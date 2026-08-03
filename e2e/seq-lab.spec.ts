import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";

/**
 * SEQ.1 — frame-scrub engine, asserted at its dead stops.
 *
 * The lab is driven by REAL page scroll through the same ScrollTrigger the
 * viewer gets; the spec reads the pin's resolved scroll bounds off the act
 * (`data-seq-start` / `data-seq-end`) and scrolls to an exact fraction of them.
 * There is no test-only playhead, so a pass here means the pin, the dead-zone
 * mapping and the decode pipeline all work together — not merely that a
 * function returns the right number.
 *
 * The frame index is read from the HUD, which is fed by the scrubber's own
 * paint callback. The canvas additionally carries `data-seq-frame`, written by
 * the draw that painted it, and the two are asserted to agree — the HUD cannot
 * report a frame that was never put on screen.
 *
 * ## The packs
 *
 * Mirrors src/components/cinematic/seq/sequences.ts (the STEP 0 census). All
 * five packs now carry 72 frames, but the mid-stop expectation is still derived
 * per pack rather than hardcoded to one number — the census is free to go
 * ragged again the next time a pack is re-cut.
 *
 * ## SEQ.LAB.FIX.2 — a declared pack whose frames are not on disk SKIPS, by name
 *
 * The census is CODE and ships with the repo; the frame packs are ASSETS and
 * some of them do not. `titans-1280` and `titans-720` are an unlaunched
 * venture's footage, deliberately gitignored (HYGIENE.2) until the Titans act
 * ships, so a fresh clone or a CI runner has the packs declared and the frames
 * absent. Before this fix that combination FAILED, and it failed dishonestly:
 * the reduced-motion check reported `Expected 0, Received -1` on a 20s poll —
 * which reads as an engine bug and is really a missing directory.
 *
 * So presence is measured on disk, once, at collection time, and each pack's
 * frame-dependent checks are their OWN test:
 *
 *   - frames on disk        → the checks run,
 *   - no frames on disk     → the checks SKIP, and the skip names the pack and
 *                             says why (never a failure, never a silent pass —
 *                             a skipped test is visible in the run),
 *   - SOME frames on disk   → a loud named failure, because a short pack is the
 *                             one mistake the engine cannot detect: it 404s the
 *                             tail and holds the last good frame forever.
 *
 * Checks that do NOT depend on the frames — that the act mounts, that the HUD
 * publishes the declared total, that reduced motion binds no scrub — are
 * registry-driven and still cover EVERY declared pack, present or not. Those
 * are the checks that would catch a census edited without its assets.
 *
 * ## Why the ends are exact and the middle is not
 *
 * Progress 0 and 1 are CLAMPED by the lead-in/lead-out dead zones, so they land
 * on frame 0 and frame N-1 regardless of sub-pixel scroll rounding — those are
 * asserted exactly, and they are the assertions that matter (a dead stop that
 * drifts is the bug this act exists to avoid). The midpoint is reached by
 * scrolling to an integer pixel inside a multi-thousand-pixel pin, so the
 * achieved progress is 0.5 only to within a pixel; it is asserted to within one
 * frame, which still excludes both ends and any gross mapping error.
 */

const PATH = "/qa/seq-lab";

/** The census, restated: id, frame count and extension per pack. */
const DECLARED = [
  { id: "gw-land-1920", count: 72, ext: ".webp" },
  { id: "gw-port-1080", count: 72, ext: ".webp" },
  { id: "gw-port-1600", count: 72, ext: ".webp" },
  { id: "titans-1280", count: 72, ext: ".webp" },
  { id: "titans-720", count: 72, ext: ".webp" },
] as const;

/** Packs live under `public` + the census `dir`, which is `/ventures/seq/<id>`. */
const SEQ_ROOT = path.resolve(process.cwd(), "public", "ventures", "seq");

/**
 * Frames actually on disk for a pack. The extension comes from the census
 * rather than being hardcoded: a pack that changed format would otherwise
 * count zero and be quietly written off as absent.
 */
function framesOnDisk(id: string, ext: string): number {
  const dir = path.join(SEQ_ROOT, id);
  if (!fs.existsSync(dir)) return 0;
  const frame = new RegExp(`^f-\\d+${ext.replace(".", "\\.")}$`);
  return fs.readdirSync(dir).filter((name) => frame.test(name)).length;
}

type Pack = { id: string; count: number; ext: string; onDisk: number; absent: boolean };

const PACKS: Pack[] = DECLARED.map((pack) => {
  const onDisk = framesOnDisk(pack.id, pack.ext);
  return { ...pack, onDisk, absent: onDisk === 0 };
});

const ABSENT = PACKS.filter((pack) => pack.absent);

function skipReason(pack: Pack): string {
  return (
    `${pack.id} SKIPPED: the census declares ${pack.count} frames, and ` +
    `public/ventures/seq/${pack.id}/ holds none on this checkout. That pack's ` +
    `footage is gitignored until its act ships (HYGIENE.2), so there is nothing ` +
    `to scrub here — this is an absent asset, not an engine fault.`
  );
}

