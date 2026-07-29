import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  injectAdminSession,
  forceLanguage,
  routeSupabase,
  stubHeroVideoMedia,
  MOCK_PHOTOS,
} from "./_admin";

/**
 * PORT.3 — rendered-pixel parity law for VIDEO surfaces (mutation-verified).
 *
 * Every video surface now resolves its FOREGROUND geometry through
 * src/lib/hero-framing (via FramedVideo); the fit-mode side fields (HERO.WIDE.1)
 * are decorative ground, not media, and stay outside the law. Mirrors port2-parity.spec.ts
 * for the video surfaces:
 *
 *  (a) DISTORTION: the painted foreground box has the clip's NATURAL aspect —
 *      measured render-aspect / natural-aspect == 1.000 ± 0.005, fit AND fill.
 *  (b) PREDICTED == PAINTED: the measured rectangle (in % of the measured
 *      container) matches an INDEPENDENT in-spec mirror of resolveHeroGeometry
 *      fed the fixture's raw focal/zoom — within 0.5 %pt per field. The mirror
 *      is deliberately NOT imported from app code.
 *  (c) SAME ASPECT ⇒ SAME RECTANGLE: surfaces built at the identical container
 *      aspect expose byte-identical data-hero-framing strings (editor tab vs
 *      its own device thumbnail; editor Desktop tab vs a live viewport forced
 *      to the same aspect) — with the per-viewport records respected (portrait
 *      record on portrait aspects, landscape on landscape).
 *
 * Mutation verification (performed manually per PORT.3 ITEM 3, results in the
 * sprint report): hardcoding object-fit:cover onto the foreground video must
 * fail (a)/(b); hardcoding posY=50 into the video adapter call must fail
 * (b)/(c) on the panned fixture.
 */

const CINE = "/cinematic";
const HERO_VIDEO_URL = "https://cdn.example.com/hero-loop.mp4";
/* Stubbed clip metadata (stubHeroVideoMedia defaults): 1920x1080 → 16:9. */
const NAT = { w: 1920, h: 1080 };

