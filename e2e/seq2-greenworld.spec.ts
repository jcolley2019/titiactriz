import { expect, test, type Page } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";
import { GW_LOGO_READY, GW_LOGO_SRC } from "../src/lib/ventures";

/**
 * SEQ.2 — Green World as the pinned scroll-scrub act, asserted on the SHIPPED
 * page rather than in the lab.
 *
 * The lab (seq-lab.spec.ts) proves the engine. This proves the ACT: that it is
 * the thing the home page mounts, that it pins, that the right pack is chosen
 * for the viewport, that the layers held still over the plate really are still,
 * and that the CTA is a consequence of crossing a latch rather than of time
 * passing.
 *
 * Scroll is driven the same way the lab drives it — read the pin's published
 * `data-seq-start`/`data-seq-end` off the act and scroll to an exact fraction of
 * them — so the act is measured through the same ScrollTrigger the viewer gets.
 * The shipped page additionally runs Lenis; ScrollTrigger keeps its own native
 * scroll listener alongside it, so a programmatic instant scroll still lands,
 * and every frame assertion polls rather than sampling once.
 *
 * ## SPEC.GW.1 — rewritten against the redesigned act
 *
 * The act this file used to assert (gold credential above dark-ground type, a
 * LOGO_BAND pinning the lockup, a CTA latched on the final dead stop) shipped
 * and was then redesigned out from under it:
 *
 *   • GW.COPY.1 retired the "Official distributor" credential entirely — the
 *     lockup goes straight from the drawn wordmark to one Body line. The copy
 *     assertions now hold the credential ABSENT in both languages.
 *   • GW.COPY.5 flipped the act's polarity: near-black INK on the bright plate,
 *     with one deep-green accent (`gw-seq-body-accent`) inside the line. The
 *     ground-contrast test therefore measures BLACK-on-LIGHT for the body line
 *     as well as for the wordmark, both held to 5:1. The act currently paints
 *     no light type over dark ground; if that ever returns, hold it to AA.
 *   • GW.VEIL.2 pulled the scrim out of the stack — clear through 76% of the
 *     stage, taking hold only in the last eighth. SCRIM_STOPS restates that.
 *   • GW.LAYOUT.2 replaced the band-plus-hung-copy geometry with ONE centred
 *     flex column (logo, body, CTA) sharing a single gap, offset below the
 *     fixed header. The geometry assertions follow: equal gaps, one centre.
 *   • The CTA latch moved from the final dead stop to mapped 0.4 — present for
 *     the whole back half of the scrub. It is still a latch, not a scrubbed
 *     value: one crossing, one tween, in either direction.
 *
 * What survives unchanged: the dead-stop frame mapping, name-renders-exactly-
 * once, the static-layer checks, EN/ES copy with no cross-leak, and the
 * canvas-pixel ground measurement with its analytic scrim composite and its
 * read-the-computed-filter grade correction.
 */

const PATH = "/cinematic";

const ACT = '[data-qa="cinematic-greenworld-seq"]';
const SEQ_ACT = `${ACT} [data-qa="seq-act"]`;
const CANVAS = `${ACT} canvas[data-qa="seq-canvas"]`;
const LOGO = '[data-qa="gw-seq-logo"]';
const LOGO_IMG = '[data-qa="gw-seq-logo-img"]';
const HEADING = `${ACT} [data-qa="section-heading"]`;
const BODY = '[data-qa="gw-seq-body"]';
const ACCENT = '[data-qa="gw-seq-body-accent"]';
const CTA_LAYER = '[data-qa="gw-seq-cta-layer"]';
const CTA = '[data-qa="gw-seq-cta"]';

/** The brand's wordmark occupies the bottom of the asset — measured, not guessed. */
const WORDMARK_TOP_FRAC = 0.853;

const LANG_KEY = "ta_lang";

/** Mirrors SEQ_LEAD_IN / SEQ_LEAD_OUT in SeqAct.tsx. */
const LEAD_IN = 0.08;
const LEAD_OUT = 0.08;
/** Both Green World packs, per the census in sequences.ts. */
const FRAME_COUNT = 72;

/**
 * Mirrors CTA_REVEAL_AT in CinematicGreenWorldSeq.tsx: the MAPPED playhead at
 * which the CTA latch crosses. Restated here, like the lead zones, so a change
 * to the reveal point has to be made deliberately in both places.
 */
