import { defineConfig } from "@playwright/test";

/**
 * TA.7e — PRODUCTION-bundle first-paint harness.
 *
 * Separate from playwright.config.ts (which boots `npm run dev`). This one serves
 * the real built bundle from dist/ via `vite preview`, because the footer flash
 * only reproduces against production chunk/CSS timing (in dev, Vite injects CSS
 * through JS so there is no stylesheet-load gap). Build first: `npm run build`.
 *
 * Pinned to :4178 (strictPort) so the spec's absolute URLs are stable. Playwright
 * owns the preview server's lifecycle; reuseExistingServer keeps a manually
 * started one alive for fast iteration.
 */
const PORT = process.env.PROD_PORT ?? "4178";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e-prod",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "off",
    video: "off",
  },
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
