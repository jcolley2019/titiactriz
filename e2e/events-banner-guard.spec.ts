import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { injectAdminSession, forceLanguage, routeSupabase, type Write } from "./_admin";

/**
 * EVENTS.I18N.1 — one field in, two locales out.
 *
 * The admin has ONE text field per thing. The owner types in whichever language
 * they think in; the system detects it and writes the other side. The public site
 * is unchanged: browser language and the site toggle still decide what a visitor
 * reads, and every string is still translated, always.
 *
 * EVENTS.1's guard asked "is the Spanish slot filled?" because ES and EN were two
 * fields and either could be left empty. There is one field now and saving fills
 * both slots, so the guard asks the same question of the one field. Its purpose —
 * never serve an English-only banner to an ES-primary audience — is unchanged.
 *
 * Laws, each falsifiable by driving the real editor:
 *
 *  1. THE TOGGLE REFUSES — enabling a banner with no text does not enable it, and
 *     says why, inline.
 *  2. TEXT CLEARS THE TRAP — with text present the same toggle succeeds, the
 *     message goes, and the write carries `enabled: true`.
 *  3. THE SAVE REFUSES TOO — and this door is not redundant: the text can be
 *     deleted AFTER a banner was legitimately enabled, and only the save is
 *     standing there when it happens. A refused save sends NO write at all.
 *  4. THE MESSAGE IS BILINGUAL — it is a real locale string in both locales, not
 *     an English sentence hard-coded into the admin.
 *  5. SPANISH IN, ENGLISH OUT — and the reverse. Whichever slot the owner typed
 *     is the source; the other is written from it.
 *  6. FAILURE IS HONEST — a translation that does not run saves the typed text
 *     into BOTH slots (never a stale mismatch, never a blocked save) and says so
 *     on screen.
 *  7. THERE IS NO EDITING-LANGUAGE TOGGLE — the ES/EN switch is gone, and nothing
 *     is entered twice.
 *
 * Every assertion is about the WRITE the editor sends or the state it refuses to
 * enter — never about a hopeful repaint.
 */

const NAV = '[data-qa="admin-nav-events"]';
const TOGGLE = '[data-qa="events-board-toggle"]';
const MAIN = '[data-qa="banner-editor"][data-banner="main"]';
const ERROR = '[data-qa="banner-text-required"]';
const WARNING = '[data-qa="translation-failed"]';

/**
 * The message is read from the locale FILES, not restated here — so the gate
 * fails if the string is renamed or dropped from either locale, and cannot pass
 * against a copy of itself. (Read via fs rather than imported: Playwright's ESM
 * loader requires an import attribute for JSON, and a census like this has no
 * business depending on that.)
 */
const localeMessage = (lng: "es" | "en", key: string): string => {
  const file = path.join(process.cwd(), "src", "i18n", "locales", `${lng}.json`);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  return json.admin.eventsBoard[key];
};

const ES_MSG = localeMessage("es", "bannerTextRequired");
const EN_MSG = localeMessage("en", "bannerTextRequired");
const EN_WARN = localeMessage("en", "translationFailedHelp");

/**
 * A board whose main banner is OFF and carries no text at all — the exact state
 * the trap exists for.
 */
const BOARD_EMPTY = {
  pageVisible: true,
  mainBanner: {
    enabled: false,
    label: { es: "EVENTOS", en: "EVENTS" },
    text: { es: "", en: "" },
    link: "",
    pages: { home: true, greenWorld: false, titans: false },
    bold: false,
    textColor: "#C9A55C",
  },
  items: [],
};

const bannerSwitch = (page: Page) => page.locator(MAIN).locator('[data-qa="banner-enabled"]');
const bannerText = (page: Page) => page.locator(MAIN).locator('[data-qa="banner-text"]');

type OpenOpts = {
  lang?: "es" | "en";
  board?: unknown;
  translate?: NonNullable<Parameters<typeof routeSupabase>[1]>["translate"];
};

