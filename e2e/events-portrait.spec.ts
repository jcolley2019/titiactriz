import { expect, test, type Page } from "@playwright/test";
import { routeSupabase } from "./_admin";

/**
 * EVENTS.PORTRAIT.1 — the card's image well honours the artwork's own shape.
 *
 * The well was landscape-only: `w-full h-auto max-h-[420px] object-cover`. Given
 * a 9:16 poster that crops the top and bottom away and keeps a horizontal band
 * out of the middle — the poster's title and its date, gone. A real event (a
 * TikTok poster) needs the whole image.
 *
 * The laws, each measured off the RENDERED box, never off a class string:
 *
 *  1. PORTRAIT IS NOT CROPPED — a 9:16 source under "auto" renders at the
 *     source's own ratio. Box ratio == file ratio means every pixel of the
 *     poster is on screen; a crop cannot satisfy it.
 *  2. TALL, NOT DOMINANT — the same image is capped in height, so a portrait
 *     poster reads tall without taking the page hostage.
 *  3. EXPLICIT BEATS THE PROBE — "portrait" set by hand renders whole even
 *     before the file is measured, and "landscape" set by hand keeps the band.
 *  4. LEGACY ROWS ARE UNTOUCHED — a row written before this field existed (no
 *     `imageAspect` at all) with landscape art renders EXACTLY as it did: full
 *     wrapper width, clamped to 420px, cropped. The default cannot be a
 *     redesign of every card already on the board.
 *
 * The fixtures are SVG data URIs with declared intrinsic dimensions: no network,
 * no decode race, and a ratio the test knows to the pixel.
 */

const PATH = "/events";
const IMG = '[data-qa="event-card-image"]';

/** An image with a known intrinsic size, served from nowhere. */
const svgImage = (w: number, h: number, fill: string) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const PORTRAIT_W = 1080;
const PORTRAIT_H = 1920; // 9:16, the TikTok poster shape
const LANDSCAPE_W = 1600;
const LANDSCAPE_H = 900; // 16:9, the shape the well was built for

const PORTRAIT_SRC = svgImage(PORTRAIT_W, PORTRAIT_H, "#3a2f1c");
const LANDSCAPE_SRC = svgImage(LANDSCAPE_W, LANDSCAPE_H, "#1c2f3a");

/** The historic well: full width of its max-w-3xl wrapper, clamped at 420px. */
const LEGACY_WRAPPER_W = 768;
const LEGACY_MAX_H = 420;
/** The portrait cap: min(560px, 70vh) — at 900px tall that is 560. */
const PORTRAIT_MAX_H = 560;

type Card = Record<string, unknown>;

const card = (overrides: Card): Card => ({
  id: "e1",
  size: "full",
  title: { es: "Cumpleaños", en: "Birthday" },
  badge: { es: "", en: "" },
  description: { es: "", en: "" },
  note: { es: "", en: "" },
  imagePosition: "above",
  buttons: [],
  ...overrides,
});

async function openEvents(page: Page, overrides: Card) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await routeSupabase(page, {
    eventsBoard: { pageVisible: true, items: [card(overrides)] },
  });
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  // The decode is what the "auto" probe waits on; assert on a decoded image only.
  await page.waitForFunction(
    (sel) => {
      const img = document.querySelector<HTMLImageElement>(sel);
      return !!img && img.complete && img.naturalWidth > 0;
    },
    IMG,
    { timeout: 10_000 },
  );
}

/** The rendered box of the one image on the page. */
async function imageBox(page: Page) {
  const box = await page.locator(IMG).boundingBox();
  expect(box, "the card image is rendered").not.toBeNull();
  return box!;
}

/* ───────────────────────── law 1 + 2 — auto, portrait art ───────────────────────── */

test("a portrait poster under 'auto' renders at its own ratio, uncropped", async ({ page }) => {
  test.setTimeout(60_000);
  await openEvents(page, { imageUrl: PORTRAIT_SRC, imageAspect: "auto" });

  // The probe read the file and said so.
  await expect(page.locator(IMG)).toHaveAttribute("data-aspect", "portrait");

  const box = await imageBox(page);
  const sourceRatio = PORTRAIT_W / PORTRAIT_H; // 0.5625
  const renderedRatio = box.width / box.height;

  // Law 1 — the box carries the source's shape, so nothing was cut off it.
  expect(
    Math.abs(renderedRatio - sourceRatio),
    `rendered ${box.width.toFixed(1)}x${box.height.toFixed(1)} (ratio ${renderedRatio.toFixed(
      3,
    )}) vs source ratio ${sourceRatio.toFixed(3)}`,
  ).toBeLessThan(0.02);

  // The band the old well would have produced, explicitly ruled out.
  expect(box.height, "a portrait poster is not squeezed into the 420px band")
    .toBeGreaterThan(LEGACY_MAX_H);

  // Law 2 — tall, but capped.
  expect(box.height, "the portrait cap holds").toBeLessThanOrEqual(PORTRAIT_MAX_H + 1);
});

/* ───────────────────── law 3 — the owner's hand overrides the probe ───────────────────── */

test("'portrait' set by hand renders whole; 'landscape' set by hand keeps the band", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await openEvents(page, { imageUrl: PORTRAIT_SRC, imageAspect: "portrait" });
  await expect(page.locator(IMG)).toHaveAttribute("data-aspect", "portrait");

  const forced = await imageBox(page);
  expect(
    Math.abs(forced.width / forced.height - PORTRAIT_W / PORTRAIT_H),
    "hand-set portrait renders at the source ratio",
  ).toBeLessThan(0.02);

  // The other direction: portrait art forced landscape stays in the old band,
  // which proves the field is what decides — not the file.
  await openEvents(page, { imageUrl: PORTRAIT_SRC, imageAspect: "landscape" });
  await expect(page.locator(IMG)).toHaveAttribute("data-aspect", "landscape");

  const banded = await imageBox(page);
  expect(Math.abs(banded.width - LEGACY_WRAPPER_W), "full wrapper width").toBeLessThanOrEqual(2);
  expect(Math.abs(banded.height - LEGACY_MAX_H), "clamped to the 420px band").toBeLessThanOrEqual(2);
});

/* ──────────────────────── law 4 — the rows already on the board ──────────────────────── */

test("a legacy landscape row, with no imageAspect at all, renders as it did", async ({ page }) => {
  test.setTimeout(60_000);
  // No `imageAspect` key — exactly the shape of every row written before today.
  await openEvents(page, { imageUrl: LANDSCAPE_SRC });

  await expect(page.locator(IMG)).toHaveAttribute("data-aspect", "landscape");

  const box = await imageBox(page);
  expect(Math.abs(box.width - LEGACY_WRAPPER_W), "full wrapper width, as before")
    .toBeLessThanOrEqual(2);
  expect(Math.abs(box.height - LEGACY_MAX_H), "clamped to 420px, as before")
    .toBeLessThanOrEqual(2);

  // 16:9 at 768 wide wants 432px; the old well cropped it to 420 and still does.
  const wanted = (LEGACY_WRAPPER_W * LANDSCAPE_H) / LANDSCAPE_W;
  expect(wanted, "the fixture is genuinely taller than the band").toBeGreaterThan(LEGACY_MAX_H);
});
