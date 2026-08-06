import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";
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
 *  6. DIVISION OF LABOR — the sitewide marquee suppresses on HOME ONLY, and
 *     only when the act ACTUALLY RENDERS; every subpage keeps it. An act
 *     hidden for any reason leaves the banner exactly as it is today.
 *
 * EVENTS.2b adds the owner's ONE switch:
 *
 *  7. THREE DOORS — the act renders only when EVENTS_ACT_ENABLED (engineering)
 *     AND board.homeVisible (the owner's "Mostrar eventos en portada" toggle)
 *     AND at least one card all hold. Every other combination is the empty
 *     section. The DEV preview stands in for the FLAG ONLY — the board
 *     conditions stay real under preview, which is what lets every
 *     board-driven combination be asserted at the shipping state.
 *  8. ONE TOGGLE, HOME SURFACE, NOT LAYOUTS — the admin switch round-trips to
 *     `homeVisible` on the saved board, defaults OFF for boards that predate
 *     it, and there are no per-layout controls anywhere.
 *  9. THE PAGE LIVES ITS OWN LIFE — /events is reachable at every board state:
 *     zero enabled cards renders the honest "más eventos próximamente" line,
 *     never a 404 and never fake urgency, and `homeVisible` has no effect on
 *     it in either direction.
 *
 * Compile-time flag states are asserted with the skip pattern (a gate that
 * lies about which state it measured is worse than one that says it skipped);
 * the preview switch lets laws 4-7 run NOW, at the shipping state, because the
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

// EVENTS.2b — the canonical "every door open" board: home surface ON.
const BOARD_WITH_CARD = { pageVisible: true, homeVisible: true, items: [CARD] };

// The same board with the owner's switch OFF — one door closed, act dark.
const BOARD_HOME_OFF = { pageVisible: true, homeVisible: false, items: [CARD] };

/** A board whose main marquee is ON for every page — the division-of-labor
 *  subject. Text differs per locale so language is also observable. */
const BOARD_BANNER_ON = {
  pageVisible: true,
  homeVisible: true,
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
    // the parser would fill with its seeded default. homeVisible is ON so that
    // emptiness, not the owner's switch, is what keeps the act dark.
    await openAt(page, PATH, { board: { pageVisible: true, homeVisible: true, items: [] } });

    await expect(page.locator(SECTION)).toHaveCount(1);
    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");
    await expect(page.locator(STAGE)).toHaveCount(0);

    const box = await page.locator(SECTION).boundingBox();
    expect(box?.height ?? 0, "a lit act with no cards has no height").toBeLessThanOrEqual(1);
  });

  test("a board with cards and the home toggle on lights the slot", async ({ page }) => {
    test.setTimeout(90_000);
    await openAt(page, PATH, { board: BOARD_WITH_CARD });

    await expect(page.locator(STAGE)).toHaveCount(1);
    await expect(page.locator(STAGE)).toHaveAttribute("data-cards", "1");
  });

  test("the owner's toggle off keeps the act dark even with the flag on", async ({ page }) => {
    test.setTimeout(90_000);
    await openAt(page, PATH, { board: BOARD_HOME_OFF });

    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");
    await expect(page.locator(STAGE)).toHaveCount(0);
  });
});

/* ─────── law 7 — three doors, every closed combination is the empty section ─────── */

test.describe("EVENTS.2b — one toggle, three doors", () => {
  test("the toggle alone cannot light the act (flag off, no preview)", async ({ page }) => {
    test.skip(EVENTS_ACT_ENABLED, "flag on — this combination no longer exists");
    test.setTimeout(120_000);
    await openAt(page, PATH, { board: BOARD_WITH_CARD });
    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");
    await expect(page.locator(STAGE)).toHaveCount(0);
  });

  test("preview without the toggle previews a dark act — the board conditions stay real", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openAt(page, `${PATH}?events=A`, { board: BOARD_HOME_OFF });
    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");
    await expect(page.locator(STAGE)).toHaveCount(0);
  });

  test("all three doors open — the act renders", async ({ page }) => {
    test.setTimeout(120_000);
    await openAt(page, `${PATH}?events=A`, { board: BOARD_WITH_CARD });
    await expect(page.locator(STAGE)).toHaveCount(1);
    await page.screenshot({ path: shot("events-2b-home-act-on.png") });
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

  test("act hidden by the owner's toggle — the banner behaves normally, even in preview", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // EVENTS.2b — suppression follows the RENDER. Same preview, same banner
    // board, but homeVisible off: the act is dark, so the marquee keeps home.
    await openAt(page, `${PATH}?events=A`, {
      board: { ...BOARD_BANNER_ON, homeVisible: false },
    });
    await expect(page.locator(STAGE)).toHaveCount(0);
    await expect(page.locator(BANNER)).toBeVisible();
    await page.screenshot({ path: shot("events-2b-home-act-off-banner-on.png") });
  });

  test("act hidden by an empty board — the banner behaves normally, even in preview", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openAt(page, `${PATH}?events=A`, {
      board: { ...BOARD_BANNER_ON, items: [] },
    });
    await expect(page.locator(STAGE)).toHaveCount(0);
    await expect(page.locator(BANNER)).toBeVisible();
  });

  test("flag on — home is suppressed with no query at all", async ({ page }) => {
    test.skip(!EVENTS_ACT_ENABLED, "flag off — armed the day the act is lit");
    test.setTimeout(120_000);
    await openAt(page, PATH, { board: BOARD_BANNER_ON });
    await expect(page.locator(BANNER)).toHaveCount(0);
    // The canonical post-flip home: the act lit by the REAL flag, marquee gone.
    await expect(page.locator(STAGE)).toHaveCount(1);
    await page.screenshot({ path: shot("events-2b-home-act-on-real-flag.png") });
  });

  test("flag on with the toggle off — the banner still runs on home", async ({ page }) => {
    test.skip(!EVENTS_ACT_ENABLED, "flag off — armed the day the act is lit");
    test.setTimeout(120_000);
    await openAt(page, PATH, { board: { ...BOARD_BANNER_ON, homeVisible: false } });
    await expect(page.locator(BANNER)).toBeVisible();
  });

  test("subpages keep the marquee at every flag state", async ({ page }) => {
    test.setTimeout(120_000);
    await openAt(page, "/book", { board: BOARD_BANNER_ON });
    await expect(page.locator(BANNER)).toBeVisible();
    await expect(page.locator(BANNER)).toContainText("GRAN EVENTO");
  });
});

