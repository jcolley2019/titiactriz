import { test, expect } from "@playwright/test";
import { forceLanguage } from "./_admin";

/**
 * ABOUT.TABLET.1/2 — the 768–1199 band stacks the About act (Candidate A,
 * ratified by Joey 7/31): photo-led single column (eyebrow, plate, quote,
 * paras, chips, CTA). ABOUT.TABLET.2 (same evening): the plate goes WIDE —
 * the law's landscape shape at the full stack width, the stack uncapped so it
 * fills the screen inside px-6. The two-column editorial split begins at
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
  test(`band ${vp.w} — the act stacks and the wide plate fills the screen`, async ({
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
        gridW: Math.round(grid.getBoundingClientRect().width),
        panelW: Math.round(panel.getBoundingClientRect().width),
        aspect: Math.round(aspect * 1000) / 1000,
        // Candidate A order: plate between the eyebrow and the quote.
        plateBelowEyebrow: panel.getBoundingClientRect().top >= eyebrow.getBoundingClientRect().bottom,
        plateAboveQuote: panel.getBoundingClientRect().bottom <= quote.getBoundingClientRect().top + 1,
      };
    });
    expect(r, "About grid + panel must exist (an About photo is configured)").not.toBeNull();
    expect(r!.cols, "band grid is a single column").toBe(1);
    expect(r!.plateBelowEyebrow, "Candidate A: plate under the eyebrow").toBe(true);
    expect(r!.plateAboveQuote, "Candidate A: plate above the quote").toBe(true);
    // ABOUT.TABLET.2 — the plate fills the stack (which fills the screen inside
    // px-6) at the law's landscape shape.
    expect(r!.gridW, "the stack fills the screen inside px-6").toBe(vp.w - 48);
    expect(r!.panelW, "the plate spans the full stack").toBe(r!.gridW);
    expect(Math.abs(r!.aspect - 1.5), "the plate paints the law's landscape shape").toBeLessThan(0.02);

    // ABOUT.TABLET.3 — the text column is centred on the page: symmetric
    // margins and one shared left edge for quote and paragraphs.
    const c = await page.evaluate(() => {
      const q = document.querySelector("#cinematic-about .cine-a-quote")!.getBoundingClientRect();
      const p = document.querySelector("#cinematic-about .cine-a-paras")!.getBoundingClientRect();
      return {
        quoteLeft: q.left,
        parasLeft: p.left,
        parasRightGap: window.innerWidth - p.right,
      };
    });
    expect(Math.abs(c.quoteLeft - c.parasLeft), "quote and paragraphs share a left edge").toBeLessThan(1);
    expect(
      Math.abs(c.parasLeft - c.parasRightGap),
      "the text column's page margins are symmetric",
    ).toBeLessThan(2);
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
