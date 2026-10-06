/**
 * HOME.DEFAULT.1 — the built site knows its own home variant. Runs at `prebuild`,
 * beside build-sitemap.mjs, reading with the same env (prebuild-env.mjs).
 *
 * Reads site_settings key `home_variant` and writes src/generated/homeVariant.ts,
 * whose BUILT_HOME_VARIANT is what useHomeVariant renders on a cache-less first
 * visit: the right home paints at once instead of a neutral hold waiting on the
 * fetch. The file is checked in, so local dev and CI work without this step.
 *
 * SITE.THEME.1 — the same for `site_theme`: src/generated/siteTheme.ts carries
 * BUILT_SITE_THEME (dark | light | auto), which the site theme renders on a
 * cache-less first visit. One request reads both keys. An absent `site_theme`
 * row is the normal state (nobody has flipped it yet), so it writes "dark"
 * quietly; only a bad value or a failed read warns.
 *
 * It must never fail a build. No network, no env, a bad answer, no row: it writes
 * "cinematic" (the live variant) and "dark", prints a warning, and the exit code
 * is 0.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ROOT, readEnv } from "./prebuild-env.mjs";

const TIMEOUT_MS = 8000;

const HOME = {
  key: "home_variant",
  tag: "build-home-variant",
  out: resolve(ROOT, "src/generated/homeVariant.ts"),
  rel: "src/generated/homeVariant.ts",
  fallback: "cinematic",
  values: ["editorial", "classic", "cinematic"],
  absentWarns: true,
  source: (variant) => `// GENERATED FILE — DO NOT EDIT BY HAND.
// Run: node scripts/build-home-variant.mjs (it runs at \`prebuild\`).
//
// HOME.DEFAULT.1 — site_settings.home_variant as it stood when this build was
// made. useHomeVariant renders it on a cache-less first visit, then still
// fetches and subscribes, so an admin flip after the build swaps live.

export const BUILT_HOME_VARIANT: "editorial" | "classic" | "cinematic" = "${variant}";
`,
};

const THEME = {
  key: "site_theme",
  tag: "build-home-variant",
  out: resolve(ROOT, "src/generated/siteTheme.ts"),
  rel: "src/generated/siteTheme.ts",
  fallback: "dark",
  values: ["dark", "light", "auto"],
  absentWarns: false,
  source: (theme) => `// GENERATED FILE — DO NOT EDIT BY HAND.
// Run: node scripts/build-home-variant.mjs (it runs at \`prebuild\`).
//
// SITE.THEME.1 — site_settings.site_theme as it stood when this build was made
// ("dark" when the row is absent). The site theme renders it on a cache-less
// first visit, then still fetches and subscribes, so an admin flip after the
// build follows live.

export const BUILT_SITE_THEME: "dark" | "light" | "auto" = "${theme}";
`,
};

function write(spec, value) {
  const next = spec.source(value);
  let current = null;
  try {
    current = readFileSync(spec.out, "utf8").replace(/\r\n/g, "\n");
  } catch {
    /* absent — written below */
  }
  if (current === next) {
    console.log(`[${spec.tag}] ${spec.key} is "${value}"; ${spec.rel} already current.`);
    return;
  }
  mkdirSync(dirname(spec.out), { recursive: true });
  writeFileSync(spec.out, next);
  console.log(`[${spec.tag}] ${spec.key} "${value}" written to ${spec.rel}.`);
}

const fail = (spec, msg) => {
  console.warn(`[${spec.tag}] WARNING: ${msg} — writing "${spec.fallback}".`);
  write(spec, spec.fallback);
};

/** One key's answer out of the shared read. */
function settle(spec, rows) {
  const row = rows.find((r) => r?.key === spec.key);
  if (!row) {
    if (spec.absentWarns) return fail(spec, `site_settings has no ${spec.key} row`);
    console.log(`[${spec.tag}] site_settings has no ${spec.key} row — the default "${spec.fallback}".`);
    return write(spec, spec.fallback);
  }
  if (!spec.values.includes(row.value)) {
    return fail(spec, `${spec.key} is ${JSON.stringify(row.value)}, not one of ${spec.values.join(" | ")}`);
  }
  write(spec, row.value);
}

const SPECS = [HOME, THEME];
const failAll = (msg) => SPECS.forEach((spec) => fail(spec, msg));

async function main() {
  const { url, key } = readEnv();
  if (!url || !key) return failAll("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set");

  let rows;
  try {
    const keys = SPECS.map((s) => s.key).join(",");
    const res = await fetch(`${url}/rest/v1/site_settings?select=key,value&key=in.(${keys})`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return failAll(`site_settings answered ${res.status}`);
    rows = await res.json();
  } catch (e) {
    return failAll(`could not reach Supabase (${e instanceof Error ? e.message : e})`);
  }
  if (!Array.isArray(rows)) return failAll("site_settings answered something that is not a list");

  for (const spec of SPECS) settle(spec, rows);
}

main()
  .catch((e) => {
    for (const spec of SPECS) {
      try {
        fail(spec, `unexpected error (${e instanceof Error ? e.message : e})`);
      } catch (inner) {
        console.warn(`[${spec.tag}] WARNING: could not write the fallback for ${spec.key} (${inner}).`);
      }
    }
  })
  .finally(() => {
    process.exitCode = 0;
  });
