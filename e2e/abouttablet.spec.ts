import { test, expect } from "@playwright/test";
import { forceLanguage } from "./_admin";

/**
 * ABOUT.TABLET.1 — the 768–1199 band stacks the About act (Candidate A,
 * ratified by Joey 7/31): photo-led single column (eyebrow, plate, quote,
 * paras, chips, CTA), plate at the band's height budget (58svh) in the law's
 * shape, capped by the law's 60vw. The two-column editorial split begins at
 * 1200px (ABOUT.VCENTER.1's centred dwell stage).
 */

const settle = async (page: import("@playwright/test").Page) => {
  await page.locator("#cinematic-about").waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(2500);
};

for (const vp of [
  { w: 820, h: 1180 },
  { w: 1024, h: 1366 },
]) {
  test(`band ${vp.w} — the act stacks and the plate is the band's budget in the law's shape`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await forceLanguage(page, "es");
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto("/cinematic", { waitUntil: "domcontentloaded" });
    await settle(page);

    const r = await page.evaluate(() => {
      const grid = document.querySelector("#cinematic-about .cine-about-grid") as HTMLElement;
      const panel = grid?.querySelector(".cine-about-panel") as HTMLElement;
      const quote = grid?.querySelector(".cine-a-quote") as HTMLElement;
      const eyebrow = grid?.querySelector(".cine-a-eyebrow") as HTMLElement;
      if (!grid || !panel || !quote || !eyebrow) return null;
      const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      const aspect = panel.getBoundingClientRect().width / panel.getBoundingClientRect().height;
      return {
        cols,
        panelW: Math.round(panel.getBoundingClientRect().width),
        aspect: Math.round(aspect * 1000) / 1000,
        // Candidate A order: plate between the eyebrow and the quote.
        plateBelowEyebrow: panel.getBoundingClientRect().top >= eyebrow.getBoundingClientRect().bottom,
        plateAboveQuote: panel.getBoundingClientRect().bottom <= quote.getBoundingClientRect().top + 1,
        svh: window.innerHeight,
      };
    });
    expect(r, "About grid + panel must exist (an About photo is configured)").not.toBeNull();
    expect(r!.cols, "band grid is a single column").toBe(1);
    expect(r!.plateBelowEyebrow, "Candidate A: plate under the eyebrow").toBe(true);
    expect(r!.plateAboveQuote, "Candidate A: plate above the quote").toBe(true);
    // Plate box = min(58svh * aspect, 60vw) at the panel's own aspect.
    const expected = Math.min(0.58 * r!.svh * (r!.aspect >= 1 ? 1.5 : 0.563), 0.6 * vp.w);
    expect(Math.abs(r!.panelW - expected), "plate width follows the band budget in the law's shape").toBeLessThan(4);
  });
}

test("1200 — the two-column editorial split attaches at the desktop line", async ({ page }) => {
  test.setTimeout(120_000);
  await forceLanguage(page, "es");
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/cinematic", { waitUntil: "domcontentloaded" });
  await settle(page);
  const cols = await page.evaluate(() => {
    const grid = document.querySelector("#cinematic-about .cine-about-grid") as HTMLElement;
    return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  });
  expect(cols, "two named columns from 1200px").toBe(2);
});
