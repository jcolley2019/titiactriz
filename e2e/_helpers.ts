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
export function attachDiagnostics(page: Page): Diagnostics {
  const diag: Diagnostics = { consoleErrors: [], failedResponses: [] };

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
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
      diag.failedResponses.push(`${status} ${url}`);
    }
  });

  page.on("requestfailed", (req) => {
    const url = req.url();
    if (/favicon|@vite|@react-refresh|\.map$/i.test(url)) return;
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
