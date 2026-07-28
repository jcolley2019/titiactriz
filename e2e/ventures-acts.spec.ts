import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { attachDiagnostics, shot, BRICK } from "./_helpers";
import { TITANS_ENABLED } from "../src/lib/ventures";

/**
 * TA.7 — ventures acts. Two full-viewport cinematic sections that replaced the
 * retired TA.6b split-panel:
 *   • Green World — curtain reveal over a seamless crossfade-loop video.
 *   • Titans — a play-once badge reveal that holds its final frame.
 *
 * Both halves are now dark, for different reasons and by different mechanisms:
 *
 * TITANS.OFF.1 — the Titans act is hidden behind TITANS_ENABLED, so its coverage
 * here is gated on the same constant rather than deleted. Every Titans assertion
 * below still describes the act exactly as it behaved the day it was switched
 * off; flipping the flag re-arms all of it with no rewrite. The always-on half
 * of the contract — that nothing Titans reaches the page while the flag is
 * false — lives in titans-off.spec.ts.
 *
 * SEQ.2 — the Green World coverage that used to live here was DELETED rather
 * than gated, because the act it described is gone rather than hidden: the home
 * page now mounts a pinned frame-scrub act with no curtains, no <video> and no
 * external shop CTA. There is no flag that brings the old assertions back, so
 * keeping them behind one would have been a lie about what can be revived. Its
 * replacement is asserted in seq2-greenworld.spec.ts; the retired component
 * itself is preserved, unmounted, at src/components/cinematic/CinematicGreenWorld.tsx.
 *
 * Language is resolved synchronously before first paint (src/i18n): stored
 * "ta_lang" wins, else navigator.language (es-* → ES, else EN). These specs pin
 * `locale` and clear storage so the copy assertions are deterministic.
 */

const PATH = "/cinematic";

const TITANS_SECTION = '[data-qa="cinematic-titans"]';
const TITANS_VIDEO = '[data-qa="titans-video"]';
const TITANS_CTA = '[data-qa="titans-cta"]';

const LANG_KEY = "ta_lang";

async function settle(page: Page, ms = 500) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wipe any stored language choice before the page's own scripts run. */
function clearStoredLang(page: Page) {
  return page.addInitScript((key) => {
    try {
      localStorage.removeItem(key as string);
    } catch {
      /* storage may be unavailable */
    }
  }, LANG_KEY);
}

test.describe("TA.7 — Titans act (desktop, EN)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  test.skip(!TITANS_ENABLED, "TITANS.OFF.1 — Titans act is hidden; re-arms with the flag.");

  test("plays once, holds the final frame; CTA + English copy", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    await page.locator(TITANS_SECTION).scrollIntoViewIfNeeded();

    const video = page.locator(TITANS_VIDEO);
    await expect(video).toHaveJSProperty("tagName", "VIDEO");

    // Playback starts once the section reaches ~50% visibility.
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 12_000 })
      .toBeGreaterThan(0.1);

    // It never loops.
    expect(await video.evaluate((el: HTMLVideoElement) => el.loop), "titans video not looping").toBe(
      false,
    );

    // It plays through to the end exactly once.
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.ended), { timeout: 20_000 })
      .toBe(true);

    const atEnd = await video.evaluate((el: HTMLVideoElement) => ({
      ct: el.currentTime,
      dur: el.duration,
    }));
    // Final frame is held: currentTime is NOT reset to 0 and sits near the end.
    expect(atEnd.ct, "held final frame — not reset to 0").toBeGreaterThan(0);
    expect(atEnd.ct, "ended at/near the last frame").toBeGreaterThan(atEnd.dur - 0.75);

    // And it stays there — no loop restart.
    await page.waitForTimeout(1300);
    const later = await video.evaluate((el: HTMLVideoElement) => ({
      ct: el.currentTime,
      ended: el.ended,
    }));
    expect(later.ended, "remains ended (no restart)").toBe(true);
    expect(Math.abs(later.ct - atEnd.ct), "final frame held steady").toBeLessThan(0.1);

    // Type has entered; CTA routes internally to the Titans page.
    await expect(page.locator(TITANS_SECTION)).toContainText("THE CREATOR AGENCY");
    await expect(page.locator(TITANS_SECTION)).toContainText("FORGE YOUR LEGEND.");
    const cta = page.locator(TITANS_CTA);
    const href = await cta.getAttribute("href");
    expect(href ?? "", "Titans CTA routes to /titans-agency").toContain("/titans-agency");
    expect(href ?? "", "Titans CTA is not external").not.toContain("http");
    await expect(cta).toContainText("JOIN TITANS");

    await page.screenshot({ path: shot(`TA.${BRICK}-titans-landed.png`) });

    expect(diag.consoleErrors, "console errors — Titans act").toEqual([]);
    expect(diag.failedResponses, "failed requests — Titans act").toEqual([]);
  });
});

