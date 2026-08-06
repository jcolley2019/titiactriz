import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * EVENTS.NAV.1 — the /events back control, the phone's spacing, and the
 * portrait tablet's card.
 *
 * Three rulings from Joey's on-screen review, each with a law that fails if it
 * regresses:
 *
 *  1. THERE IS A WAY OUT. The marquee lands a reader on /events from anywhere;
 *     until now only the browser's own button led back. A quiet gold control,
 *     top-left, to `/` bare, in both languages.
 *
 *  2. THE PHONE IS NOT PADDED OUT. Verbatim: "too much padding above EVENTS and
 *     between the events and 'the latest i'm working on' and too much below that
 *     text between that and the event card and More Events Coming Soon is cut
 *     off." Measured before the fix at 440x956, the closing line sat at y=979 on
 *     a 956-tall screen — 23px past the fold, which is the "cut off". The law is
 *     the brick's budget: the back control, the heading, the subtitle, the card
 *     title and the top of the poster all inside the first screen — and, since
 *     the complaint named it, the closing line too.
 *
 *  2b. …AND THE FOLD IS THE DEVICE'S FOLD, NOT THE HEADLESS ONE. That budget
 *     passed here and still failed in Joey's hand, because this runner has no
 *     `env(safe-area-inset-top)` and no Safari bar: the page starts ~59px lower
 *     on the phone and the last ~86px are under a floating toolbar, so a 956px
 *     screen is worth ~811. Joey, on the second screenshot: "MOVE EVENTS up
 *     along the same horizontal plane as the back button and make it slightly
 *     smaller move it all up so that the fucking thing fits on the phone
 *     screen." The way out and the title now share ONE band, and the budget is
 *     judged against the room the device actually shows — the WHOLE poster
 *     inside it, not merely its top edge.
 *
 *  3. A PORTRAIT SCREEN GETS A PORTRAIT CARD. Verbatim: "it should fit more in a
 *     portrait mode... it should be taller than wide." At 1024x1366 the frame
 *     measured 992x738 — wider than tall, poster capped at 560px inside a
 *     1366px-tall screen.
 *
 *  4. …AND DESKTOP IS UNTOUCHED. Verbatim: "the spacing here look fine in
 *     desktop view." This is the reason the back control is lifted out of flow
 *     at md and up, and the reason the portrait work is behind an orientation
 *     query: desktop and landscape tablet must keep the composition they had.
 *     The heading's position is asserted against its ratified 8rem offset, so an
 *     in-flow control that pushed the page down would fail here.
 */

const BACK = '[data-qa="events-back"]';
const TITLE = '[data-qa="events-title"]';
const INTRO = '[data-qa="events-intro"]';
const MORE = '[data-qa="events-more"]';
const CARD = "article";
const POSTER = '[data-qa="event-card-image"]';

/** A portrait poster at the real card's aspect (1043x1553), served offline. */
const POSTER_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='1043' height='1553'><rect width='100%' height='100%' fill='#2b0d2b'/></svg>`,
)}`;

const BOARD = {
  pageVisible: true,
  homeVisible: false,
  items: [
    {
      id: "cumple-2026",
      size: "full",
      title: { es: "Cumpleaños de Titi", en: "Titi's Birthday" },
      badge: { es: "", en: "" },
      description: { es: "", en: "" },
      note: { es: "", en: "" },
      imageUrl: POSTER_SVG,
      imagePosition: "above",
      imageAspect: "portrait",
      buttons: [],
    },
  ],
};

