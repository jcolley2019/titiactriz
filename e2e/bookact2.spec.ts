import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { routeSupabase } from "./_admin";

/**
 * SKIPPED (EVENTS.1, 2026-08-04) — this gate has no subject.
 *
 * Owner ruling: the Book act is UNMOUNTED from the cinematic home; the Events
 * act took its slot (position 5, after the gallery, before Green World). Every
 * law below is measured on a live render of an act that no longer paints, so
 * the file would fail for a reason that is not a defect.
 *
 * It is SKIPPED rather than deleted, to match the component: CinematicBook.tsx
 * stays in the repo with the swap and the publisher-law status recorded on it,
 * and re-mounting it in HomeCinematic is the whole revive. This gate is what
 * would prove that revive, so it is kept intact and waiting — not rewritten,
 * because the act it describes has not changed a line.
 */
test.skip(true, "EVENTS.1 — the Book act is unmounted; the Events act holds its slot");

/**
 * BOOK.ACT.2 — the Book act holds, fills its stage, and seals its seam.
 *
 * The act shipped (BOOK.ACT.1) at `min-h-[80svh]` with no pin. Two defects
 * followed from that, both reproduced here before they were fixed:
 *
 *   • IT READ SHORT — one fifth of the frame short of a full viewport, so the
 *     announcement never owned the screen it was announcing on.
 *   • THE SEAM LEAKED — that missing fifth exposed a strip of the NEXT act,
 *     Green World's bright water, beneath the act at its settled position
 *     (measured 180px at 1440×900). An act owns its full ground.
 *
 * The dwell itself — engage, hold, release on the uniform `+=120%` — is proved
 * alongside the other three story acts in review3-dwell.spec.ts, which is where
 * the "one distance, not four" law lives. This file proves the STAGE and the
 * SEAM.
 *
 * Laws, each falsifiable on the live render:
 *
 *  1. FULL STAGE — the act occupies a full viewport, at the site's act padding
 *     (1.5rem horizontal, 6rem top, 4rem bottom), with its content column
 *     vertically centred in that padded box.
 *  2. THE SEAM IS SEALED — across the act's bottom edge, at the settled
 *     position and at every point of the hold, every sampled point is owned by
 *     the act: never Green World, and never a bright ground. The act's bottom
 *     edge never rises above the frame's while the act is still holding.
 *  3. BOTH VIEWPORTS — laws 1 and 2 hold at 1440 and at 390.
 *  4. REDUCED MOTION — no pin is built, and the act still fills its stage and
 *     still owns its ground.
 *
 * Evidence: _qa/bookact2-{1440,390}.png (settled) and
 * _qa/bookact2-midpin-1440.png (held mid-dwell).
 */

const PATH = "/cinematic";
const ACT = '[data-qa="cinematic-book"]';
const COLUMN = '[data-qa="book-act-column"]';
const GW = '[data-qa="cinematic-greenworld-seq"]';

/** The dwell, as a fraction of the viewport — the story acts' one price. */
const DWELL_FACTOR = 1.2;

/** DESIGN.md act padding, in px: 1.5rem / 6rem / 4rem. */
const ACT_PADDING = { left: 24, top: 96, bottom: 64 };