test.describe("TA.7 — Titans act (Spanish copy)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });
  test.skip(!TITANS_ENABLED, "TITANS.OFF.1 — Titans act is hidden; re-arms with the flag.");

  test("renders Spanish headline and CTA", async ({ page }) => {
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 600);
    await page.locator(TITANS_SECTION).scrollIntoViewIfNeeded();

    const section = page.locator(TITANS_SECTION);
    // Type enters when the badge lands (≥3.4s) or on 'ended' — poll for it.
    await expect
      .poll(async () => (await section.textContent()) ?? "", { timeout: 20_000 })
      .toContain("FORJA TU LEYENDA.");
    await expect(section).toContainText("LA AGENCIA DE CREADORES");
    await expect(page.locator(TITANS_CTA)).toContainText("ÚNETE A TITANS");
    await expect(section, "no English copy leaks through").not.toContainText("FORGE YOUR LEGEND.");
  });
});

test.describe("TA.7 — reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  test.skip(!TITANS_ENABLED, "TITANS.OFF.1 — Titans act is hidden; re-arms with the flag.");

  test("poster renders, CTA functional, zero act videos autoplay", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 500);

    // The act renders its poster as a static <img>, not a <video>.
    const titansPoster = page.locator(TITANS_VIDEO);
    await expect(titansPoster).toHaveJSProperty("tagName", "IMG");
    expect(await titansPoster.getAttribute("src")).toContain("titans-poster.jpg");
    expect(await page.locator(`${TITANS_SECTION} video`).count(), "no Titans video").toBe(0);

    // Full type + CTA are immediately present and functional.
    await page.locator(TITANS_SECTION).scrollIntoViewIfNeeded();
    await expect(page.locator(TITANS_SECTION)).toContainText("FORGE YOUR LEGEND.");
    const titansCta = page.locator(TITANS_CTA);
    await expect(titansCta).toBeVisible();
    expect(await titansCta.getAttribute("href")).toContain("/titans-agency");

    await page.screenshot({ path: shot(`TA.${BRICK}-reduced.png`), fullPage: true });
  });
});

test.describe("TA.7 — mobile (acts stack)", () => {
  test.use({ viewport: { width: 390, height: 844 }, locale: "en-US" });
  test.skip(!TITANS_ENABLED, "TITANS.OFF.1 — Titans act is hidden; re-arms with the flag.");

  test("the act renders full-bleed with a tappable CTA", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    await page.locator(TITANS_SECTION).scrollIntoViewIfNeeded();
    // let the badge reveal + type entrance run
    await expect
      .poll(async () => (await page.locator(TITANS_SECTION).textContent()) ?? "", {
        timeout: 20_000,
      })
      .toContain("FORGE YOUR LEGEND.");
    await expect(page.locator(TITANS_CTA), "Titans CTA tappable on mobile").toBeVisible();

    await page.screenshot({ path: shot(`TA.${BRICK}-mobile-both.png`), fullPage: true });

    expect(diag.consoleErrors, "console errors — mobile acts").toEqual([]);
    expect(diag.failedResponses, "failed requests — mobile acts").toEqual([]);
  });
});
