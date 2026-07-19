import { test, expect } from "@playwright/test";
import type { Page, CDPSession } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * TA.7e — PRODUCTION first-paint footer-flash gate.
 *
 * Runs against the real built bundle (vite preview, see playwright.prod.config.ts).
 * Two independent detectors run per animation frame for the first 3s of load:
 *
 *   (A) STACKING leak — footer sits in the viewport AND is the top-most element
 *       there (hold absent, or footer painted over the hold). This is the TA.7d
 *       class of bug (z-index).
 *   (B) VISUAL leak (production-specific) — footer sits in the viewport while the
 *       neutral hold's *computed* background is transparent. In the prod bundle
 *       the module script is emitted before the stylesheet <link>, so React can
 *       mount and paint before app CSS applies; the hold keeps its inline
 *       position/inset/z-index but `hsl(var(--background))` resolves to nothing →
 *       a see-through cover the footer shows straight through. A hit-test misses
 *       this (the transparent hold is still top-most for elementFromPoint), so we
 *       detect it by probing the hold's computed background-color directly.
 *
 * A frame is "footer-visible" if EITHER detector fires. The gate: zero such
 * frames, at desktop and mobile, on a fresh visit, a cached repeat visit, and a
 * reload after scrolling mid-page. A CDP screencast records the actual painted
 * frames so the offending frame and a 3s contact sheet are saved to _qa/.
 */

const QA_DIR = path.resolve(process.cwd(), "_qa");
function qa(name: string) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  return path.join(QA_DIR, name);
}

type Sample = {
  t: number; // ms since the in-page sampler armed
  root: number; // #root child count (0 = pre-React)
  hold: boolean; // [data-qa=home-hold] present
  cine: boolean; // [data-qa=home-cinematic] present
  holdBg: string | null; // computed background-color of the hold, if present
  cssApplied: boolean; // is the app stylesheet applied yet?
  footerIn: boolean; // footer rect intersects the viewport
  footerTop: number | null;
  hitTag: string | null; // what elementFromPoint returns at the footer's top-centre
  stackingLeak: boolean; // (A) footer is top-most in the viewport
  visualLeak: boolean; // (B) footer in viewport while the hold is see-through
};

/** Installed before any page script: samples both detectors every rAF for `windowMs`. */
function armSampler(page: Page, windowMs: number) {
  return page.addInitScript((win) => {
    const w = window as unknown as { __fp: unknown[] };
    w.__fp = [];
    const arr = w.__fp;
    const start = performance.now();

    const isTransparent = (c: string) =>
      c === "transparent" || c === "rgba(0, 0, 0, 0)" || c === "";

    const sample = () => {
      const t = Math.round(performance.now() - start);
      const rootEl = document.getElementById("root");
      const root = rootEl ? rootEl.childElementCount : 0;
      const holdEl = document.querySelector('[data-qa="home-hold"]') as HTMLElement | null;
      const cine = !!document.querySelector('[data-qa="home-cinematic"]');
      const holdBg = holdEl ? getComputedStyle(holdEl).backgroundColor : null;

      // Is the app CSS applied? The app shell uses Tailwind `min-h-screen`; before
      // the stylesheet loads its computed min-height is `auto`/0. (Robust even when
      // no hold is mounted.)
      const shell = document.querySelector(".min-h-screen") as HTMLElement | null;
      const shellMin = shell ? getComputedStyle(shell).minHeight : null;
      const cssApplied =
        (!!holdEl && !isTransparent(holdBg || "")) ||
        (!!shellMin && shellMin !== "auto" && shellMin !== "0px");

      const f = document.querySelector("footer");
      const ih = window.innerHeight;
      let footerIn = false;
      let footerTop: number | null = null;
      let hitTag: string | null = null;
      let stackingLeak = false;
      let visualLeak = false;

      if (f) {
        const r = f.getBoundingClientRect();
        footerTop = Math.round(r.top);
        footerIn = r.height > 0 && r.bottom > 0 && r.top < ih;
        if (footerIn) {
          const x = Math.round(Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1));
          const y = Math.round(Math.min(Math.max(r.top + 2, 1), ih - 1));
          const hit = document.elementFromPoint(x, y) as HTMLElement | null;
          hitTag = hit
            ? hit.tagName + (hit.getAttribute("data-qa") ? "." + hit.getAttribute("data-qa") : "")
            : null;

          const boot = document.getElementById("ta-boot-cover");
          const hitIsFooter = !!hit && (hit === f || f.contains(hit));
          const hitIsHold = !!holdEl && !!hit && (hit === holdEl || holdEl.contains(hit));
          const holdOpaque = !!holdEl && !isTransparent(holdBg || "");

          // (A) STACKING leak — the footer itself is the painted top-most element
          //     at its own location (no cover above it, or a cover painted below).
          stackingLeak = hitIsFooter;
          // (B) VISUAL leak — a see-through hold sits on top (hit-test topmost) but
          //     the footer shows straight through it, and no opaque boot cover is
          //     above. Detected via the hold's computed background, since a hit-test
          //     alone cannot see transparency. Suppressed while the app CSS has not
          //     applied only if there is genuinely nothing opaque covering (no boot).
          visualLeak = !boot && hitIsHold && !holdOpaque;
        }
      }

      arr.push({
        t, root, hold: !!holdEl, cine, holdBg, cssApplied,
        footerIn, footerTop, hitTag, stackingLeak, visualLeak,
      });
      if (performance.now() - start < (win as number)) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, windowMs);
}

async function throttle(page: Page): Promise<CDPSession> {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.5 * 1024 * 1024) / 8, // Fast-3G-ish
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });
  return client;
}

