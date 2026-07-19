import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";

/**
 * TA.6c — variant resolution without flash.
 *
 * On load of `/`, the async site_settings fetch for home_variant used to flash:
 * the resolver rendered the default (editorial) first, then swapped when the
 * fetch resolved. The fix caches the last variant in localStorage
 * ("ta_home_variant") and, on a true first visit, holds on a neutral charcoal
 * screen until the fetch resolves (with a 3s fallback to the default).
 *
 * These specs pin the three paths: first visit (no editorial before the real
 * variant), repeat visit (cached variant paints without waiting on the network),
 * and the timeout fallback. Plus a regression that the default `/` still renders
 * clean with an empty cache.
 */

const HOME_VARIANT_ROUTE = "**/site_settings*home_variant*";
const CACHE_KEY = "ta_home_variant";

const EDITORIAL = '[data-qa="home-editorial"]';
const CINEMATIC = '[data-qa="home-cinematic"]';
const HOLD = '[data-qa="home-hold"]';

/** Fulfil the home_variant read with `value`, optionally after `delayMs`. */
function mockVariant(page: Page, value: string, delayMs = 0) {
  return page.route(HOME_VARIANT_ROUTE, async (route: Route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ value }),
    });
  });
}

/** Leave the home_variant read pending forever, to exercise the hold timeout. */
function hangVariant(page: Page) {
  return page.route(HOME_VARIANT_ROUTE, () => new Promise<void>(() => {}));
}

/** Start with an empty variant cache (true first-visit conditions). */
function clearCache(page: Page) {
  return page.addInitScript((key) => {
    try {
      localStorage.removeItem(key as string);
    } catch {
      /* storage may be unavailable */
    }
  }, CACHE_KEY);
}

/** Pre-seed the cache so the page renders as a repeat visitor would. */
function seedCache(page: Page, value: string) {
  return page.addInitScript(
    ([key, v]) => {
      try {
        localStorage.setItem(key as string, v as string);
      } catch {
        /* storage may be unavailable */
      }
    },
    [CACHE_KEY, value],
  );
}

/**
 * Record the ORDER in which the editorial / cinematic roots first mount, from
 * document-start via a MutationObserver. `window.__homeMounts` lets a spec prove
 * editorial never appeared before the resolved variant (the whole point of TA.6c).
 */
function trackMounts(page: Page) {
  return page.addInitScript(() => {
    const w = window as unknown as { __homeMounts: string[] };
    w.__homeMounts = [];
    const record = () => {
      if (document.querySelector('[data-qa="home-editorial"]') && !w.__homeMounts.includes("editorial"))
        w.__homeMounts.push("editorial");
      if (document.querySelector('[data-qa="home-cinematic"]') && !w.__homeMounts.includes("cinematic"))
        w.__homeMounts.push("cinematic");
    };
    const obs = new MutationObserver(record);
    const start = () => obs.observe(document.documentElement, { childList: true, subtree: true });
    if (document.documentElement) start();
    else addEventListener("DOMContentLoaded", start);
  });
}

const readMounts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __homeMounts: string[] }).__homeMounts);

test.describe("TA.6c — variant resolution without flash", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("first visit: editorial never mounts before the resolved (cinematic) variant", async ({
    page,
  }) => {
    await clearCache(page);
    await trackMounts(page);
    // Slow settings response (1.5s) — but under the 3s hold timeout, so the real
    // (cinematic) variant wins, not the fallback.
    await mockVariant(page, "cinematic", 1500);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // While the fetch is in flight the neutral hold is shown — no editorial DOM.
    await expect(page.locator(HOLD), "neutral hold while resolving").toBeVisible();
    expect(await page.locator(EDITORIAL).count(), "no editorial during hold").toBe(0);

    // Once resolved, the cinematic page mounts.
    await expect(page.locator(CINEMATIC), "cinematic mounts after resolve").toBeVisible({
      timeout: 10_000,
    });

    // Proof from document-start: cinematic is the ONLY home root that ever mounted.
    expect(await readMounts(page), "editorial never rendered before cinematic").toEqual([
      "cinematic",
    ]);
  });

  test("repeat visit: cached cinematic paints without waiting on the network", async ({ page }) => {
    await seedCache(page, "cinematic");
    await trackMounts(page);
    // Very slow response (5s): if the paint waited on it, this would time out.
    await mockVariant(page, "cinematic", 5000);

    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Cinematic appears well before the mocked network could answer.
    await expect(page.locator(CINEMATIC), "cached cinematic paints immediately").toBeVisible({
      timeout: 4000,
    });
    expect(Date.now() - t0, "painted before the 5s network response").toBeLessThan(4500);

    // Editorial never flashes.
    expect(await readMounts(page), "only cinematic ever mounted").toEqual(["cinematic"]);
  });

  test("timeout path: a never-resolving settings read falls back to editorial (~3s)", async ({
    page,
  }) => {
    await clearCache(page);
    await hangVariant(page);

    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Holds first...
    await expect(page.locator(HOLD), "hold while the read hangs").toBeVisible();

    // ...then the 3s fallback renders editorial rather than blanking forever.
    await expect(page.locator(EDITORIAL), "fallback to editorial after timeout").toBeVisible({
      timeout: 8000,
    });
    expect(Date.now() - t0, "fallback waited for the hold timeout, not instant").toBeGreaterThan(
      2500,
    );
  });

  test("regression: editorial `/` with an empty cache renders clean, no flash", async ({ page }) => {
    // Pin the variant to editorial so this regresses the default path
    // deterministically, independent of whatever the live DB is set to.
    await clearCache(page);
    await trackMounts(page);
    await mockVariant(page, "editorial", 0);
    const diag = attachDiagnostics(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(EDITORIAL), "editorial renders").toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

    // Editorial is the only home root that mounted — the fix never flashes cinematic.
    expect(await readMounts(page), "only editorial ever mounted").toEqual(["editorial"]);
    expect(await page.locator(CINEMATIC).count(), "cinematic not on editorial home").toBe(0);
    await page.screenshot({ path: shot("TA.6c-regression-home.png"), fullPage: true });

    expect(diag.consoleErrors, "console errors on /").toEqual([]);
    expect(diag.failedResponses, "failed requests on /").toEqual([]);
  });
});
