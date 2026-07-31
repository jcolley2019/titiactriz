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

/* ============ B. THE GREEN WORLD ACT IS PLATE ALL THE WAY DOWN ============ */

/** Scroll to the middle of a pinned seq act's own scrub range and settle. */
async function intoSeqAct(page: Page) {
  const range = await page.evaluate(() => {
    const el = document.querySelector('[data-qa="seq-act"]');
    if (!el) return null;
    const start = Number(el.getAttribute("data-seq-start") ?? NaN);
    const end = Number(el.getAttribute("data-seq-end") ?? NaN);
    return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
  });
  if (!range) throw new Error("MOBILE.EDGE.1: the seq act published no scrub bounds");
  await page.evaluate((y) => window.scrollTo(0, y), range.start + (range.end - range.start) * 0.5);
  await page.waitForTimeout(1100);
}

test.describe("MOBILE.EDGE.1 B — Green World fills the phone viewport", () => {
  test("the plate is painted to the stage's bottom edge — no dead stripe", async ({ page }) => {
    await openPhoneHome(page);
    await intoSeqAct(page);

    const geo = await page.evaluate(() => {
      const stage = document.querySelector('[data-qa="seq-stage"]');
      const canvas = document.querySelector('[data-qa="seq-canvas"]') as HTMLCanvasElement | null;
      if (!stage || !canvas) return null;
      const s = stage.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      return {
        viewport: window.innerHeight,
        stageTop: Math.round(s.top),
        stageBottom: Math.round(s.bottom),
        canvasBottom: Math.round(c.bottom),
        canvasTop: Math.round(c.top),
      };
    });
    expect(geo, "the seq act is pinned and painting").not.toBeNull();

    // The stage covers the visible viewport, and the canvas covers the stage.
    expect(geo!.stageTop, "the pinned stage is at the top of the fold").toBeLessThanOrEqual(0);
    expect(geo!.stageBottom, "the stage reaches the bottom of the fold").toBeGreaterThanOrEqual(
      geo!.viewport,
    );
    expect(geo!.canvasTop, "the plate starts at the stage's top").toBeLessThanOrEqual(geo!.stageTop + 1);
    expect(
      geo!.canvasBottom,
      "the plate is painted all the way to the stage's bottom",
    ).toBeGreaterThanOrEqual(geo!.stageBottom - 1);

    // THE CLAIM JOEY MADE: the bottom of the act is ARTWORK, not the backdrop.
    // Read straight off the canvas that painted it. The Green World plates are
    // bright water end to end (GW.BRIGHT.1 measured the brightest decile at
    // 244/255 on this pack), so "not the #0b0a08 ground" is a wide margin, and
    // the deepest sample sits one row off the very last pixel.
    const samples = await page.evaluate(() => {
      const c = document.querySelector('[data-qa="seq-canvas"]') as HTMLCanvasElement | null;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return null;
      return [0.9, 0.95, 0.99].map((f) => {
        const y = Math.min(c.height - 1, Math.round(c.height * f));
        const d = ctx.getImageData(Math.round(c.width / 2), y, 1, 1).data;
        return { at: f, r: d[0], g: d[1], b: d[2], lum: (d[0] + d[1] + d[2]) / 3 };
      });
    });
    expect(samples, "the canvas is readable").not.toBeNull();
    for (const s of samples!) {
      // The act's own backdrop is #0b0a08 — mean 9. Anything near it at the foot
      // of the act IS the dead stripe.
      expect(
        s.lum,
        `at ${Math.round(s.at * 100)}% of the stage the plate is artwork, not ground`,
      ).toBeGreaterThan(60);
    }

    await page.screenshot({ path: shot("mobileedge-gw-390.png") });
  });

  test("the seq stage is sized by the covering static unit", async ({ page }) => {
    await openPhoneHome(page);
    const rule = await ruleTextFor(page, ".cine-stage-lvh");
    expect(rule, "the seq stage's height class is declared").not.toBe("");
    expect(rule, "it covers the collapsed-chrome viewport").toContain("100lvh");

    const cls = await page.evaluate(
      () => document.querySelector('[data-qa="seq-stage"]')?.className ?? "",
    );
    expect(cls, "and the seq act's stage is on it").toContain("cine-stage-lvh");
    expect(cls, "not on the svh stage class it used to share with the reel").not.toContain(
      "cine-h-full",
    );
  });

  test("the nav treatment over the act is the same on a phone as on a desktop", async ({ page }) => {
    // The nav-grounding law (REVIEW.2b) is a SCROLL-POSITION law, not a
    // per-act one: transparent over the hero, grounded past ~80vh. Joey asked
    // for this to be verified rather than assumed — so it is read at both
    // viewports over the same act and compared.
    const readNav = async (w: number, h: number) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1200);
      await intoSeqAct(page);
      return page.evaluate(() => {
        const el = document.querySelector("header");
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { background: cs.backgroundColor, blur: cs.backdropFilter };
      });
    };

    await page.addInitScript(() => {
      try {
        localStorage.setItem("ta_lang", "en");
      } catch {
        /* noop */
      }
    });
    const phone = await readNav(390, 844);
    const desktop = await readNav(1440, 900);

    expect(phone, "the phone renders a header").not.toBeNull();
    expect(desktop, "the desktop renders a header").not.toBeNull();
    expect(
      phone!.background,
      "over the Green World act the phone nav grounds exactly as the desktop nav does",
    ).toBe(desktop!.background);
    expect(phone!.blur, "and carries the same blur").toBe(desktop!.blur);
  });
});

