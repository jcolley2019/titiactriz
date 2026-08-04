import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { injectAdminSession, forceLanguage, routeSupabase, type Write } from "./_admin";

/**
 * EVENTS.1 — the ES banner trap, in the admin.
 *
 * Spanish is the site's primary language, so a banner enabled with empty ES text
 * scrolls a BLANK marquee at most of the audience while looking perfectly correct
 * to whoever filled in the English field. EN stays optional and still falls back
 * per the existing behaviour — this guard is about ES and only ES.
 *
 * Laws, each falsifiable by driving the real editor:
 *
 *  1. THE TOGGLE REFUSES — enabling a banner whose ES text is empty does not
 *     enable it, and says why, inline.
 *  2. ES CLEARS THE TRAP — with Spanish text present the same toggle succeeds,
 *     the message goes, and the write carries `enabled: true`.
 *  3. THE SAVE REFUSES TOO — and this door is not redundant: ES can be deleted
 *     AFTER a banner was legitimately enabled, and only the save is standing
 *     there when it happens. A refused save sends NO write at all.
 *  4. THE MESSAGE IS BILINGUAL — it is a real locale string in both locales, not
 *     an English sentence hard-coded into the admin.
 *
 * Every assertion is about the WRITE the editor sends or the state it refuses to
 * enter — never about a hopeful repaint.
 */

const NAV = '[data-qa="admin-nav-events"]';
const TOGGLE = '[data-qa="events-board-toggle"]';
const MAIN = '[data-qa="banner-editor"][data-banner="main"]';
const ERROR = '[data-qa="banner-es-required"]';

/**
 * The message is read from the locale FILES, not restated here — so the gate
 * fails if the string is renamed or dropped from either locale, and cannot pass
 * against a copy of itself. (Read via fs rather than imported: Playwright's ESM
 * loader requires an import attribute for JSON, and a census like this has no
 * business depending on that.)
 */
const localeMessage = (lng: "es" | "en"): string => {
  const file = path.join(process.cwd(), "src", "i18n", "locales", `${lng}.json`);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  return json.admin.eventsBoard.bannerEsRequired;
};

const ES_MSG = localeMessage("es");
const EN_MSG = localeMessage("en");

/**
 * A board whose main banner is OFF and carries no Spanish text — the exact state
 * the trap exists for. EN is deliberately filled in: the banner looks complete to
 * an English-speaking editor, which is how the defect happens in the first place.
 */
const BOARD_NO_ES = {
  pageVisible: true,
  mainBanner: {
    enabled: false,
    label: { es: "EVENTOS", en: "EVENTS" },
    text: { es: "", en: "Now competing at SmartFilms" },
    link: "",
    pages: { home: true, greenWorld: false, titans: false },
    bold: false,
    textColor: "#C9A55C",
  },
  items: [],
};

const bannerSwitch = (page: Page) => page.locator(MAIN).locator('[data-qa="banner-enabled"]');
const bannerText = (page: Page) => page.locator(MAIN).locator('[data-qa="banner-text"]');

async function openBoard(page: Page, opts: { lang?: "es" | "en"; board?: unknown } = {}) {
  const writes: Write[] = [];
  await injectAdminSession(page);
  await forceLanguage(page, opts.lang ?? "en");
  await routeSupabase(page, { eventsBoard: opts.board ?? BOARD_NO_ES, writes });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await page.locator(NAV).click();
  await page.locator(TOGGLE).click(); // the board ships collapsed
  await expect(page.locator(MAIN)).toBeVisible();
  return { writes };
}

/** The upserts the editor actually sent, parsed. */
const boardWrites = (writes: Write[]) =>
  writes
    .filter((w) => w.method !== "GET" && w.url.includes("site_settings") && w.body)
    .map((w) => JSON.parse(w.body as string));

/* ───────────────────── law 1 — the toggle refuses ───────────────────── */

test.describe("EVENTS.1 — a banner cannot be enabled without ES", () => {
  test("the toggle refuses, and says why", async ({ page }) => {
    test.setTimeout(60_000);
    const { writes } = await openBoard(page);

    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(page.locator(ERROR)).toHaveCount(0);

    await bannerSwitch(page).click();

    // Refused: the banner is STILL off, and the reason is on screen.
    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(page.locator(MAIN).locator(ERROR)).toHaveText(EN_MSG);

    // Nothing was sent — a refused toggle is not a silent save.
    expect(boardWrites(writes)).toHaveLength(0);
  });

  test("the message renders in Spanish under the ES locale", async ({ page }) => {
    test.setTimeout(60_000);
    await openBoard(page, { lang: "es" });

    await bannerSwitch(page).click();
    await expect(page.locator(MAIN).locator(ERROR)).toHaveText(ES_MSG);
    // Parity, asserted rather than assumed: two locales, two distinct strings.
    expect(ES_MSG).not.toEqual(EN_MSG);
    expect(ES_MSG.length).toBeGreaterThan(0);
  });
});

/* ─────────────────── law 2 — ES present, the trap opens ─────────────────── */

test.describe("EVENTS.1 — with ES text it succeeds", () => {
  test("the toggle takes, the message clears, and the write carries it", async ({ page }) => {
    test.setTimeout(60_000);
    const { writes } = await openBoard(page);

    // The editor opens on ES, so this field IS the Spanish one.
    await bannerText(page).fill("EN COMPETENCIA — SmartFilms 2026");
    await bannerSwitch(page).click();

    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(ERROR)).toHaveCount(0);

    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForTimeout(600);

    const sent = boardWrites(writes);
    expect(sent, "the save went through").toHaveLength(1);
    const rows = Array.isArray(sent[0]) ? sent[0] : [sent[0]];
    const board = rows[0].value;
    expect(board.mainBanner.enabled).toBe(true);
    expect(board.mainBanner.text.es).toBe("EN COMPETENCIA — SmartFilms 2026");
    // EN is optional and untouched by the guard.
    expect(board.mainBanner.text.en).toBe("Now competing at SmartFilms");
  });
});

/* ─────────────────── law 3 — the save-side door ─────────────────── */

test.describe("EVENTS.1 — ES emptied after the fact", () => {
  test("the save refuses, and sends nothing", async ({ page }) => {
    test.setTimeout(60_000);
    const { writes } = await openBoard(page, {
      board: {
        ...BOARD_NO_ES,
        mainBanner: {
          ...BOARD_NO_ES.mainBanner,
          enabled: true,
          text: { es: "EN COMPETENCIA", en: "Now competing at SmartFilms" },
        },
      },
    });

    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "true");

    // The banner was legitimately enabled; now the Spanish is deleted out from
    // under it. The toggle never runs — only the save can catch this.
    await bannerText(page).fill("");
    await expect(page.locator(MAIN).locator(ERROR)).toHaveText(EN_MSG);

    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForTimeout(600);

    expect(boardWrites(writes), "a refused save writes nothing").toHaveLength(0);
    await expect(page.locator(MAIN).locator(ERROR)).toHaveText(EN_MSG);
  });
});
