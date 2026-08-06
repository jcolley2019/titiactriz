import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase } from "./_admin";
import { EVENTS_ACT_ENABLED } from "../src/lib/ventures";

/**
 * EVENTS.1 laws + EVENTS.2 composition — the Events act, below the hero.
 *
 * EVENTS.2 placement ruling (supersedes the EVENTS.1 slot-5 call), verbatim:
 * "add it to the scrolling scren so that its visible when users scroll through
 * it appears below the hero but above the 01 section." The act now mounts
 * DIRECTLY AFTER THE HERO, before act 01 (the reel).
 *
 * The EVENTS.1 laws travel with the act, unchanged:
 *
 *  1. THE SECTION IS ALWAYS THERE — flag off, the act still renders a section,
 *     in the right place in document order, never null (the late-mount law:
 *     a section that arrives after a later act has pinned is inserted against
 *     a DOM React no longer recognises — insertBefore crash, measured on the
 *     first build of the Socials act).
 *  2. DARK MEANS INVISIBLE — the empty section paints nothing and takes no
 *     height, so the hero hands straight to the reel.
 *  3. HONEST EMPTINESS — lit with ZERO cards, the act still paints nothing.
 *
 * EVENTS.2 adds what a dark act could not hold:
 *
 *  4. THE ROOMS — three committed candidates (A Proscenio, B Cartelera,
 *     C Función), staged via the DEV-only `?events=A|B|C` preview switch. The
 *     preview forces the act lit so a candidate is judged in the real flow;
 *     honest emptiness binds even in preview.
 *  5. THE DWELL — the lit act pins for the uniform +=120% (the story acts'
 *     one price) and the acts below still engage at their own spacer tops:
 *     the late pin is sort()ed and refreshed, never staling a neighbor.
 *  6. DIVISION OF LABOR — with the act enabled (or previewed), the sitewide
 *     marquee suppresses on HOME ONLY; every subpage keeps it. Flag false,
 *     no preview → today's behavior, unchanged.
 *
 * Compile-time flag states are asserted with the skip pattern (a gate that
 * lies about which state it measured is worse than one that says it skipped);
 * the preview switch lets laws 4-6 run NOW, at the shipping state, because the
 * e2e battery runs against the dev server where the switch exists.
 */

const PATH = "/cinematic";

const SECTION = '[data-qa="cinematic-events"]';
const STAGE = '[data-qa="events-stage"]';
const HEADING = '[data-qa="events-heading"]';
const CARDS = '[data-qa="events-cards"]';
const BANNER = '[data-qa="events-banner"]';
const SCROLLCUE = '[data-qa="cinematic-scrollcue"]'; // hero-only
const REEL_SLIDE = '[data-qa="reel-slide"]'; // reel-only (act 01)
const GALLERY = '[data-qa="cinematic-gallery"]';
const GREENWORLD = '[data-qa="cinematic-greenworld-seq"]';

/** A real-shaped card (the birthday event's grammar) for deterministic runs. */
const CARD = {
  id: "cumple-2026",
  size: "full",
  title: { es: "Cumpleaños de Titi", en: "Titi's Birthday" },
  badge: { es: "SÁBADO 8 DE AGOSTO", en: "SATURDAY, AUGUST 8" },
  description: {
    es: "Una noche para celebrar con todos ustedes.",
    en: "A night to celebrate with all of you.",
  },
  note: { es: "", en: "" },
  buttons: [],
};

const BOARD_WITH_CARD = { pageVisible: true, items: [CARD] };

/** A board whose main marquee is ON for every page — the division-of-labor
 *  subject. Text differs per locale so language is also observable. */
const BOARD_BANNER_ON = {
  pageVisible: true,
  mainBanner: {
    enabled: true,
    label: { es: "EVENTOS", en: "EVENTS" },
    text: { es: "GRAN EVENTO — SÁBADO 8", en: "BIG EVENT — SATURDAY 8" },
    link: "",
    pages: { home: true, greenWorld: true, titans: true },
    bold: false,
    textColor: "#C9A55C",
  },
  items: [CARD],
};

