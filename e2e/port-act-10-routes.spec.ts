import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * PORT.ACT.10 — old-route disposition.
 *
 * Google indexed /socials and /cinematic (the latter a straight duplicate of
 * the home: the same HomeCinematic component `/` serves whenever home_variant
 * is "cinematic", the live value). /work was linked from six live surfaces.
 * All three pages are gone; all three URLs answer a 301 at the edge.
 *
 * The LAW this brick was written under is that the redirect must be live
 * BEFORE the page dies, so a searcher clicking a stale result never lands on
 * anything dead. This spec is the standing guard on that: it asserts the
 * production config still carries the three redirects, that no dead route
 * survives in the app, and that the two deleted i18n subtrees are gone from
 * BOTH locales with parity intact.
 *
 * It reads vercel.json and the locale files rather than hitting the network:
 * the deployed redirect was verified by hand against titiactriz.com when this
 * shipped (301 → / on all three), and a spec that curls production would go
 * red on any unrelated outage. What can silently regress is the CONFIG, and
 * that is what is asserted here.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const root = (p: string) => resolve(HERE, "..", p);
const readJson = (p: string) => JSON.parse(readFileSync(root(p), "utf8"));

/** The three retired routes and the destination each must 301 to. */
const RETIRED = [
  { source: "/work", destination: "/" },
  { source: "/socials", destination: "/" },
  { source: "/cinematic", destination: "/" },
] as const;

test.describe("PORT.ACT.10 — the retired routes", () => {
  test("vercel.json 301s every retired path to its target", () => {
    const vercel = readJson("vercel.json");
    expect(Array.isArray(vercel.redirects), "vercel.json declares redirects").toBe(true);

    for (const { source, destination } of RETIRED) {
      const rule = vercel.redirects.find((r: { source: string }) => r.source === source);
      expect(rule, `${source} has a redirect rule`).toBeTruthy();
      expect(rule.destination, `${source} points at ${destination}`).toBe(destination);
      // A literal 301, not Vercel's `permanent: true` — which emits a 308.
      // The brick's acceptance is a 301 and the deployed surface returns one.
      expect(rule.statusCode, `${source} answers 301, not 308`).toBe(301);
      expect(rule.permanent, `${source} does not also set permanent`).toBeUndefined();
    }
  });

  test("the SPA rewrite still catches everything else", () => {
    const vercel = readJson("vercel.json");
    const spa = vercel.rewrites?.find((r: { source: string }) => r.source === "/(.*)");
    expect(spa, "the catch-all rewrite survives").toBeTruthy();
    expect(spa.destination).toBe("/index.html");
    // Redirects are evaluated before rewrites, so the three above win over it.
  });

  test("no deleted page is still registered as a route", () => {
    const routes = readFileSync(root("src/components/AnimatedRoutes.tsx"), "utf8");
    expect(routes, "no /work route").not.toContain('path="/work"');
    expect(routes, "no /socials route").not.toContain('path="/socials"');
    // Match the IMPORT, not the bare component name: the comment that records
    // why these routes went away names both pages in prose, and a check that
    // cannot tell an explanation from a live import is worse than no check.
    expect(routes, "WorkResume is not imported").not.toMatch(
      /import\(\s*["'`]@\/pages\/WorkResume["'`]\s*\)/,
    );
    expect(routes, "the Socials page is not imported").not.toMatch(
      /import\(\s*["'`]@\/pages\/Socials["'`]\s*\)/,
    );

    // /cinematic survives ONLY under the DEV gate: 27 specs mount the
    // cinematic surface through it precisely because it has no home_variant
    // fetch to race. It is absent from every production build, absent from
    // the sitemap, and the edge redirect answers the indexed URL.
    const devGated = /import\.meta\.env\.DEV && \(\s*<Route\s+path="\/cinematic"/;
    expect(routes, "/cinematic is DEV-only").toMatch(devGated);
  });

  test("nothing anywhere still links to a deleted page", () => {
    const surfaces = [
      "src/components/Header.tsx",
      "src/components/Footer.tsx",
      "src/components/cinematic/CinematicAbout.tsx",
      "src/pages/Index.tsx",
      "src/pages/HomeEditorial.tsx",
    ];
    for (const f of surfaces) {
      const src = readFileSync(root(f), "utf8");
      // Match the route as a whole string literal, so a prose mention inside a
      // comment does not fail the check but a real link does.
      expect(src, `${f} does not link to /work`).not.toMatch(/["'`]\/work["'`]/);
      expect(src, `${f} does not link to /socials`).not.toMatch(/["'`]\/socials["'`]/);
    }
  });

  test("the sitemap lists only living URLs", () => {
    const xml = readFileSync(root("public/sitemap.xml"), "utf8");
    // Strip XML comments first: the Titans entry is parked in one on purpose
    // (TITANS.OFF.1), and PORT.ACT.10's own note names the retired paths.
    const live = xml.replace(/<!--[\s\S]*?-->/g, "");
    for (const dead of ["/work", "/socials", "/cinematic"]) {
      expect(live, `sitemap does not advertise ${dead}`).not.toContain(
        `<loc>https://titiactriz.com${dead}</loc>`,
      );
    }
    expect(live, "the home is still listed").toContain("<loc>https://titiactriz.com/</loc>");
    expect(live, "Green World is still listed").toContain(
      "<loc>https://titiactriz.com/green-world</loc>",
    );
  });
});

test.describe("PORT.ACT.10 — the deleted i18n subtrees", () => {
  /** Every key path the two deleted pages (and their CTAs) owned. */
  const DELETED = [
    "work",
    "socials",
    "strengths",
    "nav.portfolio",
    "nav.socials",
    "hero.buttons.portfolio",
    "hero.ctaPortfolio",
    "about.viewWork",
    "featured.work",
  ] as const;

  /** Key paths that must SURVIVE — the acts that replaced the pages. */
  const KEPT = [
    "cinematic.socials.title",
    "admin.portfolio.sectionTitle",
    "admin.shell.sections.portfolio",
    "about.strengths.presence",
    "nav.greenWorld",
    "nav.contact",
  ] as const;

  const at = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );

  const locales = () => ({
    es: readJson("src/i18n/locales/es.json"),
    en: readJson("src/i18n/locales/en.json"),
  });

  test("every deleted key is gone from BOTH locales", () => {
    const { es, en } = locales();
    for (const path of DELETED) {
      expect(at(es, path), `es.json still carries ${path}`).toBeUndefined();
      expect(at(en, path), `en.json still carries ${path}`).toBeUndefined();
    }
  });

  test("the replacement acts keep their keys in BOTH locales", () => {
    const { es, en } = locales();
    for (const path of KEPT) {
      expect(at(es, path), `es.json lost ${path}`).toBeDefined();
      expect(at(en, path), `en.json lost ${path}`).toBeDefined();
    }
  });

  test("ES and EN hold exact key parity at the new count", () => {
    const { es, en } = locales();
    const flat = (o: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );

    const esKeys = flat(es).sort();
    const enKeys = flat(en).sort();
    expect(esKeys.filter((k) => !enKeys.includes(k)), "keys only in ES").toEqual([]);
    expect(enKeys.filter((k) => !esKeys.includes(k)), "keys only in EN").toEqual([]);
    expect(esKeys.length, "ES and EN hold the same key count").toBe(enKeys.length);
  });
});