async function open(
  page: Page,
  opts: { width: number; height: number; lang?: "es" | "en" },
) {
  await page.setViewportSize({ width: opts.width, height: opts.height });
  await forceLanguage(page, opts.lang ?? "es");
  await routeSupabase(page, { eventsBoard: BOARD });
  await page.goto("/events", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(page.locator(BACK)).toBeVisible();
  await page.waitForFunction(
    () => {
      const i = document.querySelector('[data-qa="event-card-image"]') as HTMLImageElement | null;
      return !!i && i.complete && i.naturalWidth > 0;
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(400);
}

const boxOf = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      left: Math.round(r.left),
      right: Math.round(r.right),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  });

/* ───────────────────────── law 1 — there is a way out ───────────────────────── */

test.describe("EVENTS.NAV.1 — the back control", () => {
  for (const lang of ["es", "en"] as const) {
    test(`${lang} — it reads its own language, sits top-left, and goes home`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await open(page, { width: 1440, height: 900, lang });

      const back = page.locator(BACK);
      await expect(back).toHaveText(lang === "es" ? /Volver/i : /Back/i);
      await expect(back).toHaveAttribute("href", "/");

      // Top-left: above the heading, and left of the heading's own glyphs.
      const b = await boxOf(page, BACK);
      const title = await boxOf(page, TITLE);
      expect(b.top, "the control is above the heading").toBeLessThan(title.top);
      const glyphLeft = await page.locator(TITLE).evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return Math.round(range.getBoundingClientRect().left);
      });
      expect(b.right, "…and clear of the heading's glyphs").toBeLessThan(glyphLeft);

      // And it actually navigates.
      await back.click();
      await page.waitForTimeout(900);
      expect(new URL(page.url()).pathname, "the control lands on the bare home").toBe("/");
    });
  }

  for (const lang of ["es", "en"] as const) {
    test(`${lang} — the phone puts the control and the heading on ONE row`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await open(page, { width: 440, height: 956, lang });

      const b = await boxOf(page, BACK);
      const title = await boxOf(page, TITLE);

      // "MOVE EVENTS up along the same horizontal plane as the back button":
      // the control's midline falls inside the heading's own band.
      const mid = Math.round((b.top + b.bottom) / 2);
      expect(
        mid,
        `the control shares the heading's band (control mid ${mid}, band ${title.top}–${title.bottom})`,
      ).toBeGreaterThanOrEqual(title.top);
      expect(mid, "…on the same row, not below it").toBeLessThanOrEqual(title.bottom);

      // Left edge for the way out, centred glyphs for the title, and daylight
      // between them — one row only works if they never touch.
      expect(b.left, "the control is at the page's left gutter").toBeLessThanOrEqual(20);
      const glyphLeft = await page.locator(TITLE).evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return Math.round(range.getBoundingClientRect().left);
      });
      expect(b.right, "…and clear of the heading's glyphs").toBeLessThan(glyphLeft);

      // …and clear of the fixed header, which is the only thing above it.
      const headerBottom = await page
        .locator("header")
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
      expect(b.top, "the row clears the fixed header").toBeGreaterThanOrEqual(headerBottom);
    });
  }

  test("the heading steps down on the phone and keeps its desktop size", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const size = () =>
      page.locator(TITLE).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    await open(page, { width: 440, height: 956 });
    expect(await size(), "'slightly smaller' on the phone — text-3xl").toBe(30);

    await page.setViewportSize({ width: 900, height: 900 });
    await page.waitForTimeout(300);
    expect(await size(), "…the tablet keeps text-5xl").toBe(48);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    expect(await size(), "…and the desktop keeps text-6xl").toBe(60);
  });
});

/* ────────────────── law 2 — the phone's first screen carries it all ────────────────── */

/**
 * The phones in the budget.
 *
 * The first row is not a guess any more. A temporary DEV dial printed Joey's
 * own device back to him — `FOLD 792+0` — so his Safari hands the page a
 * **792px** window with nothing overlaying it, not the 956 a naive reading of
 * the screen gives. That window, at his width, is the row this suite trusts.
 *
 * Its `reserve` covers the one thing a 440x792 runner still gets wrong: iOS
 * sizes `vh` off the LARGER viewport (~831px there, measured back from his
 * `56vh · 465px`), so the device's poster is ~20px taller than the one rendered
 * here. 25px pays for that and no more.
 *
 * The other two rows are the sizes Joey named in the brick, judged against the
 * plain fold exactly as he asked.
 */
const PHONES = [
  { name: "440x792 — Joey's iPhone, as his Safari reports it", width: 440, height: 792, reserve: 25 },
  { name: "471x1017", width: 471, height: 1017, reserve: 0 },
  { name: "390x844", width: 390, height: 844, reserve: 0 },
];

