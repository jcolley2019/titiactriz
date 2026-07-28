import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { attachDiagnostics, shot, BRICK } from "./_helpers";
import { GREEN_WORLD_SHOP_URL, TITANS_ENABLED } from "../src/lib/ventures";

/**
 * TA.7 — ventures acts. Two full-viewport cinematic sections that replace the
 * retired TA.6b split-panel:
 *   • Green World — curtain reveal over a seamless crossfade-loop video.
 *   • Titans — a play-once badge reveal that holds its final frame.
 *
 * Language is resolved synchronously before first paint (src/i18n): stored
 * "ta_lang" wins, else navigator.language (es-* → ES, else EN). These specs pin
 * `locale` and clear storage so the copy assertions are deterministic.
 *
 * TITANS.OFF.1 — the Titans act is hidden behind TITANS_ENABLED, so its
 * coverage here is gated on the same constant rather than deleted. Every Titans
 * assertion below still describes the act exactly as it behaved the day it was
 * switched off; flipping the flag re-arms all of it with no rewrite. The
 * always-on half of the contract — that nothing Titans reaches the page while
 * the flag is false — lives in titans-off.spec.ts.
 */

const PATH = "/cinematic";

const GW_SECTION = '[data-qa="cinematic-greenworld"]';
const GW_VIDEO = '[data-qa="gw-video"]';
const GW_CURTAIN = '[data-qa="gw-curtain"]';
const GW_CTA = '[data-qa="gw-cta"]';

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

/** Reveal the Green World act and wait for the curtains to finish opening. */
async function revealGreenWorld(page: Page) {
  await page.locator(GW_SECTION).scrollIntoViewIfNeeded();
  // curtain slide (0.9s) + type stagger — give it comfortable margin
  await page.waitForTimeout(1800);
}

test.describe("TA.7 — Green World act (desktop, EN)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("curtains reveal a playing video; CTA + English copy", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 700);

    // Curtains exist up-front (section still below the fold, not yet revealed).
    await expect(page.locator(GW_CURTAIN), "two curtains before reveal").toHaveCount(2);

    await revealGreenWorld(page);

    // …and are gone once the reveal completes (unmounted from the DOM).
    await expect(page.locator(GW_CURTAIN), "curtains removed after reveal").toHaveCount(0);

    // The wave video is a real, playing <video> whose currentTime advances.
    const video = page.locator(GW_VIDEO);
    await expect(video).toHaveJSProperty("tagName", "VIDEO");
    const ct0 = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    await page.waitForTimeout(900);
    const ct1 = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    expect(Math.abs(ct1 - ct0), "gw video currentTime advances (playing)").toBeGreaterThan(0.05);

    // CTA points straight at the shared Green World storefront, new tab, noopener.
    const cta = page.locator(GW_CTA);
    expect(await cta.getAttribute("href"), "GW CTA is the shared shop URL").toBe(
      GREEN_WORLD_SHOP_URL,
    );
    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("rel", /noopener/);

    // English copy.
    await expect(page.locator(GW_SECTION)).toContainText("THE WELLNESS VENTURE");
    await expect(page.locator(GW_SECTION)).toContainText("WELLNESS YOU CAN FEEL.");
    await expect(cta).toContainText("EXPLORE GREEN WORLD");

    await page.screenshot({ path: shot(`TA.${BRICK}-gw-revealed.png`) });

    expect(diag.consoleErrors, "console errors — GW act").toEqual([]);
    expect(diag.failedResponses, "failed requests — GW act").toEqual([]);
  });
});

