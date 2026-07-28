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
 * and that the CTA is a consequence of the final dead stop rather than of time
 * passing.
 *
 * Scroll is driven the same way the lab drives it — read the pin's published
 * `data-seq-start`/`data-seq-end` off the act and scroll to an exact fraction of
 * them — so the act is measured through the same ScrollTrigger the viewer gets.
 * The shipped page additionally runs Lenis; ScrollTrigger keeps its own native
 * scroll listener alongside it, so a programmatic instant scroll still lands,
 * and every frame assertion polls rather than sampling once.
 *
 * ## The logo layer's geometry was asserted BEFORE it had anything to paint
 *
 * These assertions were written while GW_LOGO_READY was false and the act
 * painted no mark: the layer was asserted anyway — present, centred, carrying
 * `data-gw-logo="off"` and holding zero images — and the spec reads the flag
 * from the same module the component reads it from, so the assertions flip WITH
 * the flag instead of going stale. GW.LOGO.1 flipped it, GW.LOGO.2 swapped in a
 * mark-only asset, and GW.LOGO.5 replaced that with the brand's FULL lockup.
 *
 * ## What GW.LOGO.5 changed about what is asserted here
 *
 * The lockup now carries the name, so the act's serif headline is retired and
 * the assertions follow it: the name is no longer asserted as rendered TYPE, it
 * is asserted to appear exactly ONCE — the heading survives only as `sr-only`,
 * for the outline and the section-heading census, and must not be visible type.
 * The gold credential drops beneath the mark, so it is asserted BELOW it rather
 * than above.
 *
 * The one genuinely new invariant is legibility. The brand's wordmark is BLACK,
 * which no other element in this act is, so where it lands is load-bearing: it
 * has to stay above the scrim's onset and clear of the portrait plate's own dark
 * band. `the black wordmark sits on light ground` samples the composited stage
 * behind the wordmark at both widths, at all three dead stops, and holds it to a
 * real contrast ratio — the check the two previous logo bricks could not have
 * failed, because neither of them painted anything black.
 */

const PATH = "/cinematic";

