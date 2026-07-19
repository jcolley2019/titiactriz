import { test, expect } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";

/**
 * FINAL-GATE regression proof: the additive cinematic sprint must not change
 * anything visible on existing routes. Loads the live editorial home (/) and
 * the admin login screen and asserts a clean console on both.
 */
async function settle(page: import("@playwright/test").Page, ms = 800) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe("regression — existing routes unchanged", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("editorial home (/) renders clean", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.screenshot({ path: shot("regression-home.png"), fullPage: true });
    expect(diag.consoleErrors, "console errors on /").toEqual([]);
    expect(diag.failedResponses, "failed requests on /").toEqual([]);
  });

  test("admin login screen renders clean", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 600);
    await page.screenshot({ path: shot("regression-admin.png"), fullPage: true });
    expect(diag.consoleErrors, "console errors on /admin").toEqual([]);
    expect(diag.failedResponses, "failed requests on /admin").toEqual([]);
  });
});
