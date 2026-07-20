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

test.describe("MEDIA2 — hero video render (framing + poster)", () => {
  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`renders video with decoupled framing + poster — ${vp.name}`, async ({ page }) => {
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

      // Poster present for instant paint; no reduced-motion still while motion is on.
      expect(await page.locator(VIDEO).getAttribute("poster"), "poster for instant paint").toBeTruthy();
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
