import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * EVENTS.SNAP.1 — the layout matrix, and the frame every card comes to rest in.
 *
 * Ratified:
 *
 *   PORTRAIT  (phone, portrait tablet)    one column, one card per screen, and
 *                                         the scroll rests each card exactly
 *                                         where the FIRST card sits on arrival.
 *   LANDSCAPE (landscape tablet, desktop) the admin's Full/Half control decides:
 *                                         Full spans the row, two Halves share
 *                                         one, and a Half left alone centres.
 *
 * ## What "centred" is measured against
 *
 * Card 1 on arrival is NOT in the middle of the viewport — the heading band sits
 * above it (measured on a one-card board: 126px down on a 390 phone, 264 at
 * 820x1180). So the contract is the ARRIVAL FRAME, not the viewport's midpoint:
 * every card must come to rest with its top at the same offset card 1 has at
 * scroll 0. Aligning to the viewport centre instead would yank card 1 out of its
 * own arrival framing by 14px on the phone and 142px on the tablet the moment
 * the reader first scrolled — the opposite of what was asked for.
 *
 * The page measures that band and publishes it as `--events-snap-top`; each cell
 * snaps to `start` with the band as its scroll margin, which makes card 1's own
 * snap position scrollY 0.
 *
 * ## Why the board is mocked
 *
 * Standing law: a layout spec states its own board. The live board carries ONE
 * card, and one card can prove nothing about how two of them stack.
 */

const CELL = '[data-qa="event-cell"]';
const CARD = "article";
const MORE = '[data-qa="events-more"]';

/** A portrait poster at the real card's aspect, served offline. */
const POSTER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='1043' height='1553'><rect width='100%' height='100%' fill='#2b0d2b'/></svg>`,
)}`;

const card = (id: string, size: "full" | "half") => ({
  id,
  size,
  title: { es: `Evento ${id}`, en: `Event ${id}` },
  badge: { es: "", en: "" },
  description: { es: "", en: "" },
  note: { es: "", en: "" },
  imageUrl: POSTER,
  imagePosition: "above",
  imageAspect: "portrait",
  buttons: [],
});

async function open(
  page: Page,
  opts: { width: number; height: number; items: ReturnType<typeof card>[] },
) {
  await page.setViewportSize({ width: opts.width, height: opts.height });
  await forceLanguage(page, "es");
  await routeSupabase(page, {
    eventsBoard: { pageVisible: true, homeVisible: false, items: opts.items },
  });
  await page.goto("/events", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(page.locator(CELL).first()).toBeVisible();
  // Every poster decoded: an undecoded card is the wrong height, and every
  // number below is a height.
  await page.waitForFunction(
    (n) => {
      const imgs = [...document.querySelectorAll<HTMLImageElement>("article img")];
      return imgs.length >= n && imgs.every((i) => i.complete && i.naturalWidth > 0);
    },
    opts.items.length,
    { timeout: 15_000 },
  );
  // The band is measured from the rendered page and republished on a frame; let
  // it land before reading it back.
  await page.waitForTimeout(500);
}

/** Card boxes in DOCUMENT coordinates — the frame of reference snapping uses. */
const cardsDoc = (page: Page) =>
  page.$$eval(CARD, (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top + window.scrollY),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }),
  );

/** The published arrival band, read off the cell the browser will snap. */
const bandOf = (page: Page) =>
  page.locator(CELL).first().evaluate((el) => ({
    scrollMarginTop: Math.round(parseFloat(getComputedStyle(el).scrollMarginTop)),
    align: getComputedStyle(el).scrollSnapAlign,
    minHeight: getComputedStyle(el).minHeight,
  }));

const snapTypeOf = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);

/** Scroll, then let the browser settle wherever IT decides to rest. */
async function settleAt(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top: Math.max(0, top), behavior: "smooth" }), y);
  await page.waitForTimeout(900);
  return page.evaluate(() => Math.round(window.scrollY));
}

