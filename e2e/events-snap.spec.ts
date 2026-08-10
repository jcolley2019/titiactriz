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

/* ══════════════════ B. PORTRAIT — moved to WebKit ══════════════════ */

/**
 * EVENTS.SNAP.2 — the portrait one-card-per-screen laws, and the one-card board's
 * exemption from them, now live in events-snap-phone.spec.ts and run in a real
 * WebKit at Joey's 440x792 device truth.
 *
 * They were here, in Chromium emulation, and they all passed while the phone
 * failed the gate in Joey's hand: cards 81px and 116px short of filling their
 * cells, and a fling resting mid-way between them. Snap strictness, where
 * momentum settles, and the svh arithmetic behind a screen-tall cell are engine
 * behaviour — this file keeps what is pure layout (the Full/Half row and the six
 * packing orders below), and the engine-dependent laws moved to the engine that
 * ships on the device.
 */
