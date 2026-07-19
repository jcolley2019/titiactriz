import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * TA.6f — browser-language auto-detection with a persistent manual override.
 *
 * Initial language (resolved synchronously in src/i18n before first paint):
 *   1. localStorage "ta_lang" — explicit manual choice, always wins.
 *   2. navigator.language starting with "es" → ES, anything else → EN.
 *   3. no navigator info → ES.
 *
 * Discriminators: the hero roles line is UPPERCASE in the dictionaries, so its
 * exact tokens tell the languages apart with a case-sensitive substring match:
 *   ES → "ACTRIZ · TIKTOKER · EMPRESARIA"
 *   EN → "ACTRESS · TIKTOKER · ENTREPRENEUR"
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

test.describe("TA.6f — es-* browser detection", () => {
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

test.describe("TA.6f — non-es browser detection", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("first visit on an en-US browser renders English", async ({ page }) => {
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page);

    await expect(page.locator("body"), "en-US → English hero line").toContainText(EN_TOKEN);
    await expect(page.locator("body"), "no Spanish tokens leak through").not.toContainText(
      ES_TOKEN,
    );
    await expect(page.locator("html"), "html lang reflects English").toHaveAttribute("lang", "en");
  });

  test("stored ta_lang=es overrides en-US detection", async ({ page }) => {
    await seedStoredLang(page, "es");
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page);

    // Explicit stored choice beats the English browser locale.
    await expect(page.locator("body"), "stored ES wins over en-US").toContainText(ES_TOKEN);
    await expect(page.locator("body")).not.toContainText(EN_TOKEN);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("toggle flips the language and the choice persists across reload", async ({ page }) => {
    // NOTE: no clearStoredLang here on purpose — a fresh context already starts
    // with empty storage, and an addInitScript clear would re-run on reload and
    // wipe the very choice this test is proving persists.
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page);

    // Detection starts English (en-US, no stored choice).
    await expect(page.locator("body")).toContainText(EN_TOKEN);
    expect(await readStoredLang(page), "no stored choice before toggling").toBeNull();

    // Manually switch to Spanish via the header language control.
    await page.locator('[data-qa="lang-menu-trigger"]').click();
    await page.locator('[data-qa="lang-es"]').click();

    await expect(page.locator("body"), "toggle switches to Spanish").toContainText(ES_TOKEN);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    expect(await readStoredLang(page), "choice persisted to ta_lang").toBe("es");

    // Reload: the persisted choice must survive despite the en-US browser locale.
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page);
    await expect(page.locator("body"), "Spanish persists across reload").toContainText(ES_TOKEN);
    await expect(page.locator("body")).not.toContainText(EN_TOKEN);
    expect(await readStoredLang(page), "ta_lang still es after reload").toBe("es");
  });
});