/* ============ C. THE TITILINKS ACT DOES NOT OVERFLOW ITS OWN STAGE ============ */

test.describe("MOBILE.EDGE.1 C — the TitiLinks act's foot is clean", () => {
  test("nothing in the act is painted past the bottom of its stage", async ({ page }) => {
    await openPhoneHome(page);

    const act = await page.evaluate(() => {
      const el = document.querySelector('[data-qa="cinematic-titilinks"]');
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    });
    expect(act, "the TitiLinks act is on the page").not.toBeNull();
    // Into the act, past the pin's start, where the phone composition is drawn.
    await page.evaluate((y) => window.scrollTo(0, y), act! + 1200);
    await page.waitForTimeout(1000);

    const overflow = await page.evaluate(() => {
      const stage = document.querySelector('[data-qa="cinematic-titilinks"] .cine-vh-full');
      if (!stage) return null;
      const s = stage.getBoundingClientRect();

      // An element's VISIBLE rect: its own box, intersected with every clipping
      // ancestor between it and the stage. The act legitimately contains scrolling
      // mocks (the browser frame's viewport, the phone mockups) whose content is
      // taller than they are and is clipped by them — that content is not
      // "painted past the stage", and reading raw boxes would flag all of it.
      // What this looks for is content the STAGE ITSELF has to clip.
      const visibleRect = (el: Element) => {
        const b = el.getBoundingClientRect();
        let top = b.top;
        let bottom = b.bottom;
        let node = el.parentElement;
        while (node && node !== stage) {
          const cs = getComputedStyle(node);
          if (cs.overflow !== "visible" || cs.overflowY !== "visible") {
            const p = node.getBoundingClientRect();
            top = Math.max(top, p.top);
            bottom = Math.min(bottom, p.bottom);
          }
          node = node.parentElement;
        }
        return { top, bottom };
      };

      const worst: { tag: string; qa: string; cls: string; bottom: number; over: number }[] = [];
      for (const el of Array.from(stage.querySelectorAll("*"))) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        const v = visibleRect(el);
        if (v.bottom <= v.top) continue; // already fully clipped by an ancestor
        const over = v.bottom - s.bottom;
        if (over > 1) {
          worst.push({
            tag: el.tagName.toLowerCase(),
            qa: el.getAttribute("data-qa") ?? "",
            cls: (typeof el.className === "string" ? el.className : "").slice(0, 60),
            bottom: Math.round(v.bottom),
            over: Math.round(over),
          });
        }
      }
      worst.sort((a, b) => b.over - a.over);
      return {
        stageTop: Math.round(s.top),
        stageBottom: Math.round(s.bottom),
        worst: worst.slice(0, 5),
      };
    });

    expect(overflow, "the TitiLinks stage is rendered").not.toBeNull();
    // THE DEFECT, stated exactly: a gold-bordered callout row began at the
    // stage's bottom edge and ran 150px past it, so the clip sliced it into a
    // pair of hairlines across the foot of the act. Any element painting past
    // the stage's bottom is that bug, whatever it is.
    expect(
      overflow!.worst,
      `nothing overflows the stage's bottom edge (worst: ${JSON.stringify(overflow!.worst)})`,
    ).toEqual([]);

    await page.screenshot({ path: shot("mobileedge-tl-390.png") });
  });

  test("the phone callout row is inside the stage, and still rendered", async ({ page }) => {
    await openPhoneHome(page);
    const act = await page.evaluate(() => {
      const el = document.querySelector('[data-qa="cinematic-titilinks"]');
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    });
    await page.evaluate((y) => window.scrollTo(0, y), act! + 1200);
    await page.waitForTimeout(1000);

    const row = await page.evaluate(() => {
      const stage = document.querySelector('[data-qa="cinematic-titilinks"] .cine-vh-full');
      if (!stage) return null;
      const s = stage.getBoundingClientRect();
      // The callouts are the gold-bordered pills; on the phone they are the ones
      // that are actually laid out (the lg column is display:none).
      const pills = Array.from(stage.querySelectorAll(".tl-callout")).filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      });
      return {
        count: pills.length,
        top: Math.round(Math.min(...pills.map((p) => p.getBoundingClientRect().top))),
        bottom: Math.round(Math.max(...pills.map((p) => p.getBoundingClientRect().bottom))),
        stageTop: Math.round(s.top),
        stageBottom: Math.round(s.bottom),
      };
    });

    expect(row, "the stage is rendered").not.toBeNull();
    // The fix must not have moved the row off the act instead of into it.
    expect(row!.count, "the phone still gets its callout row").toBeGreaterThan(0);
    expect(row!.top, "the row starts inside the stage").toBeGreaterThanOrEqual(row!.stageTop - 1);
    expect(row!.bottom, "and ends inside it").toBeLessThanOrEqual(row!.stageBottom + 1);
  });
});

