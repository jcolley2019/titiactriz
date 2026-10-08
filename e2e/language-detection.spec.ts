import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * BLOG.FIXES.1 — Spanish is the default; English only by choice.
 * (Was TA.6f's browser-language detection, retired: Googlebot renders with an
 * English browser and indexed the Spanish-primary post in English.)
 *
 * Initial language (resolved synchronously in src/i18n before first paint):
 *   1. localStorage "ta_lang" — explicit manual choice, the only way to EN.
 *   2. else ES — navigator.language is never read.
 *
 * Discriminators: the hero roles line is UPPERCASE in the dictionaries, so its
 * exact tokens tell the languages apart with a case-sensitive substring match:
 *   ES → "ACTRIZ · STREAMER · EMPRESARIA"
 *   EN → "ACTRESS · STREAMER · ENTREPRENEUR"
 */

const PATH = "/cinematic";
const ES_TOKEN = "ACTRIZ";
const EN_TOKEN = "ACTRESS";
const LANG_KEY = "ta_lang";

async function settle(page: Page, ms = 500) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wipe any stored choice before the page's own scripts run (true first visit). */
function clearStoredLang(page: Page) {
  return page.addInitScript((key) => {
    try {
      localStorage.removeItem(key as string);
    } catch {
      /* storage may be unavailable */
    }
  }, LANG_KEY);
}

/** Pre-seed an explicit manual choice before the page loads. */
function seedStoredLang(page: Page, value: string) {
  return page.addInitScript(
    ([key, v]) => {
      try {
        localStorage.setItem(key as string, v as string);
      } catch {
        /* storage may be unavailable */
      }
    },
    [LANG_KEY, value],
  );
}

const readStoredLang = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), LANG_KEY);

test.describe("BLOG.FIXES.1 — an es-CO browser", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

  test("first visit on an es-CO browser renders Spanish", async ({ page }) => {
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page);

    await expect(page.locator("body"), "es-CO → Spanish hero line").toContainText(ES_TOKEN);
    await expect(page.locator("body"), "no English tokens leak through").not.toContainText(
      EN_TOKEN,
    );
    await expect(page.locator("html"), "html lang reflects Spanish").toHaveAttribute("lang", "es");
  });
});

test.describe("BLOG.FIXES.1 — an en-US browser (Googlebot's case)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("first visit on an en-US browser with no ta_lang renders Spanish", async ({ page }) => {
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page);

    expect(await page.evaluate(() => navigator.language), "the browser really is English").toBe(
      "en-US",
    );
    await expect(page.locator("body"), "en-US → still the Spanish hero line").toContainText(
      ES_TOKEN,
    );
    await expect(page.locator("body"), "no English tokens leak through").not.toContainText(
      EN_TOKEN,
    );
    await expect(page.locator("html"), "html lang stays Spanish").toHaveAttribute("lang", "es");
    expect(await readStoredLang(page), "the default writes no choice").toBeNull();
  });

  test("stored ta_lang=en renders English", async ({ page }) => {
    await seedStoredLang(page, "en");
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page);

    await expect(page.locator("body"), "stored EN → English hero line").toContainText(EN_TOKEN);
    await expect(page.locator("body")).not.toContainText(ES_TOKEN);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("stored ta_lang=es renders Spanish", async ({ page }) => {
    await seedStoredLang(page, "es");
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page);

    await expect(page.locator("body"), "stored ES → Spanish hero line").toContainText(ES_TOKEN);
    await expect(page.locator("body")).not.toContainText(EN_TOKEN);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("toggle flips to English and the choice persists across reload", async ({ page }) => {
    // NOTE: no clearStoredLang here on purpose — a fresh context already starts
    // with empty storage, and an addInitScript clear would re-run on reload and
    // wipe the very choice this test is proving persists.
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page);

    // The default is Spanish (en-US browser, no stored choice).
    await expect(page.locator("body")).toContainText(ES_TOKEN);
    expect(await readStoredLang(page), "no stored choice before toggling").toBeNull();

    // Manually switch to English via the header language control.
    await page.locator('[data-qa="lang-menu-trigger"]').click();
    await page.locator('[data-qa="lang-en"]').click();

    await expect(page.locator("body"), "toggle switches to English").toContainText(EN_TOKEN);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(await readStoredLang(page), "choice persisted to ta_lang").toBe("en");

    // Reload: the persisted choice must survive the Spanish default.
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page);
    await expect(page.locator("body"), "English persists across reload").toContainText(EN_TOKEN);
    await expect(page.locator("body")).not.toContainText(ES_TOKEN);
    expect(await readStoredLang(page), "ta_lang still en after reload").toBe("en");

    // And back: the toggle returns to Spanish and stores that too.
    await page.locator('[data-qa="lang-menu-trigger"]').click();
    await page.locator('[data-qa="lang-es"]').click();
    await expect(page.locator("body"), "toggle switches back to Spanish").toContainText(ES_TOKEN);
    expect(await readStoredLang(page), "choice persisted to ta_lang").toBe("es");
  });
});
