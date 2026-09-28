/**
 * HOME.DEFAULT.1 — the built site knows its own home variant. Runs at `prebuild`,
 * beside build-sitemap.mjs, reading with the same env (prebuild-env.mjs).
 *
 * Reads site_settings key `home_variant` and writes src/generated/homeVariant.ts,
 * whose BUILT_HOME_VARIANT is what useHomeVariant renders on a cache-less first
 * visit: the right home paints at once instead of a neutral hold waiting on the
 * fetch. The file is checked in, so local dev and CI work without this step.
 *
 * It must never fail a build. No network, no env, a bad answer, no row: it writes
 * "cinematic" (the live variant), prints a warning, and the exit code is 0.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ROOT, readEnv } from "./prebuild-env.mjs";

const OUT = resolve(ROOT, "src/generated/homeVariant.ts");
const FALLBACK = "cinematic";
const VARIANTS = ["editorial", "classic", "cinematic"];
const TIMEOUT_MS = 8000;

const source = (variant) => `// GENERATED FILE — DO NOT EDIT BY HAND.
// Run: node scripts/build-home-variant.mjs (it runs at \`prebuild\`).
//
// HOME.DEFAULT.1 — site_settings.home_variant as it stood when this build was
// made. useHomeVariant renders it on a cache-less first visit, then still
// fetches and subscribes, so an admin flip after the build swaps live.

export const BUILT_HOME_VARIANT: "editorial" | "classic" | "cinematic" = "${variant}";
`;

function write(variant) {
  const next = source(variant);
  let current = null;
  try {
    current = readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
  } catch {
    /* absent — written below */
  }
  if (current === next) {
    console.log(`[build-home-variant] home_variant is "${variant}"; src/generated/homeVariant.ts already current.`);
    return;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, next);
  console.log(`[build-home-variant] home_variant "${variant}" written to src/generated/homeVariant.ts.`);
}

const fail = (msg) => {
  console.warn(`[build-home-variant] WARNING: ${msg} — writing "${FALLBACK}".`);
  write(FALLBACK);
};

async function main() {
  const { url, key } = readEnv();
  if (!url || !key) return fail("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set");

  let rows;
  try {
    const res = await fetch(`${url}/rest/v1/site_settings?select=value&key=eq.home_variant`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return fail(`site_settings answered ${res.status}`);
    rows = await res.json();
  } catch (e) {
    return fail(`could not reach Supabase (${e instanceof Error ? e.message : e})`);
  }
  if (!Array.isArray(rows) || rows.length === 0) return fail("site_settings has no home_variant row");

  const value = rows[0]?.value;
  if (!VARIANTS.includes(value)) return fail(`home_variant is ${JSON.stringify(value)}, not a variant`);
  write(value);
}

main()
  .catch((e) => {
    try {
      fail(`unexpected error (${e instanceof Error ? e.message : e})`);
    } catch (inner) {
      console.warn(`[build-home-variant] WARNING: could not write the fallback (${inner}).`);
    }
  })
  .finally(() => {
    process.exitCode = 0;
  });
