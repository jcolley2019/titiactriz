import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  injectAdminSession,
  forceLanguage,
  routeSupabase,
  MOCK_PHOTOS,
} from "./_admin";

/**
 * PORT.2 — rendered-pixel parity law for IMAGE surfaces (mutation-verified).
 *
 * Every image surface now resolves its geometry through src/lib/hero-framing
 * (via FramedImage). This spec asserts the law in three parts:
 *
 *  (a) DISTORTION: the painted element box has the source's NATURAL aspect —
 *      measured render-aspect / natural-aspect == 1.000 ± 0.005. (The resolver
 *      emits an explicit percentage rectangle whose aspect IS the media's; the
 *      old editor's 0.818 iPhone-tab distortion can never come back.)
 *  (b) PREDICTED == PAINTED: the measured rectangle (in % of the measured
 *      container) matches an INDEPENDENT in-spec mirror of resolveHeroGeometry
 *      fed the fixture's raw focal/zoom — within 0.5 %pt per field. The mirror
 *      is deliberately NOT imported from app code, so a corrupted adapter or a
 *      surface that stops painting what it predicts fails here.
 *  (c) SAME ASPECT ⇒ SAME RECTANGLE: surfaces built at the identical container
 *      aspect expose byte-identical data-hero-framing strings (editor tab vs
 *      its own device thumbnail; editor Desktop tab vs a live viewport forced
 *      to the same aspect). The PORT.0 cropMath drift (3.4 %pt) must be 0.
 *
 * Mutation verification (performed manually per PORT.2 ITEM 4, results in the
 * sprint report): hardcoding object-fit:cover into FramedImage must fail
 * (a)/(b); hardcoding posX=50 into framingFromFocalZoom must fail (b)/(c).
 */

const CINE = "/cinematic";

/* Known portrait source (1080x1920 → aspect 0.5625) for legible maths. */
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

