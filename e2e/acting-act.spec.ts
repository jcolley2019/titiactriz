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
    { name: "desktop", width: 1440, height: 900, shape: "wide" },
    { name: "tablet-portrait", width: 1024, height: 1366, shape: "wide" },
    { name: "phone-390", width: 390, height: 844, shape: "phone" },
    { name: "phone-360", width: 360, height: 780, shape: "phone" },
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

      // The act picks a SHAPE, it does not squeeze one composition into every
      // frame. At 390 the wide split left a ~164px copy column, which clipped
      // the headline and buried the index under the photograph.
      await expect(page.locator('[data-qa="acting-stage"]')).toHaveAttribute("data-shape", vp.shape);

      // Present and PAINTED — opacity, not just existence. The first build of
      // this act rendered a fully-populated DOM at opacity 0.
      for (const sel of [EYEBROW, HEADING, INDEX]) {
        await expect(page.locator(sel)).toBeVisible();
        const opacity = await page.locator(sel).evaluate((el) => getComputedStyle(el).opacity);
        expect(Number(opacity), `${sel} is painted`).toBeGreaterThan(0.1);
      }
      await expect(page.locator(HEADING)).toHaveText("Actuación");

      // PORT.ACT.5 — ONE chapter spine. The reel owns 01 · 02 · 03 and this act
      // continues it at 04; it does not start a private sequence that says 01
      // again three chapters in. Asserted on BOTH compositions, because the
      // phone stack draws its own numeral rather than going through
      // WideChapter, and the two could otherwise drift apart.
      await expect(page.locator(`${ACT} [data-qa="wide-numeral"]`)).toHaveText("04");

      const geo = await page.evaluate(() => {
        const q = (s: string) => document.querySelector(s)!;
        const stage = q('[data-qa="acting-stage"]').getBoundingClientRect();
        const photo = q('[data-qa="acting-page"]').getBoundingClientRect();
        const panel = q('[data-qa="acting-index"]').getBoundingClientRect();
        const heading = q('[data-qa="cinematic-acting"] [data-qa="section-heading"]');
        const eyebrow = q('[data-qa="cinematic-acting"] [data-qa="chapter-eyebrow"]').getBoundingClientRect();
        const hr = heading.getBoundingClientRect();
        const within = (r: DOMRect) => r.left >= stage.left - 1 && r.right <= stage.right + 1;
        return {
          stage: { w: stage.width, h: stage.height, left: stage.left, right: stage.right },
          photo: { w: photo.width, h: photo.height, left: photo.left, right: photo.right, bottom: photo.bottom },
          panel: { top: panel.top, left: panel.left, right: panel.right },
          headingClipped: heading.scrollWidth > heading.clientWidth + 1,
          headingWithin: within(hr),
          eyebrowWithin: within(eyebrow),
        };
      });

      // Nothing runs off the frame or gets swallowed by an overflow-hidden.
      expect(geo.headingClipped, "headline is not clipped").toBe(false);
      expect(geo.headingWithin, "headline is inside the stage").toBe(true);
      expect(geo.eyebrowWithin, "eyebrow is inside the stage").toBe(true);

      if (vp.shape === "wide") {
        // Candidate C: the photograph is the PAGE, full-bleed — it reaches the
        // frame's right edge and its full height, which a plate cannot do.
        expect(Math.abs(geo.photo.right - geo.stage.right), "photo bleeds to the right edge").toBeLessThan(2);
        expect(geo.photo.h / geo.stage.h, "photo fills the frame height").toBeGreaterThan(0.98);
        expect(geo.photo.w / geo.stage.w).toBeGreaterThan(0.55);
        expect(geo.photo.w / geo.stage.w).toBeLessThan(0.6);
        // The copy column and the photograph share the frame side by side.
        expect(geo.panel.right).toBeLessThanOrEqual(geo.photo.left + 1);
      } else {
        // PHONE: the photograph is a BAND across the top and the stack sits
        // beneath it. The index must never be behind the photograph again.
        expect(Math.abs(geo.photo.w - geo.stage.w), "band spans the full width").toBeLessThan(2);
        expect(geo.photo.h / geo.stage.h, "band takes a share, not the frame").toBeLessThan(0.55);
        expect(geo.panel.top, "index sits below the band").toBeGreaterThanOrEqual(geo.photo.bottom - 1);
      }

      await expect(page.locator(SEAM)).toBeVisible();
      // The corner filigree belongs to the wide spread's outer corner. The
      // reel's phone act omits it and so does this one.
      await expect(page.locator(ORNAMENT)).toHaveCount(vp.shape === "wide" ? 1 : 0);
      expect(errors, "no page errors").toEqual([]);
    });

    test(`the action label never overlaps the title at ${vp.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await forceLanguage(page, "es");
      await page.goto(PATH, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      expect(await scrollToIndex(page, vp.height)).toBe(true);
      await page.waitForTimeout(500);

      // The defect Joey caught at 390 on 2026-08-02: the title's box shrank
      // below its own text, the text overflowed rather than wrapping, and the
      // action label painted through the middle of it — "EL VER CASTING".
      const rows = await page.locator(CREDIT).evaluateAll((els) =>
        els.map((row) => {
          const t = row.querySelector('[data-qa="acting-title"]')!.getBoundingClientRect();
          const s = row.querySelector('[data-qa="acting-state"]')!.getBoundingClientRect();
          const title = row.querySelector('[data-qa="acting-title"]')! as HTMLElement;
          return {
            gap: s.left - t.right,
            titleOverflows: title.scrollWidth > title.clientWidth + 1,
          };
        }),
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.gap, "action label clears the title").toBeGreaterThan(0);
        expect(r.titleOverflows, "title wraps rather than overflowing its box").toBe(false);
      }
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
