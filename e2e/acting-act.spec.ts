import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ACTING_ACT_ENABLED } from "../src/lib/ventures";
import { forceLanguage } from "./_admin";

/**
 * PORT.ACT.2 — the Acting act (candidate C, editorial split).
 *
 * The act is built and gated OFF, so this file has two halves:
 *
 *   · The DARK gate below runs always. While ACTING_ACT_ENABLED is false the act
 *     must not exist on the page at all — asserted as an ABSENCE, the same shape
 *     nav-book.spec.ts uses for TitiLinks' departure from the coming-soon panel.
 *
 *   · Everything after it is `test.skip`ped while the flag is false and activates
 *     the moment it flips, so the composition is not merely "tested once by hand
 *     during the build" — flipping the flag turns its own proof back on.
 *
 * Scroll assertions read OBSERVED state, never the aimed position: Lenis
 * momentum means the landed scroll offset is not the requested one, and
 * Playwright's isVisible() is a CSS check that returns true for an element
 * parked thousands of pixels below the fold.
 */

const PATH = "/";
const ACT = '[data-qa="cinematic-acting"]';
const INDEX = '[data-qa="acting-index"]';
const CREDIT = '[data-qa="acting-credit"]';
const HEADING = `${ACT} [data-qa="section-heading"]`;
const EYEBROW = `${ACT} [data-qa="chapter-eyebrow"]`;
const ORNAMENT = `${ACT} [data-qa="chapter-ornament"]`;
const SEAM = `${ACT} [data-qa="wide-chapter-seam"]`;
const PAGE_PHOTO = '[data-qa="acting-page"]';

/** Wheel until the index is observed inside the viewport, or give up. */
async function scrollToIndex(page: Page, viewportH: number) {
  for (let i = 0; i < 140; i += 1) {
    const top = await page.evaluate(() => {
      const el = document.querySelector('[data-qa="acting-index"]');
      return el ? el.getBoundingClientRect().top : null;
    });
    if (top !== null && top > 40 && top < viewportH - 80) return true;
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(90);
  }
  return false;
}

/* ─────────────────────────── the dark gate ─────────────────────────── */

test.describe("PORT.ACT.2 — the Acting act while it is dark", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("does not mount anywhere on the cinematic home while the flag is false", async ({ page }) => {
    test.skip(ACTING_ACT_ENABLED, "flag is on — the act is supposed to be here");
    await forceLanguage(page, "es");
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    // Scroll the whole page: a gated act must be absent at every offset, not
    // merely absent above the fold.
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior }),
    );
    await page.waitForTimeout(800);
    await expect(page.locator(ACT)).toHaveCount(0);
    await expect(page.locator(INDEX)).toHaveCount(0);
    await expect(page.locator(CREDIT)).toHaveCount(0);
  });
});

/* ──────────────── the composition, live when the flag flips ──────────────── */

test.describe("PORT.ACT.2 — the Acting act composition", () => {
  test.skip(!ACTING_ACT_ENABLED, "ACTING_ACT_ENABLED is false — the act is dark by design");

  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet-portrait", width: 1024, height: 1366 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`renders candidate C at ${vp.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await forceLanguage(page, "es");
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(PATH, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      expect(await scrollToIndex(page, vp.height), "credits index reached").toBe(true);
      await page.waitForTimeout(700);

      // The chapter is present and PAINTED — opacity, not just existence. The
      // first build of this act rendered a fully-populated DOM at opacity 0.
      for (const sel of [EYEBROW, HEADING, INDEX, ORNAMENT]) {
        await expect(page.locator(sel)).toBeVisible();
        const opacity = await page.locator(sel).evaluate((el) => getComputedStyle(el).opacity);
        expect(Number(opacity), `${sel} is painted`).toBeGreaterThan(0.1);
      }
      await expect(page.locator(HEADING)).toHaveText("Actuación");

      // Candidate C: the photograph is the PAGE, full-bleed — it must reach the
      // frame's right edge and its full height, which is what a plate cannot do.
      const geo = await page.evaluate(() => {
        const photo = document.querySelector('[data-qa="acting-page"]')!.getBoundingClientRect();
        const stage = document
          .querySelector('[data-qa="cinematic-acting"] .cine-vh-full')!
          .getBoundingClientRect();
        return { photo, stage: { w: stage.width, h: stage.height, right: stage.right, top: stage.top } };
      });
      expect(Math.abs(geo.photo.right - geo.stage.right), "photo bleeds to the right edge").toBeLessThan(2);
      expect(geo.photo.height / geo.stage.h, "photo fills the frame height").toBeGreaterThan(0.98);
      // ...and it occupies the room beside the 0.42 copy column.
      expect(geo.photo.width / geo.stage.w).toBeGreaterThan(0.55);
      expect(geo.photo.width / geo.stage.w).toBeLessThan(0.60);

      await expect(page.locator(SEAM)).toBeVisible();
      expect(errors, "no page errors").toEqual([]);
    });
  }

  test("a credit links only when it has somewhere to go", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await forceLanguage(page, "es");
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    expect(await scrollToIndex(page, 900)).toBe(true);

    const rows = await page.locator(CREDIT).evaluateAll((els) =>
      els.map((e) => ({
        live: e.getAttribute("data-live"),
        tag: e.tagName,
        href: e.getAttribute("href"),
        rel: e.getAttribute("rel"),
        target: e.getAttribute("target"),
      })),
    );
    expect(rows.length, "the index has rows").toBeGreaterThan(0);

    for (const r of rows) {
      if (r.live === "true") {
        // A live row is a real anchor with a real destination, opened safely.
        expect(r.tag).toBe("A");
        expect(r.href).toBeTruthy();
        expect(r.href).not.toBe("#");
        expect(r.target).toBe("_blank");
        expect(r.rel).toMatch(/noopener/);
      } else {
        // STRIP.FAKE.1's lesson, enforced: an inert row is NOT an anchor, so it
        // cannot present a link affordance that leads nowhere.
        expect(r.tag).not.toBe("A");
        expect(r.href).toBeNull();
      }
    }

    // Numerals come from POSITION, so they are always a gapless 01, 02, 03…
    const numerals = await page
      .locator(`${CREDIT} [data-qa="acting-numeral"]`)
      .evaluateAll((els) => els.map((e) => e.textContent?.trim()));
    expect(numerals).toEqual(numerals.map((_, i) => String(i + 1).padStart(2, "0")));
  });

  test("reduced motion renders the act complete and static", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await forceLanguage(page, "es");
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // No pin under reduced motion, so a plain scroll reaches it.
    await page.locator(ACT).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    // Every entrance is a gsap.from(), so with no timeline nothing was hidden.
    for (const sel of [EYEBROW, HEADING, INDEX]) {
      await expect(page.locator(sel)).toBeVisible();
      const opacity = await page.locator(sel).evaluate((el) => getComputedStyle(el).opacity);
      expect(Number(opacity), `${sel} is painted under reduced motion`).toBeGreaterThan(0.9);
    }
  });

  test("English locale renders English titles", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await forceLanguage(page, "en");
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    expect(await scrollToIndex(page, 900)).toBe(true);
    await expect(page.locator(HEADING)).toHaveText("Acting");
    await expect(page.locator(ACT)).not.toContainText("Actuación");
  });
});