const CTA_REVEAL_AT = 0.4;
/** Raw pin progress for a given mapped playhead — the inverse of seqProgress. */
const rawFor = (mapped: number) => LEAD_IN + mapped * (1 - LEAD_IN - LEAD_OUT);
/** Comfortably either side of the latch (mapped 0.26 and 0.5 at these raws). */
const RAW_BEFORE_CTA = 0.3;
const RAW_AFTER_CTA = 0.5;

/** The mapping under test, restated independently of the implementation. */
function expectedIndex(rawProgress: number, count = FRAME_COUNT): number {
  const mapped = Math.min(1, Math.max(0, (rawProgress - LEAD_IN) / (1 - LEAD_IN - LEAD_OUT)));
  return Math.round(mapped * (count - 1));
}

function clearStoredLang(page: Page) {
  return page.addInitScript((key) => {
    try {
      localStorage.removeItem(key as string);
    } catch {
      /* storage may be unavailable */
    }
  }, LANG_KEY);
}

async function openHome(page: Page) {
  await clearStoredLang(page);
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  // The act publishes its resolved pin bounds as soon as the trigger exists.
  await page.locator(`${SEQ_ACT}[data-seq-start]`).waitFor({ timeout: 20_000 });
  // …but the acts BELOW it are still laying out (async photos, lazy media), and
  // until they have, the document is not yet tall enough to scroll to the end of
  // this act's pin. Settling here is what stops a phone-width run from silently
  // clamping halfway through the sequence.
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function readBounds(page: Page) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error("the Green World act is not mounted");
    const start = Number(el.getAttribute("data-seq-start"));
    const end = Number(el.getAttribute("data-seq-end"));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error("the act published no usable scroll bounds");
    }
    return { start, end };
  }, SEQ_ACT);
}

/**
 * Scroll to an exact fraction of the pin, and PROVE it landed.
 *
 * The naive version (read bounds once, scrollTo, hope) is wrong on this page:
 * the document grows as the acts below finish laying out, so an early scroll can
 * be clamped by the browser to a shorter document and land at a fraction of the
 * requested offset — which looks exactly like a mapping bug. The bounds are
 * re-read on each attempt because a ScrollTrigger refresh may have moved them.
 */
async function scrollToRawProgress(page: Page, t: number) {
  let want = 0;
  let got = -1;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bounds = await readBounds(page);
    want = Math.round(bounds.start + (bounds.end - bounds.start) * t);
    got = await page.evaluate((target) => {
      window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
      return Math.round(window.scrollY);
    }, want);
    await page.waitForTimeout(200);
    if (Math.abs(got - want) <= 2) return;
    // Clamped — the page is not tall enough YET. Give the layout a beat and
    // try again against freshly published bounds.
    await page.waitForTimeout(500);
  }

  throw new Error(
    `could not scroll to raw ${t}: wanted ${want}, the document clamped at ${got}`,
  );
}

/** The frame actually painted, straight off the canvas that painted it. */
async function paintedFrame(page: Page): Promise<number> {
  return Number(await page.locator(CANVAS).getAttribute("data-seq-frame"));
}

async function settleOnFrame(page: Page, want: number, tolerance: number, label: string) {
  await expect
    .poll(async () => Math.abs((await paintedFrame(page)) - want), {
      timeout: 25_000,
      message: `${label}: want frame ~${want}`,
    })
    .toBeLessThanOrEqual(tolerance);
}

/** WCAG relative luminance from a computed `rgb(…)` string. */
function wcagLuminance(rgb: string): number {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) throw new Error(`not a computed color: ${rgb}`);
  const chan = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(Number(m[1])) + 0.7152 * chan(Number(m[2])) + 0.0722 * chan(Number(m[3]));
}

