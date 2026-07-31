import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * PORT.1 — static invariant guard, mirroring the TitiLinks CROP-CORS pattern
 * (scripts/guard-invariants.mjs). Each check names a source file and a set of
 * `needs` regexes that must be present; a violation prints the offending pattern
 * and the process exits nonzero so CI/`npm run guard` fails loudly.
 */
const F = (p) => `src/${p}`;

const checks = [
  // CROP-CORS: the crop/decode engine must request its source with CORS, and
  // crossOrigin must be assigned BEFORE .src or the browser ignores it — a
  // tainted canvas then kills every re-crop of a remote photo with a
  // SecurityError. This ordering is load-bearing; assert it statically.
  {
    name: "CROP-CORS",
    file: "lib/crop.ts",
    needs: [/image\.crossOrigin\s*=\s*["']anonymous["'];\s*\n\s*image\.src\s*=\s*imageSrc;/],
  },
];

let failed = 0;
for (const c of checks) {
  let src;
  try {
    src = readFileSync(F(c.file), "utf8");
  } catch {
    console.error(`x ${c.name}: cannot read ${F(c.file)}`);
    failed++;
    continue;
  }
  const missing = c.needs.filter((re) => !re.test(src));
  if (missing.length) {
    failed++;
    console.error(`x ${c.name} (${c.file})`);
    missing.forEach((re) => console.error(`      missing: ${re}`));
  } else {
    console.log(`ok ${c.name}`);
  }
}

// PUBLIC-STRAYS: everything under public/ ships to titiactriz.com verbatim, so a
// file sitting there untracked is one careless `git add` away from deploying
// (precedent: four screen-issue screenshots, 7/31). Untracked files must be
// allowlisted here — an entry means "staged material Joey intends to land";
// remove entries once the material is committed or removed.
const STRAY_ALLOW = [
  // gw-ambient 4k masters moved to the private `masters` bucket (MASTERS.1).
  "public/ventures/seq/titans-1280/",
  "public/ventures/seq/titans-720/",
];
try {
  const untracked = execSync("git ls-files --others --exclude-standard public/", {
    encoding: "utf8",
  })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const strays = untracked.filter(
    (f) => !STRAY_ALLOW.some((a) => (a.endsWith("/") ? f.startsWith(a) : f === a)),
  );
  if (strays.length) {
    failed++;
    console.error(`x PUBLIC-STRAYS — untracked files in public/ (deploys publicly!):`);
    strays.forEach((f) => console.error(`      ${f}`));
    console.error(`      Delete them, or allowlist in scripts/guard-invariants.mjs if staged on purpose.`);
  } else {
    console.log("ok PUBLIC-STRAYS");
  }
} catch {
  console.log("-- PUBLIC-STRAYS skipped (git unavailable)");
}

if (failed) {
  console.error(`\nGUARD FAILED - ${failed} invariant(s) broken.`);
  process.exit(1);
}
console.log("\nAll invariants intact.");
