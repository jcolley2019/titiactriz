import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { shot } from "./_helpers";

/**
 * TA.7d — first-paint layout gate. Proves the bottom-of-page "footer flash" is
 * gone:
 *   • Fresh visit to / (throttled): the global footer is never visible at first
 *     paint and scrollY never leaves 0 during load.
 *   • Reload after scrolling mid-page: lands (and stays) at the top, no flash.
 *   • Mobile hero (390×844 and 390×740): the cinematic hero fully covers the
 *     visual viewport, the next section (reel) is entirely below the fold, and
 *     the scroll cue is visible and unclipped.
 *
 * Root cause (see Home.tsx / cinematic.css): during the neutral hold <main> held
 * only a fixed, zero-flow-height element, collapsing the app shell so the
 * `relative z-10` footer floated into — and painted over — the first viewport.
 */

/** Is the global <footer> actually visible right now? (below-fold OR painted-over ⇒ not visible) */
function footerVisibility() {
  const f = document.querySelector("footer");
  if (!f) return { present: false, visible: false, top: null as number | null, ih: window.innerHeight };
  const r = f.getBoundingClientRect();
  const ih = window.innerHeight;
  if (r.top >= ih) {
    return { present: true, visible: false, top: Math.round(r.top), ih, reason: "below-fold" };
  }
  // Inside the viewport vertically — is it the painted (top-most) element there,
  // or is something (the neutral hold) covering it?
  const x = Math.round(r.left + r.width / 2);
  const y = Math.round(Math.min(r.top + 2, ih - 2));
  const hit = document.elementFromPoint(x, y);
  const covered = !(hit === f || f.contains(hit));
  return {
    present: true,
    visible: !covered,
    top: Math.round(r.top),
    ih,
    hit: hit ? (hit as HTMLElement).tagName + "." + ((hit as HTMLElement).getAttribute("data-qa") ?? "") : null,
  };
}

async function throttle(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.5 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });
}

/** Sample scrollY on every frame for ~2.5s, from the moment the document exists. */
function armScrollSampler(page: Page) {
  return page.addInitScript(() => {
    (window as unknown as { __ys: number[] }).__ys = [];
    const arr = (window as unknown as { __ys: number[] }).__ys;
    const start = performance.now();
    const tick = () => {
      arr.push(Math.round(window.scrollY));
      if (performance.now() - start < 2500) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** domcontentloaded → +2 rAF ≈ "first paint + 1 frame". */
async function firstPaintPlusFrame(page: Page) {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
}

test.describe("TA.7d — first-paint flash (desktop 1440×900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("fresh visit to / never shows the footer; scrollY stays 0", async ({ page }) => {
    await throttle(page);
    await armScrollSampler(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await firstPaintPlusFrame(page);

    // The exact frame that used to show the footer — now the neutral hold / hero.
    await page.screenshot({ path: shot("TA.7d-firstpaint.png") });

    const viz = await page.evaluate(footerVisibility);
    expect(viz.visible, `footer must NOT be visible at first paint — ${JSON.stringify(viz)}`).toBe(false);
    expect(await page.evaluate(() => Math.round(window.scrollY)), "scrollY at first paint").toBe(0);

    // No scroll jump across the early (neutral-hold) window — the flash-risk phase.
    await page.waitForTimeout(2600);
    const ys = await page.evaluate(() => (window as unknown as { __ys: number[] }).__ys);
    expect(Math.max(...ys, 0), "scrollY never leaves 0 during load").toBe(0);

    // Wait for the real cinematic page to mount (its gsap/lenis chunk is heavy and,
    // under 6× CPU throttle, resolves well after first paint) then confirm the
    // footer sits far below the fold and we are still pinned at the top.
    await page.locator('[data-qa="home-cinematic"]').waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForTimeout(400);
    const settled = await page.evaluate(footerVisibility);
    expect(settled.visible, "footer stays hidden after content mounts").toBe(false);
    expect(settled.top ?? 0, "footer is far below the fold once content mounts").toBeGreaterThan(900);
    expect(await page.evaluate(() => Math.round(window.scrollY)), "still at top after mount").toBe(0);
  });

  test("reload after scrolling mid-page lands at top, no bottom flash", async ({ page }) => {
    await throttle(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Wait for the tall cinematic page so there is somewhere to scroll to.
    await page.locator('[data-qa="home-cinematic"]').waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForTimeout(400);

    await page.evaluate(() =>
      window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.5)),
    );
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => Math.round(window.scrollY)), "scrolled mid-page").toBeGreaterThan(0);

    await armScrollSampler(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await firstPaintPlusFrame(page);

    const viz = await page.evaluate(footerVisibility);
    expect(viz.visible, `footer must NOT be visible after reload — ${JSON.stringify(viz)}`).toBe(false);

    await page.waitForTimeout(2600);
    const ys = await page.evaluate(() => (window as unknown as { __ys: number[] }).__ys);
    expect(Math.max(...ys, 0), "reload lands and stays at the top (no restore jump)").toBe(0);

    // After the page fully re-mounts it is still pinned at the top (no late jump).
    await page.locator('[data-qa="home-cinematic"]').waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => Math.round(window.scrollY)), "still at top after reload+mount").toBe(0);
  });
});