/* Panned + zoomed fixture on BOTH kinds, so posX/posY corruption is visible. */
const MEDIA = {
  hero: { photo_id: "p1", focal: { x: 0.35, y: 0.7 }, zoom: 1.3 },
  reel: [
    { photo_id: "port", focal: { x: 0.8, y: 0.3 }, zoom: 1.25 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
  // ABOUT.MEDIA.1 — the opt-in 3:4 portrait panel. The portrait source at zoom
  // 1.15 in a 0.75 container overflows on BOTH axes, so posY=35 pans vertically
  // (making the posY mutation visible) while posX=50 stays centred-with-overflow.
  about: { photo_id: "port", focal: { x: 0.5, y: 0.35 }, zoom: 1.15 },
};

type Framing = { scale: number; posX: number; posY: number; fit: "fill" | "fit" };

/* Expected resolved framing per surface — straight from the fixture. */
const HERO_FRAMING: Framing = { scale: 1.3, posX: 35, posY: 70, fit: "fill" };
const REEL0_FRAMING: Framing = { scale: 1.25, posX: 80, posY: 30, fit: "fill" };
const REEL_DEFAULT_FRAMING: Framing = { scale: 1, posX: 50, posY: 50, fit: "fill" };
const ABOUT_FRAMING: Framing = { scale: 1.15, posX: 50, posY: 35, fit: "fill" };

/**
 * CINE.FLOW.5 — the reel act still has TWO true renderings, split at the 768px
 * phone breakpoint (src/components/cinematic/reelSpotlight.ts), but they no
 * longer differ in FIT. Both promoted compositions crop to their subject:
 * the phone act (V1 "Edge Veil") is edge-to-edge cover, and the wide act
 * (W2 "Center Plate & Rules") covers a bounded portrait plate. The letterbox
 * mode — and the `reelSlideFit` selector that used to choose it — is retired,
 * so the reel's expectations are one record for every surface.
 *
 * What DID move is the reel's container above the breakpoint: the wide photo is
 * now framed by the plate box, not by the viewport, so the parity law is
 * measured against the plate. The law itself is unchanged in substance —
 * whatever a surface predicts, it must paint, and the editor tab for a device
 * class must equal what that device class publishes.
 */
const PHONE_TAB = "iphone-17-pro";

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

/** Wait until the surface has decoded + measured (attr box no longer pending). */
async function framingReady(loc: Locator) {
  await expect
    .poll(async () => (await loc.getAttribute("data-hero-framing")) ?? "absent", {
      timeout: 15_000,
    })
    .not.toContain("pending");
}

type Measured = {
  attr: string | null;
  natW: number;
  natH: number;
  img: { w: number; h: number; left: number; top: number };
  box: { w: number; h: number; left: number; top: number };
};

/** Measure an <img> and its FramedImage container (the img's parent), in px. */
const measure = (loc: Locator): Promise<Measured> =>
  loc.first().evaluate((el) => {
    const img = el as HTMLImageElement;
    const r = img.getBoundingClientRect();
    const p = (img.parentElement as HTMLElement).getBoundingClientRect();
    return {
      attr: img.getAttribute("data-hero-framing"),
      natW: img.naturalWidth,
      natH: img.naturalHeight,
      img: { w: r.width, h: r.height, left: r.left, top: r.top },
      box: { w: p.width, h: p.height, left: p.left, top: p.top },
    };
  });

/** The parity law, parts (a) + (b), for one measured surface. */
function assertParity(m: Measured, framing: Framing, label: string) {
  expect(m.natW, `${label}: natural size known`).toBeGreaterThan(0);
  const na = m.natW / m.natH;

  // (a) DISTORTION — the painted box has the source's natural aspect.
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

  // The resolved framing the surface REPORTS must be the fixture's (kills a
  // corrupted adapter even where geometry happens to coincide).
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

const REEL_IMG = '[data-qa="cinematic-reel-img"]';
const HERO_IMG = '[data-qa="cinematic-hero-img"]';
const ABOUT_IMG = '[data-qa="cinematic-about-img"]';
/**
 * The FRAMED photo on the editor canvas — named explicitly because the wide
 * reel composition also paints an ambient backdrop <img>, first in DOM order.
 */
const EDITOR_CANVAS_IMG = '[data-qa="media-editor-surface"] [data-qa="media-preview-img"]';

const DEVICE_TABS = ["iphone-17-pro", "ipad-air", "desktop"] as const;

async function openAdminMedia(page: Page) {
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeSupabase(page, { media: MEDIA, photos: PHOTOS });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await settle(page, 700);
  await page.locator('[data-qa="admin-nav-media"]').click();
  await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();
}

test.describe("PORT.2 — rendered-pixel parity law (image surfaces)", () => {
  test("a+b — live reel slides: cover on a phone, cover inside the wide plate", async ({ page }) => {
    // One record per slide now, on both device classes: `measure()` reads the
    // img against ITS OWN container, which is the viewport on a phone and the
    // plate box above the breakpoint, so the same expectation holds on both.
    for (const vp of [
      { name: "1440x900", width: 1440, height: 900 },
      { name: "390x844", width: 390, height: 844 },
    ]) {
      await routeSupabase(page, { media: MEDIA, photos: PHOTOS });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(CINE, { waitUntil: "domcontentloaded" });
      await settle(page, 500);
      const reel = page.locator(REEL_IMG);
      await reel.first().scrollIntoViewIfNeeded().catch(() => {});
      await framingReady(reel.first());

      // Slide 0 carries the panned fixture; slides 1-2 the reel default.
      await assertParity(await measure(reel.nth(0)), REEL0_FRAMING, `reel[0] @${vp.name}`);
      for (const i of [1, 2]) {
        await framingReady(reel.nth(i));
        await assertParity(
          await measure(reel.nth(i)),
          REEL_DEFAULT_FRAMING,
          `reel[${i}] @${vp.name}`,
        );
      }
    }
  });

  test("a+b — live hero photo path (reduced-motion still)", async ({ page }) => {
    await routeSupabase(page, { media: MEDIA, photos: PHOTOS });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 600);
    const hero = page.locator(HERO_IMG).first();
    await framingReady(hero);
    await assertParity(await measure(hero), HERO_FRAMING, "hero @1440x900 (reduced)");
  });

  test("a+b — editor canvas per device tab (reel cover on every tab, hero fill)", async ({ page }) => {
    await openAdminMedia(page);

    // Reel-0 image editor across all three tabs.
    await page
      .locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]')
      .click();
    const canvas = page.locator(EDITOR_CANVAS_IMG);
    await expect(canvas.first()).toBeVisible();
    for (const tab of DEVICE_TABS) {
      await page.locator(`[data-qa="media-device-${tab}"]`).click();
      await page.waitForTimeout(400);
      await framingReady(canvas.first());
      // Every tab shows what its device class publishes. Post-CINE.FLOW.5 that
      // is the same framing record on all three — the wide tabs measure it
      // inside the plate, the phone tab against the full frame.
      await assertParity(await measure(canvas), REEL0_FRAMING, `editor reel-0 ${tab} tab`);
    }
    await page.locator('[data-qa="media-editor-cancel"]').click();
    await expect(page.locator('[data-qa="media-editor-surface"]')).toHaveCount(0);

    // Hero image editor on the iPhone tab — the surface that painted 0.818.
    await page
      .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-edit"]')
      .click();
    await expect(canvas.first()).toBeVisible();
    await page.locator('[data-qa="media-device-iphone-17-pro"]').click();
    await page.waitForTimeout(400);
    await framingReady(canvas.first());
    await assertParity(await measure(canvas), HERO_FRAMING, "editor hero iPhone tab");
  });

  test("a+b — manager slot cards (hero fill, reel cover per the wide act)", async ({ page }) => {
    await openAdminMedia(page);
    const cardImg = (slot: string) =>
      page.locator(`[data-qa="media-slot"][data-slot="${slot}"] img`).first();
    await framingReady(cardImg("reel-0"));
    await assertParity(await measure(cardImg("reel-0")), REEL0_FRAMING, "slot card reel-0");
    await framingReady(cardImg("hero"));
    await assertParity(await measure(cardImg("hero")), HERO_FRAMING, "slot card hero");
  });

  test("c — same aspect ⇒ same rectangle (string-identical framing boxes)", async ({ page }) => {
    // LIVE reel-0 with the document box forced to exactly 1440x900 — the
    // Desktop preset's aspect (device-presets.ts).
    await routeSupabase(page, { media: MEDIA, photos: PHOTOS });
    await forceDocumentSize(page, 1440, 900);
    const reel0 = page.locator(REEL_IMG).first();
    await reel0.scrollIntoViewIfNeeded().catch(() => {});
    await framingReady(reel0);
    const liveAttr = await reel0.getAttribute("data-hero-framing");
    expect(liveAttr, "live reel-0 framing attr").toContain(attrPrefix(REEL0_FRAMING));

    // EDITOR reel-0: per tab, the canvas and that tab's own thumbnail are built
    // at the same aspect → identical framing rectangles (cropMath drift == 0).
    // The Desktop tab (64x40 thumb, 576x360 canvas — both land on exact layout
    // pixels) is compared as a byte-identical STRING, including against the
    // live surface. The phone/tablet thumbs are ~18-28px wide, where Blink's
    // 1/64-px layout snapping shifts the measured aspect in the 4th decimal;
    // there the box fields are compared numerically at 0.15 %pt (an order of
    // magnitude under the 3.4 %pt cropMath drift this spec outlaws) with the
    // resolved framing prefix still byte-equal.
    await openAdminMedia(page);
    await page
      .locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]')
      .click();
    const canvas = page.locator(EDITOR_CANVAS_IMG).first();
    await expect(canvas).toBeVisible();
    for (const tab of DEVICE_TABS) {
      await page.locator(`[data-qa="media-device-${tab}"]`).click();
      await page.waitForTimeout(400);
      await framingReady(canvas);
      const thumb = page
        .locator(`[data-qa="media-device-${tab}"] [data-qa="media-preview-img"]`)
        .first();
      await framingReady(thumb);
      const canvasAttr = await canvas.getAttribute("data-hero-framing");
      const thumbAttr = await thumb.getAttribute("data-hero-framing");
      expect(canvasAttr, `${tab}: canvas attr present`).toBeTruthy();
      if (tab === "desktop") {
        expect(canvasAttr, `${tab}: canvas == its own device thumbnail`).toBe(thumbAttr);
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
        expect(c.prefix, `${tab}: resolved framing prefix identical`).toBe(t.prefix);
        for (let i = 0; i < 4; i++) {
          expect(
            Math.abs(c.box[i] - t.box[i]),
            `${tab}: box field ${i} canvas=${c.box[i]} thumb=${t.box[i]}`,
          ).toBeLessThanOrEqual(0.15);
        }
      }
    }
  });
});

