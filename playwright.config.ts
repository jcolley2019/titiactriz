import { defineConfig } from "@playwright/test";

/**
 * QA harness for the cinematic home page (TA.SPRINT.1).
 * Boots the Vite dev server (port 8080 — see vite.config.ts) and runs the
 * self-verification specs in e2e/. Screenshots land in _qa/ (gitignored).
 *
 * reuseExistingServer keeps an already-running `npm run dev` alive instead of
 * spawning a second one, so repeated per-brick runs are fast. Set QA_PORT to
 * point at a dev server that landed on a fallback port (Vite bumps to 8081/8082
 * when 8080 is taken).
 */
const PORT = process.env.QA_PORT ?? "8080";
const BASE_URL = `http://localhost:${PORT}`;

/**
 * FIX.CI.1 — CI runs the same battery, sharded eight ways (see ci.yml). Only
 * three knobs differ from a local run, and all three are gated on process.env.CI
 * so a session on Joey's machine behaves exactly as it did before:
 *
 *  - retries: the battery has a documented flake floor of ~1-2 per full run
 *    (timing-sensitive scroll/dwell specs). With zero retries CI would be red on
 *    clean code, which trains everyone to ignore it. Two retries mean a red CI
 *    is a real regression.
 *  - trace: kept off locally (it is pure overhead when the screen is right
 *    there); captured in CI on the first retry, because a failed shard is the
 *    only evidence available after the runner is destroyed. It is deliberately
 *    on-first-retry and NOT retain-on-failure: tracing every attempt slows the
 *    page enough to change timing, and it demonstrably does. The proof was
 *    admin-media.spec.ts's hero-video rejection test: under retain-on-failure
 *    it failed on a strict-mode violation, because the toast's aria-live
 *    announcer had time to fill before the assertion ran, so
 *    getByText(/too large/i) matched both the toast body and the announcer.
 *    FIX.CI.1b fixed that locator — it now scopes to the toast <li>, so the
 *    spec passes under either trace setting. The timing effect that exposed it
 *    is unchanged, though, so the trace choice stands on its own: tracing every
 *    attempt would still slow every test, and can still surface timing-only
 *    failures elsewhere. on-first-retry costs nothing on the ~99% of tests that
 *    pass, and a genuine failure still fails its retries — traced.
 *  - reuseExistingServer: locally it keeps an already-running `npm run dev`
 *    alive so per-brick runs are fast. In CI nothing is running, and silently
 *    adopting a stray server would be a lie about what was tested.
 *
 * workers stays at 1 even in CI: parallelism comes from separate shard runners,
 * never from contended CPU on one box, which is what the animation specs cannot
 * survive.
 */
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: CI ? 2 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: CI ? "on-first-retry" : "off",
    video: "off",
  },
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },

  /**
   * EVENTS.SNAP.2 — the phone snap laws run on WEBKIT, everything else on Chromium.
   *
   * Chromium emulation is not iOS. It passed the /events snap laws while the phone
   * failed the gate in Joey's hand, which disqualifies it as evidence for anything
   * that depends on how mobile Safari actually scrolls: scroll-snap strictness,
   * momentum resting, and the svh/lvh arithmetic behind a screen-tall cell. Those
   * laws live in events-snap-phone.spec.ts and run in a real WebKit at Joey's
   * measured device truth — a 440x792 window, not the 390x844 the emulator offers
   * and not the 956 the spec sheet claims.
   *
   * Everything else stays exactly where it was: same browser, same viewports, so
   * the rest of the battery is unchanged and comparable to previous runs.
   */
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
      testIgnore: /events-snap-phone\.spec\.ts/,
    },
    {
      name: "webkit-iphone",
      testMatch: /events-snap-phone\.spec\.ts/,
      use: {
        browserName: "webkit",
        viewport: { width: 440, height: 792 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      },
    },
  ],
});