async function settle(page: Page, ms = 900) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function openHome(page: Page) {
  await routeSupabase(page);
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await page.locator(ACT).waitFor({ timeout: 20_000 });
  await settle(page);
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

const rawPinStartOf = (page: Page, sel: string) =>
  page
    .locator(sel)
    .locator("xpath=ancestor::*[contains(@class,'pin-spacer')]")
    .first()
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

/**
 * The pin start, once it has stopped moving — the review3-dwell pattern. The
 * page keeps re-measuring after load (async media, the reel's wide rebuild,
 * fonts), and each refresh can shift every later act's flow position, so the
 * offset is trusted only after two consecutive reads agree.
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

type Stage = { top: number; bottom: number; height: number };

const stageOf = (page: Page): Promise<Stage> =>
  page.locator(ACT).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height };
  });

/**
 * Wheel until the act is genuinely holding the top of the frame, and return the
 * pin start it engaged on — the review3-dwell pattern. A stabilized read is not
 * a permanent one: a refresh landing between the read and the end of the wheel
 * re-flows every later act, so the aim is re-taken against a fresh measurement.
 */
async function engage(page: Page) {
  let pinStart = await pinStartOf(page, ACT);
  for (let i = 0; i < 4; i++) {
    await wheelTo(page, pinStart + 6);
    if (Math.abs((await stageOf(page)).top) <= 2) break;
    pinStart = await pinStartOf(page, ACT);
  }
  return pinStart;
}

/**
 * The pin distance, MEASURED: the spacer is sized to the act's height plus the
 * dwell, so the difference is the dwell exactly. Aiming the sweep below at a
 * fraction of the *assumed* 120% instead cost a run — a pin start read 122px
 * stale put the "98% of the dwell" aim 100px PAST the release, and the act was
 * correctly reported as no longer holding.
 */
const dwellOf = (page: Page) =>
  page.evaluate((sel) => {
    const section = document.querySelector(sel)!;
    const spacer = section.closest(".pin-spacer")!;
    return spacer.getBoundingClientRect().height - section.getBoundingClientRect().height;
  }, ACT);

type Probe = {
  x: number;
  y: number;
  owner: string;
  ownedByAct: boolean;
  inNeighbour: boolean;
  luminance: number;
};

/**
 * Sample the painted ground across the act's bottom edge and the frame's own
 * bottom rows: which element the browser hits there, and the relative luminance
 * of the first ancestor that lays down an OPAQUE colour. Green World's plate is
 * a `<canvas>`, which paints without a background colour — so a leak is caught
 * by identity (`inNeighbour`) as well as by brightness.
 *
 * Rows are kept in the last few pixels of the frame, below the floating
 * scroll-to-top button's box (`bottom-4`, 48px tall), so the probe reads the
 * act's ground rather than a piece of chrome that legitimately floats over it.
 */
async function probeSeam(page: Page, vw: number, vh: number, actBottom: number): Promise<Probe[]> {
  const strip = Math.max(0, vh - actBottom);
  const ys = Array.from(
    new Set(
      [
        Math.round(actBottom) - 2, // just inside the act's own bottom edge
        Math.round(actBottom), // the edge itself
        Math.round(actBottom + strip / 2), // the middle of any exposed strip
        vh - 6,
        vh - 3,
        vh - 1,
      ]
        .map((y) => Math.min(vh - 1, Math.max(0, y)))
        .sort((a, b) => a - b),
    ),
  );
  const xs = [0.04, 0.2, 0.36, 0.5, 0.64, 0.8, 0.96].map((f) => Math.round(vw * f));

  return page.evaluate(
    ({ actSel, gwSel, ys, xs }) => {
      const act = document.querySelector(actSel)!;
      const gw = document.querySelector(gwSel);
      const lin = (c: number) => {
        const u = c / 255;
        return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
      };
      const out: Probe[] = [];
      for (const y of ys) {
        for (const x of xs) {
          const hit = document.elementFromPoint(x, y);
          if (!hit) {
            out.push({ x, y, owner: "(nothing)", ownedByAct: false, inNeighbour: false, luminance: 1 });
            continue;
          }
          let el: Element | null = hit;
          let luminance = 1;
          while (el) {
            const m = /^rgba?\(([^)]+)\)$/.exec(getComputedStyle(el).backgroundColor);
            if (m) {
              const p = m[1].split(",").map((v) => parseFloat(v));
              const alpha = p.length > 3 ? p[3] : 1;
              if (alpha >= 0.999) {
                luminance = 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
                break;
              }
            }
            el = el.parentElement;
          }
          const qa = hit.getAttribute("data-qa");
          out.push({
            x,
            y,
            owner: `${hit.tagName.toLowerCase()}${qa ? `[${qa}]` : ""}`,
            ownedByAct: act === hit || act.contains(hit),
            inNeighbour: !!gw && (gw === hit || gw.contains(hit)),
            luminance,
          });
        }
      }
      return out;
    },
    { actSel: ACT, gwSel: GW, ys, xs },
  );
}