test.describe("SEQ.2 — the act on the home page", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("mounts, pins, and scrubs to its dead stops", async ({ page }) => {
    test.setTimeout(120_000);
    const diag = attachDiagnostics(page);
    await openHome(page);

    // The landscape pack, because 1440 is not a phone (the reel's 768px line).
    await expect(page.locator(SEQ_ACT)).toHaveAttribute("data-seq-id", "gw-land-1920");

    // Pinned: the published bounds span a real range, and the stage stays put
    // on screen while the page scrolls through them.
    const bounds = await page.locator(SEQ_ACT).evaluate((el) => ({
      start: Number(el.getAttribute("data-seq-start")),
      end: Number(el.getAttribute("data-seq-end")),
    }));
    expect(bounds.end - bounds.start, "pin spans ~300% of the viewport").toBeGreaterThan(900 * 2);

    await scrollToRawProgress(page, 0.25);
    const topAt25 = await page.locator(CANVAS).evaluate((el) => el.getBoundingClientRect().top);
    await scrollToRawProgress(page, 0.75);
    const topAt75 = await page.locator(CANVAS).evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(topAt75 - topAt25), "the stage is pinned, not scrolling away").toBeLessThan(4);

    // Dead stops are clamped, so both ends are exact. The middle is reached by
    // scrolling to an integer pixel inside a multi-thousand-pixel pin, so it is
    // asserted to within a frame — which still excludes both ends.
    await scrollToRawProgress(page, 0);
    await settleOnFrame(page, expectedIndex(0), 0, "first dead stop");

    await scrollToRawProgress(page, 0.5);
    await settleOnFrame(page, expectedIndex(0.5), 1, "midpoint");

    await scrollToRawProgress(page, 1);
    await settleOnFrame(page, expectedIndex(1), 0, "final dead stop");
    expect(expectedIndex(1), "the last stop is the last frame").toBe(FRAME_COUNT - 1);

    expect(diag.consoleErrors, diag.consoleErrors.join("\n")).toEqual([]);
    expect(diag.failedResponses, diag.failedResponses.join("\n")).toEqual([]);
  });

  test("the CTA is a consequence of crossing the reveal latch", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);

    // The latch sits at mapped 0.4 (raw ~0.42): hidden at the first dead stop
    // and still hidden into the front half of the scrub.
    expect(rawFor(CTA_REVEAL_AT), "the probes bracket the latch").toBeGreaterThan(RAW_BEFORE_CTA);
    expect(rawFor(CTA_REVEAL_AT)).toBeLessThan(RAW_AFTER_CTA);

    for (const t of [0, RAW_BEFORE_CTA]) {
      await scrollToRawProgress(page, t);
      await expect(page.locator(CTA_LAYER), `CTA hidden at raw ${t}`).toHaveAttribute(
        "data-gw-cta-state",
        "hidden",
      );
      const state = await page.locator(CTA_LAYER).evaluate((el) => ({
        opacity: Number(getComputedStyle(el).opacity),
        pointerEvents: getComputedStyle(el).pointerEvents,
        ariaHidden: el.getAttribute("aria-hidden"),
      }));
      expect(state.opacity, `CTA transparent at raw ${t}`).toBeLessThan(0.05);
      expect(state.pointerEvents, `CTA not hit-testable at raw ${t}`).toBe("none");
      expect(state.ariaHidden, `CTA hidden from the tree at raw ${t}`).toBe("true");
      // …and it is not a tab stop while it is invisible.
      expect(await page.locator(CTA).getAttribute("tabindex"), `CTA out of tab order at raw ${t}`).toBe(
        "-1",
      );
    }

    // Crossing the latch mid-act brings it in: visible, opaque, hit-testable
    // and back in the tab order — present for the whole back half of the scrub.
    await scrollToRawProgress(page, RAW_AFTER_CTA);
    await expect(page.locator(CTA_LAYER)).toHaveAttribute("data-gw-cta-state", "shown");
    await expect
      .poll(
        async () =>
          await page.locator(CTA_LAYER).evaluate((el) => Number(getComputedStyle(el).opacity)),
        { timeout: 10_000, message: "CTA finishes its entrance" },
      )
      .toBeGreaterThan(0.95);
    await expect(page.locator(CTA)).toBeVisible();
    expect(
      await page.locator(CTA_LAYER).evaluate((el) => getComputedStyle(el).pointerEvents),
      "CTA hit-testable once arrived",
    ).toBe("auto");
    expect(await page.locator(CTA).getAttribute("tabindex"), "CTA back in the tab order").toBe("0");

    // …and it is still there at the final dead stop, where the act releases.
    await scrollToRawProgress(page, 1);
    await expect(page.locator(CTA_LAYER)).toHaveAttribute("data-gw-cta-state", "shown");

    // The button's own pair is a fixed composite — near-black label on the gold
    // fill — so it is held to AA analytically, from the computed styles.
    const pair = await page.locator(CTA).evaluate((el) => {
      const cs = getComputedStyle(el);
      return { fg: cs.color, bg: cs.backgroundColor };
    });
    const [lighter, darker] = [wcagLuminance(pair.fg), wcagLuminance(pair.bg)].sort((a, b) => b - a);
    expect(
      (lighter + 0.05) / (darker + 0.05),
      "the CTA label is AA against its own fill",
    ).toBeGreaterThan(4.5);

    // It goes to the existing Green World page, internally.
    const href = await page.locator(CTA).getAttribute("href");
    expect(href ?? "", "CTA routes to /green-world").toBe("/green-world");
    expect(href ?? "", "CTA is not external").not.toContain("http");

    // Scrolling back above the latch puts it away again — the latch reverses.
    await scrollToRawProgress(page, RAW_BEFORE_CTA);
    await expect(page.locator(CTA_LAYER)).toHaveAttribute("data-gw-cta-state", "hidden");
    await expect
      .poll(
        async () =>
          await page.locator(CTA_LAYER).evaluate((el) => Number(getComputedStyle(el).opacity)),
        { timeout: 10_000, message: "CTA finishes its exit" },
      )
      .toBeLessThan(0.05);
    expect(await page.locator(CTA).getAttribute("tabindex"), "CTA leaves the tab order").toBe("-1");
  });

  test("the CTA actually navigates to the Green World page", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);

    // Clicked from INSIDE the lead-out zone rather than at raw 1. The mapping
    // clamps across that whole zone, so the act is on its final dead stop and
    // the CTA is fully arrived — but the pin has not yet released, so Playwright
    // nudging the element into view cannot scroll the act off screen out from
    // under the click.
    await scrollToRawProgress(page, 0.96);
    await expect(page.locator(CTA_LAYER)).toHaveAttribute("data-gw-cta-state", "shown");
    expect(await paintedFrame(page), "still on the final frame").toBe(FRAME_COUNT - 1);

    await page.locator(CTA).click();
    await expect(page).toHaveURL(/\/green-world$/);
  });

  test("one centred stack: logo, body and CTA share a centre and a gap", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);
    // Measured past the latch so the CTA layer is at rest at its shown position
    // (y = 0) and its box is the one the reader actually sees.
    await scrollToRawProgress(page, RAW_AFTER_CTA);
    await expect(page.locator(CTA_LAYER)).toHaveAttribute("data-gw-cta-state", "shown");
    await expect
      .poll(
        async () =>
          await page.locator(CTA_LAYER).evaluate((el) => Number(getComputedStyle(el).opacity)),
        { timeout: 10_000, message: "CTA settles before geometry is read" },
      )
      .toBeGreaterThan(0.95);

    const layer = page.locator(LOGO);
    await expect(layer, "the logo layer is always in the DOM").toHaveCount(1);
    await expect(layer).toHaveAttribute("data-gw-logo", GW_LOGO_READY && GW_LOGO_SRC ? "on" : "off");

    if (!GW_LOGO_READY) {
      expect(GW_LOGO_SRC, "no source is claimed while the flag is false").toBeNull();
      expect(
        await page.locator(`${LOGO} img`).count(),
        "the layer paints nothing while GW_LOGO_READY is false",
      ).toBe(0);
    } else {
      const img = page.locator(LOGO_IMG);
      await expect(img).toBeVisible();
      // The FULL lockup — the brand's own rendering of mark and name.
      expect(GW_LOGO_SRC, "the act paints the brand's own lockup").toBe(
        "/ventures/green-world-lockup.png",
      );
      await expect(img).toHaveAttribute("src", GW_LOGO_SRC);
      // It decoded — a 404 would still be "visible" as a broken image box.
      expect(
        await img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
        "the lockup actually decoded",
      ).toBeGreaterThan(0);
    }

    // GW.LAYOUT.2 — the three are flex children of ONE centred column. So the
    // layout's invariants are the column's: everything shares the canvas's
    // horizontal centre, the stack starts below the fixed header, the body sits
    // on unveiled water, and the two gaps are the SAME gap.
    const geo = await page.evaluate(
      ([logoSel, bodySel, ctaSel, canvasSel]) => {
        const l = document.querySelector(logoSel)!.getBoundingClientRect();
        const b = document.querySelector(bodySel)!.getBoundingClientRect();
        const k = document.querySelector(ctaSel)!.getBoundingClientRect();
        const c = document.querySelector(canvasSel)!.getBoundingClientRect();
        const cx = c.left + c.width / 2;
        return {
          logoDx: l.left + l.width / 2 - cx,
          bodyDx: b.left + b.width / 2 - cx,
          ctaDx: k.left + k.width / 2 - cx,
          logoTopFrac: (l.top - c.top) / c.height,
          bodyBottomFrac: (b.bottom - c.top) / c.height,
          ctaBottomFrac: (k.bottom - c.top) / c.height,
          gapLogoBody: b.top - l.bottom,
          gapBodyCta: k.top - b.bottom,
        };
      },
      [LOGO, BODY, CTA_LAYER, CANVAS],
    );
    expect(Math.abs(geo.logoDx), "logo shares the canvas centre").toBeLessThan(2);
    expect(Math.abs(geo.bodyDx), "body shares the canvas centre").toBeLessThan(2);
    expect(Math.abs(geo.ctaDx), "CTA shares the canvas centre").toBeLessThan(2);
    // The stack's box starts at the fixed header's own height (top-28/top-32),
    // so nothing in it can centre itself up underneath the nav.
    expect(geo.logoTopFrac, "the stack starts below the fixed header").toBeGreaterThan(0.13);
    // GW.VEIL.2 — the veil is clear through 76% of the stage; the type sits on
    // unveiled water, and only the handoff below it is darkened.
    expect(geo.bodyBottomFrac, "the body sits on unveiled water").toBeLessThan(0.78);
    expect(geo.ctaBottomFrac, "the CTA stays out of the scrim's weight").toBeLessThan(0.93);
    expect(geo.gapLogoBody, "logo and body are separated, not touching").toBeGreaterThan(8);
    expect(
      Math.abs(geo.gapLogoBody - geo.gapBodyCta),
      "the two gaps are the SAME gap (one flex column)",
    ).toBeLessThan(3);
  });

  test("the name renders exactly once, drawn by the mark", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);
    await scrollToRawProgress(page, 0.5);

    // The serif headline is retired: the heading survives for the outline and
    // the section-heading census, but it must not be visible type.
    const heading = page.locator(HEADING);
    await expect(heading, "the act keeps exactly one heading, for the outline").toHaveCount(1);
    await expect(heading).toHaveClass(/sr-only/);
    const headingBox = await heading.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    expect(
      Math.max(headingBox.w, headingBox.h),
      "the heading is screen-reader only, not rendered type",
    ).toBeLessThanOrEqual(2);

    // …and the name is not set as visible type anywhere else in the act either.
    const visibleName = await page.locator(ACT).evaluate((act) => {
      let hits = 0;
      const walk = document.createTreeWalker(act, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walk.nextNode())) {
        const el = n.parentElement;
        if (!el || !/green\s*world/i.test(n.textContent ?? "")) continue;
        if (el.closest(".sr-only")) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) hits += 1;
      }
      return hits;
    });
    expect(visibleName, "the brand name is drawn by the mark, not also set in type").toBe(0);

    // GW.COPY.1 — the credential is retired outright: nothing stands between
    // the drawn name and the one Body line, in either language.
    expect(
      await page.locator('[data-qa="gw-seq-eyebrow"]').count(),
      "the credential element is gone, not merely emptied",
    ).toBe(0);

    // DOM and paint order: the lockup precedes the body line, directly.
    const stack = await page.evaluate(
      ([imgSel, bodySel]) => {
        const i = document.querySelector(imgSel)!.getBoundingClientRect();
        const b = document.querySelector(bodySel)!.getBoundingClientRect();
        return { markBottom: i.bottom, bodyTop: b.top };
      },
      [LOGO_IMG, BODY],
    );
    expect(stack.bodyTop, "the body sits directly beneath the lockup").toBeGreaterThan(
      stack.markBottom,
    );
  });

  test("the layers held over the plate do not move with the scrub", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);

    // The body line is the probe rather than the heading: the heading is
    // `sr-only`, absolutely positioned and clipped to a pixel, so its box says
    // nothing about where the act's type is painted. Both probes sit below the
    // CTA latch and above it, so the latch crossing between the two reads must
    // not move either of them.
    const read = () =>
      page.evaluate(
        ([logoSel, bodySel]) => {
          const l = document.querySelector(logoSel)!.getBoundingClientRect();
          const b = document.querySelector(bodySel)!.getBoundingClientRect();
          return { logo: [l.left, l.top], body: [b.left, b.top] };
        },
        [LOGO, BODY],
      );

    await scrollToRawProgress(page, 0.2);
    await settleOnFrame(page, expectedIndex(0.2), 2, "raw 0.2");
    const before = await read();

    await scrollToRawProgress(page, 0.8);
    await settleOnFrame(page, expectedIndex(0.8), 2, "raw 0.8");
    const after = await read();

    expect(Math.abs(after.logo[0] - before.logo[0]), "logo x is static").toBeLessThan(2);
    expect(Math.abs(after.logo[1] - before.logo[1]), "logo y is static").toBeLessThan(2);
    expect(Math.abs(after.body[0] - before.body[0]), "body x is static").toBeLessThan(2);
    expect(Math.abs(after.body[1] - before.body[1]), "body y is static").toBeLessThan(2);
  });

  test("renders the English lockup", async ({ page }) => {
    await openHome(page);
    const act = page.locator(ACT);
    // The name is drawn by the brand's wordmark; the heading is sr-only and
    // carries it for the outline only.
    await expect(act.locator('[data-qa="section-heading"]')).toHaveText("Green World");
    await expect(act.locator('[data-qa="section-heading"]')).toHaveClass(/sr-only/);
    // GW.COPY.3 — one line, split so the accent lands on the provenance clause.
    await expect(act.locator(BODY)).toHaveText(
      "Natural wellness, straight from the source. I'll show you how to order it, step by step.",
    );
    await expect(act.locator(ACCENT)).toHaveText("straight from the source");
    // GW.COPY.5 — dark ink, with the deep-green accent, not the gold.
    expect(
      await act.locator(BODY).evaluate((el) => getComputedStyle(el).color),
      "the body is set in ink",
    ).toBe("rgb(11, 10, 8)");
    expect(
      await act.locator(ACCENT).evaluate((el) => getComputedStyle(el).color),
      "the accent is the deep green",
    ).toBe("rgb(11, 93, 42)");
    await expect(page.locator(CTA)).toHaveText("How to order");
    // The credential is retired — in BOTH languages, not merely translated away.
    await expect(act, "no credential renders").not.toContainText("Official distributor");
    await expect(act, "no Spanish copy leaks through").not.toContainText("Distribuidora oficial");
    await expect(act, "no Spanish copy leaks through").not.toContainText("Bienestar natural");
  });
});