/**
 * ADDENDUM — mobile hero sizing. 390×844 = URL-bar-collapsed; 390×740 simulates
 * the URL-bar-expanded (smaller) visual viewport. The cinematic hero must own
 * the whole small viewport at first paint with nothing of the reel bleeding in.
 */
for (const vp of [
  { w: 390, h: 844, label: "urlbar-collapsed", shotName: "TA.7d-mobile-hero.png" },
  { w: 390, h: 740, label: "urlbar-expanded", shotName: "TA.7d-mobile-hero-740.png" },
]) {
  test.describe(`TA.7d — mobile hero ${vp.w}×${vp.h} (${vp.label})`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });

    test("hero covers the viewport, reel below the fold, scroll cue unclipped", async ({ page }) => {
      await page.goto("/cinematic", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(700);

      const sections = page.locator('[data-qa="cinematic-section"]');
      const hero = sections.first();
      // Confirm section 0 is really the hero (kinetic name lockup).
      await expect(hero, "hero holds the name lockup").toContainText("CRISTYNA");

      const ih = await page.evaluate(() => window.innerHeight);

      // (1) Hero fully covers the visual viewport.
      const heroRect = await hero.boundingBox();
      expect(heroRect, "hero has a box").not.toBeNull();
      expect(heroRect!.y, "hero starts at the top edge").toBeLessThanOrEqual(0.5);
      expect(heroRect!.y + heroRect!.height, "hero bottom reaches past the fold").toBeGreaterThanOrEqual(
        ih - 0.5,
      );

      // (2) The next section (reel) is entirely below the fold — nothing bleeds in.
      const reel = sections.nth(1);
      const reelRect = await reel.boundingBox();
      expect(reelRect, "reel has a box").not.toBeNull();
      expect(reelRect!.y, "reel starts at/below the fold").toBeGreaterThanOrEqual(ih - 0.5);
      // Belt-and-suspenders: whatever is painted at viewport centre belongs to the hero.
      const centreOwnedByHero = await page.evaluate(() => {
        const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        const sec = el?.closest('[data-qa="cinematic-section"]');
        const first = document.querySelector('[data-qa="cinematic-section"]');
        return sec !== null && sec === first;
      });
      expect(centreOwnedByHero, "viewport centre is painted by the hero, not the reel").toBe(true);

      // (3) The scroll cue is visible and not clipped by the viewport.
      const cue = page.locator('[data-qa="cinematic-scrollcue"]');
      await expect(cue, "scroll cue visible").toBeVisible();
      const cueRect = await cue.boundingBox();
      expect(cueRect, "scroll cue has a box").not.toBeNull();
      expect(cueRect!.y, "scroll cue top within viewport").toBeGreaterThanOrEqual(0);
      expect(cueRect!.y + cueRect!.height, "scroll cue bottom not clipped").toBeLessThanOrEqual(ih + 0.5);

      await page.screenshot({ path: shot(vp.shotName) });
    });
  });
}