/**
 * CINE.FLOW.5 — the reel's COMPOSITION parity, alongside its geometry.
 *
 * PORT.2 above proves the editor paints the rectangle each device class
 * publishes. This proves it paints the same LIGHT, on BOTH device classes:
 *
 *  - the phone tab mirrors V1 "Edge Veil" — one directional veil weighted to
 *    the foot of the frame, open through the top half, and a bare numeral over
 *    its title. The 4C scrim and the numeral's flanking rules are gone, so
 *    either one reappearing on this surface fails.
 *  - the wide tabs mirror W2 "Center Plate & Rules" — ambient backdrop, two
 *    vertical hairlines, a bounded plate carrying the framed photo, and the
 *    lockup captioned beneath it with two EQUAL rules. Nothing paints over the
 *    plate: a restored `WIDE_VEIL`, or any veil at all inside the plate box,
 *    fails.
 *
 * The veil contract is restated here from src/components/cinematic/
 * reelSpotlight.ts (NOT imported, same rule as `predict` above): transparent to
 * 54%, 0.16 at 70%, 0.32 at the bottom edge — a peak inside DESIGN.md's
 * mandated 0.15-0.35 band.
 */
test.describe("CINE.FLOW.5 — reel composition parity (editor device tabs)", () => {
  const PREVIEW = '[data-qa="media-editor-surface"] [data-qa="media-preview"]';
  const VEIL = '[data-qa="reel-veil"]';
  const LOCKUP = '[data-qa="reel-lockup"]';
  const RETIRED_SCRIM = '[data-qa="reel-lockup-scrim"]';
  const RETIRED_RULE = '[data-qa="reel-rule"]';
  const PLATE = '[data-qa="wide-plate"]';
  const WIDE_RULE = '[data-qa="wide-rule"]';
  const WIDE_LOCKUP_RULE = '[data-qa="wide-lockup-rule"]';
  const VEIL_PEAK = 0.32;

  /** Alpha stops of a linear-gradient, in source order. */
  const alphaStops = (bg: string) =>
    Array.from(bg.matchAll(/rgba?\(([^)]*)\)/g)).map((m) => {
      const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
      return parts.length > 3 ? parts[3] : 1;
    });

  test("phone tab: V1 edge veil, no scrim, no rules", async ({ page }) => {
    await openAdminMedia(page);
    await page
      .locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]')
      .click();
    const preview = page.locator(PREVIEW).first();
    await expect(preview).toBeVisible();

    await page.locator(`[data-qa="media-device-${PHONE_TAB}"]`).click();
    await page.waitForTimeout(400);
    await framingReady(page.locator(EDITOR_CANVAS_IMG).first());

    const radials = await preview.evaluate((el) =>
      Array.from(el.querySelectorAll("*"))
        .map((n) => getComputedStyle(n as HTMLElement).backgroundImage)
        .filter((bg) => bg.includes("radial-gradient")),
    );
    expect(radials, "the retired focal beam is not back").toEqual([]);
    await expect(preview.locator(RETIRED_SCRIM), "the 4C scrim is retired").toHaveCount(0);
    await expect(preview.locator(RETIRED_RULE), "the phone numeral has no rules").toHaveCount(0);

    // The edge veil: full frame, transparent at the top, peaking at 0.32.
    await expect(preview.locator(VEIL), "the phone tab draws the edge veil").toHaveCount(1);
    const pbox = (await preview.boundingBox())!;
    const vbox = (await preview.locator(VEIL).boundingBox())!;
    expect(vbox.width, "veil spans the full width").toBeGreaterThanOrEqual(pbox.width - 1);
    expect(vbox.height, "veil spans the full height").toBeGreaterThanOrEqual(pbox.height - 1);

    const bg = await preview
      .locator(VEIL)
      .evaluate((el) => getComputedStyle(el as HTMLElement).backgroundImage);
    const stops = alphaStops(bg);
    expect(stops.length, "veil ramp has stops").toBeGreaterThan(3);
    expect(stops[0], "veil is transparent at the top edge").toBe(0);
    expect(stops[stops.length - 1], "veil peaks at the bottom edge").toBeCloseTo(VEIL_PEAK, 3);
    expect(Math.max(...stops), "veil never exceeds the mandated band").toBeLessThanOrEqual(0.35);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i], `stop ${i} never lightens`).toBeGreaterThanOrEqual(stops[i - 1]);
    }

    await expect(preview.locator(LOCKUP), "the phone lockup is drawn").toHaveCount(1);
  });

  test("wide tabs: W2 plate, unveiled, equal lockup rules — and none of the phone act", async ({
    page,
  }) => {
    await openAdminMedia(page);
    await page
      .locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]')
      .click();
    const preview = page.locator(PREVIEW).first();
    await expect(preview).toBeVisible();

    for (const tab of ["ipad-air", "desktop"] as const) {
      await page.locator(`[data-qa="media-device-${tab}"]`).click();
      await page.waitForTimeout(400);
      await framingReady(page.locator(EDITOR_CANVAS_IMG).first());

      // The phone act does not leak upward.
      await expect(preview.locator(VEIL), `${tab}: no phone edge veil`).toHaveCount(0);
      await expect(preview.locator(LOCKUP), `${tab}: no phone lockup`).toHaveCount(0);
      await expect(preview.locator(RETIRED_SCRIM), `${tab}: no scrim`).toHaveCount(0);

      // The plate composition is drawn.
      await expect(preview.locator('[data-qa="wide-backdrop"]'), `${tab}: ambient backdrop`)
        .toHaveCount(1);
      await expect(preview.locator(WIDE_RULE), `${tab}: two vertical hairlines`).toHaveCount(2);
      await expect(preview.locator(PLATE), `${tab}: one plate`).toHaveCount(1);

      // UNVEILED — nothing with a gradient paints inside the plate box.
      const veilsInPlate = await preview.locator(PLATE).evaluate((el) =>
        Array.from(el.querySelectorAll("*"))
          .map((n) => getComputedStyle(n as HTMLElement).backgroundImage)
          .filter((bg) => bg.includes("gradient")),
      );
      expect(veilsInPlate, `${tab}: the plate photograph is unveiled`).toEqual([]);

      // The plate holds the framed photo, and honours the portrait aspect.
      await expect(
        preview.locator(`${PLATE} img`),
        `${tab}: the framed photo lives inside the plate`,
      ).toHaveCount(1);
      const plateBox = (await preview.locator(PLATE).boundingBox())!;
      expect(
        plateBox.width / plateBox.height,
        `${tab}: plate aspect ${(plateBox.width / plateBox.height).toFixed(4)}`,
      ).toBeCloseTo(0.563, 2);

      // The lockup's two rules are equal.
      const rules = await preview
        .locator(WIDE_LOCKUP_RULE)
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
      expect(rules.length, `${tab}: two flanking rules`).toBe(2);
      expect(rules[1], `${tab}: the numeral's rules are equal`).toBeCloseTo(rules[0], 1);
    }
  });
});