/* Panned + zoomed records, one per orientation, covering BOTH fit modes. */
const MEDIA = {
  hero: {
    photo_id: null,
    focal: { x: 0.5, y: 0.08 },
    zoom: 1,
    video: {
      landscape: { focal: { x: 0.3, y: 0.7 }, zoom: 1.4, fit: "fill" },
      portrait: { focal: { x: 0.8, y: 0.25 }, zoom: 1.2, fit: "fit" },
    },
  },
  reel: [
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
};

type Framing = { scale: number; posX: number; posY: number; fit: "fill" | "fit" };

/* Expected resolved framing per viewport-orientation record. */
const LAND_FRAMING: Framing = { scale: 1.4, posX: 30, posY: 70, fit: "fill" };
const PORT_FRAMING: Framing = { scale: 1.2, posX: 80, posY: 25, fit: "fit" };

const attrPrefix = (f: Framing) =>
  `${f.scale.toFixed(2)};${f.posX.toFixed(0)};${f.posY.toFixed(0)};${f.fit};`;

/**
 * Independent mirror of resolveHeroGeometry (NOT imported from app code — see
 * header). Must stay byte-equivalent to src/lib/hero-framing.ts.
 */
function predict(mediaAspect: number, containerAspect: number, f: Framing) {
  const scale = Math.min(2.5, Math.max(0.5, f.scale));
  const wide = mediaAspect >= containerAspect;
  const pinWidth = f.fit === "fit" ? wide : !wide;
  const widthPct = (pinWidth ? 100 : (mediaAspect / containerAspect) * 100) * scale;
  const heightPct = (pinWidth ? (containerAspect / mediaAspect) * 100 : 100) * scale;
  const overflowX = widthPct - 100;
  const overflowY = heightPct - 100;
  const leftPct = overflowX > 0 ? -(f.posX / 100) * overflowX : (100 - widthPct) / 2;
  const topPct = overflowY > 0 ? -(f.posY / 100) * overflowY : (100 - heightPct) / 2;
  return { widthPct, heightPct, leftPct, topPct };
}

/** Wait until the surface has measured (attr present, box no longer pending). */
async function framingReady(loc: Locator) {
  await expect
    .poll(async () => (await loc.getAttribute("data-hero-framing")) ?? "absent", {
      timeout: 15_000,
    })
    .not.toMatch(/absent|pending/);
}

type Measured = {
  attr: string | null;
  natW: number;
  natH: number;
  img: { w: number; h: number; left: number; top: number };
  box: { w: number; h: number; left: number; top: number };
};

/** Measure a foreground <video> and its FramedVideo container (its parent). */
const measure = (loc: Locator): Promise<Measured> =>
  loc.first().evaluate((el) => {
    const v = el as HTMLVideoElement;
    const r = v.getBoundingClientRect();
    const p = (v.parentElement as HTMLElement).getBoundingClientRect();
    return {
      attr: v.getAttribute("data-hero-framing"),
      natW: v.videoWidth,
      natH: v.videoHeight,
      img: { w: r.width, h: r.height, left: r.left, top: r.top },
      box: { w: p.width, h: p.height, left: p.left, top: p.top },
    };
  });

/** The parity law, parts (a) + (b), for one measured surface. */
function assertParity(m: Measured, framing: Framing, label: string) {
  expect(m.natW, `${label}: natural size known`).toBeGreaterThan(0);
  const na = m.natW / m.natH;

  // (a) DISTORTION — the painted foreground box has the clip's natural aspect.
  const renderAspect = m.img.w / m.img.h;
  const distortion = renderAspect / na;
  expect(distortion, `${label}: distortion (render/natural aspect)`).toBeGreaterThan(0.995);
  expect(distortion, `${label}: distortion (render/natural aspect)`).toBeLessThan(1.005);

  // (b) PREDICTED == PAINTED — measured rectangle vs the independent mirror.
  const ca = m.box.w / m.box.h;
  const p = predict(na, ca, framing);
  const painted = {
    widthPct: (m.img.w / m.box.w) * 100,
    heightPct: (m.img.h / m.box.h) * 100,
    leftPct: ((m.img.left - m.box.left) / m.box.w) * 100,
    topPct: ((m.img.top - m.box.top) / m.box.h) * 100,
  };
  for (const k of ["widthPct", "heightPct", "leftPct", "topPct"] as const) {
    expect(
      Math.abs(painted[k] - p[k]),
      `${label}: ${k} painted=${painted[k].toFixed(2)} predicted=${p[k].toFixed(2)}`,
    ).toBeLessThanOrEqual(0.5);
  }

  // The resolved framing the surface REPORTS must be the fixture's record
  // (kills a corrupted adapter even where geometry happens to coincide).
  expect(m.attr ?? "", `${label}: resolved framing attr`).toContain(attrPrefix(framing));
}

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/**
 * Size the viewport so the DOCUMENT box (viewport minus any classic scrollbar)
 * is exactly `w` x `h` — required for (c)'s aspect-equality comparisons.
 */
async function forceDocumentSize(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(CINE, { waitUntil: "domcontentloaded" });
  await settle(page, 400);
  const sw = await page.evaluate(
    () => window.innerWidth - document.documentElement.clientWidth,
  );
  if (sw > 0) {
    await page.setViewportSize({ width: w + sw, height: h });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 400);
  }
}

const HERO_VIDEO = '[data-qa="cinematic-hero-video"]';
const EDITOR_CANVAS_VIDEO = '[data-qa="media-editor-surface"] [data-qa="media-preview-video"]';

/* Each tab edits/previews the record its aspect's ORIENTATION implies. */
const DEVICE_TABS = [
  { id: "iphone-17-pro", framing: PORT_FRAMING },
  { id: "ipad-air", framing: PORT_FRAMING },
  { id: "desktop", framing: LAND_FRAMING },
] as const;

/* The PORT.0 census viewports; orientation picks the framing record. */
const LIVE_VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, framing: PORT_FRAMING },
  { name: "1024x768", width: 1024, height: 768, framing: LAND_FRAMING },
  { name: "1600x900", width: 1600, height: 900, framing: LAND_FRAMING },
  { name: "2560x1080", width: 2560, height: 1080, framing: LAND_FRAMING },
] as const;

async function openVideoEditor(page: Page) {
  await stubHeroVideoMedia(page);
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeSupabase(page, { media: MEDIA, photos: MOCK_PHOTOS, heroVideo: HERO_VIDEO_URL });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await settle(page, 700);
  await page.locator('[data-qa="admin-nav-media"]').click();
  await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();
  // Hero slot pencil with an active video → VIDEO-mode editor.
  await page
    .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-edit"]')
    .click();
  await expect(page.locator('[data-qa="media-editor-surface"]')).toBeVisible();
  await expect(page.locator(EDITOR_CANVAS_VIDEO).first()).toBeVisible();
}

