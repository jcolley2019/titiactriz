import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";

/**
 * BANNER.TOGGLE.1 — the owner's switch is AUTHORITATIVE and the visitor's X is
 * subordinate. Joey's law, verbatim: "the admin toggle is authoritative and
 * global — off means no banner for anyone, immediately; the X is only a
 * per-visitor dismissal (session/localStorage) that never overrides the toggle
 * and resets when a NEW event banner appears."
 *
 * The laws, each falsifiable:
 *
 *  1. OFF MEANS OFF — a board whose main banner is disabled renders NO banner,
 *     with a clean localStorage (no dismissal helping it along).
 *  2. THE X IS PER-VISITOR AND PERSISTENT — dismissing writes localStorage, and
 *     the SAME banner stays dismissed on the next load.
 *  3. A NEW BANNER RESETS THE X — the same words re-enabled under a fresh
 *     `enabledAt` stamp are a NEW banner, and a visitor who dismissed the old
 *     one sees the new one.
 *  4. THE ADMIN STAMPS THE IDENTITY — driving the real editor, flipping the
 *     switch ON sends a write whose mainBanner carries a fresh `enabledAt`;
 *     flipping it OFF sends enabled:false and does not mint a new identity.
 *  5. FAILURE IS DARK — when the board cannot be read at all, no banner
 *     renders. The owner's switch cannot be honored, so nothing shows; the
 *     default board must never resurrect a banner the owner may have killed.
 */

const BAR = '[data-qa="events-banner"]';
const DISMISS = '[data-qa="events-banner-dismiss"]';
const MAIN = '[data-qa="banner-editor"][data-banner="main"]';

const bannerOf = (enabled: boolean, enabledAt?: string) => ({
  pageVisible: true,
  homeVisible: false,
  mainBanner: {
    enabled,
    label: { es: "EVENTOS", en: "EVENTS" },
    text: {
      es: "ESTE SÁBADO A LAS 8:00PM",
      en: "THIS SATURDAY AT 8:00PM",
    },
    link: "",
    pages: { home: true, greenWorld: true, titans: true },
    bold: false,
    textColor: "#C9A55C",
    ...(enabledAt ? { enabledAt } : {}),
  },
  items: [],
});

async function open(page: Page, board: unknown, writes?: Write[]) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await forceLanguage(page, "es");
  await routeSupabase(page, { eventsBoard: board, writes });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

test.describe("BANNER.TOGGLE.1 — the switch rules, the X serves", () => {
  test("law 1: enabled shows, disabled shows NOTHING — same text, same pages", async ({ page }) => {
    await open(page, bannerOf(true, "2026-08-19T00:00:00.000Z"));
    await expect(page.locator(BAR)).toBeVisible();

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await routeSupabase(page, { eventsBoard: bannerOf(false, "2026-08-19T00:00:00.000Z") });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await expect(page.locator(BAR)).toHaveCount(0);
  });

  test("laws 2+3: the X persists for THIS banner and resets for a NEW one", async ({ page }) => {
    await open(page, bannerOf(true, "2026-08-19T00:00:00.000Z"));
    await expect(page.locator(BAR)).toBeVisible();

    await page.locator(DISMISS).click();
    await expect(page.locator(BAR)).toHaveCount(0);

    // The dismissal is REMEMBERED: same banner, next visit, still gone.
    const keys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("eventsBannerDismissed:")),
    );
    expect(keys.length).toBe(1);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await expect(page.locator(BAR)).toHaveCount(0);

    // The owner re-enables: a fresh `enabledAt`, the same words. NEW banner —
    // the old dismissal no longer names it, and the bar returns.
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await routeSupabase(page, { eventsBoard: bannerOf(true, "2026-08-20T00:00:00.000Z") });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await expect(page.locator(BAR)).toBeVisible();
  });

  test("law 4: the editor's switch stamps enabledAt ON and leaves it alone OFF", async ({ page }) => {
    const writes: Write[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAdminSession(page);
    await forceLanguage(page, "es");
    await routeSupabase(page, { eventsBoard: bannerOf(false, "2026-08-01T00:00:00.000Z"), writes });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.locator('[data-qa="admin-nav-events"]').click();

    const sw = page.locator(MAIN).locator('[data-qa="banner-enabled"]');
    await expect(sw).toBeVisible();

    // ON — the write carries a FRESH stamp, not the August 1st one.
    await sw.click();
    await expect
      .poll(() => writes.filter((w) => w.body?.includes("events_board")).length)
      .toBeGreaterThan(0);
    const onWrite = writes.filter((w) => w.body?.includes("events_board")).at(-1)!;
    const onBoard = JSON.parse(onWrite.body!)[0].value;
    expect(onBoard.mainBanner.enabled).toBe(true);
    expect(typeof onBoard.mainBanner.enabledAt).toBe("string");
    expect(onBoard.mainBanner.enabledAt).not.toBe("2026-08-01T00:00:00.000Z");

    // OFF — enabled:false, and the identity is NOT re-minted.
    const before = writes.length;
    await sw.click();
    await expect.poll(() => writes.length).toBeGreaterThan(before);
    const offWrite = writes.filter((w) => w.body?.includes("events_board")).at(-1)!;
    const offBoard = JSON.parse(offWrite.body!)[0].value;
    expect(offBoard.mainBanner.enabled).toBe(false);
    expect(offBoard.mainBanner.enabledAt).toBe(onBoard.mainBanner.enabledAt);
  });

  test("law 5: an unreadable board fails DARK — no default banner resurrects", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await forceLanguage(page, "es");
    await routeSupabase(page, {});
    // Registered after routeSupabase, so it wins: the board read itself dies.
    await page.route("**/rest/v1/site_settings*events_board*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await expect(page.locator(BAR)).toHaveCount(0);
  });
});
