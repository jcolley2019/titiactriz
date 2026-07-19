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

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
