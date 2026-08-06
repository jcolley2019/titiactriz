/**
 * MARQUEE.1 — the evidence pack.
 *
 * Shoots the three defects' states against the LIVE board (no mock — Joey's
 * review was of the real birthday banner, so the evidence is too):
 *
 *   landing   — the nav band, whole, with no seam across the links
 *   scrolled  — the header on its own ground, banner hairlines still boxed
 *   navstrip  — the top 130px alone, where the seam used to fall
 *
 * at 1440 / 768 / 390, in both languages. Run against a FRESH dev server:
 *   node scripts/evidence-marquee.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.EVIDENCE_BASE ?? "http://localhost:8080";
const OUT = "marquee-assets";

const VIEWPORTS = [
  { w: 1440, h: 900 },
  { w: 768, h: 1024 },
  { w: 390, h: 844 },
];
const LANGS = ["es", "en"];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const shots = [];

for (const { w, h } of VIEWPORTS) {
  for (const lang of LANGS) {
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
    await page.addInitScript((l) => {
      try {
        localStorage.setItem("ta_lang", l);
      } catch {
        /* noop */
      }
    }, lang);

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForSelector('[data-qa="events-banner"]', { timeout: 20_000 });
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(900);

    // The geometry every shot is supposed to show, asserted before shooting so
    // a green pack cannot hide a regression.
    const geo = await page.evaluate(() => {
      const head = document.querySelector("header").getBoundingClientRect();
      const bar = document.querySelector('[data-qa="events-banner"]').getBoundingClientRect();
      const ground = document.querySelector('[data-qa="events-banner-navground"]');
      return {
        flush: Math.abs(bar.top - head.bottom) < 0.6,
        grounded: !!ground && ground.getBoundingClientRect().height >= head.height - 0.5,
      };
    });
    if (!geo.flush || !geo.grounded) {
      throw new Error(`${w}x${h} ${lang}: chrome geometry wrong (${JSON.stringify(geo)})`);
    }

    const landing = `${OUT}/marquee-landing-${w}x${h}-${lang}.png`;
    await page.screenshot({ path: landing });
    shots.push(landing);

    const strip = `${OUT}/marquee-navstrip-${w}x${h}-${lang}.png`;
    await page.screenshot({ path: strip, clip: { x: 0, y: 0, width: w, height: 130 } });
    shots.push(strip);

    // Scrolled: the header takes its own ground, and the bar must keep BOTH
    // hairlines — the state defect (2) was reported in.
    await page.evaluate(() =>
      window.scrollTo({ top: window.innerHeight * 1.4, behavior: "instant" }),
    );
    await page.waitForTimeout(1100);
    const scrolled = `${OUT}/marquee-scrolled-${w}x${h}-${lang}.png`;
    await page.screenshot({ path: scrolled });
    shots.push(scrolled);

    const scrolledStrip = `${OUT}/marquee-scrolled-navstrip-${w}x${h}-${lang}.png`;
    await page.screenshot({ path: scrolledStrip, clip: { x: 0, y: 0, width: w, height: 130 } });
    shots.push(scrolledStrip);

    await context.close();
    console.log(`✓ ${w}x${h} ${lang}`);
  }
}

await browser.close();
console.log(`\n${shots.length} shots in ${OUT}/`);