const ACT = '[data-qa="cinematic-greenworld-seq"]';
const SEQ_ACT = `${ACT} [data-qa="seq-act"]`;
const CANVAS = `${ACT} canvas[data-qa="seq-canvas"]`;
const LOGO = '[data-qa="gw-seq-logo"]';
const LOGO_IMG = '[data-qa="gw-seq-logo-img"]';
const CREDENTIAL = '[data-qa="gw-seq-eyebrow"]';
const HEADING = `${ACT} [data-qa="section-heading"]`;
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

  test("the CTA is a consequence of the final dead stop", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);

    // Hidden at the first dead stop and still hidden halfway through.
    for (const t of [0, 0.5]) {
      await scrollToRawProgress(page, t);
      await expect(page.locator(CTA_LAYER), `CTA hidden at raw ${t}`).toHaveAttribute(
        "data-gw-cta-state",
        "hidden",
      );
      const state = await page.locator(CTA_LAYER).evaluate((el) => ({
        opacity: Number(getComputedStyle(el).opacity),
        pointerEvents: getComputedStyle(el).pointerEvents,
      }));
      expect(state.opacity, `CTA transparent at raw ${t}`).toBeLessThan(0.05);
      expect(state.pointerEvents, `CTA not hit-testable at raw ${t}`).toBe("none");
      // …and it is not a tab stop while it is invisible.
      expect(await page.locator(CTA).getAttribute("tabindex"), `CTA out of tab order at raw ${t}`).toBe(
        "-1",
      );
    }

    // Visible, opaque, hit-testable and back in the tab order at the last stop.
    await scrollToRawProgress(page, 1);
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
      "CTA hit-testable at the final stop",
    ).toBe("auto");
    expect(await page.locator(CTA).getAttribute("tabindex"), "CTA back in the tab order").toBe("0");

    // It goes to the existing Green World page, internally.
    const href = await page.locator(CTA).getAttribute("href");
    expect(href ?? "", "CTA routes to /green-world").toBe("/green-world");
    expect(href ?? "", "CTA is not external").not.toContain("http");

    // Scrolling back up puts it away again — the latch reverses.
    await scrollToRawProgress(page, 0.5);
    await expect(page.locator(CTA_LAYER)).toHaveAttribute("data-gw-cta-state", "hidden");
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

  test("the logo layer is wired, centred, and paints the brand's lockup", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);
    await scrollToRawProgress(page, 0.5);

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
      // The FULL lockup, not the retired mark-only crop.
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

    // Horizontally centred on the canvas. The layer is deliberately NOT centred
    // vertically any more — it is pinned to a band that keeps the black wordmark
    // off the scrim (see LOGO_BAND) — so only x is asserted as a centre, and the
    // band is asserted as a band.
    const geo = await page.evaluate(
      ([logoSel, canvasSel]) => {
        const l = document.querySelector(logoSel)!.getBoundingClientRect();
        const c = document.querySelector(canvasSel)!.getBoundingClientRect();
        return {
          dx: l.left + l.width / 2 - (c.left + c.width / 2),
          topFrac: (l.top - c.top) / c.height,
          bottomFrac: (l.bottom - c.top) / c.height,
          spansWidth: l.width >= c.width - 1,
        };
      },
      [LOGO, CANVAS],
    );
    expect(Math.abs(geo.dx), "logo layer is horizontally centred on the canvas").toBeLessThan(2);
    expect(geo.spansWidth, "logo layer spans the stage it centres within").toBe(true);
    expect(geo.topFrac, "logo band starts below the header").toBeGreaterThan(0.1);
    expect(geo.bottomFrac, "logo band ends above the scrim's weight").toBeLessThan(0.58);
  });

  test("the name renders exactly once, and the credential sits beneath the mark", async ({
    page,
  }) => {
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

    // DOM order: the logo layer precedes the credential…
    const domOrder = await page.evaluate(
      ([logoSel, credSel]) => {
        const l = document.querySelector(logoSel)!;
        const c = document.querySelector(credSel)!;
        // eslint-disable-next-line no-bitwise
        return Boolean(l.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
      },
      [LOGO, CREDENTIAL],
    );
    expect(domOrder, "the credential follows the logo in the DOM").toBe(true);

    // …and it is genuinely painted below it, with the body below that.
    const stack = await page.evaluate(
      ([imgSel, credSel, bodySel]) => {
        const i = document.querySelector(imgSel)!.getBoundingClientRect();
        const c = document.querySelector(credSel)!.getBoundingClientRect();
        const b = document.querySelector(bodySel)!.getBoundingClientRect();
        return { markBottom: i.bottom, credTop: c.top, credBottom: c.bottom, bodyTop: b.top };
      },
      [LOGO_IMG, CREDENTIAL, '[data-qa="gw-seq-body"]'],
    );
    expect(stack.credTop, "the credential sits beneath the lockup").toBeGreaterThan(
      stack.markBottom,
    );
    expect(stack.bodyTop, "the body sits beneath the credential").toBeGreaterThanOrEqual(
      stack.credBottom - 1,
    );
  });

  test("the layers held over the plate do not move with the scrub", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);

    // The credential is the probe rather than the heading: since GW.LOGO.5 the
    // heading is `sr-only`, which is absolutely positioned and clipped to a
    // pixel, so its box says nothing about where the act's type is painted.
    const read = () =>
      page.evaluate(
        ([logoSel, credSel]) => {
          const l = document.querySelector(logoSel)!.getBoundingClientRect();
          const c = document.querySelector(credSel)!.getBoundingClientRect();
          return { logo: [l.left, l.top], credential: [c.left, c.top] };
        },
        [LOGO, CREDENTIAL],
      );

    await scrollToRawProgress(page, 0.2);
    await settleOnFrame(page, expectedIndex(0.2), 2, "raw 0.2");
    const before = await read();

    await scrollToRawProgress(page, 0.8);
    await settleOnFrame(page, expectedIndex(0.8), 2, "raw 0.8");
    const after = await read();

    expect(Math.abs(after.logo[0] - before.logo[0]), "logo x is static").toBeLessThan(2);
    expect(Math.abs(after.logo[1] - before.logo[1]), "logo y is static").toBeLessThan(2);
    expect(Math.abs(after.credential[0] - before.credential[0]), "credential x is static").toBeLessThan(2);
    expect(Math.abs(after.credential[1] - before.credential[1]), "credential y is static").toBeLessThan(2);
  });

  test("renders the English lockup", async ({ page }) => {
    await openHome(page);
    const act = page.locator(ACT);
    await expect(act).toContainText("Official distributor");
    // The name is drawn by the brand's wordmark now; the heading is sr-only and
    // carries it for the outline only.
    await expect(act.locator('[data-qa="section-heading"]')).toHaveText("Green World");
    await expect(act.locator('[data-qa="section-heading"]')).toHaveClass(/sr-only/);
    await expect(act).toContainText("Natural wellness, straight from the source.");
    await expect(page.locator(CTA)).toHaveText("How to order");
    await expect(act, "no Spanish copy leaks through").not.toContainText("Distribuidora oficial");
  });
});