test.describe("SEQ.2 — Spanish copy", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

  test("renders the Spanish lockup", async ({ page }) => {
    await openHome(page);
    const act = page.locator(ACT);
    // The brand name still carries translate="no" in both languages — it is an
    // sr-only heading rather than the act's rendered headline.
    await expect(act.locator('[data-qa="section-heading"]')).toHaveText("Green World");
    await expect(act.locator('[data-qa="section-heading"]')).toHaveAttribute("translate", "no");
    await expect(act.locator(BODY)).toHaveText(
      "Bienestar natural, directo de la fuente. Te muestro cómo pedirlo paso a paso.",
    );
    // Spanish puts the accent on its own words — that is why the line is split
    // in the locale files rather than marked up at a fixed offset.
    await expect(act.locator(ACCENT)).toHaveText("directo de la fuente");
    await expect(page.locator(CTA)).toHaveText("Cómo comprar");
    await expect(act, "no credential renders").not.toContainText("Distribuidora oficial");
    await expect(act, "no English copy leaks through").not.toContainText("Official distributor");
    await expect(act, "no English copy leaks through").not.toContainText("Natural wellness");
  });
});

test.describe("SEQ.2 — portrait viewport", () => {
  test.use({ viewport: { width: 390, height: 844 }, locale: "en-US" });

  test("a phone gets the portrait pack, on the same dead stops", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);
    await expect(page.locator(SEQ_ACT)).toHaveAttribute("data-seq-id", "gw-port-1080");

    await scrollToRawProgress(page, 0);
    await settleOnFrame(page, expectedIndex(0), 0, "phone first dead stop");
    await expect(page.locator(CTA_LAYER), "CTA still hidden at the first stop").toHaveAttribute(
      "data-gw-cta-state",
      "hidden",
    );
    await scrollToRawProgress(page, 1);
    await settleOnFrame(page, expectedIndex(1), 0, "phone final dead stop");
    await expect(page.locator(CTA_LAYER)).toHaveAttribute("data-gw-cta-state", "shown");
    await expect(page.locator(CTA), "CTA tappable on a phone").toBeVisible();
  });
});

