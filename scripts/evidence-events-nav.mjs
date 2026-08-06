/**
 * EVENTS.NAV.1 (+ FIX) — the evidence pack.
 *
 * /events at Joey's review viewports, both languages, against the LIVE board
 * (his review was of the real birthday card, so the evidence is too).
 *
 * The phones are judged against the room the DEVICE shows, not the room this
 * runner has: headless has no `env(safe-area-inset-top)` pushing the page down
 * and no Safari bar covering the bottom, which is exactly how the first pass
 * shipped a page that measured "in-fold" here and ran off the screen in Joey's
 * hand. `reserve` is that missing chrome, so a shot only counts as evidence if
 * the closing line — and therefore everything above it — lands above it.
 *
 *   471x1017   the size Joey measured his screenshot at (440x956 at 1.07)
 *   440x956    the iPhone 17 Pro Max in CSS px — the physical test device
 *   390x844    the small phone in the budget
 *   1024x1366  iPad portrait — the card upright, poster in the vertical room
 *   1366x1024  iPad landscape — must be UNCHANGED
 *   1920x1080  desktop        — must be UNCHANGED
 *
 * Run against a fresh dev server: node scripts/evidence-events-nav.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.EVIDENCE_BASE ?? "http://localhost:8080";
const OUT = "events-nav-fix-assets";

const VPS = [
  // The dial printed Joey's own window back to him: FOLD 792+0. That row is the
  // device, measured — the 25px reserve only pays for iOS sizing `vh` off its
  // larger (~831px) viewport, which makes the real poster ~20px taller.
  { n: "phone-440x792-joeys-iphone", w: 440, h: 792, reserve: 25 },
  { n: "phone-471x1017", w: 471, h: 1017, reserve: 0 },
  { n: "phone-390x844", w: 390, h: 844, reserve: 0 },
  { n: "tablet-portrait-1024x1366", w: 1024, h: 1366 },
  { n: "tablet-landscape-1366x1024", w: 1366, h: 1024 },
  { n: "desktop-1920x1080", w: 1920, h: 1080 },
];

/** What each viewport must be true of before its shot counts as evidence. */
const phoneContract = (reserve) => (g) => {
  const usable = g.vh - reserve;
  const rowMid = Math.round((g.back.top + g.back.bottom) / 2);
  return (
    // one row: the control's midline inside the heading's own band
    rowMid >= g.title.top &&
    rowMid <= g.title.bottom &&
    g.back.right < g.titleGlyphLeft &&
    // and the whole act — poster entire — inside the room the device shows
    g.poster.bottom <= usable &&
    g.more.bottom <= usable
  );
};

const CONTRACT = {
  "phone-440x792-joeys-iphone": phoneContract(25),
  "phone-471x1017": phoneContract(0),
  "phone-390x844": phoneContract(0),
  "tablet-portrait-1024x1366": (g) => g.card.h > g.card.w,
  "tablet-landscape-1366x1024": (g) => g.card.w === 1024 && g.card.h === 738,
  "desktop-1920x1080": (g) => g.card.w === 1024 && g.card.h === 738,
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const shots = [];

for (const vp of VPS) {
  for (const lang of ["es", "en"]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.addInitScript((l) => {
      try {
        localStorage.setItem("ta_lang", l);
      } catch {
        /* noop */
      }
    }, lang);

    await page.goto(`${BASE}/events`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForSelector('[data-qa="events-back"]', { timeout: 20_000 });
    await page
      .waitForFunction(
        () => {
          const i = document.querySelector('[data-qa="event-card-image"]');
          return !i || (i.complete && i.naturalWidth > 0);
        },
        undefined,
        { timeout: 20_000 },
      )
      .catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(600);

    const g = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          left: Math.round(r.left),
          right: Math.round(r.right),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      };
      const titleEl = document.querySelector('[data-qa="events-title"]');
      const range = document.createRange();
      if (titleEl) range.selectNodeContents(titleEl);
      return {
        vh: window.innerHeight,
        back: box('[data-qa="events-back"]'),
        title: box('[data-qa="events-title"]'),
        titleGlyphLeft: titleEl ? Math.round(range.getBoundingClientRect().left) : 0,
        card: box("article"),
        poster: box('[data-qa="event-card-image"]'),
        more: box('[data-qa="events-more"]'),
      };
    });

    const ok = CONTRACT[vp.n]?.(g) ?? true;
    if (!ok) throw new Error(`${vp.n} ${lang}: contract failed — ${JSON.stringify(g)}`);

    const file = `${OUT}/events-${vp.n}-${lang}.png`;
    await page.screenshot({ path: file });
    shots.push(file);
    const tail = CONTRACT[vp.n] && vp.w < 768
      ? `poster ${g.poster.w}x${g.poster.h} · closing line ${g.more.bottom} of ${g.vh - vp.reserve}`
      : `card ${g.card.w}x${g.card.h}`;
    console.log(`✓ ${file}  ${tail}`);
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${shots.length} shots in ${OUT}/`);
