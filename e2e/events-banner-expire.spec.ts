import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";

/**
 * BANNER.EXPIRE.1 — a banner can carry a "show until" date and takes itself
 * down after it. Why: the birthday banner ("Este Sábado 8 de Agosto") stayed on
 * the live site until Sept 24 because nobody switched it off.
 *
 * The rule: a banner is off once the END of its show-until day (the viewer's
 * own midnight) is behind now. `enabled` and `enabledAt` are never touched —
 * expiry is a separate condition — and a banner without the date never expires.
 *
 *  E1  showUntil = tomorrow → the banner renders (and = today: the day is not
 *      over yet)
 *  E2  showUntil = yesterday → no banner region, even with enabled = true
 *  E3  showUntil absent → unchanged: the banner renders exactly as before
 *  E4  admin: the date writes on the spot (no Save), flashes "saved", and the
 *      note under it flips between "Shows until" and "Expired"; blank clears it
 *
 * Dates are LOCAL calendar days, computed on this machine's clock — the browser
 * runs on the same one, which is the clock the rule reads.
 */

const BAR = '[data-qa="events-banner"]';
const BOARD_KEY = "events_board";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
};
const TODAY = dayOffset(0);
const TOMORROW = dayOffset(1);
const YESTERDAY = dayOffset(-1);

const siteBanner = (showUntil?: string) => ({
  enabled: true,
  label: { es: "EVENTOS", en: "EVENTS" },
  text: { es: "Este Sábado 8 de Agosto", en: "This Saturday, August 8" },
  link: "",
  pages: { home: true, greenWorld: false, titans: false },
  bold: false,
  textColor: "#C9A55C",
  enabledAt: "2026-08-01T00:00:00.000Z",
  ...(showUntil ? { showUntil } : {}),
});

const boardWith = (showUntil?: string) => ({
  pageVisible: true,
  homeVisible: false,
  mainBanner: siteBanner(showUntil),
  greenWorldBanner: {
    ...siteBanner(),
    enabled: false,
    pages: { home: false, greenWorld: true, titans: false },
  },
  items: [],
});

async function openHome(page: Page, board: unknown) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await forceLanguage(page, "es");
  await routeSupabase(page, { eventsBoard: board });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

test.describe("BANNER.EXPIRE.1 — the public bar obeys the show-until date", () => {
  test("E1: showUntil = tomorrow → the banner renders", async ({ page }) => {
    await openHome(page, boardWith(TOMORROW));
    await expect(page.locator(BAR)).toBeVisible();
    await expect(page.getByRole("region", { name: "EVENTOS" })).toBeVisible();
  });

  test("E1b: showUntil = today → still renders; the day is not over", async ({ page }) => {
    await openHome(page, boardWith(TODAY));
    await expect(page.locator(BAR)).toBeVisible();
  });

  test("E2: showUntil = yesterday → no banner region, even with enabled = true", async ({
    page,
  }) => {
    await openHome(page, boardWith(YESTERDAY));
    // The page itself came up — this is an absent bar, not an absent page.
    await expect(page.locator("h1").first()).toBeAttached();
    await expect(page.locator(BAR)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "EVENTOS" })).toHaveCount(0);
  });

  test("E3: showUntil absent → unchanged, the banner renders", async ({ page }) => {
    await openHome(page, boardWith());
    await expect(page.locator(BAR)).toBeVisible();
    await expect(page.getByRole("region", { name: "EVENTOS" })).toBeVisible();
  });
});

/* ═══════════════════════════ E4 — the admin field ═══════════════════════════ */

/**
 * The board, served and RE-served (admin-qol.spec.ts's live mock): a write
 * replaces the served value, so the persisted row is what the test reads.
 */
