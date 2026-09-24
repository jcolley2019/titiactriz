import { expect, test, type Page } from "@playwright/test";
import { injectAdminSession, forceLanguage, routeSupabase, type Write } from "./_admin";

/**
 * ADMIN.QOL.1 — the save-button trap.
 *
 * Hit twice in real use: a toggle at the TOP of this editor changed nothing but
 * local state, the Save that would have written it sat far below the fold, and
 * the owner navigated away or went to test — losing the change, or trusting a
 * stale page.
 *
 * The three laws, each measured against what actually reached the database:
 *
 *  1. A TOGGLE IS ALREADY SAVED. Flipping Full/Half writes on the spot, with no
 *     Save click anywhere in the test, and a reload serves the new value back.
 *     Asserted on the PERSISTED ROW, not on a class — a button that merely looks
 *     selected is the bug, not the fix.
 *  2. TEXT STILL WAITS, BUT SAYS SO. Typing writes nothing (a save here runs the
 *     translator per field), and the Save bar pins itself to the bottom of the
 *     viewport while it waits — visible from the top of the editor, which is
 *     where the trap used to be sprung.
 *  3. LEAVING ASKS FIRST. An in-app link with unsaved text is stopped, and the
 *     prompt is what decides.
 */

const BOARD_KEY = "events_board";
const SAVE_BAR = '[data-qa="events-save-bar"]';
const UNSAVED = '[data-qa="events-unsaved"]';

const card = (id: string, size: "full" | "half") => ({
  id,
  size,
  title: { es: `Evento ${id}`, en: `Event ${id}` },
  badge: { es: "", en: "" },
  description: { es: "", en: "" },
  note: { es: "", en: "" },
  imageUrl: "",
  imagePosition: "above",
  imageAspect: "auto",
  bulletsOn: false,
  bullets: [],
  videoUrl: "",
  videoFileUrl: "",
  buttons: [],
});

const BOARD = {
  pageVisible: true,
  homeVisible: false,
  items: [card("a", "full")],
};

/**
 * The events board, served and RE-served: a board that only ever answers with
 * the fixture cannot tell a real write from a no-op. This mock keeps the last
 * written value and hands it back, so "reload and see it" means something.
 */
/**
 * ADMIN.SAVEBAR.1b — how the mocked board write answers. The default is what
 * every law above was written against: at once, and successfully. `delayMs`
 * holds the write open so a test can watch the round trip; `fail` answers 400.
 */
type WriteMode = { delayMs?: number; fail?: boolean };

async function routeLiveBoard(page: Page, writes: Write[], mode: WriteMode = {}) {
  const state = { value: JSON.parse(JSON.stringify(BOARD)) as Record<string, unknown> };
  await routeSupabase(page, { writes, eventsBoard: state.value });
  // Sits IN FRONT of routeSupabase's handler and owns this one key.
  await page.route("**/rest/v1/site_settings*", async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === "GET") {
      if (!url.includes(BOARD_KEY)) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ value: state.value }),
      });
    }
    const body = req.postData() ?? "";
    if (body.includes(BOARD_KEY)) {
      // This handler fulfils before routeSupabase's ever runs (routes are
      // LIFO), so the write has to be recorded HERE or it is invisible.
      writes.push({ method: req.method(), url, body });
      if (mode.delayMs) await new Promise((r) => setTimeout(r, mode.delayMs));
      if (mode.fail) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "mocked write failure" }),
        });
      }
      try {
        const rows = JSON.parse(body);
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (row?.value) state.value = row.value;
      } catch {
        /* a body we cannot parse is not a board write */
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.fallback();
  });
  return state;
}

async function openEventsAdmin(page: Page, writes: Write[], mode: WriteMode = {}) {
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  const state = await routeLiveBoard(page, writes, mode);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.locator('[data-qa="admin-nav-events"]').click();
  await expect(page.locator(SAVE_BAR)).toBeVisible();
  await page.waitForTimeout(400);
  return state;
}

