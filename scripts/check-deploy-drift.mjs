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
 * Requires an authenticated Supabase CLI. Drift checking is a local-session
 * gate, not a CI gate, so CI still SKIPS with exit 0.
 *
 * FIX.DRIFT.1 — everywhere else, a CLI that cannot reach the project now FAILS
 * with exit 1. It used to exit 0 behind a "skipped" line, which made the one
 * outcome that matters most — the gate did not run — look exactly like the gate
 * running and finding nothing. A checker that goes quiet when it breaks is
 * worse than no checker, because it is trusted: it is the same silence that let
 * generate-alt-text sit drifted for 12 days. If the CLI is genuinely
 * unavailable and you mean to proceed anyway, say so out loud:
 * DRIFT_SKIP=1 npm run drift.
 */
const CI = !!process.env.CI;
const SKIP = process.env.DRIFT_SKIP === "1";
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
  const authIssue = /403|privileges|access token|login/i.test(msg);

  if (CI || SKIP) {
    console.log(
      `-- DRIFT check skipped (${CI ? "CI" : "DRIFT_SKIP=1"}): supabase CLI unavailable or not authenticated.`,
    );
    process.exit(0);
  }

  console.error("x DRIFT check DID NOT RUN: supabase CLI unavailable or not authenticated.");
  console.error("      This is a failure, not a pass — nothing was compared against the ledger,");
  console.error("      so a function deployed outside this repo would go unseen (law 5).");
  if (authIssue) {
    console.error("      Auth issue — run `npx supabase login` in a real terminal, then retry.");
  } else {
    console.error(`      CLI said: ${msg.trim().split("\n")[0] || "(no output)"}`);
  }
  console.error("      To proceed knowingly without the check: DRIFT_SKIP=1 npm run drift");
  process.exit(1);
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
