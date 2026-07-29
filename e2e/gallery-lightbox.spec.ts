import { test, expect, type Page } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";
import { routeSupabase, MOCK_PHOTOS } from "./_admin";

/**
 * GALLERY.TOUCH.1 — the shared gallery lightbox.
 *
 * Tap/click a gallery photo → the lightbox opens at that index: near-black
 * ground, the photo letterboxed as a plate inside a gold hairline, "n / total"
 * counter. Desktop: arrow keys navigate, Esc closes, click on the ground
 * closes. Touch: horizontal swipe advances/retreats, swipe-down closes. Body
 * scroll locks while open and is restored on close. The plate's geometry is
 * the hero-framing resolver's (asserted on the data-hero-framing contract).
 */
const CINE = "/cinematic";
const TILE = '[data-qa="gallery-photo"]';
const BOX = '[data-qa="lightbox"]';
const IMG = '[data-qa="lightbox-img"]';
const COUNTER = '[data-qa="lightbox-counter"]';

async function settle(page: Page, ms = 700) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Open the marquee's Nth ORIGINAL tile. dispatchEvent sidesteps the drift —
 * the track is a moving target Playwright's stability check would wait on. */
async function openAt(page: Page, index: number) {
  await page.locator(TILE).nth(index).dispatchEvent("click");
  await expect(page.locator(BOX)).toBeVisible();
}

const bodyOverflow = (page: Page) =>
  page.evaluate(() => document.body.style.overflow);

/** Synthesize a one-finger swipe as real TouchEvents on the lightbox. */
async function swipe(page: Page, dx: number, dy: number) {
  await page.evaluate(
    ([mx, my]) => {
      const el = document.querySelector('[data-qa="lightbox"]') as HTMLElement;
      const touch = (x: number, y: number) =>
        new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      const fire = (type: string, x: number, y: number) => {
        // Real touch anatomy: touches/targetTouches empty on touchend. Global
        // listeners (Lenis) destructure targetTouches, so it must be present.
        const live = type === "touchend" ? [] : [touch(x, y)];
        el.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: live,
            targetTouches: live,
            changedTouches: [touch(x, y)],
          }),
        );
      };
      const startX = 200;
      const startY = 400;
      fire("touchstart", startX, startY);
      fire("touchmove", startX + mx, startY + my);
      fire("touchend", startX + mx, startY + my);
    },
    [dx, dy],
  );
}

test.describe("GALLERY.TOUCH.1 — desktop lightbox", () => {
  test.beforeEach(async ({ page }) => {
    await routeSupabase(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page);
  });

  test("a click opens the lightbox at that photo's index, plate on the resolver", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await openAt(page, 2);

    await expect(page.locator(COUNTER), "counter shows the opened index").toHaveText("3 / 4");
    await expect(page.locator(IMG)).toHaveAttribute("src", MOCK_PHOTOS[2].image_url);

    // Resolver parity: the plate exposes the same framing contract as every
    // hero-media surface, resolved in contain ('fit') mode.
    await expect
      .poll(async () => (await page.locator(IMG).getAttribute("data-hero-framing")) ?? "absent")
      .toContain(";fit;");

    // Site language: gold hairline around the plate, near-black ground.
    const border = await page
      .locator('[data-qa="lightbox-plate"]')
      .evaluate((el) => getComputedStyle(el as HTMLElement).borderTopColor);
    expect(border, "plate hairline is the gold token").toContain("201, 165, 92");

    await page.screenshot({ path: shot("gallerytouch-open-1440.png") });
    expect(diag.consoleErrors, "console errors").toEqual([]);
  });

  test("arrow keys navigate with wrap, Esc closes, scroll lock arms and releases", async ({ page }) => {
    await openAt(page, 0);
    expect(await bodyOverflow(page), "body scroll locked while open").toBe("hidden");

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(COUNTER)).toHaveText("2 / 4");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(COUNTER)).toHaveText("1 / 4");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(COUNTER), "prev from the first photo wraps").toHaveText("4 / 4");

    await page.keyboard.press("Escape");
    await expect(page.locator(BOX)).toHaveCount(0);
    expect(await bodyOverflow(page), "body scroll restored on close").toBe("");
  });

  test("a click on the dark ground closes; the desktop prev/next affordances render", async ({ page }) => {
    await openAt(page, 1);
    await expect(page.locator('[data-qa="lightbox-prev"]'), "desktop prev affordance").toBeVisible();
    await expect(page.locator('[data-qa="lightbox-next"]'), "desktop next affordance").toBeVisible();
    await page.locator('[data-qa="lightbox-next"]').click();
    await expect(page.locator(COUNTER)).toHaveText("3 / 4");

    await page.locator('[data-qa="lightbox-ground"]').click({ position: { x: 10, y: 450 } });
    await expect(page.locator(BOX)).toHaveCount(0);
  });
});

test.describe("GALLERY.TOUCH.1 — touch behavior", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await routeSupabase(page);
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page);
  });

  test("swipes advance/retreat, swipe-down closes; arrows stay desktop-only", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await openAt(page, 0);

    // Prev/next affordances are desktop-only; touch drives navigation.
    await expect(page.locator('[data-qa="lightbox-prev"]')).toBeHidden();
    await expect(page.locator('[data-qa="lightbox-next"]')).toBeHidden();

    await swipe(page, -120, 0);
    await expect(page.locator(COUNTER), "swipe left advances").toHaveText("2 / 4");
    await swipe(page, 120, 0);
    await expect(page.locator(COUNTER), "swipe right retreats").toHaveText("1 / 4");

    // A sub-threshold nudge must not navigate.
    await swipe(page, -20, 0);
    await expect(page.locator(COUNTER)).toHaveText("1 / 4");

    await swipe(page, 0, 160);
    await expect(page.locator(BOX), "swipe-down closes").toHaveCount(0);
    expect(await bodyOverflow(page), "scroll restored after swipe-down close").toBe("");

    await openAt(page, 1);
    await page.screenshot({ path: shot("gallerytouch-open-390.png") });
    expect(diag.consoleErrors, "console errors — touch").toEqual([]);
  });
});

test.describe("GALLERY.TOUCH.1 — reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the static grid opens the lightbox and the plate crossfades in", async ({ page }) => {
    await routeSupabase(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page);

    await openAt(page, 2);
    await expect(page.locator(COUNTER)).toHaveText("3 / 4");

    const animation = await page
      .locator('[data-qa="lightbox-plate"]')
      .evaluate((el) => getComputedStyle(el as HTMLElement).animationName);
    expect(animation, "reduced motion renders the crossfade branch").toBe("lightbox-fade-in");
  });
});