type Frame = { seq: number; tMs: number; data: string };

/** Start a CDP screencast; returns the frame buffer + a stop() fn. */
async function startScreencast(client: CDPSession, t0: number) {
  const frames: Frame[] = [];
  client.on("Page.screencastFrame", async (evt: { data: string; sessionId: number }) => {
    frames.push({ seq: frames.length, tMs: Date.now() - t0, data: evt.data });
    try {
      await client.send("Page.screencastFrameAck", { sessionId: evt.sessionId });
    } catch {
      /* session may be tearing down */
    }
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 1 });
  return {
    frames,
    stop: async () => {
      try {
        await client.send("Page.stopScreencast");
      } catch {
        /* noop */
      }
    },
  };
}

/** Compose captured frames into a labelled contact-sheet PNG via a scratch page. */
async function writeContactSheet(page: Page, frames: Frame[], flaggedTimes: number[], out: string) {
  // Cap to ~48 evenly-spaced frames so the sheet stays legible.
  const MAX = 48;
  const step = Math.max(1, Math.ceil(frames.length / MAX));
  const picked = frames.filter((_, i) => i % step === 0);
  const near = (t: number) => flaggedTimes.some((ft) => Math.abs(ft - t) < 120);
  const cells = picked
    .map((f) => {
      const flag = near(f.tMs);
      return `<figure class="${flag ? "flag" : ""}">
        <img src="data:image/jpeg;base64,${f.data}" />
        <figcaption>${f.tMs}ms${flag ? " ⚠" : ""}</figcaption>
      </figure>`;
    })
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#222;font-family:monospace}
    .grid{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:8px}
    figure{margin:0;background:#111}
    figure.flag{outline:4px solid #ff3b3b}
    img{display:block;width:100%;height:auto}
    figcaption{color:#ddd;font-size:12px;padding:2px 4px}
    figure.flag figcaption{color:#ff8a8a;font-weight:bold}
  </style></head><body><div class="grid">${cells}</div></body></html>`;
  const tmp = qa("_contact.html");
  fs.writeFileSync(tmp, html);
  const sheet = await page.context().newPage();
  await sheet.setViewportSize({ width: 1500, height: 1000 });
  await sheet.goto("file://" + tmp.replace(/\\/g, "/"));
  await sheet.waitForTimeout(300);
  await sheet.screenshot({ path: out, fullPage: true });
  await sheet.close();
  fs.rmSync(tmp, { force: true });
}

type RunResult = { samples: Sample[]; leaks: Sample[] };

const WINDOW_MS = 9000;
/**
 * Deterministic FOUC: the module script is emitted BEFORE the stylesheet <link>,
 * so a stylesheet that arrives even slightly after the script executes leaves a
 * window where React has painted but no app CSS applies. On a fast CDN this race
 * is a coin-flip (the user lost it → footer flash). We force the worst case by
 * holding the app stylesheet back this long so the window is always present.
 */
const CSS_DELAY_MS = 1800;

async function runScenario(
  page: Page,
  opts: { seedVariant?: string; midScroll?: boolean; label: string },
): Promise<RunResult> {
  const client = await throttle(page);

  // Delay the app stylesheet to make the JS-before-CSS paint window deterministic.
  await page.route(/\/assets\/.*\.css(\?.*)?$/, async (route) => {
    await new Promise((r) => setTimeout(r, CSS_DELAY_MS));
    await route.continue();
  });

  if (opts.seedVariant) {
    // Cached repeat-visit: prime the variant cache exactly as a returning
    // visitor's browser would, so the render takes the cinematic Suspense path
    // deterministically (independent of the throttled live fetch).
    await page.addInitScript((v) => {
      try {
        localStorage.setItem("ta_home_variant", v as string);
      } catch {
        /* noop */
      }
    }, opts.seedVariant);
  }

  if (opts.midScroll) {
    // Establish a scrolled-mid-page state, then reload and measure that reload.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page
      .locator('[data-qa="home-cinematic"]')
      .waitFor({ state: "attached", timeout: 40_000 })
      .catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.5)));
    await page.waitForTimeout(300);
  }

  await armSampler(page, WINDOW_MS);
  const t0 = Date.now();
  const cast = await startScreencast(client, t0);

  const nav = opts.midScroll
    ? page.reload({ waitUntil: "domcontentloaded" })
    : page.goto("/", { waitUntil: "domcontentloaded" });
  await nav;
  await page.waitForTimeout(WINDOW_MS + 200);
  await cast.stop();

  const samples = (await page.evaluate(() => (window as unknown as { __fp: Sample[] }).__fp)) ?? [];
  const leaks = samples.filter((s) => s.stackingLeak || s.visualLeak);
  const flaggedTimes = leaks.map((s) => s.t);

  // Persist evidence.
  await writeContactSheet(page, cast.frames, flaggedTimes, qa(`TA.7e-framestrip-${opts.label}.png`));
  if (leaks.length) {
    const firstLeak = leaks[0].t;
    const offending = cast.frames.reduce((best, f) =>
      Math.abs(f.tMs - firstLeak) < Math.abs(best.tMs - firstLeak) ? f : best,
    );
    fs.writeFileSync(qa(`TA.7e-offending-frame-${opts.label}.png`), Buffer.from(offending.data, "base64"));
  }
  fs.writeFileSync(
    qa(`TA.7e-samples-${opts.label}.json`),
    JSON.stringify({ label: opts.label, frames: cast.frames.length, leaks, samples }, null, 2),
  );

  // Console summary for the diagnosis.
  const holdBgs = [...new Set(samples.map((s) => s.holdBg).filter(Boolean))];
  const cssAt = samples.find((s) => s.cssApplied)?.t ?? null;
  // eslint-disable-next-line no-console
  console.log(
    `[${opts.label}] frames=${cast.frames.length} samples=${samples.length} ` +
      `leaks=${leaks.length} (stacking=${leaks.filter((l) => l.stackingLeak).length} ` +
      `visual=${leaks.filter((l) => l.visualLeak).length}) cssAppliedAt=${cssAt}ms ` +
      `holdBgs=${JSON.stringify(holdBgs)} ` +
      (leaks.length ? `firstLeak@${leaks[0].t}ms ${JSON.stringify(leaks[0])}` : ""),
  );

  return { samples, leaks };
}

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

for (const vp of [
  { size: DESKTOP, tag: "desktop" },
  { size: MOBILE, tag: "mobile" },
]) {
  test.describe(`TA.7e prod first-paint — ${vp.tag}`, () => {
    test.use({ viewport: vp.size });

    test("fresh visit shows no footer frame", async ({ page }) => {
      const { leaks } = await runScenario(page, { label: `${vp.tag}-fresh` });
      expect(leaks, `footer visible in ${leaks.length} frame(s): ${JSON.stringify(leaks.slice(0, 3))}`).toEqual([]);
    });

    test("cached repeat visit (cinematic) shows no footer frame", async ({ page }) => {
      const { leaks } = await runScenario(page, { seedVariant: "cinematic", label: `${vp.tag}-cached` });
      expect(leaks, `footer visible in ${leaks.length} frame(s): ${JSON.stringify(leaks.slice(0, 3))}`).toEqual([]);
    });

    test("reload after scrolling mid-page shows no footer frame", async ({ page }) => {
      const { leaks } = await runScenario(page, {
        seedVariant: "cinematic",
        midScroll: true,
        label: `${vp.tag}-reload`,
      });
      expect(leaks, `footer visible in ${leaks.length} frame(s): ${JSON.stringify(leaks.slice(0, 3))}`).toEqual([]);
    });
  });
}

/**
 * TA.7e — the static boot cover (index.html) must (1) cover the document's very
 * first paint, (2) remove itself promptly on a normal load, and (3) never brick
 * the page: if the app never signals readiness, the 4s safety timeout still lifts
 * it and the page stays interactive underneath.
 */
test.describe("TA.7e — boot cover lifecycle (desktop 1440×900)", () => {
  test.use({ viewport: DESKTOP });

  test("covers the document's first paint (no white / unstyled flash)", async ({ page }) => {
    const client = await throttle(page); // widen the pre-CSS window
    await page.route(/\/assets\/.*\.css(\?.*)?$/, async (route) => {
      await new Promise((r) => setTimeout(r, CSS_DELAY_MS));
      await route.continue();
    });
    void client;
    // From the first committed frame of the real document, the top-most element at
    // the viewport centre is the opaque charcoal cover — never a bare white page.
    await page.goto("/", { waitUntil: "commit" });
    for (let i = 0; i < 12; i++) {
      const probe = await page.evaluate(() => {
        const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) as HTMLElement | null;
        const cover = document.getElementById("ta-boot-cover");
        return {
          coverPresent: !!cover,
          coverBg: cover ? getComputedStyle(cover).backgroundColor : null,
          topId: el?.id ?? null,
          topIsCoverOrChildOfRoot: el ? el.id === "ta-boot-cover" || !!el.closest("#root") : false,
        };
      });
      // While the cover is up it must be what's painted at centre, and opaque.
      if (probe.coverPresent) {
        expect(probe.topId, "boot cover is the painted top layer while present").toBe("ta-boot-cover");
        expect(probe.coverBg, "boot cover is opaque charcoal").toBe("rgb(18, 18, 18)");
      }
      await page.waitForTimeout(120);
    }
  });

  test("removes itself within 5s on a normal load; page is interactive", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#ta-boot-cover"), "cover gone within 5s").toHaveCount(0, { timeout: 5000 });
    // App mounted and reachable.
    expect(await page.evaluate(() => document.getElementById("root")?.childElementCount ?? 0)).toBeGreaterThan(0);
    await expect(page.locator("header").first(), "site chrome is interactive").toBeVisible();
  });

  test("safety timeout lifts the cover even if readiness never signals", async ({ page }) => {
    // Abort the app stylesheet so the `--background` readiness probe never resolves:
    // the normal removal path can never fire, exercising the 4s safety net alone.
    await page.route(/\/assets\/.*\.css(\?.*)?$/, (route) => route.abort());

    await page.goto("/", { waitUntil: "domcontentloaded" });
    // It really was up at first (so the safety net is what removed it).
    const seenUp = await page
      .locator("#ta-boot-cover")
      .waitFor({ state: "attached", timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    // The safety timeout (4s) removes it despite readiness never being signalled.
    await expect(page.locator("#ta-boot-cover"), "safety net removed the cover").toHaveCount(0, {
      timeout: 6000,
    });
    // React still mounted (JS was not blocked) → the page is interactive underneath.
    expect(await page.evaluate(() => document.getElementById("root")?.childElementCount ?? 0)).toBeGreaterThan(0);
    const centreReachesApp = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) as HTMLElement | null;
      return !!el && el.id !== "ta-boot-cover";
    });
    expect(centreReachesApp, "pointer events reach the app, not a stuck cover").toBe(true);
    // eslint-disable-next-line no-console
    console.log(`[boot-cover] safety-net path: seenUp=${seenUp}`);
  });
});