async function settle(page: Page, ms = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Open a path with a mocked board. `board` overrides the events_board value. */
async function openAt(
  page: Page,
  path: string,
  opts: { board?: unknown; width?: number; height?: number; lang?: "es" | "en" } = {},
) {
  await page.setViewportSize({ width: opts.width ?? 1440, height: opts.height ?? 900 });
  await forceLanguage(page, opts.lang ?? "es");
  await routeSupabase(page, opts.board === undefined ? {} : { eventsBoard: opts.board });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await settle(page);
}

/** Document-order index of a selector's first match, or -1 if it is absent. */
const orderOf = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return -1;
    let i = 0;
    for (const node of Array.from(document.querySelectorAll("*"))) {
      if (node === el) return i;
      i++;
    }
    return -1;
  }, sel);

const topOf = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top);

/**
 * The pin distance a selector's element is held for: the height its
 * `.pin-spacer` reserves beyond the pinned child itself. Works whether the
 * pinned element is the node or an ancestor inside the spacer.
 */
const pinDistanceOf = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return -1;
    const spacers = Array.from(document.querySelectorAll<HTMLElement>(".pin-spacer"));
    const spacer = spacers.find((sp) => sp.contains(el));
    if (!spacer || !spacer.firstElementChild) return -1;
    return (
      spacer.getBoundingClientRect().height -
      spacer.firstElementChild.getBoundingClientRect().height
    );
  }, sel);

/** Lenis owns the wheel; aim by wheeling and read OBSERVED state only. */
async function wheelTo(page: Page, y: number) {
  await page.mouse.move(200, 300);
  for (let i = 0; i < 260; i++) {
    const at = await page.evaluate(() => window.scrollY);
    const d = y - at;
    if (Math.abs(d) < 8) break;
    await page.mouse.wheel(0, Math.max(-700, Math.min(700, Math.round(d))));
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(450);
}

const spacerTopOf = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return Number.NaN;
    const spacer = Array.from(document.querySelectorAll<HTMLElement>(".pin-spacer")).find((sp) =>
      sp.contains(el),
    );
    const target = spacer ?? el;
    return target.getBoundingClientRect().top + window.scrollY;
  }, sel);

async function engage(page: Page, sel: string) {
  let start = await spacerTopOf(page, sel);
  for (let i = 0; i < 4; i++) {
    await wheelTo(page, start + 60);
    if (Math.abs(await topOf(page, sel)) <= 2) break;
    start = await spacerTopOf(page, sel);
  }
  return start;
}

/* ─────────────── laws 1 + 2 — the dark act, at the shipping state ─────────────── */

test.describe("EVENTS.2 — the act ships dark, below the hero", () => {
  test.skip(EVENTS_ACT_ENABLED, "EVENTS_ACT_ENABLED is on — the dark gate has no subject");

  test("the section is present, below the hero and above act 01, with the flag off", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openAt(page, PATH);

    // Present — not null, not conditionally mounted.
    await expect(page.locator(SECTION)).toHaveCount(1);
    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");

    const [cue, events, reelSlide, gallery, greenworld] = await Promise.all([
      orderOf(page, SCROLLCUE),
      orderOf(page, SECTION),
      orderOf(page, REEL_SLIDE),
      orderOf(page, GALLERY),
      orderOf(page, GREENWORLD),
    ]);

    expect(cue, "the hero is in the flow").toBeGreaterThan(-1);
    expect(reelSlide, "act 01 (the reel) is in the flow").toBeGreaterThan(-1);
    expect(greenworld, "Green World is in the flow").toBeGreaterThan(-1);
    // The EVENTS.2 position: below the hero, above the 01 section.
    expect(events, "the Events act sits below the hero").toBeGreaterThan(cue);
    expect(events, "the Events act sits above act 01").toBeLessThan(reelSlide);
    expect(events, "…and therefore above the gallery too").toBeLessThan(gallery);
  });

  test("the dark act paints nothing and takes no height", async ({ page }) => {
    test.setTimeout(90_000);
    await openAt(page, PATH);

    const box = await page.locator(SECTION).boundingBox();
    // An empty section has no box at all, or a zero-height one. Either is
    // honest; a section with height would be a room the reader pays for.
    expect(box?.height ?? 0, "the dark act's rendered height").toBeLessThanOrEqual(1);

    // Nothing designed leaked out from behind the flag.
    await expect(page.locator(STAGE)).toHaveCount(0);
    await expect(page.locator(HEADING)).toHaveCount(0);

    // The Book act stays gone from the flow, not merely hidden.
    await expect(page.locator('[data-qa="cinematic-book"]')).toHaveCount(0);
  });
});

