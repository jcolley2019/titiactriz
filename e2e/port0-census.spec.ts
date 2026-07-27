import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { QA_DIR, ensureQaDir } from "./_helpers";
import {
  injectAdminSession,
  forceLanguage,
  routeSupabase,
  stubHeroVideoMedia,
  MOCK_PHOTOS,
} from "./_admin";

/**
 * PORT.0 — media parity census (record-only).
 *
 * A render-probe sweep across every surface that paints hero/reel media. For
 * each surface × condition it measures — from the LIVE DOM, in MEASURED PIXELS,
 * never attribute strings — the natural media size, the clip-container rect, the
 * painted element rect, computed object-fit/position, the effective ancestor
 * scale, and derives the VISIBLE SOURCE REGION {x%,y%,w%,h%} of the source that
 * actually reaches the screen. Nothing is asserted about the numbers: the census
 * RECORDS them (→ _qa/port0-census.json + a printed fingerprint table) so the
 * before-state is pinned before PORT.1 lands the shared resolver.
 *
 * The probe is deliberately generic (cover/contain/fill aware) so it reports the
 * truth of whatever each surface happens to do today — including divergence and
 * distortion — rather than assuming the model.
 */

const CINE = "/cinematic";

/* A known portrait source (9:16) so the visible-region maths are legible. */
const PORTRAIT_PHOTO = {
  id: "port",
  image_url:
    "data:image/svg+xml," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'>" +
        "<rect width='100%' height='100%' fill='indigo'/></svg>",
    ),
  alt_text: "port",
};
const PHOTOS = [PORTRAIT_PHOTO, ...MOCK_PHOTOS];

const HERO_VIDEO_URL = "https://cdn.example.com/hero-loop.mp4";

/* Fixture: reel slot 0 pinned to the known portrait photo; hero video carries a
   distinct landscape framing record. Everything else default.

   FRAME.SPLIT.1 — reel slot 0 is deliberately left in the LEGACY single-record
   shape. This census sweeps every surface that paints reel media, so keeping it
   pre-split means the whole sweep is a standing check on the compatibility law:
   if any surface ever stopped seeding both classes from that one record, it
   would show up here as a framing change on that surface alone. The per-class
   fixture lives in port2-parity.spec.ts, and the law itself in framesplit. */