test.describe("EVENTS.NAV.1 — the phone's first screen carries the WHOLE act", () => {
  for (const phone of PHONES) {
    for (const lang of ["es", "en"] as const) {
      test(`${phone.name} ${lang} — row, card title, FULL poster and closing line all inside`, async ({
        page,
      }) => {
        test.setTimeout(120_000);
        await open(page, { width: phone.width, height: phone.height, lang });
        const vh = phone.height;
        const usable = vh - phone.reserve;

        const back = await boxOf(page, BACK);
        const title = await boxOf(page, TITLE);
        const cardTitle = await boxOf(page, `${CARD} h2`);
        const poster = await boxOf(page, POSTER);
        const more = await boxOf(page, MORE);

        // "lets remove the words 'The latest I'm working on'… phone stays
        // without it": on this screen the heading hands straight to the card.
        await expect(page.locator(INTRO)).toBeHidden();

        // Joey's budget, in his order — and the poster ENTIRE, not its top edge.
        for (const [what, bottom] of [
          ["the row", Math.max(back.bottom, title.bottom)],
          ["the card's title", cardTitle.bottom],
          ["the WHOLE poster", poster.bottom],
          ["the closing line", more.bottom],
        ] as const) {
          expect(bottom, `${what} is inside the viewport (${bottom} of ${vh})`).toBeLessThanOrEqual(vh);
        }

        // …and inside the room the DEVICE actually shows. This is the line the
        // first pass crossed: it fit here at 977 and ran under Safari's bar
        // there. Everything above the closing line is above it by construction.
        expect(
          more.bottom,
          `the closing line clears the device's own chrome (${more.bottom} of ${usable} usable = ${vh} − ${phone.reserve})`,
        ).toBeLessThanOrEqual(usable);

        // The poster is capped, never cropped: object-contain plus a height cap
        // means the whole 1043x1553 sheet is on screen at its own ratio.
        expect(
          Math.abs(poster.w / poster.h - 1043 / 1553),
          `the poster is fitted whole, not cropped (${poster.w}x${poster.h})`,
        ).toBeLessThan(0.02);
      });
    }
  }
});

/* ─────────────── law 3 — a portrait screen gets a portrait card ─────────────── */

test.describe("EVENTS.NAV.1 — the portrait tablet", () => {
  test("1024x1366 — the card frame is taller than it is wide", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, { width: 1024, height: 1366 });

    const card = await boxOf(page, CARD);
    expect(
      card.h,
      `the card stands up in portrait (${card.w}w x ${card.h}h)`,
    ).toBeGreaterThan(card.w);

    // …because the poster was given the vertical room, not merely because the
    // column was squeezed: it must clear the 560px cap the landscape card keeps.
    const poster = await boxOf(page, POSTER);
    expect(poster.h, `the poster uses the height (${poster.h}px)`).toBeGreaterThan(560);
    expect(poster.right, "…without overflowing its card").toBeLessThanOrEqual(card.right);
    expect(poster.left, "…on either side").toBeGreaterThanOrEqual(card.left);
  });
});

/* ────────────── law 4 — desktop and landscape are left exactly alone ────────────── */

test.describe("EVENTS.NAV.1 — untouched where Joey said it was fine", () => {
  for (const vp of [
    { name: "desktop-1920", width: 1920, height: 1080 },
    { name: "tablet-landscape-1366", width: 1366, height: 1024 },
  ]) {
    test(`${vp.name} — the composition keeps its ratified geometry`, async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, vp);

      // The heading still starts at the page's ratified 8rem top padding. An
      // in-flow back control would have pushed it down by its own height.
      const title = await boxOf(page, TITLE);
      expect(
        title.top,
        `the heading is still at the 8rem offset (got ${title.top})`,
      ).toBeLessThanOrEqual(130);

      // "Restore 'The latest I'm working on.' on desktop/tablet only" — the
      // line the phone gave up is still here, in this screen's own language.
      await expect(page.locator(INTRO)).toBeVisible();

      // And the card keeps the landscape shape — the portrait work must not
      // reach a landscape screen.
      const card = await boxOf(page, CARD);
      expect(card.w, `the card keeps its width (${card.w})`).toBe(1024);
      expect(card.h, `…and is still wider than tall (${card.w}x${card.h})`).toBeLessThan(card.w);

      const poster = await boxOf(page, POSTER);
      expect(poster.h, "the poster keeps the ratified 560px cap").toBeLessThanOrEqual(560);
    });
  }
});
