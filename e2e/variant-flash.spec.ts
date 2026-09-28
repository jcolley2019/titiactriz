import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";
import { BUILT_HOME_VARIANT } from "../src/generated/homeVariant";

/**
 * TA.6c — variant resolution without flash; HOME.DEFAULT.1 — and without a hold.
 *
 * On load of `/`, the async site_settings fetch for home_variant used to flash:
 * the resolver rendered the default (editorial) first, then swapped when the
 * fetch resolved. TA.6c cached the last variant in localStorage
 * ("ta_home_variant") and held a true first visit on a neutral charcoal screen
 * until the fetch answered. HOME.DEFAULT.1 retires that hold: the build writes
 * the live variant into src/generated/homeVariant.ts, and a cache-less first
 * visit renders it at once, while the fetch and the realtime channel still run
 * so an admin flip made after the build swaps live.
 *
 * These specs pin the paths: first visit (the built variant, never editorial
 * first, never waiting on the network), the live swap, repeat visit (cached
 * variant paints without waiting on the network), a settings read that never
 * answers, and a regression that the default `/` renders clean.
 */

const HOME_VARIANT_ROUTE = "**/site_settings*home_variant*";
const CACHE_KEY = "ta_home_variant";

const EDITORIAL = '[data-qa="home-editorial"]';
const CINEMATIC = '[data-qa="home-cinematic"]';
const HOLD = '[data-qa="home-hold"]';

type Variant = typeof BUILT_HOME_VARIANT;

/** The home root a variant mounts. Classic (Index.tsx) carries no data-qa root. */
function rootOf(v: Variant): string {
  if (v === "editorial") return EDITORIAL;
  if (v === "cinematic") return CINEMATIC;
  throw new Error("HomeClassic has no data-qa root — give it one before these specs can pin it");
}

/** The variant the build baked in, and one it can swap to when site_settings disagrees. */
const BUILT = BUILT_HOME_VARIANT;
const OTHER: Variant = BUILT === "editorial" ? "cinematic" : "editorial";

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

/** Leave the home_variant read pending forever — nothing may wait on it. */
function hangVariant(page: Page) {
  return page.route(HOME_VARIANT_ROUTE, () => new Promise<void>(() => {}));
}

/**
 * Start with an empty variant cache (true first-visit conditions). Only the
 * tab's first document is cleared, so a reload sees what that visit cached.
 */
function clearCache(page: Page) {
  return page.addInitScript((key) => {
    try {
      if (sessionStorage.getItem("__qaVariantCacheCleared")) return;
      sessionStorage.setItem("__qaVariantCacheCleared", "1");
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
 * no other home ever appeared before the built one (the whole point of TA.6c).
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

test.describe("TA.6c / HOME.DEFAULT.1 — variant resolution without flash or hold", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("first visit: the built variant renders at once, no editorial flash, before a 5s settings read", async ({
    page,
  }) => {
    await clearCache(page);
    await trackMounts(page);
    // Very slow settings response (5s) answering the built variant: if the first
    // render waited on it — the TA.6c hold — this would time out.
    await mockVariant(page, BUILT, 5000);

    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator(rootOf(BUILT)), "built variant paints before the fetch answers").toBeVisible({
      timeout: 4000,
    });
    expect(Date.now() - t0, "painted before the 5s network response").toBeLessThan(4500);
    await expect(page.locator(HOLD), "no hold once the built variant is up").toHaveCount(0);
    await page.screenshot({ path: shot("HOME.DEFAULT.1-first-visit.png") });

    // Proof from document-start: the built variant is the ONLY home root that ever mounted.
    expect(await readMounts(page), "no other home rendered before the built one").toEqual([BUILT]);
  });

  test("live swap: site_settings answers a different variant → the page switches", async ({ page }) => {
    await clearCache(page);
    await trackMounts(page);
    // An admin flip made after the build: the fetch answers the other variant.
    await mockVariant(page, OTHER, 1500);
    const diag = attachDiagnostics(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator(rootOf(BUILT)), "built variant renders first").toBeVisible({ timeout: 4000 });
    await expect(page.locator(rootOf(OTHER)), "the page switches to the fetched variant").toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(rootOf(BUILT)), "the built variant is gone").toHaveCount(0);
    expect(await readMounts(page), "built, then the fetched variant").toEqual([BUILT, OTHER]);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), CACHE_KEY),
      "the fetched variant is cached",
    ).toBe(OTHER);

    // The next visit paints the cached variant straight away — it outranks the built one.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(rootOf(OTHER)), "cached variant paints on reload").toBeVisible({
      timeout: 10_000,
    });
    expect(await readMounts(page), "only the cached variant mounted on reload").toEqual([OTHER]);

    expect(diag.consoleErrors, "console errors across the swap").toEqual([]);
    expect(diag.failedResponses, "failed requests across the swap").toEqual([]);
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

  test("a settings read that never answers leaves the built variant up — no hold, no fallback swap", async ({
    page,
  }) => {
    await clearCache(page);
    await trackMounts(page);
    await hangVariant(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(rootOf(BUILT)), "built variant renders").toBeVisible({ timeout: 4000 });

    // Past the old 3s hold timeout: nothing swapped, nothing fell back.
    await page.waitForTimeout(4000);
    await expect(page.locator(rootOf(BUILT)), "built variant still up").toBeVisible();
    await expect(page.locator(HOLD), "no hold").toHaveCount(0);
    expect(await readMounts(page), "only the built variant ever mounted").toEqual([BUILT]);
  });

  test("regression: the default `/` with an empty cache renders clean, no flash", async ({ page }) => {
    // Pin the settings answer to the built variant so this regresses the default
    // path deterministically, independent of whatever the live DB is set to.
    await clearCache(page);
    await trackMounts(page);
    await mockVariant(page, BUILT, 0);
    const diag = attachDiagnostics(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(rootOf(BUILT)), "default home renders").toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

    // The built variant is the only home root that mounted — nothing flashed.
    expect(await readMounts(page), "only the built variant ever mounted").toEqual([BUILT]);
    expect(await page.locator(rootOf(OTHER)).count(), "the other home is not on the page").toBe(0);
    await page.screenshot({ path: shot("TA.6c-regression-home.png"), fullPage: true });

    expect(diag.consoleErrors, "console errors on /").toEqual([]);
    expect(diag.failedResponses, "failed requests on /").toEqual([]);
  });
});