async function routeLiveBoard(page: Page, writes: Write[]) {
  const state = { value: JSON.parse(JSON.stringify(boardWith())) as Record<string, unknown> };
  await routeSupabase(page, { writes, eventsBoard: state.value });
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

const boardWrites = (writes: Write[]) =>
  writes.filter((w) => w.method !== "GET" && (w.body ?? "").includes(BOARD_KEY));

const COPY = {
  en: {
    label: "Show until (optional)",
    shows: (d: string) => `Shows until ${d}`,
    expired: (d: string) => `Expired ${d} — the banner is hidden; pick a new date or clear it`,
  },
  es: {
    label: "Mostrar hasta (opcional)",
    shows: (d: string) => `Se muestra hasta el ${d}`,
    expired: (d: string) =>
      `Venció el ${d} — el banner está oculto; elige una fecha nueva o bórrala`,
  },
} as const;

const SHOTS = "_qa/banner-expire-1";

async function runE4(
  page: Page,
  lang: "en" | "es",
  viewport: { width: number; height: number },
) {
  const writes: Write[] = [];
  await injectAdminSession(page);
  await forceLanguage(page, lang);
  const state = await routeLiveBoard(page, writes);
  await page.setViewportSize(viewport);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.locator('[data-qa="admin-nav-events"]').click();
  await expect(page.locator('[data-qa="events-save-bar"]')).toBeVisible();
  await page.waitForTimeout(400);

  const copy = COPY[lang];
  const editor = page.locator('[data-qa="banner-editor"][data-banner="main"]');
  const input = editor.locator('[data-qa="banner-show-until"]');
  const flash = editor.locator('[data-qa="flash-banner-main-until"]');
  const note = editor.locator('[data-qa="banner-until-note"]');
  const mainBanner = () => state.value.mainBanner as Record<string, unknown>;
  // The note's date, formatted in the page exactly as the admin formats it.
  const shown = (d: string) =>
    page.evaluate(
      ({ d, lang }) =>
        new Date(`${d}T12:00:00`).toLocaleDateString(lang, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      { d, lang },
    );

  await expect(editor.getByText(copy.label)).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(note, "no date, no note").toHaveCount(0);
  expect(boardWrites(writes), "opening the editor writes nothing").toHaveLength(0);

  // ── a future date: written at once, flashed, "Shows until" ──
  await input.fill(TOMORROW);
  await expect(flash).toHaveAttribute("data-state", "saved");
  await expect
    .poll(() => mainBanner().showUntil, { message: "the row carries the date", timeout: 10_000 })
    .toBe(TOMORROW);
  expect(boardWrites(writes).length, "one write, no Save clicked").toBe(1);
  await expect(note).toHaveAttribute("data-expired", "false");
  await expect(note).toHaveText(copy.shows(await shown(TOMORROW)));
  // Expiry is a separate condition: the switch and its stamp never move.
  expect(mainBanner().enabled).toBe(true);
  expect(mainBanner().enabledAt).toBe("2026-08-01T00:00:00.000Z");
  await expect(page.locator('[data-qa="events-save-bar"]')).toHaveAttribute("data-dirty", "false");
  await editor.scrollIntoViewIfNeeded();
  await editor.screenshot({ path: `${SHOTS}/${lang}-${viewport.width}-shows-until.png` });

  // ── a past date: written at once, and the note flips to "Expired" ──
  await expect(flash).toHaveCount(0, { timeout: 5_000 });
  await input.fill(YESTERDAY);
  await expect(flash).toHaveAttribute("data-state", "saved");
  await expect.poll(() => mainBanner().showUntil, { timeout: 10_000 }).toBe(YESTERDAY);
  expect(boardWrites(writes).length).toBe(2);
  await expect(note).toHaveAttribute("data-expired", "true");
  await expect(note).toHaveText(copy.expired(await shown(YESTERDAY)));
  expect(mainBanner().enabled, "an expired banner's switch is still on").toBe(true);
  await editor.screenshot({ path: `${SHOTS}/${lang}-${viewport.width}-expired.png` });

  // ── blank clears it: the row loses the field, the note goes ──
  await expect(flash).toHaveCount(0, { timeout: 5_000 });
  await input.fill("");
  await expect(flash).toHaveAttribute("data-state", "saved");
  await expect
    .poll(() => "showUntil" in mainBanner(), { message: "the date is gone", timeout: 10_000 })
    .toBe(false);
  expect(boardWrites(writes).length).toBe(3);
  await expect(note).toHaveCount(0);
  await expect(page.locator('[data-qa="events-save-bar"]')).toHaveAttribute("data-dirty", "false");
}

test("E4: the admin date writes instantly, flashes saved, and its note flips (EN, desktop)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await runE4(page, "en", { width: 1280, height: 720 });
});

test("E4-es: the same in Spanish at phone width", async ({ page }) => {
  test.setTimeout(120_000);
  await runE4(page, "es", { width: 390, height: 844 });
});
