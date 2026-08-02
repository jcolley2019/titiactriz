import { test, expect, type Page } from "@playwright/test";
import { attachDiagnostics, shot, BRICK } from "./_helpers";

/**
 * TA.8 / TA.8a — TitiLinks act. A pinned product tour (browser-frame arrival →
 * tour with fly-in callouts → launch announcement) followed by a CLEAN FADE
 * RELEASE (TA.8a): the act's content fades + scales to 0.96 while a single thin
 * gold line sweeps once, then normal scroll continues into About.
 *
 * TA.8a replaced the old logo-mask exit (a body-portalled SVG overlay that
 * leaked opaque gold arcs over the launch card and persisted into About).
 * These specs now GUARANTEE the opposite: at every scroll position, top→bottom
 * and back, no exit element exists outside the act's own section and the About
 * pull-quote is never obstructed by an overlay.
 */
const PATH = "/cinematic";
const SECTION = '[data-qa="cinematic-titilinks"]';
const FRAME = '[data-qa="tl-frame"]';
const LANDING = '[data-qa="tl-landing"]';
const CALLOUT = '[data-qa="tl-callout"]:visible';
const CARD = '[data-qa="tl-launch"]';
const CTA = '[data-qa="tl-cta"]';
const MASK = '[data-qa="tl-exit-mask"]'; // removed in TA.8a — must NEVER exist
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

const scrollState = (page: Page) =>
  page.evaluate(() => ({
    y: window.scrollY,
    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  }));

/** Wheel toward a target scrollY (Lenis-driven; window.scrollTo won't stick). */
async function wheelToY(
  page: Page,
  target: number,
  dir: 1 | -1,
  { maxSteps = 80, delta = 700, pause = 70 } = {},
) {
  for (let i = 0; i < maxSteps; i++) {
    const { y } = await scrollState(page);
    if (dir > 0 ? y >= target - 4 : y <= target + 4) break;
    await page.mouse.wheel(0, dir > 0 ? delta : -delta);
    await page.waitForTimeout(pause);
  }
  await page.waitForTimeout(140); // let the scrub settle before sampling
}

/**
 * At the CURRENT scroll position assert: (1) no logo-mask exists anywhere, (2)
 * every exit-related element (data-qa^="tl-exit") is a descendant of the act's
 * section, and (3) when the About pull-quote is on screen, elementFromPoint over
 * its centre returns About content (never an overlay). Returns the About hit for
 * diagnostics.
 */
async function assertCleanAt(page: Page, label: string) {
  const res = await page.evaluate(() => {
    const section = document.querySelector('[data-qa="cinematic-titilinks"]');
    const exitEls = Array.from(document.querySelectorAll('[data-qa^="tl-exit"]'));
    const masks = document.querySelectorAll('[data-qa="tl-exit-mask"]').length;
    const outside = exitEls
      .filter((el) => !section || !section.contains(el))
      .map((el) => el.getAttribute("data-qa"));

    const q = document.querySelector('#cinematic-about [data-qa="section-heading"]');
    let about: { inView: boolean; ok: boolean; hit: string | null } = {
      inView: false,
      ok: true,
      hit: null,
    };
    if (q) {
      const r = q.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1);
      const cy = r.top + r.height / 2;
      // The site header is `position: fixed` over the top ~63px at EVERY scroll
      // position, so a probe landing in that band always returns the header —
      // which says nothing about TitiLinks leaking. Clamp the probe down to the
      // first visible pixel of the heading instead of skipping the sample: this
      // still asserts at every step, and asserts somewhere actually on screen.
      const header = document.querySelector("header");
      const navBottom = header ? header.getBoundingClientRect().bottom : 0;
      const probeY = Math.max(cy, navBottom + 1);
      if (r.height > 0 && r.bottom > navBottom && probeY < vh) {
        const el = document.elementFromPoint(cx, probeY) as HTMLElement | null;
        about = {
          inView: true,
          ok: !!(el && el.closest("#cinematic-about")),
          hit: el ? el.getAttribute("data-qa") ?? el.tagName : null,
        };
      }
    }
    return { masks, outside, about };
  });

  expect(res.masks, `no exit mask exists @${label}`).toBe(0);
  expect(res.outside, `no exit element outside the act @${label}`).toEqual([]);
  if (res.about.inView) {
    expect(res.about.ok, `About unobstructed @${label} (hit=${res.about.hit})`).toBe(true);
  }
  return res;
}

