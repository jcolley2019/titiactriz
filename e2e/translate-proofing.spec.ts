import { test, expect } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";

/**
 * TA.6e — translate-proofing.
 *
 * Chrome auto-translate (e.g. Spanish→English) used to mangle two things:
 *   1. the per-letter kinetic hero name (CRISTYNA POLENTINO), whose individual
 *      letters were re-flowed into garbage "words", and
 *   2. the ES / EN toggle labels, which got machine-translated.
 *
 * The fixes: mark proper nouns and the language control `translate="no"`, and
 * keep <html lang> in sync with the active site language so the browser stops
 * offering a wrong-direction translation once a visitor picks EN.
 *
 * These specs pin the gate:
 *   (a) the cinematic hero name container carries translate="no", and
 *   (b) <html lang> flips when the language toggle is clicked.
 */

const PATH = "/cinematic";

async function settle(page: import("@playwright/test").Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe("TA.6e — translate-proofing", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("cinematic hero name container is marked translate=no", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 700);

    // The hero name is the only <h1> on the cinematic page; its per-letter spans
    // live inside it, so translate="no" on the container protects them all.
    const heroName = page.locator('h1[data-qa="section-heading"]');
    await expect(heroName, "hero name heading present").toHaveCount(1);
    await expect(heroName, "hero name opts out of translation").toHaveAttribute("translate", "no");
    await expect(heroName, "hero name also carries the notranslate class").toHaveClass(
      /notranslate/,
    );

    // The language control opts out too (its ES/EN labels must not be translated).
    await page.locator('[data-qa="lang-menu-trigger"]').click();
    const langGroup = page.locator('[data-qa="lang-es"]').locator("xpath=ancestor::*[@role='group']");
    await expect(langGroup, "language toggle group opts out of translation").toHaveAttribute(
      "translate",
      "no",
    );

    await page.screenshot({ path: shot("TA.6e-translate-proof.png") });
    expect(diag.consoleErrors, "console errors").toEqual([]);
    expect(diag.failedResponses, "failed requests").toEqual([]);
  });

  test("<html lang> flips when the language toggle is clicked", async ({ page }) => {
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 500);

    const html = page.locator("html");
    const initial = (await html.getAttribute("lang")) ?? "es";
    expect(["es", "en"], "html starts on a supported language").toContain(initial);

    const target = initial === "en" ? "es" : "en";

    // Open the language menu (Radix dropdown, portaled to <body>).
    await page.locator('[data-qa="lang-menu-trigger"]').click();
    await expect(page.locator(`[data-qa="lang-${target}"]`)).toBeVisible();

    // Pick the OTHER language → <html lang> must flip to it.
    await page.locator(`[data-qa="lang-${target}"]`).click();
    await expect(html, `html lang flips to ${target}`).toHaveAttribute("lang", target);

    // Flip back to the original → proves the sync tracks the toggle both ways.
    if (!(await page.locator(`[data-qa="lang-${initial}"]`).isVisible())) {
      await page.locator('[data-qa="lang-menu-trigger"]').click();
    }
    await page.locator(`[data-qa="lang-${initial}"]`).click();
    await expect(html, `html lang flips back to ${initial}`).toHaveAttribute("lang", initial);
  });
});