/* ──────────────── law 3 — honest emptiness, once the flag is on ──────────────── */

test.describe("EVENTS.1 — lit, with zero cards", () => {
  test.skip(!EVENTS_ACT_ENABLED, "EVENTS_ACT_ENABLED is false — the act is dark by design");

  test("an empty board still paints nothing", async ({ page }) => {
    test.setTimeout(90_000);
    // A board that EXISTS and is genuinely card-less — not an absent row, which
    // the parser would fill with its seeded default.
    await openAt(page, PATH, { board: { pageVisible: true, items: [] } });

    await expect(page.locator(SECTION)).toHaveCount(1);
    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");
    await expect(page.locator(STAGE)).toHaveCount(0);

    const box = await page.locator(SECTION).boundingBox();
    expect(box?.height ?? 0, "a lit act with no cards has no height").toBeLessThanOrEqual(1);
  });

  test("a board with cards lights the slot", async ({ page }) => {
    test.setTimeout(90_000);
    await openAt(page, PATH, { board: BOARD_WITH_CARD });

    await expect(page.locator(STAGE)).toHaveCount(1);
    await expect(page.locator(STAGE)).toHaveAttribute("data-cards", "1");
  });
});

/* ──────── law 4 — the rooms, judged in the real flow via the DEV preview ──────── */

test.describe("EVENTS.2 — the bake-off rooms (DEV preview)", () => {
  for (const room of ["A", "B", "C"] as const) {
    test(`?events=${room} lights the act in room ${room}, in place, in Spanish`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await openAt(page, `${PATH}?events=${room}`, { board: BOARD_WITH_CARD });

      await expect(page.locator(SECTION)).toHaveAttribute("data-room", room);
      await expect(page.locator(SECTION)).toHaveAttribute("data-preview", "true");
      await expect(page.locator(STAGE)).toHaveCount(1);
      await expect(page.locator(HEADING)).toHaveText(/Eventos/i);
      // The ratified card grammar is the tenant of every room.
      await expect(page.locator(CARDS)).toHaveCount(1);
      await expect(page.locator(CARDS)).toContainText("Cumpleaños de Titi");

      // The lit act keeps the EVENTS.2 position: below the hero, above 01.
      const [cue, events, reelSlide] = await Promise.all([
        orderOf(page, SCROLLCUE),
        orderOf(page, SECTION),
        orderOf(page, REEL_SLIDE),
      ]);
      expect(events, "lit act still below the hero").toBeGreaterThan(cue);
      expect(events, "lit act still above act 01").toBeLessThan(reelSlide);
    });
  }

  test("the rooms speak English too", async ({ page }) => {
    test.setTimeout(120_000);
    await openAt(page, `${PATH}?events=B`, { board: BOARD_WITH_CARD, lang: "en" });
    await expect(page.locator(HEADING)).toHaveText(/Events/i);
    await expect(page.locator(CARDS)).toContainText("Titi's Birthday");
  });

  test("honest emptiness binds even in preview", async ({ page }) => {
    test.setTimeout(120_000);
    await openAt(page, `${PATH}?events=A`, { board: { pageVisible: true, items: [] } });
    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");
    await expect(page.locator(STAGE)).toHaveCount(0);
  });

  test("no preview, no flag — the query-less page is untouched by the switch", async ({
    page,
  }) => {
    test.skip(EVENTS_ACT_ENABLED, "flag on — the dark shape is not this page's state");
    test.setTimeout(120_000);
    await openAt(page, PATH, { board: BOARD_WITH_CARD });
    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");
    await expect(page.locator(STAGE)).toHaveCount(0);
  });
});