test.describe("TA.8 — TitiLinks act (desktop, EN)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("pinned tour → launch card → clean fade release → About", async ({ page }) => {
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

    // Launch card irises open (clip-path circle radius grows well past 0).
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
    expect(await cardRadius(), "launch card irised open").toBeGreaterThan(20);
    await page.screenshot({ path: shot(`TA.${BRICK}-launchcard.png`) });

    // CTA points at the live product, new tab, noopener.
    const cta = page.locator(CTA);
    expect(await cta.getAttribute("href"), "CTA → titilinks.com").toBe("https://titilinks.com");
    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("rel", /noopener/);
    await expect(page.locator(CARD)).toContainText("NOW LIVE");

    // Release: NO overlay ever mounts on the body. Finish scrolling into About.
    await wheelUntil(
      page,
      async () => page.locator(ABOUT).isVisible().catch(() => false),
      { maxSteps: 24, delta: 600, pause: 140 },
    );
    await page.locator(ABOUT).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // No logo-mask ever existed; About is reachable and unobstructed.
    await expect(page.locator(MASK), "logo-mask never mounts (TA.8a)").toHaveCount(0);
    await assertCleanAt(page, "about-reached");
    await expect(page.locator(ABOUT), "About section reachable").toBeVisible();
    expect((await page.locator(ABOUT).textContent())?.trim().length ?? 0).toBeGreaterThan(0);
    await page.screenshot({ path: shot("TA.8a-exit-clean.png") });

    // Document scroll continued well past the section — no scroll-lock residue.
    expect(await page.evaluate(() => window.scrollY), "scroll advanced past the act").toBeGreaterThan(1500);

    expect(diag.consoleErrors, "console errors — TitiLinks act").toEqual([]);
    expect(diag.failedResponses, "failed requests — TitiLinks act").toEqual([]);
  });
});

test.describe("TA.8a — exit release leaks nothing (full-page scroll, both viewports)", () => {
  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`no exit element outside the act + About never obstructed — ${vp.name}`, async ({ page }) => {
      const diag = attachDiagnostics(page);
      await clearStoredLang(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(PATH, { waitUntil: "domcontentloaded" });
      await settle(page, 800);
      await page.mouse.move(vp.width / 2, vp.height / 2);

      const { max } = await scrollState(page);
      const STEPS = 10; // 0%,10%,…,100%

      // Top → bottom, sampling at every 10% increment.
      for (let i = 0; i <= STEPS; i++) {
        const target = Math.round((max * i) / STEPS);
        await wheelToY(page, target, 1);
        await assertCleanAt(page, `${vp.name} down ${i * 10}%`);
      }

      // Bottom → back to top, sampling at every 10% increment.
      for (let i = STEPS; i >= 0; i--) {
        const target = Math.round((max * i) / STEPS);
        await wheelToY(page, target, -1);
        await assertCleanAt(page, `${vp.name} up ${i * 10}%`);
      }

      expect(diag.consoleErrors, `console errors — leak sweep ${vp.name}`).toEqual([]);
      expect(diag.failedResponses, `failed requests — leak sweep ${vp.name}`).toEqual([]);
    });
  }
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
      async () => (await page.locator(CTA).textContent())?.includes("Visita") ?? false,
      { maxSteps: 24, delta: 450, pause: 150 },
    );
    await expect(page.locator(CTA)).toContainText("Visita TitiLinks");
    expect(await page.locator(CTA).getAttribute("href")).toBe("https://titilinks.com");
  });
});

test.describe("TA.8 — reduced motion (static fallback)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("no pin, no mask; frame + callouts + launch card all functional", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 500);

    await page.locator(SECTION).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // No exit mask ever exists under reduced motion.
    await expect(page.locator(MASK)).toHaveCount(0);

    // Frame, all callouts, and the launch card + CTA are statically present.
    await expect(page.locator(FRAME)).toBeVisible();
    await expect(page.locator(CALLOUT)).toHaveCount(6);
    await expect(page.locator(SECTION)).toContainText("One link. All of you.");

    const cta = page.locator(CTA);
    await expect(cta).toBeVisible();
    expect(await cta.getAttribute("href")).toBe("https://titilinks.com");
    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("rel", /noopener/);
    await expect(page.locator(CARD)).toContainText("NOW LIVE");

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

    // Advance to the launch CTA.
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

    // Finish scrolling; no overlay mounts and About is reachable + unobstructed.
    await wheelUntil(page, async () => page.locator(ABOUT).isVisible().catch(() => false), {
      maxSteps: 20,
      delta: 600,
      pause: 140,
    });
    await page.locator(ABOUT).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await expect(page.locator(ABOUT)).toBeVisible();
    await expect(page.locator(MASK)).toHaveCount(0);
    await assertCleanAt(page, "mobile about-reached");

    expect(diag.consoleErrors, "console errors — mobile").toEqual([]);
    expect(diag.failedResponses, "failed requests — mobile").toEqual([]);
  });
});
