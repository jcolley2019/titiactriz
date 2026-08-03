import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase, svgPhoto } from "./_admin";
import { shot } from "./_helpers";

/**
 * REVIEW.2a — spreads as TONAL ROOMS with a self-drawing plate frame.
 *
 * Laws, each falsifiable on the live render:
 *
 *  1. ONE FIELD — each spread is a single uninterrupted ground edge to edge:
 *     the room div spans the full frame, the chapter column paints NO ground of
 *     its own (both sides of the seam sample the same material by
 *     construction), and the blurred ambient backdrop is gone from the live
 *     act.
 *  2. SIBLING SHADES — the three chapters sit on CHAPTER_GROUND_1..3, and the
 *     three grounds differ from each other.
 *  3. THE FRAME DRAWS — the plate's gold hairline is a stroke-dashoffset rect
 *     on the pinned timeline: mid-slot it is partially drawn, and at every
 *     slide's dead-stop it is COMPLETE (offset ~0).
 *  4. STATIC UNDER REDUCED MOTION — frame and filigree render complete and
 *     static, no draw.
 *  5. OUTER-CORNER LAW — one filigree per spread, at the copy column's outer
 *     top corner, mirrored per alternation.
 *
 * Evidence: _qa/review2-{01,02,03}-1440.png (settled, frames drawn),
 * _qa/review2-mid-draw.png (slide 2's frame mid-draw), and
 * _qa/review2-390-phone.png (the untouched phone act).
 */

const PATH = "/cinematic";

/** Mirrors CHAPTER_GROUNDS in src/components/cinematic/FramedVideo.tsx. */
const CHAPTER_GROUNDS_RGB = ["rgb(13, 11, 8)", "rgb(11, 11, 10)", "rgb(8, 7, 6)"] as const;

const PHOTOS = [
  svgPhoto("p1", "crimson"),
  svgPhoto("p2", "teal"),
  svgPhoto("p3", "goldenrod"),
  svgPhoto("p4", "navy"),
];

/** Timeline rest positions (of 3.0) for each slide — nothing mid-tween. */
const DEAD_STOPS = { 1: 0.5 / 3, 2: 1.75 / 3, 3: 2.8 / 3 } as const;

/**
 * Slide 2's frame draws on its entrance slot (timeline 1.1 → 1.5). The exact
 * scroll↔time map depends on the timeline's total duration, so rather than
 * betting the shot on one offset the test scans this scroll window (fractions
 * of the pin's 300vh) and captures the first genuinely mid-draw frame.
 */
const MID_DRAW_SCAN = [1.05, 1.12, 1.19, 1.26, 1.33, 1.4].map((t) => t / 3);

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wheel the document to `y` (Lenis owns the scroll on this route). */
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

/** stroke-dashoffset of every plate frame line, in slide order. */
const frameOffsets = (page: Page) =>
  page
    .locator('[data-qa="plate-frame-line"]')
    .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).strokeDashoffset)));

const slideSel = (i: number) => `[data-qa="reel-slide"][data-slide="${i}"]`;