/* ══════════════════ A. LANDSCAPE — the Full/Half row ══════════════════ */

test.describe("EVENTS.SNAP.1 — landscape honours Full/Half", () => {
  const W = 1280;
  const H = 800;
  /** max-w-5xl, centred in 1280 → the column runs 128…1152. */
  const COL_LEFT = 128;
  const COL_W = 1024;

  test("two Half cards share one row, side by side", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, { width: W, height: H, items: [card("a", "half"), card("b", "half")] });

    const [a, b] = await cardsDoc(page);
    expect(a.top, "both Halves start on the same row").toBe(b.top);
    expect(a.left, "the first Half opens the column").toBe(COL_LEFT);
    expect(b.left, "…and the second sits to its right").toBeGreaterThan(a.right);
    expect(b.right, "…inside the ratified column").toBeLessThanOrEqual(COL_LEFT + COL_W);

    // A column each, minus the gap-8 between them.
    for (const [name, c] of [
      ["first", a],
      ["second", b],
    ] as const) {
      expect(
        Math.abs(c.w - (COL_W - 32) / 2),
        `the ${name} Half takes one column (${c.w}px)`,
      ).toBeLessThanOrEqual(2);
    }
  });

  test("a Full card spans the whole row", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, { width: W, height: H, items: [card("a", "full"), card("b", "half")] });

    const [full, half] = await cardsDoc(page);
    expect(full.w, "Full spans the column").toBe(COL_W);
    expect(half.top, "…so the Half cannot share its row").toBeGreaterThan(full.top);
  });

  /**
   * "Alone on its row" is a property of the PACKING, not of the card — so the
   * law has to be stated over the orders a board can actually arrive in.
   *
   * The first cut of this spec proved it on a ONE-CARD board, which is the only
   * arrangement where "alone" is true by default: nothing precedes the Half and
   * nothing follows it. It never asked what happens when a Full card closes the
   * row above — which is the LIVE board's own shape (Full, then Half), and the
   * arrangement Joey found on screen. A board can put a lone Half in four
   * distinguishable places, and each one is walked from a different branch of
   * `loneHalves()`, so each one is stated here:
   *
   *   leading   — the Half opens the board and a Full follows
   *   trailing  — a Full opens the board and the Half ends it   ← the live board
   *   enclosed  — a Full on either side
   *   after a pair — two Halves fill a row, the third is left over
   *
   * The paired rows are asserted alongside, so "centre the lone one" can never
   * be bought by centring Halves that DO have a partner.
   */
  const HALF_W = (COL_W - 32) / 2;

  const ARRANGEMENTS = [
    { name: "alone on the board", sizes: ["half"], lone: [0], pairs: [] },
    { name: "trailing a Full — the live board", sizes: ["full", "half"], lone: [1], pairs: [] },
    { name: "leading, with a Full below", sizes: ["half", "full"], lone: [0], pairs: [] },
    { name: "enclosed by Fulls", sizes: ["full", "half", "full"], lone: [1], pairs: [] },
    { name: "left over after a pair", sizes: ["half", "half", "half"], lone: [2], pairs: [[0, 1]] },
    {
      name: "left over after a pair, with a Full below",
      sizes: ["half", "half", "half", "full"],
      lone: [2],
      pairs: [[0, 1]],
    },
  ] as const;

  for (const a of ARRANGEMENTS) {
    test(`a Half with no partner centres — ${a.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, {
        width: W,
        height: H,
        items: a.sizes.map((s, i) => card(String.fromCharCode(97 + i), s)),
      });

      const cards = await cardsDoc(page);
      expect(cards, "every card rendered").toHaveLength(a.sizes.length);

      for (const i of a.lone) {
        const lone = cards[i];
        expect(
          Math.abs(lone.w - HALF_W),
          `card ${i} is still ONE column wide (${lone.w}px, expected ~${HALF_W})`,
        ).toBeLessThanOrEqual(2);

        const leftGap = lone.left - COL_LEFT;
        const rightGap = COL_LEFT + COL_W - lone.right;
        expect(
          Math.abs(leftGap - rightGap),
          `card ${i} has equal gutters, so it is centred (left ${leftGap}, right ${rightGap})`,
        ).toBeLessThanOrEqual(2);
        expect(
          lone.left,
          `card ${i} genuinely moved off the left edge (left ${lone.left})`,
        ).toBeGreaterThan(COL_LEFT + 100);
      }

      // Centring must not leak onto Halves that DO have a partner.
      for (const [x, y] of a.pairs) {
        expect(cards[x].top, `cards ${x} and ${y} share a row`).toBe(cards[y].top);
        expect(cards[x].left, `card ${x} opens the column`).toBe(COL_LEFT);
        expect(cards[y].left, `card ${y} sits to its right`).toBeGreaterThan(cards[x].right);
      }

      // …and the Fulls around them still span, so the row above/below the lone
      // Half is genuinely closed — which is WHY it is alone.
      a.sizes.forEach((size, i) => {
        if (size !== "full") return;
        expect(cards[i].w, `card ${i} is Full and spans the column`).toBe(COL_W);
        expect(cards[i].left, `card ${i} starts at the column edge`).toBe(COL_LEFT);
      });
    });
  }

  test("a single Full card is the ratified geometry, untouched", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, { width: W, height: H, items: [card("a", "full")] });

    const [only] = await cardsDoc(page);
    expect(only.w, "the 1024 column, exactly as before this brick").toBe(COL_W);
    expect(only.left, "at the same offset").toBe(COL_LEFT);
    expect(only.top, "and the same top").toBe(276);
  });

  test("landscape never snaps and never gets a screen-tall cell", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, { width: W, height: H, items: [card("a", "half"), card("b", "half")] });

    expect(await snapTypeOf(page), "no snap on a landscape screen").toBe("none");
    const { minHeight } = await bandOf(page);
    expect(
      minHeight === "auto" || minHeight === "0px",
      `cells keep their content height (min-height: ${minHeight})`,
    ).toBe(true);
  });
});

/* ══════════════════ B. PORTRAIT — one screen per card ══════════════════ */

const PORTRAIT_ROOMS = [
  { name: "phone-390x844", width: 390, height: 844 },
  { name: "tablet-portrait-820x1180", width: 820, height: 1180 },
];

for (const room of PORTRAIT_ROOMS) {
  test.describe(`EVENTS.SNAP.1 — ${room.name}`, () => {
    const items = [card("a", "full"), card("b", "half"), card("c", "full")];

    test("cards stack one per column, whatever Full/Half says", async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      const cards = await cardsDoc(page);
      expect(cards, "all three are on the page").toHaveLength(3);
      for (let i = 1; i < cards.length; i++) {
        expect(cards[i].top, `card ${i} is BELOW card ${i - 1}, never beside it`).toBeGreaterThan(
          cards[i - 1].top + cards[i - 1].h - 1,
        );
        expect(cards[i].left, `card ${i} keeps the same column`).toBe(cards[0].left);
        expect(cards[i].w, `…at the same width`).toBe(cards[0].w);
      }
    });

    test("the page ARRIVES at the top, with the heading and the way out in view", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      // The defect this guards: arm the snap before the band is measured and the
      // band is 0, so card 1's snap position becomes its own raw top. The browser
      // obeys on load, scrolls 126px down, and eats the heading and the back
      // control before the reader has touched anything. Every document-coordinate
      // measurement reads identically either way — only the scroll position and
      // the rendered pixels tell the truth, so this is asserted on both.
      expect(await page.evaluate(() => Math.round(window.scrollY)), "no jump on load").toBe(0);
      await expect(page.locator('[data-qa="events-title"]'), "the heading is on screen").toBeInViewport();
      await expect(page.locator('[data-qa="events-back"]'), "…and so is the way out").toBeInViewport();

      const cards = await cardsDoc(page);
      const firstTop = await page
        .locator(CARD)
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().top));
      expect(firstTop, "card 1 is exactly where the document puts it").toBe(cards[0].top);
    });

    test("the snap container is armed, and each cell carries the arrival band", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      // Chrome reports `y proximity` as plain `y` — proximity is the default
      // strictness. `y mandatory` would read back in full, and would be wrong.
      expect(await snapTypeOf(page), "portrait scrolls snap, softly").toBe("y");

      const cards = await cardsDoc(page);
      const { scrollMarginTop, align } = await bandOf(page);
      expect(align, "each card is a snap target, aligned to its own top").toBe("start");
      expect(
        scrollMarginTop,
        `the band equals card 1's arrival top (${cards[0].top})`,
      ).toBe(cards[0].top);

      // Card 1's snap position is therefore the arrival position itself.
      expect(cards[0].top - scrollMarginTop, "card 1 snaps to scrollY 0").toBe(0);
    });

    test("every card comes to rest in card 1's arrival frame", async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      const cards = await cardsDoc(page);
      const { scrollMarginTop: band } = await bandOf(page);

      for (let i = 0; i < cards.length; i++) {
        await settleAt(page, cards[i].top - band);
        const top = await page
          .locator(CARD)
          .nth(i)
          .evaluate((el) => Math.round(el.getBoundingClientRect().top));
        expect(top, `card ${i} rests in the arrival frame, ${band}px down`).toBe(band);
      }
    });

    test("one card per screen: the next card waits below the fold", async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      const cards = await cardsDoc(page);
      const { scrollMarginTop: band } = await bandOf(page);

      for (let i = 0; i < cards.length - 1; i++) {
        await settleAt(page, cards[i].top - band);
        const nextTop = await page
          .locator(CARD)
          .nth(i + 1)
          .evaluate((el) => Math.round(el.getBoundingClientRect().top));
        expect(
          nextTop,
          `with card ${i} at rest, card ${i + 1} has not crept into the screen`,
        ).toBeGreaterThanOrEqual(room.height);
      }
    });

    test("nothing is trapped: every card and the closing line stay reachable", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      const cards = await cardsDoc(page);
      const { scrollMarginTop: band } = await bandOf(page);

      // End to end, card by card, the way a thumb travels — and back up again.
      const order = [...cards.keys(), ...[...cards.keys()].reverse()];
      for (const i of order) {
        await settleAt(page, cards[i].top - band);
        await expect(page.locator(CARD).nth(i), `card ${i} is reachable`).toBeInViewport();
      }

      // The closing line lives past the last card and must not be sealed off by
      // a snap point. Proximity is what buys this: `mandatory` could refuse to
      // rest here at all.
      const moreTop = await page
        .locator(MORE)
        .evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
      await settleAt(page, moreTop - room.height / 2);
      await expect(page.locator(MORE), "the closing line is reachable").toBeInViewport();
    });
  });
}

/* ══════════════ C. THE ONE-CARD BOARD IS NOT TOUCHED ══════════════ */

test.describe("EVENTS.SNAP.1 — a single card is left exactly as it was", () => {
  for (const room of PORTRAIT_ROOMS) {
    test(`${room.name} — no snap, no screen-tall cell, ratified geometry`, async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items: [card("a", "full")] });

      // One card is ALREADY one-per-screen, and events-nav.spec.ts holds its
      // composition to the pixel — including the closing line inside the phone's
      // first screen. A screen-tall cell would push that line off the fold.
      expect(await snapTypeOf(page), "the snap container is not armed").toBe("none");

      const { minHeight } = await bandOf(page);
      expect(
        minHeight === "auto" || minHeight === "0px",
        `the cell keeps its content height (min-height: ${minHeight})`,
      ).toBe(true);

      const [only] = await cardsDoc(page);
      expect(only.top, "the card arrives where it always did").toBe(
        room.width === 390 ? 126 : 264,
      );
    });
  }
});