/** Board writes only — the storage and translate traffic is not this test's. */
const boardWrites = (writes: Write[]) =>
  writes.filter((w) => w.method !== "GET" && (w.body ?? "").includes(BOARD_KEY));

const sizeButton = (page: Page, label: "Full" | "Half") =>
  page.getByRole("button", { name: label, exact: true });

/* ═════════════ law 1 — a toggle is already saved ═════════════ */

test("Full/Half writes to the board with no Save click, and survives a reload", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  const state = await openEventsAdmin(page, writes);

  expect((state.value.items as { size: string }[])[0].size, "the fixture starts Full").toBe("full");
  expect(boardWrites(writes), "nothing written just by opening the editor").toHaveLength(0);

  await sizeButton(page, "Half").click();

  // The indicator lands AT the control — the owner's eye is already there.
  await expect(page.locator('[data-qa^="flash-size-"]'), "it says saved, by the switch")
    .toBeVisible();
  await expect(page.locator('[data-qa^="flash-size-"]')).toHaveAttribute("data-state", "saved");

  // The row itself, not the button's styling.
  await expect
    .poll(() => (state.value.items as { size: string }[])[0].size, {
      message: "the persisted board carries the new size",
      timeout: 10_000,
    })
    .toBe("half");
  expect(boardWrites(writes).length, "exactly one write, and no Save was clicked").toBe(1);

  // The bar never went dirty: a committed toggle is not pending work.
  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "false");
  await expect(page.locator(UNSAVED)).toHaveCount(0);

  // …and the reload is the real proof.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-qa="admin-nav-events"]').click();
  await expect(page.locator(SAVE_BAR)).toBeVisible();
  await expect(sizeButton(page, "Half"), "Half comes back selected").toHaveClass(/bg-accent/);
});

test("a visibility switch writes on the spot too", async ({ page }) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  const state = await openEventsAdmin(page, writes);

  await page.locator('[data-qa="home-visible"]').click();
  await expect(page.locator('[data-qa="flash-homeVisible"]')).toHaveAttribute(
    "data-state",
    "saved",
  );
  await expect
    .poll(() => state.value.homeVisible, { timeout: 10_000 })
    .toBe(true);
  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "false");
});

/* ═════════════ law 2 — text waits, and the bar says so ═════════════ */

test("typing writes nothing, and pins the Save bar to the bottom of the viewport", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  await openEventsAdmin(page, writes);

  const title = page.locator('[data-qa="event-title"]').first();
  await title.fill("Un evento nuevo");
  await page.waitForTimeout(500);

  // Not one write per keystroke — not one write at all.
  expect(boardWrites(writes), "typing does not touch the database").toHaveLength(0);

  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "true");
  await expect(page.locator(UNSAVED), "the unsaved marker is up").toBeVisible();

  // THE POINT OF THE BRICK: from the top of a long editor, with the bottom of
  // the section far below the fold, the bar is still on screen.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const geo = await page.evaluate((sel) => {
    const bar = document.querySelector(sel) as HTMLElement;
    const section = bar.closest("section") as HTMLElement;
    const r = bar.getBoundingClientRect();
    return {
      barBottom: Math.round(r.bottom),
      barTop: Math.round(r.top),
      vh: window.innerHeight,
      sectionBottom: Math.round(section.getBoundingClientRect().bottom),
      position: getComputedStyle(bar).position,
    };
  }, SAVE_BAR);

  expect(geo.sectionBottom, "the editor really does run past the fold").toBeGreaterThan(geo.vh);
  expect(geo.position, "the bar is sticky, not merely at the end of the page").toBe("sticky");
  expect(geo.barTop, "…and it is inside the viewport").toBeLessThan(geo.vh);
  expect(geo.barBottom, "…pinned at its bottom").toBeLessThanOrEqual(geo.vh + 1);
  await expect(page.locator(SAVE_BAR)).toBeInViewport();
});

