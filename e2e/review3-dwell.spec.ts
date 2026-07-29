import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { routeSupabase } from "./_admin";

/**
 * REVIEW.3a — the UNIFORM dwell law.
 *
 * Every story act pins with the About standard — `start: "top top"`,
 * `end: "+=120%"` — before it releases: the gallery, the Book announcement
 * (BOOK.ACT.2), About, and contact. The scrub showcases (Green World and
 * TitiLinks) keep their own `+=300%` timelines and are not this file's business.
 *
 * Laws, each falsifiable on the live render:
 *
 *  1. EACH STORY ACT DWELLS — engages at the top of the frame, holds through
 *     the dwell, releases after +=120%.
 *  2. THE DWELL IS UNIFORM — the four acts' pin distances are the SAME
 *     distance, not four numbers that happen to be near each other.
 *  3. THE GALLERY STAYS ALIVE WHILE PINNED — hover still pauses the marquee,
 *     and a click still opens the lightbox, mid-dwell.
 *  4. THE FORM STAYS USABLE WHILE PINNED — an input can be clicked, focused
 *     and typed into mid-dwell.
 *  5. THE FOOTER NEVER PINS — the dwell law stops at the footer.
 *  6. REDUCED MOTION SKIPS EVERY PIN.
 *
 * Evidence: _qa/review3-dwell-{gallery,book,about,contact}.png — each act held
 * mid-dwell.
 */

const PATH = "/cinematic";
const VH = 900;
/** The dwell: +=120% of the viewport, the About standard. */
const DWELL = 1.2 * VH;

/** Document order, so the sweep below only ever wheels downward. */
const ACTS = [
  { name: "gallery", sel: '[data-qa="cinematic-gallery"]' },
  { name: "book", sel: '[data-qa="cinematic-book"]' },
  { name: "about", sel: "#cinematic-about" },
  { name: "contact", sel: "#contact" },
] as const;

const spacerOf = (page: Page, sel: string) =>
  page.locator(sel).locator("xpath=ancestor::*[contains(@class,'pin-spacer')]");

const footerSpacer = (page: Page) =>
  page.locator("footer").locator("xpath=ancestor-or-self::*[contains(@class,'pin-spacer')]");

async function settle(page: Page, ms = 900) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wheel the document to `y` (Lenis owns the scroll on this route). */
async function wheelTo(page: Page, y: number) {
  await page.mouse.move(200, 300);
  for (let i = 0; i < 200; i++) {
    const at = await page.evaluate(() => window.scrollY);
    const delta = y - at;
    if (Math.abs(delta) < 8) break;
    await page.mouse.wheel(0, Math.max(-600, Math.min(600, Math.round(delta))));
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(500);
}

async function openHome(page: Page) {
  await page.setViewportSize({ width: 1440, height: VH });
  await routeSupabase(page);
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await settle(page);
}

/** The spacer's top edge in document coordinates — where the pin engages. */
const rawPinStartOf = (page: Page, sel: string) =>
  spacerOf(page, sel)
    .first()
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

/**
 * The pin start, once it has stopped moving. The page keeps re-measuring after
 * load — async media lands, the reel rebuilds its wide timeline, fonts settle,
 * and each ScrollTrigger.refresh() can shift every later act's flow position.
 * A start read mid-shuffle aims the wheel at a stale offset (measured: 58px
 * adrift under a loaded battery run), so the position is trusted only after
 * two consecutive reads agree.
 */
async function pinStartOf(page: Page, sel: string) {
  let prev = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < 25; i++) {
    const cur = await rawPinStartOf(page, sel);
    if (Math.abs(cur - prev) < 1) return cur;
    prev = cur;
    await page.waitForTimeout(350);
  }
  return prev;
}

const topOf = (page: Page, sel: string) =>
  page.locator(sel).evaluate((el) => el.getBoundingClientRect().top);

/**
 * Wheel until the act is genuinely holding the top of the frame, and return the
 * pin start it engaged on.
 *
 * `pinStartOf` above hands back a STABILIZED offset, but stability is not
 * permanence: a `ScrollTrigger.refresh()` landing between the read and the end
 * of the wheel re-flows every later act, leaving the aim short (measured 82px
 * adrift on a cold run — enough to miss a 60px overshoot and read the act as
 * unpinned). Aiming at the engage point is the one step in this file with no
 * slack — mid-dwell and release both aim hundreds of pixels inside their
 * window — so the aim is simply re-taken against a fresh measurement. The law
 * is unchanged: the caller still asserts the act is pinned when this returns.
 */
async function engage(page: Page, sel: string) {
  let pinStart = await pinStartOf(page, sel);
  for (let i = 0; i < 4; i++) {
    await wheelTo(page, pinStart + 60);
    if (Math.abs(await topOf(page, sel)) <= 2) break;
    pinStart = await pinStartOf(page, sel);
  }
  return pinStart;
}

