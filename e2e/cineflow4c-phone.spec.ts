import { expect, test, type Page } from "@playwright/test";
import { forceLanguage } from "./_admin";
import { shot } from "./_helpers";

/**
 * CINE.FLOW.4C STEP 4 — evidence for the unveiled phone act.
 *
 * Captures the SHIPPED phone rendering (the live cinematic route, not the
 * bake-off harness) at both phone frames the editor models, in both languages,
 * at the reel's first and third dead-stops: the photograph unveiled, and the
 * lockup reading off its own local scrim.
 *
 * A dead-stop is a scrub position where nothing is mid-tween. The reel's pinned
 * timeline runs 0..3 over 300vh — crossfades at marks 1 and 2, then a 0.5 dwell
 * — so slide 1 rests anywhere in [0, 1) and slide 3 from 2.53 (its title tween
 * ends) to 3.0. We drive to those positions by SCROLL rather than by touching
 * GSAP, so what is photographed is what a visitor's thumb produces, and we
 * confirm the stop by reading the slide opacities back before shooting.
 *
 * Files: _qa/cineflow4c-<width>-<lang>-s<slide>.png (8 of them).
 */

const PATH = "/cinematic";

const FRAMES = [
  { w: 390, h: 844 },
  { w: 440, h: 956 },
] as const;

const LANGS = ["es", "en"] as const;

/** Timeline positions (of 3.0) where slide 1 and slide 3 are each at rest. */
const DEAD_STOPS = { 1: 0.5 / 3, 3: 2.8 / 3 } as const;

async function settle(page: Page, ms = 500) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/**
 * Wheel the document to `y`. Lenis owns the scroll on this route, so a direct
 * scrollTo would be fought by its RAF loop; wheeling in bounded steps and
 * re-measuring converges the same way a thumb does.
 */
async function wheelTo(page: Page, y: number) {
  await page.mouse.move(200, 300);
  for (let i = 0; i < 80; i++) {
    const at = await page.evaluate(() => window.scrollY);
    const delta = y - at;
    if (Math.abs(delta) < 8) break;
    await page.mouse.wheel(0, Math.max(-600, Math.min(600, Math.round(delta))));
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(500);
}

/** Absolute document Y at which the reel's pin engages (its top hits 0). */
async function pinStartY(page: Page) {
  return page.evaluate(() => {
    const img = document.querySelector('[data-qa="cinematic-reel-img"]');
    const pin = img?.closest('[data-qa="cinematic-section"]')?.firstElementChild;
    if (!pin) throw new Error("reel pin container not found");
    return pin.getBoundingClientRect().top + window.scrollY;
  });
}

const opacities = (page: Page) =>
  page
    .locator('[data-qa="reel-slide"]')
    .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).opacity)));

test.describe("CINE.FLOW.4C — shipped phone act: evidence", () => {
  for (const frame of FRAMES) {
    for (const lang of LANGS) {
      test(`phone ${frame.w}x${frame.h} ${lang.toUpperCase()}`, async ({ page }) => {
        test.setTimeout(180_000);
        await forceLanguage(page, lang);
        await page.setViewportSize({ width: frame.w, height: frame.h });
        await page.goto(PATH, { waitUntil: "domcontentloaded" });
        await settle(page, 900);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));

        // The phone act must actually be mounted, or the evidence is worthless.
        await expect(page.locator('[data-qa="reel-spotlight"]')).toHaveCount(3);
        await expect(page.locator('[data-qa="reel-lockup-scrim"]')).toHaveCount(3);

        // Scroll far enough for the pin to be measurable, then to each stop.
        const y0 = await pinStartY(page);

        for (const slide of [1, 3] as const) {
          await wheelTo(page, y0 + DEAD_STOPS[slide] * 3 * frame.h);
          await page.waitForFunction(
            () =>
              [...document.querySelectorAll('[data-qa="cinematic-reel-img"]')].every(
                (i) =>
                  (i as HTMLImageElement).complete &&
                  (i as HTMLImageElement).naturalWidth > 0 &&
                  !(i.getAttribute("data-hero-framing") ?? "").includes("pending"),
              ),
            { timeout: 30_000 },
          );

          // Confirm the dead-stop before shooting: the named slide is fully
          // opaque and every other slide is fully out.
          const op = await opacities(page);
          expect(op.length, "three slides").toBe(3);
          expect(op[slide - 1], `slide ${slide} opaque at its dead-stop`).toBeGreaterThan(0.99);
          op.forEach((v, idx) => {
            if (idx !== slide - 1) {
              expect(v, `slide ${idx + 1} out at slide ${slide}'s dead-stop`).toBeLessThan(0.01);
            }
          });

          await page.screenshot({
            path: shot(`cineflow4c-${frame.w}-${lang}-s${slide}.png`),
          });
        }
      });
    }
  }
});