test("discarding puts the text back and the bar stands down", async ({ page }) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  await openEventsAdmin(page, writes);

  const title = page.locator('[data-qa="event-title"]').first();
  const original = await title.inputValue();
  await title.fill("Texto que se va a descartar");
  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "true");

  await page.locator('[data-qa="events-discard"]').click();
  await expect(title, "the typed text is gone").toHaveValue(original);
  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "false");
  expect(boardWrites(writes), "discarding writes nothing either").toHaveLength(0);
});

/* ═════════════ law 3 — leaving asks first ═════════════ */

test("an in-app link with unsaved text is stopped, and the prompt decides", async ({ page }) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  await openEventsAdmin(page, writes);

  await page.locator('[data-qa="event-title"]').first().fill("Texto sin guardar");
  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "true");

  // Any same-origin link out of here will do; the admin shell has its own.
  const away = page.locator('a[href="/"]').first();
  await away.click();

  await expect(page.locator('[data-qa="events-leave-prompt"]'), "it asks first").toBeVisible();
  expect(page.url(), "…and the navigation really was stopped").toContain("/admin");

  // Keep editing → still here, still dirty, text intact.
  await page.locator('[data-qa="events-leave-stay"]').click();
  await expect(page.locator('[data-qa="events-leave-prompt"]')).toHaveCount(0);
  expect(page.url()).toContain("/admin");
  await expect(page.locator('[data-qa="event-title"]').first()).toHaveValue("Texto sin guardar");

  // Leave anyway → the navigation that was interrupted is the one that happens.
  await away.click();
  await expect(page.locator('[data-qa="events-leave-prompt"]')).toBeVisible();
  await page.locator('[data-qa="events-leave-discard"]').click();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 10_000 })
    .toBe("/");
  expect(boardWrites(writes), "leaving discards, it does not save").toHaveLength(0);
});

test("with no unsaved text, leaving is not interrupted", async ({ page }) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  await openEventsAdmin(page, writes);

  // A toggle is already committed, so it must NOT arm the prompt.
  await sizeButton(page, "Half").click();
  await expect(page.locator('[data-qa^="flash-size-"]')).toHaveAttribute("data-state", "saved");

  await page.locator('a[href="/"]').first().click();
  await expect(page.locator('[data-qa="events-leave-prompt"]')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/");
});

/* ═════════ ADMIN.SAVEBAR.1b — an instant switch never flashes the bar ═════════
 *
 * Joey, verbatim: "when you click the toggle that little save bar thing pops up
 * for just a split second and then next to the text by the toggle it shows a
 * check mark and saved". A switch is committed the moment it moves, so the bar
 * has nothing to say about it — not for the length of the round trip either.
 * The write is held open 400ms so that window is wide enough to see.
 */

const HOME_SWITCH = '[data-qa="home-visible"]';
const HOME_FLASH = '[data-qa="flash-homeVisible"]';

/**
 * In-page witness, armed before the click: a MutationObserver catches a dirty
 * render that lives for a single frame, which no outside poll can promise to.
 */
async function armBarWitness(page: Page) {
  await page.evaluate(
    ({ bar, unsaved }) => {
      const w = window as unknown as { __barSeen: { unsaved: number; dirty: number } };
      w.__barSeen = { unsaved: 0, dirty: 0 };
      const look = () => {
        if (document.querySelector(unsaved)) w.__barSeen.unsaved++;
        if (document.querySelector(bar)?.getAttribute("data-dirty") === "true") w.__barSeen.dirty++;
      };
      new MutationObserver(look).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-dirty"],
      });
    },
    { bar: SAVE_BAR, unsaved: UNSAVED },
  );
}

const barWitness = (page: Page) =>
  page.evaluate(() => (window as unknown as { __barSeen: unknown }).__barSeen);

/**
 * The brief's poll: every 25ms, from the click until the flash lands, is the
 * unsaved marker attached? Read in one evaluate so no locator auto-waits.
 */
