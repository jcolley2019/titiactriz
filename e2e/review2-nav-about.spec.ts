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
 *  5. THE FOOTER NEVER PINS — no pin-spacer ever wraps the footer. (This law
 *     used to read "contact never pins"; REVIEW.3a extended the dwell to every
 *     story act, contact included — review3-dwell.spec.ts owns that side. What
 *     survives here is the boundary: the dwell stops at the footer.)
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

/**
 * REVIEW.2b's dwell thresholds — the LAW, and untouched by the FLAKE work
 * below. `PINNED_PX` is "holding the top of the frame" and `RELEASED_PX` is
 * "gone from the frame"; they are named once so the waiter and the assertion
 * cannot drift apart into a tolerance that quietly does a retry's job.
 */
const PINNED_PX = 2;
const RELEASED_PX = -200;

const aboutTop = (page: Page) =>
  page.locator("#cinematic-about").evaluate((el) => el.getBoundingClientRect().top);

const aboutSpacer = (page: Page) =>
  page.locator("#cinematic-about").locator("xpath=ancestor::*[contains(@class,'pin-spacer')]");

/** Document Y at which About's dwell begins — the pin-spacer's top. */
const pinStartY = (page: Page) =>
  aboutSpacer(page).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

/**
 * FLAKE.1 — every act above About decodes its photography late, and each late
 * decode changes the document height ABOVE the pin. A Y measured once and
 * reused is therefore an aim at a plateau that has since moved, which is how
 * this test drifted 9px short of its target and read an unpinned frame.
 */
async function reelImagesSettled(page: Page) {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-qa="cinematic-reel-img"]')].every(
        (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
      ),
    { timeout: 30_000 },
  );
}

/**
 * Drive `offset` px into About's dwell and return the section's OBSERVED top.
 *
 * The FLAKE.1–4 shape: the aim is re-measured against the CURRENT layout on
 * every attempt rather than computed once, and the state is waited for rather
 * than sampled once — Lenis carries momentum past a wheel aim, so a one-shot
 * read can catch the frame before ScrollTrigger has applied the pin. Re-aims
 * are bounded at three; if the state is never observed the caller's assertion
 * still runs and still reports the real number, so a genuinely broken pin
 * fails here rather than being retried into a pass.
 */
async function toDwellOffset(page: Page, offset: number, want: "pinned" | "released") {
  const aim = async () => {
    await wheelTo(page, (await pinStartY(page)) + offset);
  };

  const observed = () =>
    page
      .waitForFunction(
        ({ mode, pinnedPx, releasedPx }) => {
          const el = document.querySelector("#cinematic-about");
          if (!el) return false;
          const top = el.getBoundingClientRect().top;
          return mode === "pinned" ? Math.abs(top) <= pinnedPx : top < releasedPx;
        },
        { mode: want, pinnedPx: PINNED_PX, releasedPx: RELEASED_PX },
        { timeout: 6_000 },
      )
      .then(() => true)
      .catch(() => false);

  await aim();
  let settled = await observed();
  for (let attempt = 0; !settled && attempt < 2; attempt += 1) {
    await aim();
    settled = await observed();
  }
  return aboutTop(page);
}

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
    // FLAKE.3 — stress headroom: the re-aims are bounded, but a CPU-starved
    // run pays for each of them, and a budget that fits only the happy path is
    // itself a source of red.
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);
    await reelImagesSettled(page);

    // The pin exists: ScrollTrigger wraps About in a spacer sized for the
    // dwell. The footer has none — the dwell law stops at the footer.
    await expect(aboutSpacer(page), "About sits in a pin spacer under motion").toHaveCount(1);
    await expect(
      page.locator("footer").locator("xpath=ancestor-or-self::*[contains(@class,'pin-spacer')]"),
      "the footer never pins",
    ).toHaveCount(0);

    // Engage: just past the spacer's top (wheelTo converges within ±8px, so
    // aiming a hair beyond keeps the check deterministic) the section holds
    // the top of the frame…
    const topAtEngage = await toDwellOffset(page, 60, "pinned");
    expect(Math.abs(topAtEngage), "About pinned at engage").toBeLessThanOrEqual(PINNED_PX);

    // …and half a dwell later (60% of 120%) it is STILL holding the frame.
    const topMidDwell = await toDwellOffset(page, 0.6 * 1.2 * 900, "pinned");
    expect(Math.abs(topMidDwell), "About still pinned mid-dwell").toBeLessThanOrEqual(PINNED_PX);

    // Release: past the +=120% dwell the section scrolls away normally.
    const topAfterRelease = await toDwellOffset(page, 1.2 * 900 + 300, "released");
    expect(topAfterRelease, "About released after the dwell").toBeLessThan(RELEASED_PX);
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
      page.locator("footer").locator("xpath=ancestor-or-self::*[contains(@class,'pin-spacer')]"),
      "the footer never pins (reduced)",
    ).toHaveCount(0);
    await expect(page.locator("#cinematic-about")).toBeAttached();
  });
});
