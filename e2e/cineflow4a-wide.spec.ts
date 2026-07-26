import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { QA_DIR, ensureQaDir, shot } from "./_helpers";

/**
 * CINE.FLOW.4A STEP 7 — falsifiable safety assertions for the wide bake-off.
 *
 * For EVERY wide variant (W1–W3), at EVERY wide frame from the harness set,
 * for EVERY slide at its dead-stop state, measured via getBoundingClientRect
 * at review-zoom 1 (the frame at true CSS pixel size, viewport >= frame):
 *
 *  a. UNIVERSAL: the lockup's bounding rect must not intersect the focal safe
 *     circle — radius 0.30 x plate width, centred on the resolved focal point
 *     in viewport coordinates.
 *  b. W1 and W2 only: the lockup's bounding rect must not intersect the
 *     plate's bounding rect.
 *
 * This replaces the unfalsifiable "nothing lands across her face".
 *
 * The same pass captures the STEP 8 evidence (slide 0 dead-stop, ES and EN,
 * named cineflow4a-<variant>-<width>-<lang>.png) and dumps the measured
 * geometry (visible-photo %, gutters, lockup widths, safe radii) to
 * _qa/cineflow4a-metrics.json for the brick report.
 */

const PATH = "/qa/reel-bakeoff";

const WIDE_FRAMES = [
  { id: "834x1112", w: 834, h: 1112 },
  { id: "1024x768", w: 1024, h: 768 },
  { id: "1440x900", w: 1440, h: 900 },
  { id: "1600x900", w: 1600, h: 900 },
  { id: "2560x1080", w: 2560, h: 1080 },
] as const;

const VARIANTS = ["w1", "w2", "w3"] as const;
const LANGS = ["es", "en"] as const;

type Rect = { x: number; y: number; width: number; height: number };

const rectsIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Circle-rect: distance from centre to the rect's closest point vs radius. */
const circleIntersectsRect = (cx: number, cy: number, r: number, rect: Rect) => {
  const nx = Math.min(Math.max(cx, rect.x), rect.x + rect.width);
  const ny = Math.min(Math.max(cy, rect.y), rect.y + rect.height);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
};

const intersectArea = (a: Rect, b: Rect) => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** Drive the harness scrub (a controlled React range input) to progress p. */
async function setScrub(page: Page, p: number) {
  await page.evaluate((val) => {
    const el = document.querySelector<HTMLInputElement>('[data-qa="bakeoff-scrub"]');
    if (!el) throw new Error("scrub input not mounted");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, String(Math.round(val * 1000)));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, p);
  await page.waitForTimeout(150);
}

async function ensureLang(page: Page, lang: "es" | "en") {
  const readout = page.locator('[data-qa="bakeoff-lang"]');
  const current = (await readout.textContent())?.trim().toLowerCase();
  if (current === lang) return;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("l");
  await expect(readout).toHaveText(lang.toUpperCase());
  await page.waitForTimeout(150);
}

type Metric = {
  variant: string;
  frame: string;
  lang: string;
  slide: number;
  deadStopProgress: number;
  visiblePhotoPct: number;
  safeRadius: number;
  focalVp: { x: number; y: number };
  plate: Rect;
  lockup: Rect;
  leftGutter: number;
};

const metrics: Metric[] = [];