async function pollUntilFlash(page: Page, clickedAt: number) {
  const sightings: number[] = [];
  for (;;) {
    const tick = await page.evaluate(
      ({ unsaved, flash }) => ({
        unsaved: !!document.querySelector(unsaved),
        state: document.querySelector(flash)?.getAttribute("data-state") ?? null,
      }),
      { unsaved: UNSAVED, flash: HOME_FLASH },
    );
    const at = Date.now() - clickedAt;
    if (tick.unsaved) sightings.push(at);
    if (tick.state) return { sightings, elapsed: at, state: tick.state };
    if (at > 10_000) throw new Error("the flash never landed");
    await page.waitForTimeout(25);
  }
}

test("F1: a clean board's switch writes without the bar ever going dirty", async ({ page }) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  const state = await openEventsAdmin(page, writes, { delayMs: 400 });
  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "false");
  await expect(page.locator(HOME_SWITCH)).toHaveAttribute("aria-checked", "false");

  await armBarWitness(page);
  const clickedAt = Date.now();
  await page.locator(HOME_SWITCH).click();
  const { sightings, elapsed, state: flashState } = await pollUntilFlash(page, clickedAt);

  expect(elapsed, "the write really was held open").toBeGreaterThanOrEqual(350);
  expect(sightings, "events-unsaved was never attached during the write").toEqual([]);
  expect(await barWitness(page), "not even for one frame").toEqual({ unsaved: 0, dirty: 0 });
  expect(flashState).toBe("saved");
  await expect(page.locator(HOME_FLASH)).toHaveAttribute("data-state", "saved");
  await expect(page.locator(HOME_SWITCH)).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => state.value.homeVisible, { timeout: 10_000 }).toBe(true);
  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "false");
});

test("F2: a failed switch write goes back, says so, and never dirties the bar", async ({ page }) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  const state = await openEventsAdmin(page, writes, { delayMs: 400, fail: true });
  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "false");
  await expect(page.locator(HOME_SWITCH)).toHaveAttribute("aria-checked", "false");

  await armBarWitness(page);
  const clickedAt = Date.now();
  await page.locator(HOME_SWITCH).click();
  const { sightings, elapsed, state: flashState } = await pollUntilFlash(page, clickedAt);

  expect(elapsed, "the write really was held open").toBeGreaterThanOrEqual(350);
  expect(boardWrites(writes).length, "the write was attempted").toBe(1);
  expect(sightings, "events-unsaved was never attached during the write").toEqual([]);
  expect(await barWitness(page), "not even for one frame").toEqual({ unsaved: 0, dirty: 0 });
  expect(flashState).toBe("failed");
  await expect(page.locator(HOME_FLASH)).toHaveAttribute("data-state", "failed");
  // The switch is back where it was, and the database never moved.
  await expect(page.locator(HOME_SWITCH)).toHaveAttribute("aria-checked", "false");
  expect(state.value.homeVisible).toBe(false);
  await expect(page.locator(SAVE_BAR)).toHaveAttribute("data-dirty", "false");
});

/* ═════════ ADMIN.SAVEBAR.1c — Save is greyed out until text changes ═════════
 *
 * Joey, verbatim: "if its an action or item that dosen't autosave like a toggle,
 * then it should remain greyed out until something is entered and then be
 * bright showing that it still needs to be saved if its not greyed out".
 *
 *  G1  Clean → Save disabled. A switch writes through the (held-open) mocked
 *      write and Save never lights, not on any 25ms sample. Text lights it;
 *      Discard greys it again.
 *  G3  At 390×844: no back-to-top button on /admin (it covered Save), and the
 *      dirty bar's warning sits wholly on screen — the bar wraps instead of
 *      pushing it off its left edge.
 *
 * G2 — the same law on the hero copy editor — lives in hero-copy.spec.ts.
 */

const EVENTS_SAVE = '[data-qa="events-save"]';