test.describe("SEQ.2 — reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("first frame, full lockup and a clickable CTA, with no pin at all", async ({ page }) => {
    test.setTimeout(120_000);
    // The `reducedMotion` fixture is not honoured in this Playwright build (see
    // the same note in cinematic.spec.ts) — emulate it on the page instead.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await page.locator(SEQ_ACT).waitFor({ timeout: 20_000 });

    // No pin is created, so no bounds are ever published.
    await expect(page.locator(SEQ_ACT)).not.toHaveAttribute("data-seq-start", /.*/);

    // Parked on the first frame…
    await expect
      .poll(() => paintedFrame(page), { timeout: 25_000, message: "reduced motion first frame" })
      .toBe(0);

    // …and it stays there no matter how far the page is scrolled.
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior }),
    );
    await page.waitForTimeout(700);
    expect(await paintedFrame(page), "no frame advanced under reduced motion").toBe(0);

    // The layer, the type and a fully live CTA are all there from the start.
    await expect(page.locator(LOGO)).toHaveCount(1);
    await expect(page.locator(BODY)).toContainText("Natural wellness");
    await expect(page.locator(CTA_LAYER)).toHaveAttribute("data-gw-cta-state", "shown");
    await expect(page.locator(CTA)).toBeVisible();
    expect(await page.locator(CTA).getAttribute("tabindex"), "CTA is a tab stop").toBe("0");
    expect(
      await page.locator(CTA_LAYER).evaluate((el) => getComputedStyle(el).pointerEvents),
      "CTA hit-testable under reduced motion",
    ).toBe("auto");
  });
});