// Printed once at collection. `list` does not surface a skip's annotation, and
// a skip whose reason is invisible is only marginally better than a silent pass.
if (ABSENT.length > 0) {
  console.log(`[seq-lab] ${ABSENT.length} declared pack(s) have no frames on disk:`);
  for (const pack of ABSENT) console.log(`[seq-lab]   ${skipReason(pack)}`);
}

/** Mirrors SEQ_LEAD_IN / SEQ_LEAD_OUT in SeqAct.tsx. */
const LEAD_IN = 0.08;
const LEAD_OUT = 0.08;

/** The mapping under test, restated independently of the implementation. */
function expectedIndex(rawProgress: number, count: number): number {
  const mapped = Math.min(1, Math.max(0, (rawProgress - LEAD_IN) / (1 - LEAD_IN - LEAD_OUT)));
  return Math.round(mapped * (count - 1));
}

async function scrollToRawProgress(page: Page, id: string, t: number) {
  const bounds = await page.evaluate((seqId) => {
    const el = document.querySelector(`[data-qa="seq-act"][data-seq-id="${seqId}"]`);
    if (!el) throw new Error(`act ${seqId} is not mounted`);
    const start = Number(el.getAttribute("data-seq-start"));
    const end = Number(el.getAttribute("data-seq-end"));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error(`act ${seqId} published no usable scroll bounds`);
    }
    return { start, end };
  }, id);

  const top = Math.round(bounds.start + (bounds.end - bounds.start) * t);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), top);
  await page.waitForTimeout(120);
}

function hud(page: Page, id: string) {
  return page.locator(`[data-qa="seq-hud-${id}"]`);
}

async function hudIndex(page: Page, id: string): Promise<number> {
  return Number(await hud(page, id).getAttribute("data-seq-index"));
}

/**
 * Sample the canvas backing store on a grid. A blank act is either untouched
 * (all zero, fully transparent) or flat backdrop; a painted frame is neither.
 */
