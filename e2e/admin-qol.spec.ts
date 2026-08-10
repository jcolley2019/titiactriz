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
async function routeLiveBoard(page: Page, writes: Write[]) {
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

async function openEventsAdmin(page: Page, writes: Write[]) {
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  const state = await routeLiveBoard(page, writes);
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
