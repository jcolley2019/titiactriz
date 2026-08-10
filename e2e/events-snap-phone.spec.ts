import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * EVENTS.SNAP.2 — the phone snap laws, on WEBKIT at Joey's device truth.
 *
 * These moved out of events-snap.spec.ts because Chromium emulation passed every
 * one of them while the phone failed the gate in Joey's hand. Scroll-snap
 * strictness, where momentum comes to rest, and the svh arithmetic behind a
 * screen-tall cell are all engine behaviour — proving them anywhere but WebKit
 * proves nothing about iOS. The project (playwright.config.ts) supplies a real
 * WebKit at 440x792, which is the window Joey's iPhone actually reports.
 *
 * The two laws this brick adds to SNAP.1's, both from the failed gate:
 *
 *   FILL      every card is exactly as tall as its cell — one screen minus the
 *             heading band, gold frame and all — so no two cards differ and none
 *             leaves dead space. SNAP.1 deliberately let the card keep its own
 *             content height inside a screen-tall cell, which measured 81px short
 *             on card 1 and 116px short on card 2 at 440x792.
 *   DECISIVE  `mandatory`, not `proximity`. Proximity did land a scroll aimed 40
 *             or 120px short of a card, but gave up at 250px and rested where it
 *             was dropped — which is a real thumb's fling. Joey's ruling: "a
 *             decisive snap, not a suggestion".
 *
 * The reachability law is unchanged in intent and re-proved here against the
 * stricter snap: every card, the closing line, AND the bottom of the document
 * must all be places the reader can come to rest.
 *
 * Standing law: a layout spec states its own board — the live board's card count
 * is not this spec's business.
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
  await page.waitForFunction(
    (n) => {
      const imgs = [...document.querySelectorAll<HTMLImageElement>("article img")];
      return imgs.length >= n && imgs.every((i) => i.complete && i.naturalWidth > 0);
    },
    opts.items.length,
    { timeout: 15_000 },
  );
  // The band is measured from the rendered page and republished on a frame.
  await page.waitForTimeout(500);
}

/** Card boxes in DOCUMENT coordinates — the frame of reference snapping uses. */
const cardsDoc = (page: Page) =>
  page.$$eval(CARD, (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top + window.scrollY), h: Math.round(r.height) };
    }),
  );

const bandOf = (page: Page) =>
  page
    .locator(CELL)
    .first()
    .evaluate((el) => ({
      scrollMarginTop: Math.round(parseFloat(getComputedStyle(el).scrollMarginTop)),
      align: getComputedStyle(el).scrollSnapAlign,
    }));

const snapTypeOf = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);

/** Scroll, then let the browser settle wherever IT decides to rest. */
async function settleAt(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top: Math.max(0, top), behavior: "smooth" }), y);
  await page.waitForTimeout(900);
  return page.evaluate(() => Math.round(window.scrollY));
}

/**
 * Joey's iPhone reports a 440x792 window; the portrait tablet rides along because
 * the same portrait laws govern it and WebKit is the honest engine for both.
 */
const PORTRAIT_ROOMS = [
  { name: "phone-440x792", width: 440, height: 792 },
  { name: "tablet-portrait-820x1180", width: 820, height: 1180 },
];