/**
 * The scrim's stops, restated from CinematicGreenWorldSeq.tsx exactly as the
 * frame mapping above is restated — so a change to the gradient has to be made
 * here too, deliberately, rather than silently darkening the type's ground.
 * GW.VEIL.2: clear through 76% of the stage, 0.45 by 93%, 0.88 at the bottom.
 */
const SCRIM_STOPS: Array<[number, number]> = [
  [0, 0],
  [0.76, 0],
  [0.93, 0.45],
  [1, 0.88],
];
/** #0b0a08, the scrim's colour and the FrameScrubber's backdrop. */
const SCRIM_RGB = [11, 10, 8] as const;

test.describe("SEQ.2 — dark type on bright water", () => {
  /**
   * GW.COPY.5 flipped the act's polarity: the black wordmark AND the ink body
   * line both stand on the bright plate, so BOTH grounds are measured — canvas
   * pixels behind each zone, graded by the canvas's own computed CSS filter
   * (GW.BRIGHT.1 — getImageData returns the UNGRADED backing store), with the
   * scrim composited analytically, at every dead stop, worst row wins. Held to
   * 5:1 against black — designed brighter; 5:1 fails loudly if the stack is
   * ever re-centred down into the scrim without being brittle to a re-cut
   * plate. The act paints no light type over dark ground any more; if that
   * returns, hold it to AA (4.5:1) the same way.
   */
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ] as const) {
    test(`the ink sits on light ground at ${width}`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(!GW_LOGO_READY || !GW_LOGO_SRC, "nothing is painted while the flag is false");

      const context = await browser.newContext({ viewport: { width, height }, locale: "en-US" });
      const page = await context.newPage();
      await openHome(page);

      // Each zone is a slice of an overlay element, in fractions of its own
      // box: the wordmark is the bottom of the lockup asset; the body line is
      // its whole rect.
      const zones = [
        { name: "wordmark", sel: LOGO_IMG, topFrac: WORDMARK_TOP_FRAC },
        { name: "body", sel: BODY, topFrac: 0 },
      ];
      const samples: Array<{ zone: string; t: number; luminance: number; contrast: number }> = [];

      // Every dead stop, because the plate moves under type that does not.
      for (const t of [0, 0.5, 1]) {
        await scrollToRawProgress(page, t);
        await settleOnFrame(page, expectedIndex(t), 1, `type ground @ raw ${t}`);
        await page.waitForTimeout(250);

        for (const zone of zones) {
          const s = await page.evaluate(
            ({ zoneSel, canvasSel, stops, rgb, topFrac }) => {
              const el = document.querySelector(zoneSel) as HTMLElement;
              const canvas = document.querySelector(canvasSel) as HTMLCanvasElement;
              const zr = el.getBoundingClientRect();
              const cr = canvas.getBoundingClientRect();

              // The zone's slice, in viewport pixels…
              const zTop = zr.top + zr.height * topFrac;
              const zBottom = zr.bottom;

              // …mapped into canvas backing-store pixels (the canvas is DPR-scaled).
              const sx = canvas.width / cr.width;
              const sy = canvas.height / cr.height;
              const x0 = Math.max(0, Math.round((zr.left - cr.left) * sx));
              const x1 = Math.min(canvas.width, Math.round((zr.right - cr.left) * sx));
              const y0 = Math.max(0, Math.round((zTop - cr.top) * sy));
              const y1 = Math.min(canvas.height, Math.round((zBottom - cr.top) * sy));
              if (x1 <= x0 || y1 <= y0) throw new Error("the zone is off the canvas");

              const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
              const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;

              // GW.BRIGHT.1: the plate carries a CSS `filter`, and getImageData
              // returns the UNGRADED backing store — so the grade has to be
              // applied here or this test would measure ground the reader never
              // sees. It is read off the canvas rather than restated, so it
              // cannot drift from whatever the act actually sets.
              const filter = getComputedStyle(canvas).filter;
              const num = (fn: string) => {
                const m = filter.match(new RegExp(`${fn}\\(([0-9.]+)\\)`));
                return m ? Number(m[1]) : 1;
              };
              const bright = num("brightness");
              const sat = num("saturate");
              const cl = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
              const sr0 = 0.213 + 0.787 * sat;
              const sr1 = 0.715 - 0.715 * sat;
              const sr2 = 0.072 - 0.072 * sat;
              const sg0 = 0.213 - 0.213 * sat;
              const sg1 = 0.715 + 0.285 * sat;
              const sg2 = 0.072 - 0.072 * sat;
              const sb0 = 0.213 - 0.213 * sat;
              const sb1 = 0.715 - 0.715 * sat;
              const sb2 = 0.072 + 0.928 * sat;
              const grade = (r: number, g: number, b: number) => {
                const R = cl(r * bright);
                const G = cl(g * bright);
                const B = cl(b * bright);
                return [
                  cl(sr0 * R + sr1 * G + sr2 * B),
                  cl(sg0 * R + sg1 * G + sg2 * B),
                  cl(sb0 * R + sb1 * G + sb2 * B),
                ] as const;
              };

              const alphaAt = (p: number) => {
                for (let i = 0; i < stops.length - 1; i += 1) {
                  const [p0, a0] = stops[i];
                  const [p1, a1] = stops[i + 1];
                  if (p >= p0 && p <= p1) {
                    return p1 === p0 ? a1 : a0 + ((a1 - a0) * (p - p0)) / (p1 - p0);
                  }
                }
                return stops[stops.length - 1][1];
              };

              // The DARKEST row of ground under the zone, scrim included —
              // an average would let a dark band hide inside a bright mean.
              let worstRow = 1e9;
              const rowW = x1 - x0;
              for (let y = 0; y < y1 - y0; y += 1) {
                let sum = 0;
                for (let x = 0; x < rowW; x += 1) {
                  const i = (y * rowW + x) * 4;
                  // Rec.709 on the plate as GRADED — i.e. as it is actually painted.
                  const [R, G, B] = grade(data[i], data[i + 1], data[i + 2]);
                  sum += 0.2126 * R + 0.7152 * G + 0.0722 * B;
                }
                const plate = sum / rowW;
                // Composite the scrim over it at this row's height on the stage.
                const stageFrac = (y0 + y) / canvas.height;
                const a = alphaAt(stageFrac);
                const scrimL = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
                const L = plate * (1 - a) + scrimL * a;
                if (L < worstRow) worstRow = L;
              }
              return { luminance: worstRow };
            },
            {
              zoneSel: zone.sel,
              canvasSel: CANVAS,
              stops: SCRIM_STOPS,
              rgb: [...SCRIM_RGB] as number[],
              topFrac: zone.topFrac,
            },
          );

          const lin = ((s.luminance / 255 + 0.055) / 1.055) ** 2.4;
          const contrast = (lin + 0.05) / 0.05;
          samples.push({ zone: zone.name, t, luminance: s.luminance, contrast });
        }
      }

      for (const zone of zones) {
        const zoneSamples = samples.filter((s) => s.zone === zone.name);
        const worst = zoneSamples.reduce((a, b) => (a.contrast < b.contrast ? a : b));
        console.log(
          `[GW.COPY.5 ${width}] ${zone.name} ground ` +
            zoneSamples
              .map((s) => `raw${s.t}: L=${s.luminance.toFixed(0)} ${s.contrast.toFixed(1)}:1`)
              .join("  ") +
            `  | worst ${worst.contrast.toFixed(1)}:1`,
        );
        expect(
          worst.contrast,
          `black-on-light ${zone.name} ground at ${width} (worst of 3 dead stops)`,
        ).toBeGreaterThan(5);
      }

      await context.close();
    });
  }
});

test.describe("SEQ.2 — evidence", () => {
  for (const width of [390, 1440]) {
    for (const locale of ["en-US", "es-CO"] as const) {
      test(`dead stops at ${width}, ${locale}`, async ({ browser }) => {
        test.setTimeout(180_000);
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 900 },
          locale,
        });
        const page = await context.newPage();
        await openHome(page);

        const lang = locale === "en-US" ? "en" : "es";
        for (const [label, t] of [
          ["first", 0],
          ["mid", 0.5],
          ["last", 1],
        ] as const) {
          await scrollToRawProgress(page, t);
          await settleOnFrame(page, expectedIndex(t), 1, `${label} @ ${width}`);
          // Let the CTA's entrance finish before the mid and last frames are
          // captured — the latch has crossed by mid (mapped 0.5 > 0.4).
          await page.waitForTimeout(t >= 0.5 ? 900 : 250);
          await page.screenshot({ path: shot(`seq2-${width}-${lang}-${label}.png`) });
        }

        await context.close();
      });
    }
  }
});
