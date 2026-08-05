import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

/** Screenshots go here; the whole folder is gitignored. */
export const QA_DIR = path.resolve(process.cwd(), "_qa");
/** Brick label for screenshot names, e.g. TA_BRICK=1 → "TA.1-desktop.png". */
export const BRICK = process.env.TA_BRICK ?? "x";

export function ensureQaDir() {
  fs.mkdirSync(QA_DIR, { recursive: true });
}

export function shot(name: string) {
  ensureQaDir();
  return path.join(QA_DIR, name);
}

export type Diagnostics = {
  consoleErrors: string[];
  failedResponses: string[];
};

/**
 * Wire console / pageerror / network listeners onto a page and collect
 * anything that would fail the gate. Vite HMR and sourcemap chatter is
 * filtered so only real application problems surface.
 */
/**
 * FIX.BANNER.SPEC.1 — the WebEdit connector is not the app.
 *
 * WEBEDIT.VISION.1a injects `http://localhost:5199/webedit-connect.js` into the
 * dev HTML, and ONLY the dev HTML: the plugin is `apply: "serve"`, nothing in
 * `src/` imports it, and a clean `vite build` leaves zero traces of "webedit" or
 * "5199" anywhere in dist. So when the design tool happens not to be running,
 * the browser logs a resource failure that the shipped site is structurally
 * incapable of emitting — and it does so on EVERY page load, which took 22
 * specs red in a battery run purely because a tool on another port had exited.
 *
 * The gate exists to catch what the site does wrong. It may not be hostage to
 * whether a separate program is up, so the connector is filtered by ORIGIN.
 * Matching the message text alone would not work: a failed subresource logs the
 * bare string "Failed to load resource: net::ERR_CONNECTION_REFUSED" and carries
 * the URL only in its location.
 */
const WEBEDIT_CONNECTOR = /localhost:5199|webedit-connect/i;

export function attachDiagnostics(page: Page): Diagnostics {
  const diag: Diagnostics = { consoleErrors: [], failedResponses: [] };

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (WEBEDIT_CONNECTOR.test(text) || WEBEDIT_CONNECTOR.test(msg.location()?.url ?? "")) return;
    if (/\[vite\]|sourcemap|Download the React DevTools/i.test(text)) return;
    // Pre-existing on main (React 18.3 doesn't map the camelCase `fetchPriority`
    // DOM attribute): emitted by the untouched editorial home / ParallaxImage,
    // NOT by this additive sprint. Filtered so the regression gate flags only
    // NEW problems. The cinematic page itself emits none of these.
    if (/fetchPriority/i.test(text)) return;
    diag.consoleErrors.push(text);
  });

  page.on("pageerror", (err) => {
    diag.consoleErrors.push(`pageerror: ${err.message}`);
  });

  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400) {
      const url = res.url();
      // Ignore favicon and Vite dev noise; everything else counts.
      if (/favicon|@vite|@react-refresh|\.map$/i.test(url)) return;
      if (WEBEDIT_CONNECTOR.test(url)) return; // dev-only bridge — see above
      diag.failedResponses.push(`${status} ${url}`);
    }
  });

  page.on("requestfailed", (req) => {
    const url = req.url();
    if (/favicon|@vite|@react-refresh|\.map$/i.test(url)) return;
    if (WEBEDIT_CONNECTOR.test(url)) return; // dev-only bridge — see above
    // net::ERR_ABORTED is normal for cancelled prefetches; skip it.
    const failure = req.failure()?.errorText ?? "";
    if (/ERR_ABORTED/i.test(failure)) return;
    diag.failedResponses.push(`requestfailed ${failure} ${url}`);
  });

  return diag;
}

/**
 * Scroll a page from top to bottom in wheel steps (Lenis-friendly), pausing
 * so scroll-driven animations settle, and screenshot at each major step.
 */
export async function scrollThrough(page: Page, namePrefix: string, steps = 8) {
  const height = page.viewportSize()?.height ?? 900;
  await page.mouse.move(200, 300);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, Math.round(height * 0.9));
    await page.waitForTimeout(450);
    await page.screenshot({ path: shot(`${namePrefix}-scroll-${i + 1}.png`) });
  }
}
