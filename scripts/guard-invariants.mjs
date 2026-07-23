import { readFileSync } from "node:fs";

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

if (failed) {
  console.error(`\nGUARD FAILED - ${failed} invariant(s) broken.`);
  process.exit(1);
}
console.log("\nAll invariants intact.");
