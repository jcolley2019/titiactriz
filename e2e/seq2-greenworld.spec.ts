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
 * ## The logo layer is asserted while it is EMPTY
 *
 * GW_LOGO_READY is false: the act paints no mark. The layer is asserted anyway —
 * present, centred, carrying `data-gw-logo="off"` and holding zero images — and
 * the spec reads the flag from the same module the component reads it from, so
 * the day the flag flips these assertions flip WITH it instead of going stale.
 * That is the point of asserting an empty layer: the geometry is pinned before
 * the asset exists, so landing the asset cannot silently move it.
 */

const PATH = "/cinematic";

const ACT = '[data-qa="cinematic-greenworld-seq"]';
const SEQ_ACT = `${ACT} [data-qa="seq-act"]`;
const CANVAS = `${ACT} canvas[data-qa="seq-canvas"]`;
const LOGO = '[data-qa="gw-seq-logo"]';
const CTA_LAYER = '[data-qa="gw-seq-cta-layer"]';
const CTA = '[data-qa="gw-seq-cta"]';

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

  test("the logo layer is wired, centred, and empty while the flag is false", async ({ page }) => {
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
      await expect(page.locator('[data-qa="gw-seq-logo-img"]')).toBeVisible();
    }

    // Centred over the canvas — asserted now, while the layer is empty, so that
    // landing the asset cannot move it without failing here.
    const geo = await page.evaluate(
      ([logoSel, canvasSel]) => {
        const l = document.querySelector(logoSel)!.getBoundingClientRect();
        const c = document.querySelector(canvasSel)!.getBoundingClientRect();
        return {
          dx: l.left + l.width / 2 - (c.left + c.width / 2),
          dy: l.top + l.height / 2 - (c.top + c.height / 2),
          covers: l.width >= c.width - 1 && l.height >= c.height - 1,
        };
      },
      [LOGO, CANVAS],
    );
    expect(Math.abs(geo.dx), "logo layer is horizontally centred on the canvas").toBeLessThan(2);
    expect(Math.abs(geo.dy), "logo layer is vertically centred on the canvas").toBeLessThan(2);
    expect(geo.covers, "logo layer spans the stage it centres within").toBe(true);
  });

  test("the layers held over the plate do not move with the scrub", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);

    const read = () =>
      page.evaluate(
        ([logoSel, headingSel]) => {
          const l = document.querySelector(logoSel)!.getBoundingClientRect();
          const h = document.querySelector(headingSel)!.getBoundingClientRect();
          return { logo: [l.left, l.top], heading: [h.left, h.top] };
        },
        [LOGO, `${ACT} [data-qa="section-heading"]`],
      );

    await scrollToRawProgress(page, 0.2);
    await settleOnFrame(page, expectedIndex(0.2), 2, "raw 0.2");
    const before = await read();

    await scrollToRawProgress(page, 0.8);
    await settleOnFrame(page, expectedIndex(0.8), 2, "raw 0.8");
    const after = await read();

    expect(Math.abs(after.logo[0] - before.logo[0]), "logo x is static").toBeLessThan(2);
    expect(Math.abs(after.logo[1] - before.logo[1]), "logo y is static").toBeLessThan(2);
    expect(Math.abs(after.heading[0] - before.heading[0]), "heading x is static").toBeLessThan(2);
    expect(Math.abs(after.heading[1] - before.heading[1]), "heading y is static").toBeLessThan(2);
  });

  test("renders the English lockup", async ({ page }) => {
    await openHome(page);
    const act = page.locator(ACT);
    await expect(act).toContainText("Official distributor");
    await expect(act.locator('[data-qa="section-heading"]')).toHaveText("Green World");
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
    // The brand name is the headline in both languages, and carries translate="no".
    await expect(act.locator('[data-qa="section-heading"]')).toHaveText("Green World");
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