/* ─────── law 5 — the uniform dwell, and the neighbors it must not disturb ─────── */

test.describe("EVENTS.2 — the dwell", () => {
  test("the lit act pins for the uniform +=120% and no neighbor is staled", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await openAt(page, `${PATH}?events=A`, { board: BOARD_WITH_CARD });
    const DWELL = 1.2 * 900;

    // The act's own price: exactly the story acts' one number.
    const dist = await pinDistanceOf(page, STAGE);
    expect(Math.abs(dist - DWELL), `the act dwells for +=120% (got ${Math.round(dist)})`)
      .toBeLessThanOrEqual(14);

    // The neighbor's price is untouched: the gallery still dwells its own
    // +=120% with the events pin live above it. This is the falsifier for a
    // late-mounted pin created without sort()+refresh.
    const galleryDist = await pinDistanceOf(page, GALLERY);
    expect(
      Math.abs(galleryDist - DWELL),
      `the gallery below keeps its own +=120% (got ${Math.round(galleryDist)})`,
    ).toBeLessThanOrEqual(14);

    // Engage, hold, release — observed state, never the aimed position.
    const start = await engage(page, STAGE);
    expect(Math.abs(await topOf(page, STAGE)), "pinned at engage").toBeLessThanOrEqual(2);
    await wheelTo(page, start + 0.6 * DWELL);
    expect(Math.abs(await topOf(page, STAGE)), "still pinned mid-dwell").toBeLessThanOrEqual(2);
    await wheelTo(page, start + DWELL + 320);
    expect(await topOf(page, STAGE), "released after the dwell").toBeLessThan(-200);

    // And the act below still engages at its OWN spacer top.
    await engage(page, GALLERY);
    expect(
      Math.abs(await topOf(page, GALLERY)),
      "the gallery still engages at its own spacer top",
    ).toBeLessThanOrEqual(2);
  });

  test("reduced motion renders the lit act complete, static, unpinned", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openAt(page, `${PATH}?events=C`, { board: BOARD_WITH_CARD });

    await expect(page.locator(STAGE)).toHaveCount(1);
    await expect(page.locator(CARDS)).toBeVisible();
    const dist = await pinDistanceOf(page, STAGE);
    expect(dist, "no pin-spacer under reduced motion").toBeLessThanOrEqual(0);
  });
});

/* ─────────── law 6 — the marquee's division of labor, both states ─────────── */

test.describe("EVENTS.2 — marquee division of labor", () => {
  test("flag off, no preview — the marquee still runs on home (today, unchanged)", async ({
    page,
  }) => {
    test.skip(EVENTS_ACT_ENABLED, "flag on — this is the other state's spec");
    test.setTimeout(120_000);
    await openAt(page, PATH, { board: BOARD_BANNER_ON });
    await expect(page.locator(BANNER)).toBeVisible();
    await expect(page.locator(BANNER)).toContainText("GRAN EVENTO");
  });

  test("previewing a room suppresses the home marquee — the post-flip state, visible now", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openAt(page, `${PATH}?events=A`, { board: BOARD_BANNER_ON });
    // The act carries the events story on home; the marquee yields the page.
    await expect(page.locator(STAGE)).toHaveCount(1);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("flag on — home is suppressed with no query at all", async ({ page }) => {
    test.skip(!EVENTS_ACT_ENABLED, "flag off — armed the day the act is lit");
    test.setTimeout(120_000);
    await openAt(page, PATH, { board: BOARD_BANNER_ON });
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("subpages keep the marquee at every flag state", async ({ page }) => {
    test.setTimeout(120_000);
    await openAt(page, "/book", { board: BOARD_BANNER_ON });
    await expect(page.locator(BANNER)).toBeVisible();
    await expect(page.locator(BANNER)).toContainText("GRAN EVENTO");
  });
});