/**
 * ABOUT.MEDIA.1 (ITEM 4) — the same rendered-pixel parity law, extended to the
 * opt-in About portrait panel. The panel is fixed 3:4 EVERYWHERE (card thumbnail
 * ≡ editor canvas ≡ live panel), so it needs no device tabs and the editor
 * canvas and live panel — both 3:4, same photo, same focal/zoom — expose a
 * BYTE-IDENTICAL data-hero-framing string, the strongest form of part (c).
 *
 * Mutation verification (manual, results in the sprint report): forcing posY=50
 * into CinematicAbout's FramedImage focal must fail the live (a)/(b) parity and
 * the byte-identical editor==live equality; reverting restores green.
 */
test.describe("ABOUT.MEDIA.1 — parity law (About portrait panel)", () => {
  test("a+b — live About panel paints at natural aspect (desktop + mobile)", async ({ page }) => {
    // Reduced motion keeps the panel static (no Lenis/pins) so the bottom-of-page
    // section is measurable at both widths; the parity maths are motion-agnostic.
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const vp of [
      { name: "1440x900", width: 1440, height: 900 },
      { name: "390x844", width: 390, height: 844 },
    ]) {
      await routeSupabase(page, { media: MEDIA, photos: PHOTOS });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(CINE, { waitUntil: "domcontentloaded" });
      await settle(page, 500);
      const panel = page.locator(ABOUT_IMG).first();
      await panel.scrollIntoViewIfNeeded().catch(() => {});
      await framingReady(panel);
      await assertParity(await measure(panel), ABOUT_FRAMING, `about @${vp.name}`);
    }
  });

  test("a+b — About slot card + editor canvas (3:4 fill, no device tabs)", async ({ page }) => {
    await openAdminMedia(page);

    // Slot card thumbnail — the About card renders the framed 3:4 panel.
    const card = page.locator('[data-qa="media-slot"][data-slot="about"] img').first();
    await framingReady(card);
    await assertParity(await measure(card), ABOUT_FRAMING, "slot card about");

    // Editor canvas — one fixed 3:4 canvas, the device-tab row is hidden.
    await page
      .locator('[data-qa="media-slot"][data-slot="about"] [data-qa="media-slot-edit"]')
      .click();
    const canvas = page.locator(EDITOR_CANVAS_IMG).first();
    await expect(canvas).toBeVisible();
    await expect(
      page.locator('[data-qa="media-editor-devices"]'),
      "About editor hides the device tabs (one 3:4 canvas is the contract)",
    ).toHaveCount(0);
    await framingReady(canvas);
    await assertParity(await measure(canvas), ABOUT_FRAMING, "editor about canvas");
  });

  test("c — About editor canvas == live panel (byte-identical 3:4 framing)", async ({ page }) => {
    // LIVE panel at 1440x900 — the desktop grid resolves the panel column to a
    // clean 400px 3:4 box.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await routeSupabase(page, { media: MEDIA, photos: PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 500);
    const panel = page.locator(ABOUT_IMG).first();
    await panel.scrollIntoViewIfNeeded().catch(() => {});
    await framingReady(panel);
    const liveAttr = await panel.getAttribute("data-hero-framing");
    expect(liveAttr, "live About framing attr").toContain(attrPrefix(ABOUT_FRAMING));

    // EDITOR canvas — same media + same 3:4 container + same focal/zoom ⇒ a
    // byte-identical data-hero-framing string (the PORT.2 part-c law, strongest
    // form: both surfaces are literally 3:4).
    await openAdminMedia(page);
    await page
      .locator('[data-qa="media-slot"][data-slot="about"] [data-qa="media-slot-edit"]')
      .click();
    const canvas = page.locator(EDITOR_CANVAS_IMG).first();
    await expect(canvas).toBeVisible();
    await framingReady(canvas);
    const canvasAttr = await canvas.getAttribute("data-hero-framing");
    expect(canvasAttr, "editor About canvas == live About panel (both 3:4)").toBe(liveAttr);
  });
});
