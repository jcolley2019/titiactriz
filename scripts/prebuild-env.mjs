/**
 * The Supabase URL and anon key the prebuild steps read with — the same pair the
 * browser client uses (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY), from
 * the environment or the .env files Vite would read. Shared by build-sitemap.mjs
 * and build-home-variant.mjs so both steps see exactly the same backend.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Vite's precedence, lowest first: .env, .env.local, .env.production, .env.production.local. */
export function readEnv() {
  const env = {};
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    const file = resolve(ROOT, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return {
    url: process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL,
    key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}