test.describe("REVIEW.3a — the uniform dwell law", () => {
  test("1440 — each story act engages, holds, and releases on the same +=120%", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await openHome(page);

    const distances: Record<string, number> = {};

    for (const act of ACTS) {
      // The pin exists: ScrollTrigger wraps the act in a spacer sized for the
      // dwell (section height + pin distance).
      await expect(spacerOf(page, act.sel), `${act.name} sits in a pin spacer`).toHaveCount(1);

      const dist = await page.evaluate((sel) => {
        const section = document.querySelector(sel)!;
        const spacer = section.closest(".pin-spacer")!;
        return spacer.getBoundingClientRect().height - section.getBoundingClientRect().height;
      }, act.sel);
      distances[act.name] = dist;

      // Engage: just past the spacer's top (wheelTo converges within ±8px, so
      // aiming a hair beyond keeps the check deterministic) the act holds the
      // top of the frame…
      const pinStart = await engage(page, act.sel);
      expect(Math.abs(await topOf(page, act.sel)), `${act.name} pinned at engage`).toBeLessThanOrEqual(2);

      // …and half a dwell later it is STILL holding the frame.
      await wheelTo(page, pinStart + 0.6 * DWELL);
      expect(
        Math.abs(await topOf(page, act.sel)),
        `${act.name} still pinned mid-dwell`,
      ).toBeLessThanOrEqual(2);
      await page.screenshot({ path: shot(`review3-dwell-${act.name}.png`) });

      // Release: past the +=120% dwell the act scrolls away normally.
      await wheelTo(page, pinStart + DWELL + 300);
      expect(await topOf(page, act.sel), `${act.name} released after the dwell`).toBeLessThan(-200);
    }

    // Law 2 — ONE dwell, not four: every act's pin distance is +=120% of the
    // viewport, and all four are the SAME number.
    for (const act of ACTS) {
      expect(
        Math.abs(distances[act.name] - DWELL),
        `${act.name} dwells for +=120% (got ${distances[act.name]})`,
      ).toBeLessThanOrEqual(12);
    }
    const values = ACTS.map((a) => distances[a.name]);
    expect(
      Math.max(...values) - Math.min(...values),
      `the four dwells are one distance (${values.join(", ")})`,
    ).toBeLessThanOrEqual(4);

    // Law 5 — the dwell law stops at the footer.
    await expect(footerSpacer(page), "the footer never pins").toHaveCount(0);
  });

  test("1440 — the gallery stays fully interactive while pinned", async ({ page }) => {
    test.setTimeout(240_000);
    await openHome(page);

    const pinStart = await pinStartOf(page, '[data-qa="cinematic-gallery"]');
    await wheelTo(page, pinStart + 0.5 * DWELL);
    expect(
      Math.abs(await topOf(page, '[data-qa="cinematic-gallery"]')),
      "gallery pinned for the whole interaction check",
    ).toBeLessThanOrEqual(2);

    // 3a — the marquee keeps self-driving through the dwell, and hover still
    // pauses it. Park the cursor below the track first so nothing is paused.
    const track = page.locator('[data-qa="cinematic-marquee-track"]');
    await page.mouse.move(720, 880);
    await page.waitForTimeout(300);
    const t0 = await track.evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(1500);
    const t1 = await track.evaluate((el) => getComputedStyle(el).transform);
    expect(t1, "marquee still self-drives mid-dwell").not.toBe(t0);

    await page.locator('[data-qa="cinematic-marquee"]').hover();
    await page.waitForTimeout(300);
    const h0 = await track.evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(600);
    const h1 = await track.evaluate((el) => getComputedStyle(el).transform);
    expect(h1, "hover pauses the marquee mid-dwell").toBe(h0);

    // 3b — a click still opens the lightbox mid-dwell. dispatchEvent sidesteps
    // the drift — the track is a moving target Playwright would wait on.
    await page.locator('[data-qa="gallery-photo"]').first().dispatchEvent("click");
    await expect(page.locator('[data-qa="lightbox"]'), "lightbox opens mid-dwell").toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-qa="lightbox"]')).toHaveCount(0);

    // …and the act is still holding the frame after all of it.
    expect(
      Math.abs(await topOf(page, '[data-qa="cinematic-gallery"]')),
      "gallery still pinned after the interactions",
    ).toBeLessThanOrEqual(2);
  });

  test("1440 — the contact form stays usable while pinned", async ({ page }) => {
    test.setTimeout(240_000);
    await openHome(page);

    const pinStart = await pinStartOf(page, "#contact");
    await wheelTo(page, pinStart + 0.5 * DWELL);
    expect(
      Math.abs(await topOf(page, "#contact")),
      "contact pinned for the whole form check",
    ).toBeLessThanOrEqual(2);

    // An input can be clicked, focused and typed into mid-dwell. The pin fixes
    // the section's place only — the form underneath it is fully live.
    const name = page.locator("#cine-name");
    await name.click();
    await expect(name, "the input took focus mid-dwell").toBeFocused();
    await page.keyboard.type("Cristyna");
    await expect(name, "the input took text mid-dwell").toHaveValue("Cristyna");

    // …without the act letting go of the frame.
    expect(
      Math.abs(await topOf(page, "#contact")),
      "contact still pinned after typing",
    ).toBeLessThanOrEqual(2);
  });

  test("1440 reduced motion — no story act pins, and the footer still never pins", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: VH });
    await routeSupabase(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    for (const act of ACTS) {
      await expect(
        spacerOf(page, act.sel),
        `${act.name} unpinned under reduced motion`,
      ).toHaveCount(0);
    }
    await expect(footerSpacer(page), "the footer never pins (reduced)").toHaveCount(0);
  });
});
