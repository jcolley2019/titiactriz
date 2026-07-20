import { test, expect, type Page } from "@playwright/test";
import { attachDiagnostics, shot, BRICK } from "./_helpers";

/**
 * TA.8 — TitiLinks act. A pinned product tour (browser-frame arrival → tour with
 * fly-in callouts → coming-soon announcement) followed by a logo-mask exit that
 * reveals the About section and unmounts. Verifies the pin engages + releases
 * cleanly, the frame's internal content translates, every callout appears, the
 * coming-soon CTA points at titilinks.com (_blank/noopener), the exit mask is
 * removed from the DOM afterwards, About is reachable, and EN/ES + reduced-motion
 * + mobile all hold.
 */
const PATH = "/cinematic";
const SECTION = '[data-qa="cinematic-titilinks"]';
const FRAME = '[data-qa="tl-frame"]';
const LANDING = '[data-qa="tl-landing"]';
const CALLOUT = '[data-qa="tl-callout"]:visible';
const CARD = '[data-qa="tl-comingsoon"]';
const CTA = '[data-qa="tl-cta"]';
const MASK = '[data-qa="tl-exit-mask"]';
const ABOUT = "#cinematic-about";
const LANG_KEY = "ta_lang";

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

function clearStoredLang(page: Page) {
  return page.addInitScript((key) => {
    try {
      localStorage.removeItem(key as string);
    } catch {
      /* storage may be unavailable */
    }
  }, LANG_KEY);
}

/** Wheel down until `predicate()` is truthy or we run out of steps. */
async function wheelUntil(
  page: Page,
  predicate: () => Promise<boolean>,
  { maxSteps = 40, delta = 500, pause = 150 } = {},
): Promise<boolean> {
  for (let i = 0; i < maxSteps; i++) {
    if (await predicate()) return true;
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(pause);
  }
  return predicate();
}

test.describe("TA.8 — TitiLinks act (desktop, EN)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("pinned tour → coming-soon → logo-mask exit → About", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    // Reach the act (arrival).
    await page.locator(FRAME).scrollIntoViewIfNeeded();
    await page.mouse.move(720, 450);
    await page.waitForTimeout(500);
    await expect(page.locator(FRAME)).toBeVisible();
    await expect(page.locator(SECTION)).toContainText("One link. All of you.");
    await page.screenshot({ path: shot(`TA.${BRICK}-arrival.png`) });

    // Tour: the mini-landing translates inside the frame as we scroll the pin.
    const landing = page.locator(LANDING);
    const t0 = await landing.evaluate((el) => getComputedStyle(el).transform);
    await wheelUntil(
      page,
      async () => (await landing.evaluate((el) => getComputedStyle(el).transform)) !== t0,
      { maxSteps: 10, delta: 450, pause: 160 },
    );
    const t1 = await landing.evaluate((el) => getComputedStyle(el).transform);
    expect(t1, "mini-landing translates inside the frame with scroll").not.toBe(t0);
    await page.screenshot({ path: shot(`TA.${BRICK}-tour-mid.png`) });

    // Every callout chip animates IN (opacity → 1) across the pinned range.
    // Note: Playwright ':visible' ignores opacity, so assert computed opacity.
    const calloutOpacities = () =>
      page.locator(CALLOUT).evaluateAll((els) =>
        els.map((el) => parseFloat(getComputedStyle(el as HTMLElement).opacity)),
      );
    await expect(page.locator(CALLOUT), "six feature callouts present").toHaveCount(6);
    await wheelUntil(
      page,
      async () => (await calloutOpacities()).filter((o) => o > 0.9).length >= 6,
      { maxSteps: 16, delta: 450, pause: 160 },
    );
    expect(
      (await calloutOpacities()).filter((o) => o > 0.9).length,
      "all six callouts flown in (opacity ~1)",
    ).toBe(6);

    // Coming-soon card irises open (clip-path circle radius grows well past 0).
    const cardRadius = async () => {
      const cp = await page
        .locator(CARD)
        .evaluate((el) => getComputedStyle(el).clipPath)
        .catch(() => "");
      if (cp === "none") return 100000;
      const m = cp.match(/circle\(([\d.]+)(?:px|%)/); // radius in px or %
      return m ? parseFloat(m[1]) : 0;
    };
    await wheelUntil(page, async () => (await cardRadius()) > 20, {
      maxSteps: 28,
      delta: 500,
      pause: 160,
    });
    expect(await cardRadius(), "coming-soon card irised open").toBeGreaterThan(20);
    await page.screenshot({ path: shot(`TA.${BRICK}-comingsoon.png`) });

    // CTA points at the live product, new tab, noopener.
    const cta = page.locator(CTA);
    expect(await cta.getAttribute("href"), "CTA → titilinks.com").toBe("https://titilinks.com");
    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("rel", /noopener/);
    await expect(page.locator(CARD)).toContainText("COMING SOON");

    // Exit: the logo-mask overlay mounts during the release.
    const maskAppeared = await wheelUntil(
      page,
      async () => (await page.locator(MASK).count()) > 0,
      { maxSteps: 14, delta: 350, pause: 150 },
    );
    if (maskAppeared) await page.screenshot({ path: shot(`TA.${BRICK}-exit-mask-mid.png`) });
    expect(maskAppeared, "logo-mask overlay mounts during the exit").toBe(true);

    // Finish the exit: the overlay unmounts entirely and About is revealed.
    await wheelUntil(page, async () => (await page.locator(MASK).count()) === 0, {
      maxSteps: 16,
      delta: 600,
      pause: 150,
    });
    await page.waitForTimeout(600);
    await expect(page.locator(MASK), "exit mask removed from the DOM").toHaveCount(0);

    await page.locator(ABOUT).scrollIntoViewIfNeeded();
    await expect(page.locator(ABOUT), "About section reachable").toBeVisible();
    expect((await page.locator(ABOUT).textContent())?.trim().length ?? 0).toBeGreaterThan(0);

    // Document scroll continued well past the section — no scroll-lock residue.
    expect(await page.evaluate(() => window.scrollY), "scroll advanced past the act").toBeGreaterThan(1500);

    expect(diag.consoleErrors, "console errors — TitiLinks act").toEqual([]);
    expect(diag.failedResponses, "failed requests — TitiLinks act").toEqual([]);
  });
});