test.describe("PORT.3 — rendered-pixel parity law (video surfaces)", () => {
  test("a+b — live hero video across the four census viewports (both records, both fits)", async ({
    page,
  }) => {
    for (const vp of LIVE_VIEWPORTS) {
      await stubHeroVideoMedia(page);
      await routeSupabase(page, { media: MEDIA, photos: MOCK_PHOTOS, heroVideo: HERO_VIDEO_URL });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(CINE, { waitUntil: "domcontentloaded" });
      await settle(page, 600);
      const hero = page.locator(HERO_VIDEO).first();
      await framingReady(hero);
      const m = await measure(hero);
      expect(m.natW, `live @${vp.name}: stubbed clip metadata`).toBe(NAT.w);
      await assertParity(m, vp.framing, `live hero video @${vp.name}`);
    }
  });

  test("a+b — editor video canvas per device tab + device thumbnails", async ({ page }) => {
    await openVideoEditor(page);
    const canvas = page.locator(EDITOR_CANVAS_VIDEO).first();
    for (const tab of DEVICE_TABS) {
      await page.locator(`[data-qa="media-device-${tab.id}"]`).click();
      await page.waitForTimeout(400);
      await framingReady(canvas);
      await assertParity(await measure(canvas), tab.framing, `editor canvas ${tab.id} tab`);
    }
    // Thumbnails preview their OWN orientation's record, independent of the
    // active tab — all three are asserted in place.
    for (const tab of DEVICE_TABS) {
      const thumb = page
        .locator(`[data-qa="media-device-${tab.id}"] [data-qa="media-preview-video"]`)
        .first();
      await framingReady(thumb);
      await assertParity(await measure(thumb), tab.framing, `device thumbnail ${tab.id}`);
    }
  });

  test("c — same aspect ⇒ same rectangle (records respected, string-identical boxes)", async ({
    page,
  }) => {
    // LIVE hero video with the document box forced to exactly 1440x900 — the
    // Desktop preset's aspect (device-presets.ts). Landscape → landscape record.
    await stubHeroVideoMedia(page);
    await routeSupabase(page, { media: MEDIA, photos: MOCK_PHOTOS, heroVideo: HERO_VIDEO_URL });
    await forceDocumentSize(page, 1440, 900);
    const live = page.locator(HERO_VIDEO).first();
    await framingReady(live);
    const liveAttr = await live.getAttribute("data-hero-framing");
    expect(liveAttr, "live hero framing attr = landscape record").toContain(
      attrPrefix(LAND_FRAMING),
    );

    // EDITOR: per tab, the canvas and that tab's own thumbnail are built at the
    // same aspect → identical framing rectangles, each on the record its
    // orientation implies. Same dual-tier comparison as port2-parity: the
    // Desktop tab (both boxes on exact layout pixels) compares as a
    // byte-identical STRING — including against the live surface — while the
    // tiny phone/tablet thumbs (~18-28px, Blink 1/64-px snapping) compare box
    // fields numerically at 0.15 %pt with the framing prefix still byte-equal.
    await openVideoEditor(page);
    const canvas = page.locator(EDITOR_CANVAS_VIDEO).first();
    for (const tab of DEVICE_TABS) {
      await page.locator(`[data-qa="media-device-${tab.id}"]`).click();
      await page.waitForTimeout(400);
      await framingReady(canvas);
      const thumb = page
        .locator(`[data-qa="media-device-${tab.id}"] [data-qa="media-preview-video"]`)
        .first();
      await framingReady(thumb);
      const canvasAttr = await canvas.getAttribute("data-hero-framing");
      const thumbAttr = await thumb.getAttribute("data-hero-framing");
      expect(canvasAttr, `${tab.id}: canvas attr present`).toBeTruthy();
      expect(canvasAttr, `${tab.id}: canvas on the ${tab.framing.fit} record`).toContain(
        attrPrefix(tab.framing),
      );
      if (tab.id === "desktop") {
        expect(canvasAttr, `${tab.id}: canvas == its own device thumbnail`).toBe(thumbAttr);
        expect(
          canvasAttr,
          "editor Desktop tab == live viewport at the identical aspect",
        ).toBe(liveAttr);
      } else {
        const parse = (a: string) => {
          const i = a.lastIndexOf(";");
          return { prefix: a.slice(0, i + 1), box: a.slice(i + 1).split(",").map(Number) };
        };
        const c = parse(canvasAttr!);
        const t = parse(thumbAttr!);
        expect(c.prefix, `${tab.id}: resolved framing prefix identical`).toBe(t.prefix);
        for (let i = 0; i < 4; i++) {
          expect(
            Math.abs(c.box[i] - t.box[i]),
            `${tab.id}: box field ${i} canvas=${c.box[i]} thumb=${t.box[i]}`,
          ).toBeLessThanOrEqual(0.15);
        }
      }
    }
  });
});
