/**
 * EVENTS.2 — the bake-off evidence pack.
 *
 * Captures every room × viewport × language of the Events act, LIT via the
 * DEV-only `?events=` preview switch, against the LIVE board — so the real
 * birthday card and its real poster are in frame, in the act's real position
 * (below the hero, above act 01), settled mid-dwell.
 *
 * 3 rooms (A Proscenio, B Cartelera, C Función) × 4 viewports (390, 768,
 * 1280, 1920) × 2 languages (es, en) = 24 shots, named predictably:
 *
 *   events-bakeoff-assets/room{A|B|C}-{w}x{h}-{es|en}.png
 *
 * Run with a FRESH dev server (law 3) at localhost:8080:
 *   node scripts/evidence-events-bakeoff.mjs
 *
 * No flag is flipped anywhere: the preview switch exists only in DEV builds,
 * and this script only reads the page.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.EVIDENCE_BASE ?? "http://localhost:8080";
const OUT = "events-bakeoff-assets";

const ROOMS = ["A", "B", "C"];
const LANGS = ["es", "en"];
const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1280, h: 800 },
  { w: 1920, h: 1080 },
];

const DWELL_FRACTION = 0.6; // mid-dwell: entrance long since complete, pin held

/** Lenis owns the wheel — aim by wheeling, read observed state only. */
async function wheelTo(page, y) {
  await page.mouse.move(200, 300);
  for (let i = 0; i < 300; i++) {
    const at = await page.evaluate(() => window.scrollY);
    const d = y - at;
    if (Math.abs(d) < 8) break;
    await page.mouse.wheel(0, Math.max(-700, Math.min(700, Math.round(d))));
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(500);
}

async function capture(browser, { room, lang, w, h }) {
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await context.newPage();
  await page.addInitScript((l) => {
    try {
      localStorage.setItem("ta_lang", l);
    } catch {
      /* noop */
    }
  }, lang);

  await page.goto(`${BASE}/cinematic?events=${room}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('[data-qa="events-stage"]', { timeout: 20_000 }).catch(() => null);

  const lit = await page.locator('[data-qa="events-stage"]').count();
  if (!lit) {
    throw new Error(
      `room ${room} ${w}x${h} ${lang}: the act did not light — the LIVE events_board has no cards, ` +
        `its "Mostrar eventos en portada" toggle is off (EVENTS.2b: the preview honors the real ` +
        `board conditions), or the dev server is not the DEV build.`,
    );
  }

  // The real poster must be decoded before the shot counts as evidence.
  await page
    .waitForFunction(
      () => {
        const imgs = Array.from(document.querySelectorAll('[data-qa="event-card-image"]'));
        return imgs.every((img) => img.complete && img.naturalWidth > 0);
      },
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => console.warn(`  (poster still loading after 20s — shooting anyway)`));
  await page.evaluate(() => document.fonts?.ready).catch(() => {});

  // Aim mid-dwell: the pin-spacer's absolute top plus a fraction of the dwell.
  // Late refreshes (poster decode) can move pin starts between aims, so
  // re-measure and re-aim until the OBSERVED state is the pinned frame.
  const dwell = 1.2 * h;
  const spacerTopNow = () =>
    page.evaluate(() => {
      const stage = document.querySelector('[data-qa="events-stage"]');
      if (!stage) return Number.NaN;
      const spacer = Array.from(document.querySelectorAll(".pin-spacer")).find((sp) =>
        sp.contains(stage),
      );
      return (spacer ?? stage).getBoundingClientRect().top + window.scrollY;
    });
  const stageTop = () =>
    page.locator('[data-qa="events-stage"]').evaluate((el) => el.getBoundingClientRect().top);

  let top = Number.NaN;
  for (let attempt = 0; attempt < 4; attempt++) {
    await wheelTo(page, (await spacerTopNow()) + DWELL_FRACTION * dwell);
    top = await stageTop();
    if (Math.abs(top) <= 4) break;
  }
  if (Math.abs(top) > 4) {
    throw new Error(`stage top ${Math.round(top)}px after 4 aims — the shot would not show the pinned frame`);
  }

  const file = `${OUT}/room${room}-${w}x${h}-${lang}.png`;
  await page.screenshot({ path: file });
  await context.close();
  return file;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const files = [];
let failed = 0;
for (const room of ROOMS) {
  for (const { w, h } of VIEWPORTS) {
    for (const lang of LANGS) {
      const label = `room${room}-${w}x${h}-${lang}`;
      try {
        const file = await capture(browser, { room, lang, w, h });
        files.push(file);
        console.log(`✓ ${file}`);
      } catch (e) {
        failed++;
        console.error(`✗ ${label}: ${e.message}`);
      }
    }
  }
}
await browser.close();
console.log(`\n${files.length} / ${ROOMS.length * VIEWPORTS.length * LANGS.length} shots captured.`);
if (failed) process.exit(1);