/** Law 2, at one scroll position. */
function expectSealed(probes: Probe[], where: string) {
  for (const p of probes) {
    expect(
      p.inNeighbour,
      `${where}: (${p.x},${p.y}) exposes Green World — owner ${p.owner}`,
    ).toBe(false);
    expect(p.ownedByAct, `${where}: the act owns (${p.x},${p.y}) — owner ${p.owner}`).toBe(true);
    expect(
      p.luminance,
      `${where}: no bright leak at (${p.x},${p.y}) — L=${p.luminance.toFixed(4)}, owner ${p.owner}`,
    ).toBeLessThan(0.03);
  }
}

/**
 * Laws 1 and 2 at one viewport. Run for 1440 and 390 — the act's stage and its
 * seam are the same laws at both, only the numbers change.
 */
function stageAndSeamAt(vw: number, vh: number) {
  const DWELL = DWELL_FACTOR * vh;

  test.describe(`BOOK.ACT.2 — ${vw}`, () => {
    test.use({ viewport: { width: vw, height: vh }, locale: "es-CO" });

    test(`${vw} — the act fills a full viewport with its column centred`, async ({ page }) => {
      test.setTimeout(180_000);
      await openHome(page);

      const geom = await page.evaluate(
        ({ actSel, colSel }) => {
          const a = document.querySelector(actSel)!;
          const c = document.querySelector(colSel)!;
          const ar = a.getBoundingClientRect();
          const cr = c.getBoundingClientRect();
          const cs = getComputedStyle(a);
          return {
            actHeight: ar.height,
            colHeight: cr.height,
            // The column's centre, measured from the act's own top edge.
            colCentre: cr.top + cr.height / 2 - ar.top,
            padTop: parseFloat(cs.paddingTop),
            padBottom: parseFloat(cs.paddingBottom),
            padLeft: parseFloat(cs.paddingLeft),
            padRight: parseFloat(cs.paddingRight),
          };
        },
        { actSel: ACT, colSel: COLUMN },
      );

      // Law 1a — a full viewport of stage.
      expect(
        geom.actHeight,
        `the act fills the viewport (got ${geom.actHeight} of ${vh})`,
      ).toBeGreaterThanOrEqual(vh - 1);

      // Law 1b — the site's act padding, top-weighted to clear the header.
      expect(geom.padLeft, "act padding: 1.5rem left").toBeCloseTo(ACT_PADDING.left, 0);
      expect(geom.padRight, "act padding: 1.5rem right").toBeCloseTo(ACT_PADDING.left, 0);
      expect(geom.padTop, "act padding: 6rem top").toBeCloseTo(ACT_PADDING.top, 0);
      expect(geom.padBottom, "act padding: 4rem bottom").toBeCloseTo(ACT_PADDING.bottom, 0);

      // Law 1c — the column is centred in the PADDED box, and is genuinely
      // shorter than the stage (otherwise "centred" would say nothing).
      const expected = geom.padTop + (geom.actHeight - geom.padTop - geom.padBottom) / 2;
      expect(
        Math.abs(geom.colCentre - expected),
        `the column is centred in the padded stage (centre ${geom.colCentre.toFixed(1)}, expected ${expected.toFixed(1)})`,
      ).toBeLessThanOrEqual(2);
      expect(
        geom.colHeight,
        `the column is shorter than the stage (${geom.colHeight.toFixed(0)} of ${geom.actHeight.toFixed(0)})`,
      ).toBeLessThan(geom.actHeight);
    });

    test(`${vw} — the seam holds through the whole dwell`, async ({ page }) => {
      test.setTimeout(300_000);
      await openHome(page);

      // Engage first: it proves the act holds AND converges the measurement the
      // rest of the sweep is aimed with.
      await engage(page);
      const dwell = await dwellOf(page);
      expect(
        Math.abs(dwell - DWELL),
        `the act takes the story price, +=120% (got ${dwell})`,
      ).toBeLessThanOrEqual(12);

      // Arriving, settled at the top of the frame, and five points of the hold,
      // as fractions of the measured dwell.
      const FRACTIONS = [-0.3, 0.006, 0.25, 0.5, 0.75, 0.9, 0.97];

      // The sweep is asserted on the state it OBSERVES, not on the state its aim
      // intended. Lenis owns this route with `duration: 1.1`, so the easing
      // carries past the last wheel event — measured ~100px at 390 — and a late
      // aim can therefore land past the release even off a freshly re-anchored
      // offset. Below the release the next act owns the frame by design, so such
      // a position is UNCOVERED, not a seam failure. Coverage is then asserted
      // in its own right, so a sweep that quietly stopped reaching the hold
      // cannot pass by testing nothing.
      let held = 0;
      let deepest = Number.NEGATIVE_INFINITY;

      for (const f of FRACTIONS) {
        const label = `${(f * 100).toFixed(1)}% of the dwell`;
        // Re-anchor on every aim: one extra comparison, and the whole class of
        // stale-offset aiming goes away.
        await wheelTo(page, (await pinStartOf(page, ACT)) + f * dwell);
        const stage = await stageOf(page);
        if (stage.top < -2) continue; // past the release — see above
        held += 1;
        deepest = Math.max(deepest, f);

        // Law 2a — the act's bottom edge never rises above the frame's.
        expect(
          stage.bottom,
          `${label}: the act reaches the bottom of the frame (bottom ${stage.bottom.toFixed(1)} of ${vh}, top ${stage.top.toFixed(1)})`,
        ).toBeGreaterThanOrEqual(vh - 1);

        // Law 2b — and the ground actually painted there is the act's.
        expectSealed(await probeSeam(page, vw, vh, stage.bottom), label);

        if (f === 0.006) await page.screenshot({ path: shot(`bookact2-${vw}.png`) });
        if (f === 0.5 && vw === 1440) {
          await page.screenshot({ path: shot("bookact2-midpin-1440.png") });
        }
      }

      // The sweep really did cover the act's arrival and its hold.
      expect(held, `the sweep observed the act holding (${held} positions)`).toBeGreaterThanOrEqual(
        5,
      );
      expect(
        deepest,
        `the sweep reached deep into the hold (deepest ${(deepest * 100).toFixed(1)}%)`,
      ).toBeGreaterThanOrEqual(0.75);
    });
  });
}

stageAndSeamAt(1440, 900);
stageAndSeamAt(390, 844);

test.describe("BOOK.ACT.2 — reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

  test("no pin is built, and the act still fills its stage and owns its ground", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openHome(page);

    // Law 4a — reduced motion skips the dwell, like every other story act.
    await expect(
      page.locator(ACT).locator("xpath=ancestor::*[contains(@class,'pin-spacer')]"),
      "the book act is unpinned under reduced motion",
    ).toHaveCount(0);

    // Law 4b — the stage and the seam are CSS, not motion, so they still hold.
    // Lenis is not running here, so the act is placed with a plain scroll.
    await page.evaluate((sel) => {
      const el = document.querySelector(sel)!;
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY,
        behavior: "instant" as ScrollBehavior,
      });
    }, ACT);
    await page.waitForTimeout(400);

    const stage = await stageOf(page);
    expect(Math.abs(stage.top), "the act is at the top of the frame").toBeLessThanOrEqual(2);
    expect(
      stage.height,
      `the act fills the viewport under reduced motion (got ${stage.height})`,
    ).toBeGreaterThanOrEqual(899);
    expectSealed(await probeSeam(page, 1440, 900, stage.bottom), "reduced motion, settled");
  });
});
