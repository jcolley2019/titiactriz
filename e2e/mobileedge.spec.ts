import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";

/**
 * MOBILE.EDGE.1 — PHONE VIEWPORT TRUTH.
 *
 * Four defects from Joey's iPhone review, and the thing they have in common is
 * that none of them is visible on a desktop browser: they are all consequences of
 * a viewport whose height MOVES (Safari's chrome collapses as you scroll) and
 * whose edges are not rectangular (notch, Dynamic Island, home indicator).
 *
 * A headless Chromium cannot reproduce either condition — `svh`, `lvh` and `dvh`
 * all resolve to the same number here, and there are no safe-area insets to
 * report. So this spec does NOT pretend to measure the iPhone. It measures the
 * two things that are true on every device and that the defects were made of:
 *
 *   1. GEOMETRY AT 390 — an act's box against the viewport's box, and against its
 *      own children. A stage that lets its content overflow past its bottom edge
 *      (the TitiLinks callouts) is a bug at every viewport height; it is only
 *      VISIBLE at the one where the content stops fitting.
 *   2. THE DECLARATION — that the height unit and the safe-area law each act is
 *      supposed to obey is the one actually in the cascade. `env(safe-area-inset-*)`
 *      resolves to 0px here, so its EFFECT is untestable, but its PRESENCE is not:
 *      the rule text is read straight out of the CSSOM.
 *
 * What still needs a real phone: that the insets are the right size, and that the
 * chrome-collapse cases behave. Those are Joey's eye, not this file's.
 */

const PHONE = { width: 390, height: 844 };

async function openPhoneHome(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("ta_lang", "en");
    } catch {
      /* noop */
    }
  });
  await page.setViewportSize(PHONE);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

/**
 * The CSS text of every rule whose selector matches `selector`, read out of the
 * document's own stylesheets. This is how a `calc(... + env(safe-area-inset-*))`
 * is asserted on a machine that has no insets: the computed value is the fallback,
 * but the DECLARATION is the law, and the declaration is right here.
 */
async function ruleTextFor(page: Page, selector: string): Promise<string> {
  return page.evaluate((sel) => {
    let out = "";
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin (the font stylesheets)
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule && rule.selectorText === sel) out += rule.cssText;
      }
    }
    return out;
  }, selector);
}

/* ================== A. THE HERO OWNS EXACTLY THE FIRST VIEWPORT ================== */

test.describe("MOBILE.EDGE.1 A — the hero owns the first viewport", () => {
  test("at 390 the hero covers the fold and no successor pixels are visible", async ({ page }) => {
    await openPhoneHome(page);

    const geo = await page.evaluate(() => {
      const hero = document.querySelector('[data-qa="cinematic-section"]');
      if (!hero) return null;
      const h = hero.getBoundingClientRect();
      // The act that follows the hero in document order — whatever it is. Naming
      // it by hook would make this spec a hostage to the running order.
      let next: Element | null = hero.nextElementSibling;
      while (next && next.getBoundingClientRect().height === 0) next = next.nextElementSibling;
      const n = next?.getBoundingClientRect();
      return {
        viewport: window.innerHeight,
        heroTop: Math.round(h.top),
        heroBottom: Math.round(h.bottom),
        nextTop: n ? Math.round(n.top) : null,
        scrollY: Math.round(window.scrollY),
      };
    });

    expect(geo, "the hero act is on the page").not.toBeNull();
    expect(geo!.scrollY, "the page lands at the top").toBe(0);
    expect(geo!.heroTop, "the hero starts at the fold's top").toBe(0);

    // THE CLAIM. The hero's own box reaches at least the bottom of the visual
    // viewport — "at least", because `lvh` is deliberately ≥ the visible height:
    // while Safari's bar is shown the hero overflows behind it, and that overflow
    // is exactly what keeps the next act off the screen.
    expect(
      geo!.heroBottom,
      "the hero's box covers the whole visible viewport",
    ).toBeGreaterThanOrEqual(geo!.viewport);

    // AND NOTHING FOLLOWS IT INTO THE FOLD.
    expect(geo!.nextTop, "an act follows the hero").not.toBeNull();
    expect(
      geo!.nextTop!,
      "the next act starts at or below the fold — no successor pixels",
    ).toBeGreaterThanOrEqual(geo!.viewport);

    await page.screenshot({ path: shot("mobileedge-hero-390.png") });
  });

  test("the hero is sized by lvh and padded by the safe area", async ({ page }) => {
    await openPhoneHome(page);

    // The height unit, as declared. `lvh` is the whole point of CINE.FLOW.5-FIX2:
    // a STATIC full-screen height. `dvh` here would re-open the leak.
    const heightRule = await ruleTextFor(page, ".cine-act-lvh");
    expect(heightRule, "the hero's height class is declared").not.toBe("");
    // Only the winning declaration survives into the CSSOM — the `100vh`
    // fallback on the line above it is a source fact this API cannot see, so it
    // is not asserted here.
    expect(heightRule, "the hero is sized in lvh").toContain("100lvh");

    // The safe-area law, as declared — its effect is 0px on this machine.
    const padRule = await ruleTextFor(page, ".cine-hero-safe");
    expect(padRule, "the hero's safe padding class is declared").not.toBe("");
    expect(padRule, "top padding clears the notch").toContain("safe-area-inset-top");
    expect(padRule, "bottom padding clears the home indicator").toContain("safe-area-inset-bottom");

    const cueRule = await ruleTextFor(page, ".cine-scrollcue-safe");
    expect(cueRule, "the scroll cue clears the home indicator").toContain("safe-area-inset-bottom");

    // AND THE LAW IS ON THE ELEMENT, not merely in the stylesheet.
    const applied = await page.evaluate(() => {
      const hero = document.querySelector('[data-qa="cinematic-section"]');
      const cue = document.querySelector('[data-qa="cinematic-scrollcue"]');
      if (!hero || !cue) return null;
      const cs = getComputedStyle(hero);
      return {
        heroClasses: hero.className,
        cueClasses: cue.className,
        // env() → 0 here, so these are the base clearances the calc() adds to.
        padTop: cs.paddingTop,
        padBottom: cs.paddingBottom,
        padLeft: cs.paddingLeft,
      };
    });
    expect(applied, "hero and cue are both present").not.toBeNull();
    expect(applied!.heroClasses).toContain("cine-hero-safe");
    expect(applied!.heroClasses).toContain("cine-safe-x");
    expect(applied!.cueClasses).toContain("cine-scrollcue-safe");
    // The clearances the act had before this brick, unchanged where there are no
    // insets to add: pt-24 / pb-16 / px-6.
    expect(applied!.padTop, "the header clearance is unchanged at 0 insets").toBe("96px");
    expect(applied!.padBottom, "the foot clearance is unchanged at 0 insets").toBe("64px");
    expect(applied!.padLeft, "the gutter is unchanged at 0 insets").toBe("24px");
  });
});