/* ==================== D. EDGE-TO-EDGE CHROME ==================== */

test.describe("MOBILE.EDGE.1 D — the page is declared edge-to-edge", () => {
  test("the viewport covers the screen and the chrome has a brand colour", async ({ page }) => {
    await openPhoneHome(page);

    const head = await page.evaluate(() => {
      const meta = (name: string) =>
        document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? null;
      return { viewport: meta("viewport"), themeColor: meta("theme-color") };
    });

    expect(head.viewport, "a viewport meta is declared").not.toBeNull();
    expect(
      head.viewport!,
      "the layout viewport is the whole screen — notch and home indicator included",
    ).toContain("viewport-fit=cover");
    expect(head.viewport!, "at the device's own width").toContain("width=device-width");

    // ONE static brand value, per what TitiLinks shipped rather than what its
    // plan proposed. #121212 is `--background` and the TA.7e boot cover's own
    // literal, so Safari's chrome, the first paint and the page ground agree.
    expect(head.themeColor, "the chrome is painted a brand colour").toBe("#121212");
  });

  test("the fixed header and the footer state their insets", async ({ page }) => {
    await openPhoneHome(page);

    const chrome = await page.evaluate(() => {
      const header = document.querySelector("header") as HTMLElement | null;
      const footerBox = document.querySelector("footer .container-editorial") as HTMLElement | null;
      return {
        headerPadTop: header?.style.paddingTop ?? null,
        headerComputedTop: header ? getComputedStyle(header).paddingTop : null,
        footerPadBottom: footerBox?.style.paddingBottom ?? null,
        footerComputed: footerBox ? getComputedStyle(footerBox).paddingBottom : null,
      };
    });

    // The declaration is the law; env() is 0px on this machine, so the computed
    // value is the base clearance the calc() adds to — unchanged from before.
    expect(chrome.headerPadTop, "the header clears the notch").toContain("safe-area-inset-top");
    expect(chrome.headerComputedTop, "and is unchanged at 0 insets").toBe("12px");
    expect(chrome.footerPadBottom, "the footer clears the home indicator").toContain(
      "safe-area-inset-bottom",
    );
    expect(chrome.footerComputed, "and is unchanged at 0 insets").toBe("48px");
  });
});

/* ========== E. THE HERO→REEL SEAM WEARS THE SKIRT (MOBILE.EDGE.3) ========== */