test.describe("TA.7 — Green World act (Spanish copy)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

  test("renders Spanish headline, kicker and CTA", async ({ page }) => {
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 700);
    await revealGreenWorld(page);

    const section = page.locator(GW_SECTION);
    await expect(section).toContainText("EL EMPRENDIMIENTO DE BIENESTAR");
    await expect(section).toContainText("BIENESTAR QUE SE SIENTE.");
    await expect(page.locator(GW_CTA)).toContainText("EXPLORA GREEN WORLD");
    await expect(section, "no English copy leaks through").not.toContainText(
      "WELLNESS YOU CAN FEEL.",
    );
  });
});

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

  test("posters render, CTAs functional, zero act videos autoplay", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 500);

    // No curtains under reduced motion.
    await expect(page.locator(GW_CURTAIN), "no curtains under reduced motion").toHaveCount(0);

    // Each live act renders its poster as a static <img>, not a <video>.
    const gwPoster = page.locator(GW_VIDEO);
    await expect(gwPoster).toHaveJSProperty("tagName", "IMG");
    expect(await gwPoster.getAttribute("src")).toContain("greenworld-poster.jpg");

    // Zero <video> elements inside the act (nothing autoplays).
    expect(await page.locator(`${GW_SECTION} video`).count(), "no GW video").toBe(0);

    if (TITANS_ENABLED) {
      const titansPoster = page.locator(TITANS_VIDEO);
      await expect(titansPoster).toHaveJSProperty("tagName", "IMG");
      expect(await titansPoster.getAttribute("src")).toContain("titans-poster.jpg");
      expect(await page.locator(`${TITANS_SECTION} video`).count(), "no Titans video").toBe(0);
    }

    // Full type + both CTAs are immediately present and functional.
    await page.locator(GW_SECTION).scrollIntoViewIfNeeded();
    await expect(page.locator(GW_SECTION)).toContainText("WELLNESS YOU CAN FEEL.");
    const gwCta = page.locator(GW_CTA);
    await expect(gwCta).toBeVisible();
    expect(await gwCta.getAttribute("href")).toBe(GREEN_WORLD_SHOP_URL);

    if (TITANS_ENABLED) {
      await page.locator(TITANS_SECTION).scrollIntoViewIfNeeded();
      await expect(page.locator(TITANS_SECTION)).toContainText("FORGE YOUR LEGEND.");
      const titansCta = page.locator(TITANS_CTA);
      await expect(titansCta).toBeVisible();
      expect(await titansCta.getAttribute("href")).toContain("/titans-agency");
    }

    await page.screenshot({ path: shot(`TA.${BRICK}-reduced.png`), fullPage: true });
  });
});

test.describe("TA.7 — mobile (acts stack)", () => {
  test.use({ viewport: { width: 390, height: 844 }, locale: "en-US" });

  test("each live act renders full-bleed with tappable CTAs", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    await revealGreenWorld(page);
    await expect(page.locator(GW_CTA), "GW CTA tappable on mobile").toBeVisible();
    expect(await page.locator(GW_CTA).getAttribute("href")).toBe(GREEN_WORLD_SHOP_URL);

    // VENT.GW.1 — a portrait viewport plays the dedicated 9:16 wave clip (the
    // landscape clip's motion lives where a phone's cover-crop discards it).
    // VENT.GW.2 — the clip is a play-once video (src attaches lazily at ~50%
    // visibility, so poll) that holds its final frame: no loop attribute.
    await expect
      .poll(async () => (await page.locator(GW_VIDEO).getAttribute("src")) ?? "", {
        timeout: 10_000,
      })
      .toContain("greenworld-panel-loop-portrait.mp4");
    expect(
      await page.locator(GW_VIDEO).evaluate((el) => (el as HTMLVideoElement).loop),
      "portrait wave plays once (no loop)",
    ).toBe(false);

    if (TITANS_ENABLED) {
      await page.locator(TITANS_SECTION).scrollIntoViewIfNeeded();
      // let the badge reveal + type entrance run
      await expect
        .poll(async () => (await page.locator(TITANS_SECTION).textContent()) ?? "", {
          timeout: 20_000,
        })
        .toContain("FORGE YOUR LEGEND.");
      await expect(page.locator(TITANS_CTA), "Titans CTA tappable on mobile").toBeVisible();
    }

    await page.screenshot({ path: shot(`TA.${BRICK}-mobile-both.png`), fullPage: true });

    expect(diag.consoleErrors, "console errors — mobile acts").toEqual([]);
    expect(diag.failedResponses, "failed requests — mobile acts").toEqual([]);
  });
});