test.describe("SEQ.2 — Spanish copy", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

  test("renders the Spanish lockup", async ({ page }) => {
    await openHome(page);
    const act = page.locator(ACT);
    await expect(act).toContainText("Distribuidora oficial");
    // The brand name still carries translate="no" in both languages — it is now
    // an sr-only heading rather than the act's rendered headline.
    await expect(act.locator('[data-qa="section-heading"]')).toHaveText("Green World");
    await expect(act.locator('[data-qa="section-heading"]')).toHaveAttribute("translate", "no");
    await expect(act).toContainText("Bienestar natural, directo de la fuente.");
    await expect(page.locator(CTA)).toHaveText("Cómo comprar");
    await expect(act, "no English copy leaks through").not.toContainText("Official distributor");
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
    await expect(page.locator(ACT)).toContainText("Official distributor");
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
 * here too, deliberately, rather than silently darkening the wordmark's ground.
 */
const SCRIM_STOPS: Array<[number, number]> = [
  [0, 0],
  [0.42, 0],
  [0.74, 0.62],
  [1, 0.9],
];
/** #0b0a08, the scrim's colour and the FrameScrubber's backdrop. */
const SCRIM_RGB = [11, 10, 8] as const;

test.describe("SEQ.2 — the black wordmark's ground", () => {
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ] as const) {
    test(`the black wordmark sits on light ground at ${width}`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(!GW_LOGO_READY || !GW_LOGO_SRC, "nothing is painted while the flag is false");

      const context = await browser.newContext({ viewport: { width, height }, locale: "en-US" });
      const page = await context.newPage();
      await openHome(page);

      const samples: Array<{ t: number; luminance: number; contrast: number }> = [];

      // Every dead stop, because the plate moves under a wordmark that does not.
      for (const t of [0, 0.5, 1]) {
        await scrollToRawProgress(page, t);
        await settleOnFrame(page, expectedIndex(t), 1, `wordmark ground @ raw ${t}`);
        await page.waitForTimeout(250);

        const s = await page.evaluate(
          ({ imgSel, canvasSel, stops, rgb, topFrac }) => {
            const img = document.querySelector(imgSel) as HTMLImageElement;
            const canvas = document.querySelector(canvasSel) as HTMLCanvasElement;
            const ir = img.getBoundingClientRect();
            const cr = canvas.getBoundingClientRect();

            // The wordmark's slice of the painted lockup, in viewport pixels.
            const wmTop = ir.top + ir.height * topFrac;
            const wmBottom = ir.bottom;

            // …mapped into canvas backing-store pixels (the canvas is DPR-scaled).
            const sx = canvas.width / cr.width;
            const sy = canvas.height / cr.height;
            const x0 = Math.max(0, Math.round((ir.left - cr.left) * sx));
            const x1 = Math.min(canvas.width, Math.round((ir.right - cr.left) * sx));
            const y0 = Math.max(0, Math.round((wmTop - cr.top) * sy));
            const y1 = Math.min(canvas.height, Math.round((wmBottom - cr.top) * sy));
            if (x1 <= x0 || y1 <= y0) throw new Error("the wordmark is off the canvas");

            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;

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

            // The DARKEST row of ground under the wordmark, scrim included —
            // an average would let a dark band hide inside a bright mean.
            let worstRow = 1e9;
            const rowW = x1 - x0;
            for (let y = 0; y < y1 - y0; y += 1) {
              let sum = 0;
              for (let x = 0; x < rowW; x += 1) {
                const i = (y * rowW + x) * 4;
                // Rec.709 on the plate as drawn.
                sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
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
            imgSel: LOGO_IMG,
            canvasSel: CANVAS,
            stops: SCRIM_STOPS,
            rgb: [...SCRIM_RGB] as number[],
            topFrac: WORDMARK_TOP_FRAC,
          },
        );

        const lin = ((s.luminance / 255 + 0.055) / 1.055) ** 2.4;
        const contrast = (lin + 0.05) / 0.05;
        samples.push({ t, luminance: s.luminance, contrast });
      }

      const worst = samples.reduce((a, b) => (a.contrast < b.contrast ? a : b));
      console.log(
        `[GW.LOGO.5 ${width}] wordmark ground ` +
          samples
            .map((s) => `raw${s.t}: L=${s.luminance.toFixed(0)} ${s.contrast.toFixed(1)}:1`)
            .join("  ") +
          `  | worst ${worst.contrast.toFixed(1)}:1`,
      );

      // Designed to ~7:1; held at 5:1 so the check fails loudly if the lockup is
      // ever re-centred back down into the scrim, without being brittle to a
      // re-cut plate that shifts the water a little.
      expect(
        worst.contrast,
        `black wordmark ground at ${width} (worst of 3 dead stops)`,
      ).toBeGreaterThan(5);

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
          // Let the CTA's entrance finish before the last frame is captured.
          await page.waitForTimeout(t === 1 ? 900 : 250);
          await page.screenshot({ path: shot(`seq2-${width}-${lang}-${label}.png`) });
        }

        await context.close();
      });
    }
  }
});