async function openWide(page: Page) {
  await forceLanguage(page, "es");
  await routeSupabase(page, { photos: PHOTOS });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await settle(page, 900);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe("REVIEW.2a — tonal rooms and the self-drawing frame", () => {
  test("1440 — one continuous field per spread; the backdrop is gone", async ({ page }) => {
    await openWide(page);

    // The blurred ambient backdrop is retired from the live act.
    await expect(page.locator('[data-qa="wide-backdrop"]')).toHaveCount(0);

    for (const i of [0, 1, 2]) {
      // The room spans the full frame — edge to edge, both sides of the seam.
      const room = page.locator(`${slideSel(i)} [data-qa="wide-room"]`);
      await expect(room, `slide ${i + 1} has one room`).toHaveCount(1);
      const rBox = (await room.boundingBox())!;
      expect(rBox.x, `slide ${i + 1} room reaches the left edge`).toBeLessThanOrEqual(0.5);
      expect(rBox.width, `slide ${i + 1} room spans the frame`).toBeGreaterThanOrEqual(1439);

      // Single ground: the chapter column paints no material of its own, so a
      // sample on either side of the seam is the same field.
      const chapterBg = await page
        .locator(`${slideSel(i)} [data-qa="wide-chapter"]`)
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(chapterBg, `slide ${i + 1} chapter column is transparent`).toBe("rgba(0, 0, 0, 0)");

      // The luminance gradient rides on the room, as HERO.WIDE.1 set it.
      const roomStyle = await room.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, image: s.backgroundImage };
      });
      expect(roomStyle.bg, `slide ${i + 1} ground is its chapter shade`).toBe(
        CHAPTER_GROUNDS_RGB[i],
      );
      expect(roomStyle.image, `slide ${i + 1} carries the luminance gradient`).toContain(
        "linear-gradient",
      );
    }

    // Sibling shades: the three grounds differ from each other.
    expect(new Set(CHAPTER_GROUNDS_RGB).size).toBe(3);
  });

  test("1440 — outer-corner law: one filigree per spread, mirrored per alternation", async ({
    page,
  }) => {
    await openWide(page);

    for (const i of [0, 1, 2]) {
      const orn = page.locator(`${slideSel(i)} [data-qa="chapter-ornament"]`);
      await expect(orn, `slide ${i + 1} has ONE filigree`).toHaveCount(1);

      const copyLeft = i % 2 === 1;
      const oBox = (await orn.boundingBox())!;
      const cBox = (await page
        .locator(`${slideSel(i)} [data-qa="wide-chapter"]`)
        .boundingBox())!;

      // Top corner (inset 112px to clear the fixed header band)…
      expect(oBox.y, `slide ${i + 1} filigree at the column's top`).toBeLessThan(cBox.y + 160);
      // …on the OUTER (frame-edge) side of the copy column.
      if (copyLeft) {
        expect(oBox.x - cBox.x, `slide ${i + 1} filigree hugs the outer left corner`).toBeLessThan(
          80,
        );
      } else {
        expect(
          cBox.x + cBox.width - (oBox.x + oBox.width),
          `slide ${i + 1} filigree hugs the outer right corner`,
        ).toBeLessThan(80);
      }

      // Mirrored per alternation: flipped when the column sits on the right.
      const flipped = await orn.evaluate((el) => el.className.includes("-scale-x-100"));
      expect(flipped, `slide ${i + 1} mirror`).toBe(!copyLeft);
    }
  });

  test("1440 — the frame draws on the timeline and is complete at every dead-stop", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openWide(page);
    const y0 = await pinStartY(page);

    // Mid-slot: somewhere in slide 2's entrance window the line is partially
    // drawn — neither blank nor done. Scan the window and photograph it.
    let midCaptured = false;
    for (const f of MID_DRAW_SCAN) {
      await wheelTo(page, y0 + f * 3 * 900);
      const mid = await frameOffsets(page);
      if (mid[1] > 0.05 && mid[1] < 0.95) {
        await page.screenshot({ path: shot("review2-mid-draw.png") });
        midCaptured = true;
        break;
      }
    }
    expect(midCaptured, "slide 2's frame observed mid-draw").toBe(true);

    // Every dead-stop: the active slide's frame is COMPLETE, and the settled
    // spreads are the brick's evidence.
    for (const slide of [1, 2, 3] as const) {
      await wheelTo(page, y0 + DEAD_STOPS[slide] * 3 * 900);
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

      const op = await opacities(page);
      expect(op[slide - 1], `slide ${slide} opaque at its dead-stop`).toBeGreaterThan(0.99);

      const offsets = await frameOffsets(page);
      expect(
        Math.abs(offsets[slide - 1]),
        `slide ${slide} frame complete at its dead-stop`,
      ).toBeLessThan(0.01);

      await page.screenshot({ path: shot(`review2-0${slide}-1440.png`) });
    }
  });

  test("1440 reduced motion — frame and filigree render complete and static", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openWide(page);

    // Three static spreads, each its own settled frame.
    await expect(page.locator('[data-qa="plate-frame-line"]')).toHaveCount(3);
    const offsets = await frameOffsets(page);
    offsets.forEach((o, i) =>
      expect(Math.abs(o), `slide ${i + 1} frame complete under reduced motion`).toBeLessThan(
        0.01,
      ),
    );

    // Scoped to the REEL, like every other locator in this spec. WideChapter
    // draws the filigree for whichever act mounts it, so a page-wide count is a
    // count of the whole page's filigree and reads 4 the moment the Acting act
    // draws its own — a REVIEW.2a law failing on a change it does not govern.
    // The reduced-motion path renders no `reel-slide`, so the anchor is the
    // reel's section, identified as `pinStartY` above identifies it.
    const ornOpacities = await page
      .locator('[data-qa="cinematic-section"]:has([data-qa="cinematic-reel-img"]) [data-qa="chapter-ornament"]')
      .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).opacity)));
    expect(ornOpacities.length).toBe(3);
    ornOpacities.forEach((o, i) =>
      expect(o, `slide ${i + 1} filigree settled under reduced motion`).toBeCloseTo(0.18, 2),
    );
  });

  test("phone 390 — the act is untouched: no room, no frame, no filigree", async ({ page }) => {
    await forceLanguage(page, "es");
    await routeSupabase(page, { photos: PHOTOS });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    await expect(page.locator('[data-qa="reel-lockup"]')).toHaveCount(3);
    await expect(page.locator('[data-qa="reel-veil"]')).toHaveCount(3);
    await expect(page.locator('[data-qa="wide-room"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="plate-frame-line"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="chapter-ornament"]')).toHaveCount(0);

    await page.screenshot({ path: shot("review2-390-phone.png") });
  });
});
