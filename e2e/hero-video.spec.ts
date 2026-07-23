import { test, expect, type Page } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";
import { routeSupabase, stubHeroVideoMedia, MOCK_PHOTOS } from "./_admin";

/**
 * ADMIN.MEDIA.2 (ITEM 3) — the live cinematic hero renders the background video
 * with its own (decoupled) framing applied, a poster for instant paint, and —
 * under reduced motion — the poster still instead of an autoplaying video.
 */
const CINE = "/cinematic";
const VIDEO = '[data-qa="cinematic-hero-video"]';
const POSTER = '[data-qa="cinematic-hero-video-poster"]';
const HERO_VIDEO_URL = "https://cdn.example.com/hero-loop.mp4";

// Decoupled video framing: focal (0.3, 0.7), zoom 1.5 — distinct from the image.
const MEDIA_WITH_VIDEO = {
  hero: {
    photo_id: null,
    focal: { x: 0.5, y: 0.08 },
    zoom: 1,
    video: { focal: { x: 0.3, y: 0.7 }, zoom: 1.5 },
  },
  reel: [
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
};

async function settle(page: Page, ms = 700) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

const objectPositionOf = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => getComputedStyle(el as HTMLElement).objectPosition);

const parentTransform = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el) => getComputedStyle((el as HTMLElement).parentElement as HTMLElement).transform);

const scaleOf = (transform: string): number => {
  if (transform === "none") return 1;
  const m = transform.match(/matrix\(([-\d.]+)/);
  return m ? parseFloat(m[1]) : NaN;
};

test.describe("MEDIA2 — hero video render (framing + dark hold)", () => {
  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`renders video with decoupled framing + dark hold — ${vp.name}`, async ({ page }) => {
      const diag = attachDiagnostics(page);
      await stubHeroVideoMedia(page);
      await routeSupabase(page, {
        media: MEDIA_WITH_VIDEO,
        photos: MOCK_PHOTOS,
        heroVideo: HERO_VIDEO_URL,
      });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(CINE, { waitUntil: "domcontentloaded" });
      await settle(page, 700);

      // The video leads the hero (image + Ken Burns are suppressed).
      await expect(page.locator(VIDEO)).toHaveCount(1);
      await expect(page.locator('[data-qa="cinematic-hero-img"]')).toHaveCount(0);

      // Decoupled video framing applied: object-position + a scale from focal.
      expect(await objectPositionOf(page, VIDEO), "video focal → object-position").toBe("30% 70%");
      expect(scaleOf(await parentTransform(page, VIDEO)), "video zoom → scale").toBeCloseTo(1.5, 1);

      // FIX.MEDIA.B: a video surface never carries the hero photo as a poster —
      // it holds dark and fades the video in. No reduced-motion still while motion is on.
      expect(await page.locator(VIDEO).getAttribute("poster"), "no poster on the video surface").toBeNull();
      await expect(page.locator(POSTER)).toHaveCount(0);

      await page.screenshot({ path: shot(`MEDIA2-hero-video-${vp.name}.png`) });
      expect(diag.consoleErrors, "console errors — hero video").toEqual([]);
      expect(diag.failedResponses, "failed requests — hero video").toEqual([]);
    });
  }

  test("reduced motion renders the poster image, not the video", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await stubHeroVideoMedia(page);
    await routeSupabase(page, {
      media: MEDIA_WITH_VIDEO,
      photos: MOCK_PHOTOS,
      heroVideo: HERO_VIDEO_URL,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 500);

    await expect(page.locator(POSTER), "reduced motion shows the poster still").toHaveCount(1);
    await expect(page.locator(VIDEO), "no autoplaying video under reduced motion").toHaveCount(0);
    // The still is framed with the SAME decoupled video focal.
    expect(await objectPositionOf(page, POSTER)).toBe("30% 70%");

    await page.screenshot({ path: shot("MEDIA2-hero-reduced-poster.png"), fullPage: true });
    expect(diag.consoleErrors, "console errors — reduced motion").toEqual([]);
    expect(diag.failedResponses, "failed requests — reduced motion").toEqual([]);
  });
});

/* ---------- ADMIN.MEDIA.3 — dual-aspect selection, back-compat, fit ---------- */
const LAND_URL = "https://cdn.example.com/hero-landscape.mp4";
const PORT_URL = "https://cdn.example.com/hero-portrait.mp4";
const dataSrc = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => (el as HTMLElement).getAttribute("data-src"));