async function openBoard(page: Page, opts: OpenOpts = {}) {
  const writes: Write[] = [];
  await injectAdminSession(page);
  await forceLanguage(page, opts.lang ?? "en");
  await routeSupabase(page, {
    eventsBoard: opts.board ?? BOARD_EMPTY,
    translate: opts.translate,
    writes,
  });
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

/** The single saved board, unwrapped from the upsert envelope. */
const savedBoard = (writes: Write[]) => {
  const sent = boardWrites(writes);
  expect(sent, "the save went through").toHaveLength(1);
  const rows = Array.isArray(sent[0]) ? sent[0] : [sent[0]];
  return rows[0].value;
};

/** The texts the admin actually asked the translate function about. */
const translateCalls = (writes: Write[]) =>
  writes
    .filter((w) => w.url.includes("/functions/v1/translate-text") && w.body)
    .map((w) => JSON.parse(w.body as string).text as string);

const save = async (page: Page) => {
  await page.getByRole("button", { name: /save changes/i }).click();
  await page.waitForTimeout(900);
};

/* ───────────────────── law 1 — the toggle refuses ───────────────────── */

test.describe("EVENTS.I18N.1 — a banner cannot be enabled with no text", () => {
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

/* ───── law 2 + law 5 — text present, and it fills the other locale ───── */

test.describe("EVENTS.I18N.1 — one field, both slots", () => {
  test("Spanish in: the EN slot is auto-filled with English", async ({ page }) => {
    test.setTimeout(60_000);
    const { writes } = await openBoard(page, {
      translate: () => ({ source: "es", translation: "This Saturday at 8:00pm" }),
    });

    await bannerText(page).fill("Este Sábado a las 8:00pm");
    await bannerSwitch(page).click();

    // Law 2: the guard is satisfied by the one field having text.
    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(ERROR)).toHaveCount(0);

    await save(page);

    expect(translateCalls(writes), "the typed text was sent once").toEqual([
      "Este Sábado a las 8:00pm",
    ]);

    const board = savedBoard(writes);
    expect(board.mainBanner.enabled).toBe(true);
    expect(board.mainBanner.text.es).toBe("Este Sábado a las 8:00pm");
    expect(board.mainBanner.text.en).toBe("This Saturday at 8:00pm");
    // The source is recorded, so re-opening shows the owner's own words back.
    expect(board.mainBanner.text.src).toBe("es");
    expect(board.mainBanner.text.pending).toBeUndefined();
  });

  test("English in: the ES slot is auto-filled with Spanish", async ({ page }) => {
    test.setTimeout(60_000);
    const { writes } = await openBoard(page, {
      translate: () => ({ source: "en", translation: "Este Sábado a las 8:00pm" }),
    });

    await bannerText(page).fill("This Saturday at 8:00pm");
    await bannerSwitch(page).click();
    await save(page);

    const board = savedBoard(writes);
    expect(board.mainBanner.text.en).toBe("This Saturday at 8:00pm");
    expect(board.mainBanner.text.es).toBe("Este Sábado a las 8:00pm");
    expect(board.mainBanner.text.src).toBe("en");

    // And the field shows the ENGLISH back — the owner's own words, not the
    // translation of them.
    await expect(bannerText(page)).toHaveValue("This Saturday at 8:00pm");
  });

  test("an untouched field is not re-translated", async ({ page }) => {
    test.setTimeout(60_000);
    const { writes } = await openBoard(page, {
      board: {
        ...BOARD_EMPTY,
        mainBanner: {
          ...BOARD_EMPTY.mainBanner,
          enabled: true,
          text: { es: "EN COMPETENCIA", en: "Now competing", src: "es" },
        },
      },
      // Loud, wrong answer: if the admin asks at all, the write below shows it.
      translate: () => ({ source: "es", translation: "SHOULD-NOT-BE-ASKED" }),
    });

    await save(page);

    expect(translateCalls(writes), "nothing was edited, so nothing was asked").toEqual([]);
    const board = savedBoard(writes);
    expect(board.mainBanner.text.es).toBe("EN COMPETENCIA");
    expect(board.mainBanner.text.en).toBe("Now competing");
  });
});

/* ─────────────────── law 3 — the save-side door ─────────────────── */

test.describe("EVENTS.I18N.1 — text emptied after the fact", () => {
  test("the save refuses, and sends nothing", async ({ page }) => {
    test.setTimeout(60_000);
    const { writes } = await openBoard(page, {
      board: {
        ...BOARD_EMPTY,
        mainBanner: {
          ...BOARD_EMPTY.mainBanner,
          enabled: true,
          text: { es: "EN COMPETENCIA", en: "Now competing", src: "es" },
        },
      },
    });

    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "true");

    // The banner was legitimately enabled; now the text is deleted out from
    // under it. The toggle never runs — only the save can catch this.
    await bannerText(page).fill("");
    await expect(page.locator(MAIN).locator(ERROR)).toHaveText(EN_MSG);

    await save(page);

    expect(boardWrites(writes), "a refused save writes nothing").toHaveLength(0);
    await expect(page.locator(MAIN).locator(ERROR)).toHaveText(EN_MSG);
  });
});

/* ───────────────── law 6 — failure is honest, not blocking ───────────────── */

test.describe("EVENTS.I18N.1 — translation failure", () => {
  test("saves the typed text into BOTH slots and warns", async ({ page }) => {
    test.setTimeout(60_000);
    const { writes } = await openBoard(page, { translate: () => null });

    await bannerText(page).fill("Te Invito a Celebrar mi Cumpleaños");
    await bannerSwitch(page).click();
    await save(page);

    // The save is NOT blocked...
    const board = savedBoard(writes);
    // ...and neither slot is stale: both carry exactly what was typed.
    expect(board.mainBanner.text.es).toBe("Te Invito a Celebrar mi Cumpleaños");
    expect(board.mainBanner.text.en).toBe("Te Invito a Celebrar mi Cumpleaños");
    // Still owed a translation, so the next successful save heals it.
    expect(board.mainBanner.text.pending).toBe(true);

    // And the owner is told, on screen — not only in a toast that has faded.
    await expect(page.locator(WARNING)).toHaveText(EN_WARN);
  });

  test("the next successful save heals it", async ({ page }) => {
    test.setTimeout(60_000);
    const { writes } = await openBoard(page, {
      board: {
        ...BOARD_EMPTY,
        mainBanner: {
          ...BOARD_EMPTY.mainBanner,
          enabled: true,
          // The wreckage a failed save leaves behind: same text both sides.
          text: { es: "Feliz Cumpleaños", en: "Feliz Cumpleaños", src: "es", pending: true },
        },
      },
      translate: () => ({ source: "es", translation: "Happy Birthday" }),
    });

    // No edit at all — the save alone must finish the job it could not finish.
    await save(page);

    expect(translateCalls(writes)).toEqual(["Feliz Cumpleaños"]);
    const board = savedBoard(writes);
    expect(board.mainBanner.text.es).toBe("Feliz Cumpleaños");
    expect(board.mainBanner.text.en).toBe("Happy Birthday");
    expect(board.mainBanner.text.pending).toBeUndefined();
    await expect(page.locator(WARNING)).toHaveCount(0);
  });
});

/* ─────────────── law 7 — nothing is entered twice ─────────────── */

test.describe("EVENTS.I18N.1 — the editing-language toggle is gone", () => {
  test("no ES/EN switch, and one input per thing", async ({ page }) => {
    test.setTimeout(60_000);
    await openBoard(page, {
      board: {
        ...BOARD_EMPTY,
        items: [
          {
            id: "card-1",
            size: "full",
            title: { es: "Cumpleaños", en: "Birthday", src: "en" },
            badge: { es: "", en: "" },
            description: { es: "", en: "" },
            note: { es: "", en: "" },
            buttons: [],
          },
        ],
      },
    });

    // The old toggle was two bare "ES"/"EN" buttons. Neither may exist.
    await expect(page.getByRole("button", { name: /^ES$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^EN$/ })).toHaveCount(0);

    // One field per thing — not one per locale.
    await expect(bannerText(page)).toHaveCount(1);
    const title = page.locator('[data-qa="event-title"]');
    await expect(title).toHaveCount(1);
    // ...showing the slot the owner typed, not the site-primary one.
    await expect(title).toHaveValue("Birthday");
  });
});