test.describe("CINE.FLOW.4A — wide plate compositions: safety laws", () => {
  test.afterAll(() => {
    ensureQaDir();
    fs.writeFileSync(
      path.join(QA_DIR, "cineflow4a-metrics.json"),
      JSON.stringify(metrics, null, 2),
    );
  });

  for (const frame of WIDE_FRAMES) {
    test(`laws hold at ${frame.id} (all variants, slides, languages)`, async ({ page }) => {
      test.setTimeout(300_000);
      // Viewport at least as large as the frame: measurements and shots at
      // true CSS pixels, review zoom pinned to 1.
      await page.setViewportSize({ width: frame.w + 64, height: frame.h + 260 });
      await page.goto(PATH, { waitUntil: "domcontentloaded" });

      const frameSelect = page.locator('[data-qa="bakeoff-frame"]');
      await frameSelect.waitFor({ state: "visible", timeout: 20_000 });
      await frameSelect.selectOption(frame.id);
      await page.locator('[data-qa="bakeoff-zoom"]').selectOption("1");
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const frameEl = page.locator('[data-qa="bakeoff-wide-frame"]');
      await expect(frameEl).toBeVisible();

      for (const lang of LANGS) {
        await ensureLang(page, lang);

        for (const variant of VARIANTS) {
          await page.locator('[data-qa="bakeoff-wide-variant"]').selectOption(variant);
          const root = page.locator(`[data-qa="wide-variant"][data-variant="${variant}"]`);
          await root.waitFor({ state: "attached", timeout: 20_000 });

          // Every plate photo decoded — geometry attribute must be resolved,
          // not the aspect-unknown fallback.
          await page.waitForFunction(
            () => {
              const imgs = [
                ...document.querySelectorAll<HTMLImageElement>(
                  '[data-qa="wide-plate"] img[data-qa="bakeoff-reel-img"]',
                ),
              ];
              return (
                imgs.length >= 3 &&
                imgs.every(
                  (i) =>
                    i.complete &&
                    i.naturalWidth > 0 &&
                    !(i.getAttribute("data-hero-framing") ?? "").includes("pending"),
                )
              );
            },
            { timeout: 30_000 },
          );

          const deadStops = (await root.getAttribute("data-deadstops"))
            ?.split(",")
            .map(Number);
          expect(deadStops, `${variant}@${frame.id}: dead-stops advertised`).toBeTruthy();
          expect(deadStops!.length).toBe(3);

          const frameRect = (await frameEl.boundingBox()) as Rect | null;
          expect(frameRect, "frame rect").toBeTruthy();
          expect(Math.round(frameRect!.width), "frame at true CSS px").toBe(frame.w);
          expect(Math.round(frameRect!.height)).toBe(frame.h);

          for (let slide = 0; slide < 3; slide++) {
            await setScrub(page, deadStops![slide]);

            const slideEl = root.locator(`[data-qa="wide-slide"][data-index="${slide}"]`);
            const plateEl = slideEl.locator('[data-qa="wide-plate"]');
            const lockupEl = slideEl.locator('[data-qa="wide-lockup"]');

            const plate = (await plateEl.boundingBox()) as Rect;
            const lockup = (await lockupEl.boundingBox()) as Rect;
            const focalAttr = await plateEl.getAttribute("data-focal");
            expect(plate, `${variant}@${frame.id} s${slide}: plate rect`).toBeTruthy();
            expect(lockup, `${variant}@${frame.id} s${slide}: lockup rect`).toBeTruthy();
            expect(focalAttr).toBeTruthy();

            const [fx, fy] = focalAttr!.split(",").map(Number);
            const focalVp = { x: plate.x + fx * plate.width, y: plate.y + fy * plate.height };
            const safeRadius = 0.3 * plate.width;

            // (a) UNIVERSAL — lockup vs focal safe circle.
            expect(
              circleIntersectsRect(focalVp.x, focalVp.y, safeRadius, lockup),
              `${variant}@${frame.id} s${slide} ${lang}: lockup intersects the focal safe circle ` +
                `(r=${safeRadius.toFixed(1)} at ${focalVp.x.toFixed(0)},${focalVp.y.toFixed(0)}; ` +
                `lockup ${JSON.stringify(lockup)})`,
            ).toBe(false);

            // (b) W1/W2 — lockup vs plate.
            if (variant !== "w3") {
              expect(
                rectsIntersect(lockup, plate),
                `${variant}@${frame.id} s${slide} ${lang}: lockup intersects the plate`,
              ).toBe(false);
            }

            // Metrics — visible % of the source photograph, from the resolver's
            // own geometry attribute (widthPct,heightPct,leftPct,topPct).
            const framing = await plateEl
              .locator('img[data-qa="bakeoff-reel-img"]')
              .getAttribute("data-hero-framing");
            const box = framing?.split(";")[4]?.split(",").map(Number);
            let visiblePhotoPct = NaN;
            if (box && box.length === 4 && box.every(Number.isFinite)) {
              const [wPct, hPct, lPct, tPct] = box;
              const photo: Rect = {
                x: plate.x + (lPct / 100) * plate.width,
                y: plate.y + (tPct / 100) * plate.height,
                width: (wPct / 100) * plate.width,
                height: (hPct / 100) * plate.height,
              };
              // Clipped by the plate (overflow hidden), then by the frame.
              const inPlate: Rect = {
                x: Math.max(photo.x, plate.x),
                y: Math.max(photo.y, plate.y),
                width: Math.min(photo.x + photo.width, plate.x + plate.width) - Math.max(photo.x, plate.x),
                height: Math.min(photo.y + photo.height, plate.y + plate.height) - Math.max(photo.y, plate.y),
              };
              visiblePhotoPct =
                (intersectArea(inPlate, frameRect!) / (photo.width * photo.height)) * 100;
            }

            metrics.push({
              variant,
              frame: frame.id,
              lang,
              slide,
              deadStopProgress: deadStops![slide],
              visiblePhotoPct,
              safeRadius,
              focalVp,
              plate,
              lockup,
              leftGutter: Math.max(0, plate.x - frameRect!.x),
            });

            // STEP 8 evidence — slide 0 dead-stop, per variant/width/lang.
            if (slide === 0) {
              await page.waitForFunction(() => {
                const imgs = [
                  ...document.querySelectorAll<HTMLImageElement>('img[data-qa="wide-backdrop"]'),
                ];
                return imgs.every((i) => i.complete && i.naturalWidth > 0);
              });
              await frameEl.screenshot({
                path: shot(`cineflow4a-${variant}-${frame.w}-${lang}.png`),
              });
            }
          }
        }
      }
    });
  }
});