/* ────────── law 9 — the /events page lives its own life, at every state ────────── */

test.describe("EVENTS.2b — the /events page lifecycle", () => {
  test("zero enabled cards — reachable, honest 'próximamente', never 404", async ({ page }) => {
    test.setTimeout(120_000);
    await openAt(page, "/events", {
      board: { pageVisible: true, homeVisible: false, items: [] },
    });

    // The page is itself, not the 404 route.
    await expect(page.locator("h1")).toHaveText(/Eventos/i);
    // The honest empty line — a quiet fact, not fake urgency.
    await expect(page.getByText(/más eventos próximamente/i)).toBeVisible();
    // And genuinely empty: no cards.
    await expect(page.locator("article")).toHaveCount(0);
    await page.screenshot({ path: shot("events-2b-page-empty.png") });
  });

  test("with cards the grid grows to fit — and homeVisible has no say here", async ({ page }) => {
    test.setTimeout(120_000);
    // homeVisible OFF on purpose: the owner's home switch governs the home
    // surface only, and must not reach into the /events page in either
    // direction.
    await openAt(page, "/events", {
      board: { pageVisible: true, homeVisible: false, items: [CARD] },
    });

    await expect(page.locator("h1")).toHaveText(/Eventos/i);
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article")).toContainText("Cumpleaños de Titi");
    await page.screenshot({ path: shot("events-2b-page-populated.png") });
  });

  test("the page speaks English too", async ({ page }) => {
    test.setTimeout(120_000);
    await openAt(page, "/events", {
      board: { pageVisible: true, homeVisible: false, items: [CARD] },
      lang: "en",
    });
    await expect(page.locator("h1")).toHaveText(/Events/i);
    await expect(page.locator("article")).toContainText("Titi's Birthday");
  });
});

/* ───────── law 8 — the admin's one switch, round-tripped to the saved board ───────── */

test.describe("EVENTS.2b — the admin toggle", () => {
  const NAV = '[data-qa="admin-nav-events"]';
  const BOARD_TOGGLE = '[data-qa="events-board-toggle"]';
  const HOME_SWITCH = '[data-qa="home-visible"]';

  async function openBoardAdmin(page: Page, board: unknown) {
    const writes: Write[] = [];
    await injectAdminSession(page);
    await forceLanguage(page, "en"); // the save button is matched by its EN name
    await routeSupabase(page, { eventsBoard: board, writes });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.locator(NAV).click();
    await page.locator(BOARD_TOGGLE).click(); // the board ships collapsed
    await expect(page.locator(HOME_SWITCH)).toBeVisible();
    // Let the manager's initial board fetch land BEFORE interacting: a click
    // that races it gets repainted by the arriving row, and a screenshot taken
    // in that window shows a state the save never carried.
    await page.waitForTimeout(700);
    return { writes };
  }

  const savedHomeVisible = (writes: Write[]) => {
    const sent = writes
      .filter((w) => w.method !== "GET" && w.url.includes("site_settings") && w.body)
      .map((w) => JSON.parse(w.body as string));
    expect(sent, "exactly one save went through").toHaveLength(1);
    const payload = Array.isArray(sent[0]) ? sent[0][0] : sent[0];
    return (payload.value as { homeVisible?: unknown }).homeVisible;
  };

  test("a board that predates the field shows the switch OFF, and saving keeps it off", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // No homeVisible key at all — the live rows written before EVENTS.2b.
    const { writes } = await openBoardAdmin(page, { pageVisible: true, items: [CARD] });

    await expect(page.locator(HOME_SWITCH)).toHaveAttribute("data-state", "unchecked");
    await page.locator(HOME_SWITCH).scrollIntoViewIfNeeded();
    await page.screenshot({ path: shot("events-2b-admin-toggle-off.png") });

    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForTimeout(600);
    expect(savedHomeVisible(writes), "an untouched old board saves homeVisible false").toBe(false);
  });

  test("one click turns the home surface on, and the save carries it", async ({ page }) => {
    test.setTimeout(120_000);
    const { writes } = await openBoardAdmin(page, { pageVisible: true, items: [CARD] });

    await page.locator(HOME_SWITCH).click();
    await expect(page.locator(HOME_SWITCH)).toHaveAttribute("data-state", "checked");
    // …and it HOLDS: the state survives any late repaint before the shot.
    await page.waitForTimeout(700);
    await expect(page.locator(HOME_SWITCH)).toHaveAttribute("data-state", "checked");
    await page.screenshot({ path: shot("events-2b-admin-toggle-on.png") });

    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForTimeout(600);
    expect(savedHomeVisible(writes), "the save writes homeVisible true").toBe(true);
  });

  test("a board saved with the switch on reopens with it on", async ({ page }) => {
    test.setTimeout(120_000);
    await openBoardAdmin(page, { pageVisible: true, homeVisible: true, items: [CARD] });
    await expect(page.locator(HOME_SWITCH)).toHaveAttribute("data-state", "checked");
  });
});