test.describe("TA.8 — TitiLinks act (Spanish copy)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

  test("renders Spanish headline and CTA", async ({ page }) => {
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 700);

    await page.locator(FRAME).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const section = page.locator(SECTION);
    await expect(section).toContainText("Un link. Todo tú.");
    await expect(section, "no English copy leaks through").not.toContainText("One link. All of you.");

    // Scroll to the announcement and check the Spanish CTA.
    await wheelUntil(
      page,
      async () => (await page.locator(CTA).textContent())?.includes("Conoce") ?? false,
      { maxSteps: 24, delta: 450, pause: 150 },
    );
    await expect(page.locator(CTA)).toContainText("Conoce TitiLinks");
    expect(await page.locator(CTA).getAttribute("href")).toBe("https://titilinks.com");
  });
});

test.describe("TA.8 — reduced motion (static fallback)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("no pin, no mask; frame + callouts + coming-soon card all functional", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 500);

    await page.locator(SECTION).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // No exit mask ever exists under reduced motion.
    await expect(page.locator(MASK)).toHaveCount(0);

    // Frame, all callouts, and the coming-soon card + CTA are statically present.
    await expect(page.locator(FRAME)).toBeVisible();
    await expect(page.locator(CALLOUT)).toHaveCount(6);
    await expect(page.locator(SECTION)).toContainText("One link. All of you.");

    const cta = page.locator(CTA);
    await expect(cta).toBeVisible();
    expect(await cta.getAttribute("href")).toBe("https://titilinks.com");
    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("rel", /noopener/);
    await expect(page.locator(CARD)).toContainText("COMING SOON");

    // About still reachable directly below (no scroll-jacking).
    await page.locator(ABOUT).scrollIntoViewIfNeeded();
    await expect(page.locator(ABOUT)).toBeVisible();

    await page.screenshot({ path: shot(`TA.${BRICK}-reduced.png`), fullPage: true });
    expect(diag.consoleErrors, "console errors — reduced motion").toEqual([]);
    expect(diag.failedResponses, "failed requests — reduced motion").toEqual([]);
  });
});

test.describe("TA.8 — mobile 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, locale: "en-US" });

  test("pinned tour works; frame near-fullwidth, callouts stack, About reachable", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    await page.locator(FRAME).scrollIntoViewIfNeeded();
    await page.mouse.move(195, 420);
    await page.waitForTimeout(400);
    await expect(page.locator(FRAME)).toBeVisible();
    await expect(page.locator(CALLOUT), "callouts stack on mobile").toHaveCount(6);

    // Advance to the coming-soon CTA.
    await wheelUntil(
      page,
      async () => {
        const cta = page.locator(CTA);
        return (await cta.count()) > 0 && (await cta.getAttribute("href")) === "https://titilinks.com";
      },
      { maxSteps: 20, delta: 400, pause: 150 },
    );
    expect(await page.locator(CTA).getAttribute("href")).toBe("https://titilinks.com");
    await page.screenshot({ path: shot(`TA.${BRICK}-mobile.png`), fullPage: true });

    // Finish scrolling; the exit unmounts and About is reachable.
    await wheelUntil(page, async () => (await page.locator(MASK).count()) === 0 &&
      (await page.locator(ABOUT).isVisible().catch(() => false)), { maxSteps: 20, delta: 600, pause: 140 });
    await page.locator(ABOUT).scrollIntoViewIfNeeded();
    await expect(page.locator(ABOUT)).toBeVisible();
    await expect(page.locator(MASK)).toHaveCount(0);

    expect(diag.consoleErrors, "console errors — mobile").toEqual([]);
    expect(diag.failedResponses, "failed requests — mobile").toEqual([]);
  });
});