async function canvasSample(page: Page, id: string) {
  return await page.evaluate((seqId) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-seq-id="${seqId}"]`);
    if (!canvas) throw new Error(`canvas ${seqId} is not mounted`);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    const { width, height } = canvas;
    if (width === 0 || height === 0) throw new Error(`canvas ${seqId} has no backing store`);

    let min = 255;
    let max = 0;
    let offBackdrop = 0;
    let samples = 0;
    for (let gy = 1; gy < 8; gy += 1) {
      for (let gx = 1; gx < 8; gx += 1) {
        const px = ctx.getImageData(Math.floor((width * gx) / 8), Math.floor((height * gy) / 8), 1, 1).data;
        const lum = px[0] * 0.299 + px[1] * 0.587 + px[2] * 0.114;
        min = Math.min(min, lum);
        max = Math.max(max, lum);
        // Backdrop is #0b0a08 (11,10,8); anything meaningfully off it is paint.
        if (Math.abs(px[0] - 11) > 6 || Math.abs(px[1] - 10) > 6 || Math.abs(px[2] - 8) > 6) offBackdrop += 1;
        samples += 1;
      }
    }
    return { min, max, offBackdrop, samples, frame: Number(canvas.getAttribute("data-seq-frame")) };
  }, id);
}

async function openLab(page: Page) {
  await page.goto(PATH);
  await expect(page.locator('[data-qa="seq-lab-heading"]')).toBeVisible();
  // Bounds are published by the pin, which is built from the census — an act
  // with no frames on disk still mounts and still pins, so every DECLARED pack
  // is waited for here regardless of presence.
  for (const pack of PACKS) {
    await page.locator(`[data-qa="seq-act"][data-seq-id="${pack.id}"][data-seq-start]`).waitFor();
  }
}

test.describe("SEQ.1 — census vs disk", () => {
  for (const pack of PACKS) {
    test(`${pack.id} — the declared frames are on disk`, () => {
      test.skip(pack.absent, skipReason(pack));
      expect(
        pack.onDisk,
        `${pack.id}: the census declares ${pack.count} frames and disk holds ${pack.onDisk}. ` +
          `A short pack is invisible to the engine — it 404s the tail and holds the last good frame.`,
      ).toBe(pack.count);
    });
  }
});

test.describe("SEQ.1 — frame-scrub lab", () => {
  test("lab mounts one pinned act per pack, with no console errors", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await openLab(page);

    // Mounting and the HUD total come from the census, not from the frames, so
    // this covers every declared pack — including any whose footage is absent.
    // It is the check that catches a pack added to sequences.ts and nowhere else.
    await expect(page.locator('[data-qa="seq-act"]')).toHaveCount(PACKS.length);
    await expect(page.locator('[data-qa="seq-canvas"]')).toHaveCount(PACKS.length);
    for (const pack of PACKS) {
      await expect(hud(page, pack.id)).toHaveAttribute("data-seq-total", String(pack.count));
    }

    expect(diag.consoleErrors, diag.consoleErrors.join("\n")).toEqual([]);
  });

  for (const pack of PACKS) {
    test(`${pack.id} — scrubbing lands on the expected frame and paints it`, async ({ page }) => {
      test.skip(pack.absent, skipReason(pack));
      test.setTimeout(120_000);
      await openLab(page);

      for (const t of [0, 0.5, 1]) {
        await scrollToRawProgress(page, pack.id, t);
        const want = expectedIndex(t, pack.count);

        if (t === 0 || t === 1) {
          // Dead stops are clamped, so they are exact — poll only because the
          // frame still has to decode before it can be reported as painted.
          await expect
            .poll(() => hudIndex(page, pack.id), { timeout: 20_000, message: `${pack.id} @ raw ${t}` })
            .toBe(want);
        } else {
          await expect
            .poll(() => hudIndex(page, pack.id), { timeout: 20_000, message: `${pack.id} @ raw ${t}` })
            .toBeGreaterThan(0);
          const got = await hudIndex(page, pack.id);
          expect(Math.abs(got - want), `${pack.id} @ raw ${t}: got ${got}, want ~${want}`).toBeLessThanOrEqual(1);
        }

        const sample = await canvasSample(page, pack.id);
        // The HUD may not report a frame the canvas never drew.
        expect(sample.frame, `${pack.id} @ raw ${t}: HUD/canvas disagree`).toBe(await hudIndex(page, pack.id));
        expect(sample.offBackdrop, `${pack.id} @ raw ${t}: canvas is blank`).toBeGreaterThan(sample.samples / 2);
        expect(sample.max - sample.min, `${pack.id} @ raw ${t}: canvas is flat`).toBeGreaterThan(8);
      }
    });
  }

  test("the decode cache stays under its cap while the whole pack is scrubbed", async ({ page }) => {
    const pack = PACKS[0];
    test.skip(pack.absent, skipReason(pack));
    test.setTimeout(180_000);
    await openLab(page);

    let peak = 0;
    for (let step = 0; step <= 10; step += 1) {
      await scrollToRawProgress(page, pack.id, step / 10);
      await page.waitForTimeout(200);
      peak = Math.max(peak, Number(await hud(page, pack.id).getAttribute("data-seq-cached")));
    }
    // SEQ_CACHE_MAX in frameCache.ts. Eviction is what keeps a 72-frame pack
    // from becoming a quarter-gigabyte of resident bitmaps.
    expect(peak, "decode cache exceeded its cap").toBeLessThanOrEqual(28);
    expect(peak, "nothing was cached at all").toBeGreaterThan(0);
  });
});

test.describe("SEQ.1 — reduced motion", () => {
  // The `reducedMotion` test-fixture option is not honoured in this Playwright
  // build (matchMedia still reports no-preference) — see the same note in
  // cinematic.spec.ts. Emulate it on the page so the branch is really taken.

  test("no act binds a scrub", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PATH);
    await expect(page.locator('[data-qa="seq-lab-heading"]')).toBeVisible();

    // No pin is created under reduced motion, so no bounds are published. That
    // is decided by the media query and not by the frames, so every declared
    // pack is held to it.
    for (const pack of PACKS) {
      await expect(page.locator(`[data-qa="seq-act"][data-seq-id="${pack.id}"]`)).not.toHaveAttribute(
        "data-seq-start",
        /.*/,
      );
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot("seq-lab-reduced-390.png") });
  });

  for (const pack of PACKS) {
    test(`${pack.id} — holds its first frame and never advances`, async ({ page }) => {
      test.skip(pack.absent, skipReason(pack));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(PATH);
      await expect(page.locator('[data-qa="seq-lab-heading"]')).toBeVisible();

      await expect
        .poll(() => hudIndex(page, pack.id), { timeout: 20_000, message: `${pack.id} first frame` })
        .toBe(0);

      // Scrolling the whole page must not advance a single frame.
      await page.evaluate(() =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior }),
      );
      await page.waitForTimeout(600);
      expect(await hudIndex(page, pack.id), `${pack.id} advanced under reduced motion`).toBe(0);
    });
  }
});

test.describe("SEQ.1 — evidence", () => {
  for (const width of [390, 1440]) {
    for (const pack of PACKS) {
      test(`${pack.id} — dead stops at ${width}`, async ({ page }) => {
        test.skip(pack.absent, skipReason(pack));
        test.setTimeout(120_000);
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await openLab(page);

        for (const [label, t] of [
          ["first", 0],
          ["mid", 0.5],
          ["last", 1],
        ] as const) {
          await scrollToRawProgress(page, pack.id, t);
          const want = expectedIndex(t, pack.count);
          // Settle on the stop before capturing, so the evidence shows the
          // dead stop rather than whatever was mid-decode when it arrived.
          await expect
            .poll(async () => Math.abs((await hudIndex(page, pack.id)) - want), {
              timeout: 20_000,
              message: `${pack.id} @ ${label} (${width})`,
            })
            .toBeLessThanOrEqual(1);
          await page.waitForTimeout(200);
          await page.screenshot({ path: shot(`seq-lab-${width}-${pack.id}-${label}.png`) });
        }
      });
    }
  }
});