test.describe("MOBILE.EDGE.3 E — the seam skirt guards the hero→reel boundary", () => {
  test("the skirt sits on the seam at zero layout cost", async ({ page }) => {
    await openPhoneHome(page);

    const geo = await page.evaluate(() => {
      const hero = document.querySelector('[data-qa="cinematic-section"]');
      if (!hero) return null;
      // Same walk as suite A: the act that follows the hero, whatever it is.
      let next: Element | null = hero.nextElementSibling;
      while (next && next.getBoundingClientRect().height === 0) next = next.nextElementSibling;
      if (!next) return null;
      const h = hero.getBoundingClientRect();
      const n = next.getBoundingClientRect();
      const skirt = next.querySelector('[data-qa="seam-skirt"]');
      if (!skirt) return { hasSkirt: false as const, gap: Math.round(n.top - h.bottom) };
      const s = skirt.getBoundingClientRect();
      const cs = getComputedStyle(skirt);
      return {
        hasSkirt: true as const,
        gap: Math.round(n.top - h.bottom),
        seamOffset: Math.round(s.top - n.top),
        height: Math.round(s.height),
        overhangLeft: Math.round(s.left - n.left),
        overhangRight: Math.round(n.right - s.right),
        position: cs.position,
        pointer: cs.pointerEvents,
        onSection: skirt.parentElement === next,
        inStage: skirt.closest(".cine-stage-lvh") !== null,
      };
    });

    expect(geo, "the hero and its successor are on the page").not.toBeNull();

    // THE LAW THIS BRICK MAY NOT BEND: the skirt costs zero layout — the GAP
    // between hero.bottom and reel.top stays exactly 0.
    expect(geo!.gap, "hero.bottom ↔ reel.top GAP is exactly 0").toBe(0);

    expect(geo!.hasSkirt, "the reel act wears the seam skirt").toBe(true);
    if (geo!.hasSkirt) {
      expect(geo!.seamOffset, "the skirt's top edge IS the seam").toBe(0);
      expect(geo!.height, "a short skirt — the ruled ~110px, not a veil's reach").toBe(110);
      expect(geo!.overhangLeft, "it spans the act, flush left").toBe(0);
      expect(geo!.overhangRight, "and flush right").toBe(0);
      expect(geo!.position, "absolute — zero layout shift by construction").toBe("absolute");
      expect(geo!.pointer, "and it can never eat a tap").toBe("none");
      // The mid-act clause is enforced by parentage: on the SECTION the skirt
      // scrolls away with the seam as the pin engages; inside the pinned stage
      // it would ride the whole scrub instead.
      expect(geo!.onSection, "the skirt is the section's child").toBe(true);
      expect(geo!.inStage, "and never the pinned stage's").toBe(false);
    }

    await page.screenshot({ path: shot("mobileedge-skirt-390.png") });
  });

  test("the skirt yields once the reader is past the seam", async ({ page }) => {
    await openPhoneHome(page);

    // At the rest position the skirt is at full strength — this is the one
    // scroll position it exists for, the expanded bar sampling the act's
    // first rows.
    const atRest = await page.evaluate(() => {
      const el = document.querySelector('[data-qa="seam-skirt"]');
      return el ? parseFloat(getComputedStyle(el).opacity) : null;
    });
    expect(atRest, "the skirt is on the page").not.toBeNull();
    expect(atRest!, "full strength at the rest position").toBe(1);

    // Past the fade window the photograph must be bare: the chrome that needed
    // the skirt collapses on the first scroll.
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(1100);
    const scrolled = await page.evaluate(() => {
      const el = document.querySelector('[data-qa="seam-skirt"]');
      return {
        scrollY: Math.round(window.scrollY),
        opacity: el ? parseFloat(getComputedStyle(el).opacity) : null,
      };
    });
    expect(scrolled.opacity, "the skirt is still on the page").not.toBeNull();
    // Lenis law: assert against the OBSERVED position, not the aimed one.
    expect(scrolled.scrollY, "the sweep actually left the fade window").toBeGreaterThan(350);
    expect(scrolled.opacity!, "past the window the photograph is bare").toBe(0);
  });

  test("the skirt is declared as the law writes it", async ({ page }) => {
    await openPhoneHome(page);

    const rule = await ruleTextFor(page, ".cine-seam-skirt");
    expect(rule, "the skirt class is declared").not.toBe("");
    expect(rule, "a ~110px skirt").toContain("height: 110px");
    expect(rule, "a fade, not a wash").toContain("linear-gradient");
    // The CSSOM serializes #0b0a08 to its rgb triplet; asserting the triplet
    // pins the fade to the ground colour at both ends of the gradient.
    expect(rule, "from the page ground colour").toContain("11, 10, 8");
    expect(rule, "absolute, so the seam GAP cannot move").toContain("position: absolute");
    expect(rule, "and inert to the pointer").toContain("pointer-events: none");
  });
});
