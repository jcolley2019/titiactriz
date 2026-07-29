import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";

/**
 * REVIEW.2b — the nav grounds on scroll; the About act dwells.
 *
 * Laws, each falsifiable on the live render:
 *
 *  1. NAV TRANSPARENT AT THE TOP — over the hero the header carries no ground:
 *     the opening picture runs edge to edge with no lid.
 *  2. NAV GROUNDED PAST THE HERO — past ~80vh the header sits on the site's
 *     near-black ground (with the 700ms transition making it a fade), so act
 *     content passes beneath it rather than colliding with the glyphs.
 *  3. ABOUT DWELLS — the About section pins at the top of the frame for
 *     +=120% of scroll before releasing.
 *  4. REDUCED MOTION SKIPS THE PIN — About renders unpinned, in flow.
 *  5. CONTACT NEVER PINS — no pin-spacer ever wraps the contact act (ruled:
 *     contact, footer and forms never pin).
 *
 * Evidence: _qa/review2-nav-scrolled.png (grounded nav over the reel act).
 */

const PATH = "/cinematic";

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wheel the document to `y` (Lenis owns the scroll on this route). */
async function wheelTo(page: Page, y: number) {
  await page.mouse.move(200, 300);
  for (let i = 0; i < 120; i++) {
    const at = await page.evaluate(() => window.scrollY);
    const delta = y - at;
    if (Math.abs(delta) < 8) break;
    await page.mouse.wheel(0, Math.max(-600, Math.min(600, Math.round(delta))));
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(500);
}

const headerBg = (page: Page) =>
  page.locator("header").evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe("REVIEW.2b — nav ground and the About dwell", () => {
  test("1440 — the nav is transparent over the hero and grounded past it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    // 1. Over the hero: no ground.
    expect(await headerBg(page), "transparent at the top").toBe("rgba(0, 0, 0, 0)");

    // 2. Past ~80vh: the near-black ground. 1.2 viewports is well past the
    // threshold and inside the reel act — exactly where glyph collisions were.
    await wheelTo(page, 1.2 * 900);
    await expect
      .poll(async () => headerBg(page), { message: "grounded past the hero" })
      .toBe("rgba(11, 10, 8, 0.95)");
    await page.screenshot({ path: shot("review2-nav-scrolled.png") });

    // …and it releases its ground again at the top.
    await wheelTo(page, 0);
    await expect
      .poll(async () => headerBg(page), { message: "transparent again at the top" })
      .toBe("rgba(0, 0, 0, 0)");
  });

  test("1440 — About pins for +=120% and then releases; contact never pins", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    // The pin exists: ScrollTrigger wraps About in a spacer sized for the
    // dwell. Contact has none — it is never pinned.
    const spacer = page.locator("#cinematic-about").locator("xpath=ancestor::*[contains(@class,'pin-spacer')]");
    await expect(spacer, "About sits in a pin spacer under motion").toHaveCount(1);
    await expect(
      page.locator("#contact").locator("xpath=ancestor::*[contains(@class,'pin-spacer')]"),
      "contact never pins",
    ).toHaveCount(0);

    // Engage: just past the spacer's top (wheelTo converges within ±8px, so
    // aiming a hair beyond keeps the check deterministic) the section holds
    // the top of the frame…
    const pinStart = await spacer.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await wheelTo(page, pinStart + 60);
    const topAtEngage = await page
      .locator("#cinematic-about")
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(topAtEngage), "About pinned at engage").toBeLessThanOrEqual(2);

    // …and half a dwell later (60% of 120%) it is STILL holding the frame.
    await wheelTo(page, pinStart + 0.6 * 1.2 * 900);
    const topMidDwell = await page
      .locator("#cinematic-about")
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(topMidDwell), "About still pinned mid-dwell").toBeLessThanOrEqual(2);

    // Release: past the +=120% dwell the section scrolls away normally.
    await wheelTo(page, pinStart + 1.2 * 900 + 300);
    const topAfterRelease = await page
      .locator("#cinematic-about")
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(topAfterRelease, "About released after the dwell").toBeLessThan(-200);
  });

  test("1440 reduced motion — About renders unpinned, in flow", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    await expect(
      page.locator("#cinematic-about").locator("xpath=ancestor::*[contains(@class,'pin-spacer')]"),
      "no pin under reduced motion",
    ).toHaveCount(0);
    await expect(
      page.locator("#contact").locator("xpath=ancestor::*[contains(@class,'pin-spacer')]"),
      "contact never pins (reduced)",
    ).toHaveCount(0);
    await expect(page.locator("#cinematic-about")).toBeAttached();
  });
});