for (const room of PORTRAIT_ROOMS) {
  test.describe(`EVENTS.SNAP.2 — ${room.name}`, () => {
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
      }
    });

    test("the page ARRIVES at the top, with the heading and the way out in view", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      expect(await page.evaluate(() => Math.round(window.scrollY)), "no jump on load").toBe(0);
      await expect(
        page.locator('[data-qa="events-title"]'),
        "the heading is on screen",
      ).toBeInViewport();
      await expect(
        page.locator('[data-qa="events-back"]'),
        "…and so is the way out",
      ).toBeInViewport();
    });

    test("the snap is MANDATORY, and each cell carries the arrival band", async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      // Read back in full: `proximity` is the default strictness and computes to a
      // bare `y`, so a bare `y` here would mean the brick had silently reverted.
      expect(await snapTypeOf(page), "the snap is decisive, not a suggestion").toBe("y mandatory");

      const cards = await cardsDoc(page);
      const { scrollMarginTop, align } = await bandOf(page);
      expect(align, "each card is a snap target, aligned to its own top").toBe("start");
      expect(scrollMarginTop, `the band equals card 1's arrival top (${cards[0].top})`).toBe(
        cards[0].top,
      );
      expect(cards[0].top - scrollMarginTop, "card 1 snaps to scrollY 0").toBe(0);
    });

    /* ─────────────── the FILL law (EVENTS.SNAP.2) ─────────────── */

    test("every card fills its cell — one screen minus the band, frame and all", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      const { scrollMarginTop: band } = await bandOf(page);
      const cells = await page.$$eval(CELL, (els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().height)),
      );
      const cards = await cardsDoc(page);

      for (let i = 0; i < cards.length; i++) {
        expect(
          cards[i].h,
          `card ${i} fills its cell — no dead space between the art and the bottom border`,
        ).toBe(cells[i]);
      }
      // Every card the SAME height, and that height is the screen below the band.
      const heights = new Set(cards.map((c) => c.h));
      expect(heights.size, "no two cards differ in height").toBe(1);
      expect(cards[0].h, "the card is one screen minus the heading band").toBe(room.height - band);
    });

    /* ─────────────── the DECISIVE-SNAP law (EVENTS.SNAP.2) ─────────────── */

    test("a scroll dropped well short of a card still lands it", async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items });

      const cards = await cardsDoc(page);
      const { scrollMarginTop: band } = await bandOf(page);
      const target = cards[1].top - band;

      // 250px short is where `proximity` gave up and rested where it was dropped.
      for (const short of [40, 120, 250]) {
        const rest = await settleAt(page, target - short);
        expect(rest, `aimed ${short}px short, the snap still closes the gap`).toBe(target);
      }
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

    /* ─────────────── the REACHABILITY law, against the stricter snap ─────────────── */

    test("nothing is trapped: every card, the closing line, and the document's end", async ({
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

      // The closing line is a snap position of its OWN — that is the mechanism
      // that makes `mandatory` safe, so it is asserted directly rather than
      // inferred from where a scroll happens to land.
      const tail = await page.locator(MORE).evaluate((el) => ({
        align: getComputedStyle(el).scrollSnapAlign,
        snapPoint: Math.round(
          el.getBoundingClientRect().top +
            window.scrollY -
            parseFloat(getComputedStyle(el).scrollMarginTop || "0"),
        ),
      }));
      expect(tail.align, "the closing line is a snap position, not a gap between two").toBe("start");

      // And the law itself: approached from above, from just short, and from past
      // it, the reader ends up looking at the whole closing line. The rest
      // position is deliberately NOT asserted to be the tail's own snap point —
      // where that point sits beyond the document's end (the portrait tablet: the
      // line's snap point is past max scroll) the browser clamps to the last
      // reachable one, and the line is fully on screen there anyway. Readable is
      // the law; which snap position delivers it is the engine's business.
      for (const off of [-90, -30, 40]) {
        await settleAt(page, tail.snapPoint + off);
        await expect(
          page.locator(MORE),
          `from ${off}px away, the closing line is fully on screen`,
        ).toBeInViewport({ ratio: 1 });
      }

      // And the very bottom of the document, footer included, is not fenced off:
      // with only cards and the closing line as snap positions, `mandatory` pulled
      // back from the end and sealed off the footer's last 197px.
      await page.evaluate(() => window.scrollTo({ top: 1e7, behavior: "instant" }));
      await page.waitForTimeout(1000);
      const end = await page.evaluate(() => ({
        rest: Math.round(window.scrollY),
        max: Math.round(document.documentElement.scrollHeight - window.innerHeight),
      }));
      expect(end.rest, "the end of the document is a place the reader can rest").toBe(end.max);
      await expect(page.locator("footer"), "the footer is reachable in full").toBeInViewport({
        ratio: 1,
      });
    });
  });
}

/* ══════════════ the one-card board is still not touched ══════════════ */

test.describe("EVENTS.SNAP.2 — a single card is left exactly as it was", () => {
  for (const room of PORTRAIT_ROOMS) {
    test(`${room.name} — no snap, no screen-tall cell, no forced fill`, async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, { ...room, items: [card("solo", "full")] });

      expect(await snapTypeOf(page), "the snap container is not armed").toBe("none");
      const geo = await page.locator(CELL).first().evaluate((el) => ({
        minHeight: getComputedStyle(el).minHeight,
        align: getComputedStyle(el).scrollSnapAlign,
      }));
      expect(geo.align, "a lone card is not a snap target").toBe("none");
      // WebKit says `auto` where Chromium says `0px` for an unset min-height;
      // both mean the same thing, which is that no screen-tall cell was applied.
      expect(["0px", "auto"], "…and gets no screen-tall cell").toContain(geo.minHeight);

      // The ratified one-card composition: the card is its own content height, and
      // the fill law of a multi-card board must not have leaked onto it.
      const cards = await cardsDoc(page);
      expect(cards[0].h, "the lone card keeps its dialled-in height").toBeLessThan(room.height);
    });
  }
});