const MEDIA = {
  hero: {
    photo_id: null,
    focal: { x: 0.5, y: 0.08 },
    zoom: 1,
    video: {
      landscape: { focal: { x: 0.5, y: 0.35 }, zoom: 1.2, fit: "fill" },
      portrait: { focal: { x: 0.5, y: 0.5 }, zoom: 1, fit: "fill" },
    },
  },
  reel: [
    { photo_id: "port", focal: { x: 0.5, y: 0.3 }, zoom: 1.25 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
};

const LIVE_VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1600x900", width: 1600, height: 900 },
  { name: "2560x1080", width: 2560, height: 1080 },
];

type Region = { x: number; y: number; w: number; h: number };
type Record = {
  surface: string;
  condition: string;
  ok: boolean;
  note?: string;
  natural?: { w: number; h: number };
  naturalAspect?: number;
  container?: { w: number; h: number };
  containerAspect?: number;
  element?: { w: number; h: number };
  scale?: { sx: number; sy: number };
  objectFit?: string;
  objectPosition?: string;
  visible?: Region;
  fill?: { x: number; y: number };
  distortion?: number;
};

const records: Record[] = [];

/**
 * The in-page probe. Given a media element and a clip element (or null → the
 * viewport), returns the measured geometry + derived visible source region.
 * Runs entirely on measured rects + computed style + intrinsic dimensions.
 */
async function probe(
  page: Page,
  surface: string,
  condition: string,
  mediaSel: string,
  clipSel: string | null,
): Promise<Record> {
  const raw = await page.evaluate(
    ({ mediaSel, clipSel }) => {
      const m = document.querySelector(mediaSel) as
        | (HTMLElement & { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number })
        | null;
      if (!m) return { err: "media-not-found" as const };
      const nat = {
        w: (m.naturalWidth || (m as HTMLVideoElement).videoWidth || 0) as number,
        h: (m.naturalHeight || (m as HTMLVideoElement).videoHeight || 0) as number,
      };
      if (!nat.w || !nat.h) return { err: "no-natural-size" as const };

      const r = m.getBoundingClientRect();
      const clipEl = clipSel ? (document.querySelector(clipSel) as HTMLElement | null) : null;
      if (clipSel && !clipEl) return { err: "clip-not-found" as const };
      const clip = clipEl
        ? clipEl.getBoundingClientRect()
        : ({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight } as DOMRect);

      const cs = getComputedStyle(m);
      const fit = cs.objectFit || "fill";
      // object-position → fractions 0..1 (our surfaces always emit "x% y%").
      const parsePos = (v: string): [number, number] => {
        const parts = v.trim().split(/\s+/);
        const frac = (s: string, extentBox: number, extentContent: number): number => {
          if (s.endsWith("%")) return parseFloat(s) / 100;
          if (s.endsWith("px")) {
            const denom = extentBox - extentContent;
            return denom !== 0 ? parseFloat(s) / denom : 0.5;
          }
          if (s === "left" || s === "top") return 0;
          if (s === "right" || s === "bottom") return 1;
          if (s === "center") return 0.5;
          return 0.5;
        };
        const px = parts[0] ?? "50%";
        const py = parts[1] ?? "50%";
        return [frac(px, r.width, 0), frac(py, r.height, 0)];
      };
      const [pfx, pfy] = parsePos(cs.objectPosition || "50% 50%");

      const na = nat.w / nat.h;
      // Painted content size within the element box (screen px, post-transform).
      let cw: number, ch: number;
      if (fit === "cover") {
        const s = Math.max(r.width / nat.w, r.height / nat.h);
        cw = nat.w * s;
        ch = nat.h * s;
      } else if (fit === "contain") {
        const s = Math.min(r.width / nat.w, r.height / nat.h);
        cw = nat.w * s;
        ch = nat.h * s;
      } else {
        // fill / none / react-easy-crop: the whole source maps to the element box.
        cw = r.width;
        ch = r.height;
      }
      // For %-based object-position the offset uses (box - content).
      const offX = (r.width - cw) * pfx;
      const offY = (r.height - ch) * pfy;
      const contentLeft = r.left + offX;
      const contentTop = r.top + offY;

      const inter = (
        a: { l: number; t: number; r: number; b: number },
        b: { l: number; t: number; r: number; b: number },
      ) => ({
        l: Math.max(a.l, b.l),
        t: Math.max(a.t, b.t),
        r: Math.min(a.r, b.r),
        b: Math.min(a.b, b.b),
      });
      const elBox = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      const clipBox = { l: clip.left, t: clip.top, r: clip.right, b: clip.bottom };
      const contentBox = { l: contentLeft, t: contentTop, r: contentLeft + cw, b: contentTop + ch };
      const v = inter(inter(elBox, clipBox), contentBox);
      const vw = Math.max(0, v.r - v.l);
      const vh = Math.max(0, v.b - v.t);

      const visible = {
        x: ((v.l - contentLeft) / cw) * 100,
        y: ((v.t - contentTop) / ch) * 100,
        w: (vw / cw) * 100,
        h: (vh / ch) * 100,
      };

      // Effective cumulative ancestor scale (uniform vs not).
      const offW = (m as HTMLElement).offsetWidth || r.width;
      const offH = (m as HTMLElement).offsetHeight || r.height;
      const sx = offW ? r.width / offW : 1;
      const sy = offH ? r.height / offH : 1;

      const contentAspect = ch !== 0 ? cw / ch : na;
      const distortion = na !== 0 ? contentAspect / na : 1;

      return {
        natural: nat,
        naturalAspect: na,
        container: { w: clip.width, h: clip.height },
        containerAspect: clip.height ? clip.width / clip.height : 0,
        element: { w: r.width, h: r.height },
        scale: { sx, sy },
        objectFit: fit,
        objectPosition: cs.objectPosition,
        visible,
        fill: { x: (r.width / clip.width) * 100, y: (r.height / clip.height) * 100 },
        distortion,
      };
    },
    { mediaSel, clipSel },
  );

  if ("err" in raw) {
    const rec: Record = { surface, condition, ok: false, note: raw.err };
    records.push(rec);
    return rec;
  }
  const rec: Record = { surface, condition, ok: true, ...raw };
  records.push(rec);
  return rec;
}

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

const nearestOverflowClip = async (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => {
    let n: HTMLElement | null = el.parentElement;
    while (n) {
      const o = getComputedStyle(n).overflow;
      if (o === "hidden" || o === "clip") return true;
      n = n.parentElement;
    }
    return false;
  });

test.describe("PORT.0 — media parity census (record-only)", () => {
  /* ---------- A. LIVE reel slide 1 (slot 0) at four viewports ---------- */
  test("A — live reel slot-0 across viewports", async ({ page }) => {
    for (const vp of LIVE_VIEWPORTS) {
      await routeSupabase(page, { media: MEDIA, photos: PHOTOS });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(CINE, { waitUntil: "domcontentloaded" });
      await settle(page, 500);
      const reel = page.locator('[data-qa="cinematic-reel-img"]').first();
      await reel.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      // Clip = the nearest overflow-hidden stage; the census uses the viewport
      // box for full-bleed live surfaces (the stage fills it).
      const rec = await probe(page, "LIVE reel[0]", vp.name, '[data-qa="cinematic-reel-img"]', null);
      rec.note = (await nearestOverflowClip(page, '[data-qa="cinematic-reel-img"]')) ? "clipped-stage" : "no-clip";
    }
    expect(records.filter((r) => r.surface === "LIVE reel[0]").length).toBe(LIVE_VIEWPORTS.length);
  });

  /* ---------- B. LIVE hero video at four viewports ---------- */
  test("B — live hero video across viewports", async ({ page }) => {
    for (const vp of LIVE_VIEWPORTS) {
      await stubHeroVideoMedia(page);
      await routeSupabase(page, { media: MEDIA, photos: PHOTOS, heroVideo: HERO_VIDEO_URL });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(CINE, { waitUntil: "domcontentloaded" });
      await settle(page, 600);
      const orientation = vp.height > vp.width ? "portrait" : "landscape";
      const rec = await probe(page, "LIVE hero video", vp.name, '[data-qa="cinematic-hero-video"]', null);
      rec.note = `record=${orientation}`;
    }
    expect(records.filter((r) => r.surface === "LIVE hero video").length).toBe(LIVE_VIEWPORTS.length);
  });

  /* ---------- Shared admin bootstrap ---------- */
  async function openAdminMedia(page: Page, opts: { heroVideo?: string } = {}) {
    await stubHeroVideoMedia(page);
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: MEDIA, photos: PHOTOS, heroVideo: opts.heroVideo ?? null });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 700);
    await page.locator('[data-qa="admin-nav-media"]').click();
    await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();
  }

  const DEVICE_TABS = [
    { id: "iphone-17-pro", label: "iPhone", orient: "portrait" },
    { id: "ipad-air", label: "iPad", orient: "portrait" },
    { id: "desktop", label: "Desktop", orient: "landscape" },
  ];

  /* ---------- C. ADMIN FramingEditor, IMAGE mode, reel slot 0 ---------- */
  test("C — admin framing editor (image) reel-0 per device tab", async ({ page }) => {
    await openAdminMedia(page);
    await page.locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]').click();
    const surface = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface).toBeVisible();
    await page.waitForTimeout(700); // decode + crop mount

    for (const tab of DEVICE_TABS) {
      await page.locator(`[data-qa="media-device-${tab.id}"]`).click();
      await page.waitForTimeout(500);
      // PORT.2: the image canvas is the resolver-driven SectionPreview surface
      // (react-easy-crop is gone) — probe the framed img against its preview box.
      const rec = await probe(
        page,
        "EDITOR image reel-0",
        `${tab.label} tab`,
        '[data-qa="media-editor-surface"] [data-qa="media-preview-img"]',
        '[data-qa="media-editor-surface"] [data-qa="media-preview"]',
      );
      rec.note = `${tab.orient} canvas`;
      // Non-uniform-scale probe for the iPhone tab (Joey observed visible stretch).
      if (tab.id === "iphone-17-pro" && rec.ok && rec.scale) {
        rec.note += ` | stretch sx/sy=${(rec.scale.sx / rec.scale.sy).toFixed(3)}`;
      }
    }
    expect(records.filter((r) => r.surface === "EDITOR image reel-0").length).toBe(3);
  });

  /* ---------- D. ADMIN FramingEditor, VIDEO mode, hero ---------- */
  test("D — admin framing editor (video) hero per device tab", async ({ page }) => {
    await openAdminMedia(page, { heroVideo: HERO_VIDEO_URL });
    await page.locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-edit"]').click();
    const surface = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface).toBeVisible();
    await expect(surface.locator('[data-qa="media-preview-video"]').first()).toBeVisible();
    await page.waitForTimeout(500);

    for (const tab of DEVICE_TABS) {
      await page.locator(`[data-qa="media-device-${tab.id}"]`).click();
      await page.waitForTimeout(500);
      const rec = await probe(
        page,
        "EDITOR video hero",
        `${tab.label} tab`,
        '[data-qa="media-editor-surface"] [data-qa="media-preview-video"]',
        '[data-qa="media-editor-surface"]',
      );
      rec.note = `${tab.orient} canvas`;
    }
    expect(records.filter((r) => r.surface === "EDITOR video hero").length).toBe(3);
  });

  /* ---------- E. SectionPreview device thumbnails + reel-0 slot card ---------- */
  test("E — device thumbnails + reel-0 slot card", async ({ page }) => {
    await openAdminMedia(page);

    // Reel-0 slot card thumbnail (FramedImage in an aspect-[3/4] clip).
    const slotCard = page.locator('[data-qa="media-slot"][data-slot="reel-0"]');
    await expect(slotCard).toBeVisible();
    await page.waitForTimeout(400);
    const cardRec = await probe(
      page,
      "SLOT card reel-0",
      "aspect-3/4",
      '[data-qa="media-slot"][data-slot="reel-0"] img',
      '[data-qa="media-slot"][data-slot="reel-0"] .aspect-\\[3\\/4\\]',
    );
    cardRec.note = "slot thumbnail";

    // Open the reel-0 editor to reach the device-tab thumbnails.
    await slotCard.locator('[data-qa="media-slot-edit"]').click();
    await expect(page.locator('[data-qa="media-editor-surface"]')).toBeVisible();
    await page.waitForTimeout(600);

    for (const tab of DEVICE_TABS) {
      // Each tab hosts a small SectionPreview thumbnail; measure its framed img
      // against the thumbnail box.
      const rec = await probe(
        page,
        "THUMB reel-0",
        `${tab.label} tab`,
        `[data-qa="media-device-${tab.id}"] [data-qa="media-preview-img"]`,
        `[data-qa="media-device-${tab.id}"] [data-qa="media-preview"]`,
      );
      rec.note = `${tab.orient} thumb`;
    }
    expect(records.filter((r) => r.surface === "THUMB reel-0").length).toBe(3);
  });

  /* ---------- Emit: JSON + compact fingerprint table + divergences ---------- */
  test.afterAll(async () => {
    ensureQaDir();
    const out = path.join(QA_DIR, "port0-census.json");
    fs.writeFileSync(out, JSON.stringify(records, null, 2), "utf8");

    const fp = (r: Record) =>
      r.ok && r.visible
        ? `x${r.visible.x.toFixed(0)} y${r.visible.y.toFixed(0)} w${r.visible.w.toFixed(0)} h${r.visible.h.toFixed(0)}`
        : `— (${r.note ?? "no-data"})`;

    const rows = records.map((r) => ({
      surface: r.surface,
      cond: r.condition,
      contA: r.containerAspect ? r.containerAspect.toFixed(2) : "—",
      natA: r.naturalAspect ? r.naturalAspect.toFixed(2) : "—",
      fit: r.objectFit ?? "—",
      pos: r.objectPosition ?? "—",
      "visible x/y/w/h %": fp(r),
      distort: r.distortion !== undefined ? r.distortion.toFixed(3) : "—",
      notes: r.note ?? "",
    }));

    // eslint-disable-next-line no-console
    console.log("\n================ PORT.0 FINGERPRINT TABLE ================");
    // eslint-disable-next-line no-console
    console.table(rows);
    // eslint-disable-next-line no-console
    console.log(`\nRaw numbers → ${out}`);

    // Highlight the requested divergences (record-only, no assertions).
    const byKey = (s: string, c: string) => records.find((r) => r.surface === s && r.condition === c);
    const dist = (a?: Region, b?: Region) =>
      a && b
        ? Math.max(
            Math.abs(a.x - b.x),
            Math.abs(a.y - b.y),
            Math.abs(a.w - b.w),
            Math.abs(a.h - b.h),
          )
        : NaN;

    const cmps: { label: string; delta: number }[] = [];
    const liveWide = byKey("LIVE hero video", "2560x1080");
    const editorDeskVid = byKey("EDITOR video hero", "Desktop tab");
    if (liveWide?.visible && editorDeskVid?.visible)
      cmps.push({ label: "live@2560x1080 video vs editor Desktop tab (video)", delta: dist(liveWide.visible, editorDeskVid.visible) });

    const liveReelWide = byKey("LIVE reel[0]", "2560x1080");
    const thumbDesk = byKey("THUMB reel-0", "Desktop tab");
    if (liveReelWide?.visible && thumbDesk?.visible)
      cmps.push({ label: "live reel@2560x1080 vs Desktop thumbnail", delta: dist(liveReelWide.visible, thumbDesk.visible) });

    const editorImgDesk = byKey("EDITOR image reel-0", "Desktop tab");
    if (editorImgDesk?.visible && thumbDesk?.visible)
      cmps.push({ label: "editor image Desktop tab vs Desktop thumbnail (same aspect)", delta: dist(editorImgDesk.visible, thumbDesk.visible) });

    const editorImgPhone = byKey("EDITOR image reel-0", "iPhone tab");
    const liveReelPhone = byKey("LIVE reel[0]", "390x844");
    if (editorImgPhone?.visible && liveReelPhone?.visible)
      cmps.push({ label: "editor image iPhone tab vs live reel@390x844", delta: dist(editorImgPhone.visible, liveReelPhone.visible) });

    const slotCard = byKey("SLOT card reel-0", "aspect-3/4");
    if (slotCard?.visible && liveReelPhone?.visible)
      cmps.push({ label: "reel-0 slot card vs live reel@390x844", delta: dist(slotCard.visible, liveReelPhone.visible) });

    cmps.sort((a, b) => b.delta - a.delta);
    // eslint-disable-next-line no-console
    console.log("\n---- DIVERGENCES (max Δ of any visible-region field, %pts) ----");
    for (const c of cmps) {
      // eslint-disable-next-line no-console
      console.log(`  ${c.delta.toFixed(1).padStart(6)}   ${c.label}`);
    }

    const distortions = records.filter((r) => r.ok && r.distortion !== undefined && Math.abs((r.distortion as number) - 1) > 0.01);
    // eslint-disable-next-line no-console
    console.log("\n---- DISTORTION ≠ 1.00 ----");
    if (distortions.length === 0) {
      // eslint-disable-next-line no-console
      console.log("  none — every surface paints its source at its natural aspect");
    } else {
      for (const r of distortions) {
        // eslint-disable-next-line no-console
        console.log(`  ${(r.distortion as number).toFixed(3)}  ${r.surface} / ${r.condition}`);
      }
    }
    // eslint-disable-next-line no-console
    console.log("==========================================================\n");
  });
});
