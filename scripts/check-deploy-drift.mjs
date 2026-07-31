import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * BUILD.GATE.3 — deployed-vs-repo drift check for Supabase edge functions.
 *
 * Law 5: deployed state ≠ repo state. The alt-text function drifted for 12 days
 * after a dashboard deploy before anyone noticed. This script makes that drift
 * visible the same day: it compares each deployed function's bundle sha against
 * supabase/functions/deploy-ledger.json (the last-known-synced state).
 *
 * Requires an authenticated Supabase CLI; when the CLI can't reach the project
 * (no login, CI) it SKIPS with exit 0 — drift checking is a local-session gate,
 * not a CI gate.
 */
const LEDGER_PATH = new URL("../supabase/functions/deploy-ledger.json", import.meta.url);
const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));

let raw;
try {
  raw = execSync(`npx supabase functions list --project-ref ${ledger.projectRef}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 90_000,
  });
} catch (e) {
  const msg = `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`;
  console.log("-- DRIFT check skipped: supabase CLI unavailable or not authenticated.");
  if (/403|privileges|access token|login/i.test(msg)) {
    console.log("   (auth issue — run `npx supabase login` in a real terminal to enable this check)");
  }
  process.exit(0);
}

const start = raw.indexOf("{");
if (start === -1) {
  console.error("x DRIFT: could not parse `functions list` output.");
  process.exit(1);
}
const live = JSON.parse(raw.slice(start));
const deployed = new Map((live.functions ?? []).map((f) => [f.slug, f]));

let failed = 0;
for (const [slug, expected] of Object.entries(ledger.functions)) {
  const fn = deployed.get(slug);
  if (!fn) {
    console.error(`x DRIFT ${slug}: in ledger but NOT deployed — was it deleted?`);
    failed++;
  } else if (fn.ezbr_sha256 !== expected.ezbr_sha256) {
    console.error(`x DRIFT ${slug}: deployed sha changed since last sync (v${expected.version} -> v${fn.version}).`);
    console.error(`      Someone deployed outside this repo (dashboard?). The repo copy may be stale.`);
    console.error(`      Re-sync: npx supabase functions download ${slug} --project-ref ${ledger.projectRef},`);
    console.error(`      diff against the repo, then update deploy-ledger.json in the same commit.`);
    failed++;
  } else {
    console.log(`ok ${slug} (v${fn.version}, sha matches ledger)`);
  }
  deployed.delete(slug);
}
for (const slug of deployed.keys()) {
  console.error(`x DRIFT ${slug}: deployed but not in the ledger — add it (and a repo copy) or investigate.`);
  failed++;
}

if (failed) {
  console.error(`\nDRIFT DETECTED - ${failed} function(s) out of sync with the ledger.`);
  process.exit(1);
}
console.log("\nDeployed functions match the ledger.");