test("G1: Save is greyed while clean, through a switch's write, lit by text, greyed by Discard", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  const state = await openEventsAdmin(page, writes, { delayMs: 400 });
  await expect(page.locator(EVENTS_SAVE), "a clean board has nothing to save").toBeDisabled();

  // Every 25ms from the click until the flash lands, read in one evaluate so no
  // locator auto-waits: is Save lit?
  const clickedAt = Date.now();
  await page.locator(HOME_SWITCH).click();
  const litAt: number[] = [];
  for (;;) {
    const tick = await page.evaluate(
      ({ save, flash }) => ({
        lit: !(document.querySelector(save) as HTMLButtonElement | null)?.disabled,
        flash: document.querySelector(flash)?.getAttribute("data-state") ?? null,
      }),
      { save: EVENTS_SAVE, flash: HOME_FLASH },
    );
    const at = Date.now() - clickedAt;
    if (tick.lit) litAt.push(at);
    if (tick.flash) {
      expect(at, "the write really was held open").toBeGreaterThanOrEqual(350);
      break;
    }
    if (at > 10_000) throw new Error("the flash never landed");
    await page.waitForTimeout(25);
  }
  expect(litAt, "Save never lit while the switch was writing").toEqual([]);
  await expect.poll(() => state.value.homeVisible, { timeout: 10_000 }).toBe(true);
  await expect(page.locator(EVENTS_SAVE), "a committed switch leaves nothing to save").toBeDisabled();

  await page.locator('[data-qa="banner-text"]').first().fill("Texto nuevo para el banner");
  await expect(page.locator(EVENTS_SAVE), "typed text lights Save").toBeEnabled();

  await page.locator('[data-qa="events-discard"]').click();
  await expect(page.locator(EVENTS_SAVE), "Discard greys it again").toBeDisabled();
  expect(boardWrites(writes).length, "only the switch wrote").toBe(1);
});

test("G3: at 390×844 the admin has no back-to-top button, and the Events warning is on screen", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const writes: Write[] = [];
  // In SPANISH, Titi's admin language: its longer bar strings ("Cambios de texto
  // sin guardar", "Guardar cambios") are what overflowed a 390px row. English
  // fits on one line, so an EN-only check passes with or without the wrap.
  await injectAdminSession(page);
  await forceLanguage(page, "es");
  await routeLiveBoard(page, writes);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.locator('[data-qa="admin-nav-events"]').click();
  await expect(page.locator(SAVE_BAR)).toBeVisible();
  await page.waitForTimeout(400);

  // Deep in the editor — far past the 80px the button waits for on a phone.
  const text = page.locator('[data-qa="banner-text"]').first();
  await text.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY), "past the button's threshold").toBeGreaterThan(80);
  await expect(page.getByRole("button", { name: "Scroll to top" })).toHaveCount(0);

  await text.fill("Texto sin guardar");
  await expect(page.locator(UNSAVED)).toBeVisible();
  const geo = await page.evaluate(
    ({ unsaved, bar }) => {
      const u = document.querySelector(unsaved)!.getBoundingClientRect();
      const b = document.querySelector(bar)!.getBoundingClientRect();
      return {
        left: u.left,
        right: u.right,
        top: u.top,
        bottom: u.bottom,
        barLeft: b.left,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    },
    { unsaved: UNSAVED, bar: SAVE_BAR },
  );
  expect(geo.left, "the warning starts inside its own bar").toBeGreaterThanOrEqual(geo.barLeft);
  expect(geo.left).toBeGreaterThanOrEqual(0);
  expect(geo.right).toBeLessThanOrEqual(geo.vw);
  expect(geo.top).toBeGreaterThanOrEqual(0);
  expect(geo.bottom).toBeLessThanOrEqual(geo.vh);

  // The control: off /admin the button is still there once you scroll, so its
  // absence above is the route rule, not a page too short to scroll.
  await page.locator('[data-qa="events-discard"]').click();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(page.getByRole("button", { name: "Scroll to top" })).toBeVisible({ timeout: 10_000 });
});
