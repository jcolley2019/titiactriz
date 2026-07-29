import { test, expect, type Page } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";
import { routeSupabase, stubHeroVideoMedia, MOCK_PHOTOS } from "./_admin";

/**
 * VID.MODEL.1 — the live cinematic hero renders ONE background video. The same
 * clip plays on every screen; the VIEWPORT orientation picks which framing
 * record applies to it (portrait viewports read `portrait`, landscape viewports
 * read `landscape`). FIX.MEDIA.B: a video surface never paints the photo — it
 * dark-holds then fades in; the photo is only the reduced-motion still.
 */
const CINE = "/cinematic";
const VIDEO = '[data-qa="cinematic-hero-video"]';
const POSTER = '[data-qa="cinematic-hero-video-poster"]';
const HERO_IMG = '[data-qa="cinematic-hero-img"]';
const HERO_VIDEO_URL = "https://cdn.example.com/hero-loop.mp4";
const PORT_URL = "https://cdn.example.com/hero-portrait.mp4";

// One video, two DISTINCT per-viewport framing records.
const MEDIA_TWO_RECORDS = {
  hero: {
    photo_id: null,
    focal: { x: 0.5, y: 0.08 },
    zoom: 1,
    video: {
      landscape: { focal: { x: 0.2, y: 0.3 }, zoom: 1.5, fit: "fill" },
      portrait: { focal: { x: 0.8, y: 0.9 }, zoom: 1, fit: "fill" },
    },
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

// PORT.3: the foreground video resolves through hero-framing and exposes its
// resolved framing as `data-hero-framing` = "scale;posX;posY;fit;box" — record
// selection is asserted on that contract, not on CSS object-position/transform.
const framingAttr = (page: Page, sel: string) =>
  page.locator(sel).first().getAttribute("data-hero-framing");

const dataSrc = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => (el as HTMLElement).getAttribute("data-src"));

test.describe("VID.MODEL.1 — one video, framing by viewport orientation", () => {
  for (const vp of [
    {
      name: "desktop",
      width: 1440,
      height: 900,
      framing: "1.50;20;30;fill;", // landscape record (scale;posX;posY;fit)
    },
    {
      name: "mobile",
      width: 390,
      height: 844,
      framing: "1.00;80;90;fill;", // portrait record
    },
  ]) {
    test(`same clip, ${vp.name} viewport applies its own framing + dark hold`, async ({ page }) => {
      const diag = attachDiagnostics(page);
      await stubHeroVideoMedia(page);
      await routeSupabase(page, {
        media: MEDIA_TWO_RECORDS,
        photos: MOCK_PHOTOS,
        heroVideo: HERO_VIDEO_URL,
      });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(CINE, { waitUntil: "domcontentloaded" });
      await settle(page, 700);

      // The video leads the hero (image + Ken Burns are suppressed).
      await expect(page.locator(VIDEO)).toHaveCount(1);
      await expect(page.locator('[data-qa="cinematic-hero-img"]')).toHaveCount(0);

      // ONE video: the same clip regardless of viewport.
      expect(await dataSrc(page, VIDEO), "the single video plays on every screen").toBe(HERO_VIDEO_URL);

      // The viewport's orientation picks the framing record.
      await expect
        .poll(async () => (await framingAttr(page, VIDEO)) ?? "absent", {
          timeout: 10_000,
        })
        .toContain(vp.framing);

      // FIX.MEDIA.B: a video surface never carries the hero photo as a poster —
      // it holds dark and fades the video in. No reduced-motion still while motion is on.
      expect(await page.locator(VIDEO).getAttribute("poster"), "no poster on the video surface").toBeNull();
      await expect(page.locator(POSTER)).toHaveCount(0);

      await page.screenshot({ path: shot(`VIDMODEL-hero-${vp.name}.png`) });
      expect(diag.consoleErrors, "console errors — hero video").toEqual([]);
      expect(diag.failedResponses, "failed requests — hero video").toEqual([]);
    });
  }

  test("resizing across the orientation boundary re-keys the framing (same clip)", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await stubHeroVideoMedia(page);
    await routeSupabase(page, {
      media: MEDIA_TWO_RECORDS,
      photos: MOCK_PHOTOS,
      heroVideo: HERO_VIDEO_URL,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 700);

    expect(await dataSrc(page, VIDEO)).toBe(HERO_VIDEO_URL);
    await expect
      .poll(async () => (await framingAttr(page, VIDEO)) ?? "absent", { timeout: 10_000 })
      .toContain("1.50;20;30;fill;");

    // Resize to a portrait phone → the SAME clip, but the portrait framing record.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    expect(await dataSrc(page, VIDEO), "still the same single clip").toBe(HERO_VIDEO_URL);
    await expect
      .poll(async () => (await framingAttr(page, VIDEO)) ?? "absent", { timeout: 10_000 })
      .toContain("1.00;80;90;fill;");

    expect(diag.consoleErrors, "console errors — re-key").toEqual([]);
    expect(diag.failedResponses, "failed requests — re-key").toEqual([]);
  });

  // FIX.MEDIA.D — the load-race flash. gallery_photos resolves immediately while
  // the site_settings reads (video/photo) are held ~400ms. On the old sequential
  // fetch the hero committed photos first, so the photo branch painted a frame
  // before videoSrc arrived. With the parallel single-commit fetch the page
  // learns photos + video together, so the photo hero must NEVER paint.
  test("photo branch never paints while a configured video's setting is still loading", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await stubHeroVideoMedia(page);
    await routeSupabase(page, {
      media: MEDIA_TWO_RECORDS,
      photos: MOCK_PHOTOS,
      heroVideo: HERO_VIDEO_URL,
    });
    // Delay ONLY site_settings; gallery_photos still resolves immediately. The
    // window is wide (1.5s) so it comfortably spans the app boot + the fast
    // gallery_photos resolve — that post-boot gap is exactly where the old
    // sequential fetch painted the Ken Burns photo.
    const SETTINGS_DELAY = 1500;
    await page.route("**/rest/v1/site_settings**", async (route) => {
      await new Promise((r) => setTimeout(r, SETTINGS_DELAY));
      await route.fallback();
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "commit" });
    // The cinematic root mounts synchronously (before any data); start sampling
    // only once it exists so the window tracks the real race, not the JS boot.
    await page.waitForSelector('[data-qa="home-cinematic"]', { state: "attached", timeout: 8000 });

    // Sample the whole pre-settings window: while the video setting is in
    // flight, the photo hero must stay absent for every sampled frame.
    let sawPhoto = 0;
    const deadline = Date.now() + SETTINGS_DELAY - 400;
    while (Date.now() < deadline) {
      sawPhoto += await page.locator(HERO_IMG).count();
      await page.waitForTimeout(20);
    }
    expect(sawPhoto, "photo hero never painted during the settings race").toBe(0);

    // Once settings resolve, the video leads the hero — still no photo branch.
    await settle(page, 500);
    await expect(page.locator(VIDEO), "video appears once settings resolve").toHaveCount(1);
    await expect(page.locator(HERO_IMG), "photo branch never rendered").toHaveCount(0);
    expect(await dataSrc(page, VIDEO)).toBe(HERO_VIDEO_URL);

    expect(diag.consoleErrors, "console errors — load race").toEqual([]);
    expect(diag.failedResponses, "failed requests — load race").toEqual([]);
  });

  test("reduced motion renders the poster image (framed by the viewport record), not the video", async ({
    page,
  }) => {
    const diag = attachDiagnostics(page);
    await stubHeroVideoMedia(page);
    await routeSupabase(page, {
      media: MEDIA_TWO_RECORDS,
      photos: MOCK_PHOTOS,
      heroVideo: HERO_VIDEO_URL,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 500);

    await expect(page.locator(POSTER), "reduced motion shows the poster still").toHaveCount(1);
    await expect(page.locator(VIDEO), "no autoplaying video under reduced motion").toHaveCount(0);
    // The still is framed with the landscape (desktop viewport) record.
    expect(await objectPositionOf(page, POSTER)).toBe("20% 30%");

    await page.screenshot({ path: shot("VIDMODEL-hero-reduced-poster.png"), fullPage: true });
    expect(diag.consoleErrors, "console errors — reduced motion").toEqual([]);
    expect(diag.failedResponses, "failed requests — reduced motion").toEqual([]);
  });
});

/* ---------- back-compat: today's prod video lives under the legacy portrait key ---------- */
test.describe("VID.MODEL.1 — legacy portrait-key back-compat", () => {
  test("only cinematic_hero_video_portrait present → the clip renders on both viewport sizes", async ({
    page,
  }) => {
    const diag = attachDiagnostics(page);
    // Legacy single-shape framing (pre-refactor), read as the landscape record.
    const legacyMedia = {
      hero: {
        photo_id: null,
        focal: { x: 0.5, y: 0.08 },
        zoom: 1,
        video: { focal: { x: 0.4, y: 0.6 }, zoom: 1.2 },
      },
      reel: MEDIA_TWO_RECORDS.reel,
    };
    await stubHeroVideoMedia(page);
    // NOTE: no `heroVideo` (canonical) — ONLY the legacy portrait key is set.
    await routeSupabase(page, { media: legacyMedia, photos: MOCK_PHOTOS, heroVideoPortrait: PORT_URL });

    // Desktop viewport: the legacy clip still leads the hero.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 700);
    await expect(page.locator(VIDEO), "legacy clip renders on desktop").toHaveCount(1);
    expect(await dataSrc(page, VIDEO), "resolved from the legacy portrait key").toBe(PORT_URL);

    // Phone viewport: the same legacy clip keeps playing.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await expect(page.locator(VIDEO), "legacy clip renders on phone").toHaveCount(1);
    expect(await dataSrc(page, VIDEO), "same legacy clip on phone").toBe(PORT_URL);

    expect(diag.consoleErrors, "console errors — back-compat").toEqual([]);
    expect(diag.failedResponses, "failed requests — back-compat").toEqual([]);
  });
});

/* ---------- HERO.WIDE.1: fit mode letterboxes onto a framed stage ---------- */
test.describe("HERO.WIDE.1 — fit mode (framed stage: side fields + gold seams, no spill)", () => {
  test("a landscape-viewport fit record shows contain foreground framed by side fields", async ({ page }) => {
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
      reel: MEDIA_TWO_RECORDS.reel,
    };
    await stubHeroVideoMedia(page);
    // HERO.WIDE.1: a PORTRAIT clip in a landscape viewport — the case that
    // letterboxes with side flanks, like the shipped desktop hero.
    await page.addInitScript(() => {
      const w = window as unknown as { __TEST_VIDEO_W?: number; __TEST_VIDEO_H?: number };
      w.__TEST_VIDEO_W = 1080;
      w.__TEST_VIDEO_H = 1920;
    });
    await routeSupabase(page, { media, photos: MOCK_PHOTOS, heroVideo: HERO_VIDEO_URL });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    // HERO.WIDE.1: the blurred video-copy spill is gone — exactly ONE <video>
    // renders inside the hero, and no element carries the old backdrop hook.
    await expect(
      page.locator('[data-qa="cinematic-hero-video-backdrop"]'),
      "no blurred backdrop copy",
    ).toHaveCount(0);
    await expect(
      page.locator('[data-qa="cinematic-section"] video'),
      "exactly one hero video element",
    ).toHaveCount(1);

    // PORT.3: the foreground letterboxes via the resolver's contain math (the
    // rectangle IS the contain box, objectFit itself is "fill") — the resolved
    // fit mode is asserted on the framing contract.
    await expect
      .poll(async () => (await framingAttr(page, VIDEO)) ?? "absent", { timeout: 10_000 })
      .toContain(";fit;");

    // The flanks are deliberate fields with a gold hairline seam at each
    // video/field junction, sized off the same resolver geometry.
    for (const side of ["left", "right"] as const) {
      const field = page.locator(`[data-qa="framed-video-field-${side}"]`);
      await expect(field, `${side} field renders`).toHaveCount(1);
      const fieldBox = await field.boundingBox();
      expect(fieldBox && fieldBox.width, `${side} field has real width`).toBeGreaterThan(50);

      const seam = page.locator(`[data-qa="framed-video-seam-${side}"]`);
      await expect(seam, `${side} seam renders`).toHaveCount(1);
      const seamColor = await seam.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
      expect(seamColor, `${side} seam is the gold hairline`).toContain("201, 165, 92");
    }

    // Seams sit at the video plate's edges (resolver parity, ±2px).
    const videoBox = await page.locator(VIDEO).boundingBox();
    const leftSeamBox = await page.locator('[data-qa="framed-video-seam-left"]').boundingBox();
    const rightSeamBox = await page.locator('[data-qa="framed-video-seam-right"]').boundingBox();
    expect(videoBox && leftSeamBox && rightSeamBox, "boxes measurable").toBeTruthy();
    expect(Math.abs(leftSeamBox!.x + leftSeamBox!.width - videoBox!.x), "left seam hugs the plate").toBeLessThanOrEqual(2);
    expect(Math.abs(rightSeamBox!.x - (videoBox!.x + videoBox!.width)), "right seam hugs the plate").toBeLessThanOrEqual(2);

    await page.screenshot({ path: shot("HEROWIDE-fit-render.png") });

    expect(diag.consoleErrors, "console errors — fit render").toEqual([]);
    expect(diag.failedResponses, "failed requests — fit render").toEqual([]);
  });
});