test.describe("MEDIA3 — viewport selects the orientation source", () => {
  const media = {
    hero: {
      photo_id: null,
      focal: { x: 0.5, y: 0.08 },
      zoom: 1,
      video: {
        landscape: { focal: { x: 0.2, y: 0.3 }, zoom: 1, fit: "fill" },
        portrait: { focal: { x: 0.8, y: 0.9 }, zoom: 1, fit: "fill" },
      },
    },
    reel: [
      { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    ],
  };

  test("desktop → landscape URL+framing; phone → portrait URL+framing", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await stubHeroVideoMedia(page);
    await routeSupabase(page, {
      media,
      photos: MOCK_PHOTOS,
      heroVideo: LAND_URL,
      heroVideoPortrait: PORT_URL,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 700);

    await expect(page.locator(VIDEO)).toHaveCount(1);
    expect(await dataSrc(page, VIDEO), "desktop → landscape URL").toBe(LAND_URL);
    expect(await objectPositionOf(page, VIDEO), "desktop → landscape framing").toBe("20% 30%");
    await page.screenshot({ path: shot("MEDIA3-render-desktop.png") });

    // Resize to a portrait phone viewport → the portrait source takes over.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    expect(await dataSrc(page, VIDEO), "phone → portrait URL").toBe(PORT_URL);
    expect(await objectPositionOf(page, VIDEO), "phone → portrait framing").toBe("80% 90%");
    await page.screenshot({ path: shot("MEDIA3-render-mobile.png") });

    expect(diag.consoleErrors, "console errors — dual source").toEqual([]);
    expect(diag.failedResponses, "failed requests — dual source").toEqual([]);
  });

  test("back-compat: only the legacy single value → used at every viewport", async ({ page }) => {
    const legacyMedia = {
      hero: {
        photo_id: null,
        focal: { x: 0.5, y: 0.08 },
        zoom: 1,
        video: { focal: { x: 0.4, y: 0.6 }, zoom: 1.2 }, // legacy single shape
      },
      reel: media.reel,
    };
    await stubHeroVideoMedia(page);
    await routeSupabase(page, { media: legacyMedia, photos: MOCK_PHOTOS, heroVideo: LAND_URL });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    // Desktop uses the (migrated) landscape source + its framing.
    expect(await dataSrc(page, VIDEO)).toBe(LAND_URL);
    expect(await objectPositionOf(page, VIDEO), "legacy → landscape framing").toBe("40% 60%");
    expect(scaleOf(await parentTransform(page, VIDEO))).toBeCloseTo(1.2, 1);

    // Phone with no portrait source falls back to the same landscape clip.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    expect(await dataSrc(page, VIDEO), "phone falls back to landscape").toBe(LAND_URL);
    expect(await objectPositionOf(page, VIDEO)).toBe("40% 60%");
  });
});

test.describe("MEDIA3 — fit mode renders a blurred backdrop over an uncropped video", () => {
  test("desktop fit source shows contain foreground + blurred backdrop", async ({ page }) => {
    const diag = attachDiagnostics(page);
    const media = {
      hero: {
        photo_id: null,
        focal: { x: 0.5, y: 0.08 },
        zoom: 1,
        video: {
          landscape: { focal: { x: 0.5, y: 0.5 }, zoom: 1, fit: "fit" },
          portrait: { focal: { x: 0.5, y: 0.5 }, zoom: 1, fit: "fill" },
        },
      },
      reel: [
        { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
        { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
        { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      ],
    };
    await stubHeroVideoMedia(page);
    await routeSupabase(page, { media, photos: MOCK_PHOTOS, heroVideo: LAND_URL });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    const backdrop = page.locator('[data-qa="cinematic-hero-video-backdrop"]');
    await expect(backdrop, "fit mode adds a backdrop copy").toHaveCount(1);
    const blur = await backdrop.evaluate((el) => getComputedStyle(el as HTMLElement).filter);
    expect(blur, "backdrop is blurred").toMatch(/blur/);

    const objectFit = await page
      .locator(VIDEO)
      .first()
      .evaluate((el) => getComputedStyle(el as HTMLElement).objectFit);
    expect(objectFit, "foreground video is uncropped (contain)").toBe("contain");
    await page.screenshot({ path: shot("MEDIA3-fit-render.png") });

    expect(diag.consoleErrors, "console errors — fit render").toEqual([]);
    expect(diag.failedResponses, "failed requests — fit render").toEqual([]);
  });
});

