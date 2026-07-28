import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { attachDiagnostics, shot, BRICK } from "./_helpers";
import { TITANS_ENABLED } from "../src/lib/ventures";

/**
 * TITANS.OFF.1 — Titans Agency is hidden site-wide behind a single constant
 * (TITANS_ENABLED in src/lib/ventures.ts) after a TikTok policy change ended
 * the creator-agency program. The ruling was HIDE, not delete.
 *
 * This spec is the standing proof that "hidden" means hidden everywhere, not
 * just where someone remembered to look. It asserts the absence across the
 * three surface families a stray link tends to survive in:
 *   • rendered chrome — both navs and the footer, at phone and desktop width,
 *   • the page body — the home cinematic act and both home variants,
 *   • the machine-readable layer — sitemap.xml and the JSON-LD block, which are
 *     static files that cannot read the flag and so are the likeliest to rot.
 *
 * ## Why the assertions are written as absences, not as counts
 *
 * A count ("nav has 2 links") passes for the wrong reason the moment an
 * unrelated brick adds a link. Every assertion here names Titans specifically:
 * no href to the route, no visible "Titans" string in the chrome. That is the
 * property that must hold, and it stays true no matter what else the nav grows.
 *
 * ## The revive path
 *
 * The last block in this file is the inverse: it runs ONLY when the flag is
 * true, and it re-asserts that the surfaces come back. It is skipped today and
 * is meant to be — it exists so that whoever flips TITANS_ENABLED back gets a
 * green check that the revive actually worked, rather than having to trust that
 * removing a `false` was sufficient. Deleting it would leave the revive
 * unverified; that is why a permanently-skipped test earns its place here.
 */

const TITANS_HREF = "/titans-agency";
const TITANS_SECTION = '[data-qa="cinematic-titans"]';

/** Every route a visitor can reach that used to advertise Titans. */
const PUBLIC_PAGES = ["/", "/cinematic"] as const;

async function settle(page: import("@playwright/test").Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe("TITANS.OFF.1 — the venture is hidden", () => {
  test.skip(TITANS_ENABLED, "Titans is live; the hidden-state contract does not apply.");

  test.describe("chrome carries no Titans entry", () => {
    for (const width of [390, 1440]) {
      test(`no nav, footer or body link to Titans at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

        for (const route of PUBLIC_PAGES) {
          await page.goto(route, { waitUntil: "domcontentloaded" });
          await settle(page);

          // Nothing anywhere in the document points at the route — this covers
          // the desktop nav, the footer, the hero quick-links and the featured
          // cards in one assertion that cannot be satisfied by luck.
          expect(
            await page.locator(`a[href*="${TITANS_HREF}"]`).count(),
            `${route} @${width}: link to ${TITANS_HREF}`,
          ).toBe(0);

          // The mobile menu is behind a toggle, so its links are not in the DOM
          // until it opens. Open it and check again, or the phone-width pass
          // proves nothing about the surface most likely to keep a stale entry.
          if (width === 390) {
            const toggle = page.locator('button[aria-label="Toggle menu"]');
            if (await toggle.count()) {
              await toggle.first().click();
              await page.waitForTimeout(400);
              expect(
                await page.locator(`a[href*="${TITANS_HREF}"]`).count(),
                `${route} @${width}: link to ${TITANS_HREF} inside the open mobile menu`,
              ).toBe(0);
              await page.keyboard.press("Escape").catch(() => {});
            }
          }

          // Header and footer must not even say the word — a plain-text
          // "Titans Agency" with no href is still a live-looking claim.
          for (const region of ["header", "footer"]) {
            const el = page.locator(region);
            if (!(await el.count())) continue;
            expect(
              ((await el.first().innerText().catch(() => "")) ?? "").toLowerCase(),
              `${route} @${width}: "${region}" text mentions Titans`,
            ).not.toContain("titans");
          }
        }
      });
    }
  });

  test("the home cinematic act is not mounted", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cinematic", { waitUntil: "domcontentloaded" });
    await settle(page);

    // Scroll the whole page so any lazily-mounted act would have its chance.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);

    expect(await page.locator(TITANS_SECTION).count(), "Titans act mounted").toBe(0);
    expect(
      await page.locator('[data-qa="titans-video"]').count(),
      "Titans video/poster mounted",
    ).toBe(0);

    // The badge-reveal clip must never be fetched — a hidden act that still
    // pulls 9 MB of video is not hidden in the way that matters.
    expect(
      diag.failedResponses.filter((r) => r.includes("titans")),
      "failed Titans requests",
    ).toEqual([]);
    expect(diag.consoleErrors, "console errors with Titans hidden").toEqual([]);
  });

  test("the route falls through to the site's 404", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(TITANS_HREF, { waitUntil: "domcontentloaded" });
    await settle(page);

    // The app's existing not-found behaviour, not a bespoke "gone" page.
    await expect(page.locator("h1")).toHaveText("404");
    await expect(page.getByText("Oops! Page not found")).toBeVisible();

    // And the page it 404s on must not still be advertising the venture.
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body, "404 page mentions Titans").not.toContain("titans");
  });

  test("sitemap.xml and JSON-LD carry no live Titans claim", async () => {
    const root = process.cwd();

    // Sitemap: strip comments the way any XML parser would, then read what is
    // actually served. The entry is parked in a comment, not deleted, so a
    // naive substring search would pass while the file still advertised it.
    const sitemap = fs.readFileSync(path.join(root, "public", "sitemap.xml"), "utf8");
    const live = sitemap.replace(/<!--[\s\S]*?-->/g, "");
    const locs = [...live.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length, "sitemap still lists the surviving pages").toBeGreaterThan(0);
    expect(
      locs.filter((l) => l.includes("titans")),
      "live <loc> entries pointing at Titans",
    ).toEqual([]);
    // XML comments may not contain a double hyphen — the parked block must not
    // have made the file unparseable.
    for (const c of sitemap.match(/<!--[\s\S]*?-->/g) ?? []) {
      expect(c.slice(4, -3), "illegal '--' inside an XML comment").not.toContain("--");
    }

    // JSON-LD: parse it for real. It has no comment syntax, so the Titans
    // claims were removed outright and recorded in an HTML comment above.
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(block, "JSON-LD block present").not.toBeNull();
    const ld = JSON.parse(block![1]);
    expect(
      JSON.stringify(ld).toLowerCase(),
      "structured data still claims Titans",
    ).not.toContain("titans");
  });

  test("evidence — home chrome without Titans", async ({ page }) => {
    for (const width of [390, 1440]) {
      for (const [lang, locale] of [
        ["es", "es-CO"],
        ["en", "en-US"],
      ] as const) {
        const ctx = await page.context().browser()!.newContext({
          viewport: { width, height: width === 390 ? 844 : 900 },
          locale,
        });
        const p = await ctx.newPage();
        await p.addInitScript(() => {
          try {
            localStorage.removeItem("ta_lang");
          } catch {
            /* storage may be unavailable */
          }
        });
        await p.goto("/", { waitUntil: "domcontentloaded" });
        await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(700);
        await p.screenshot({ path: shot(`titansoff-${width}-${lang}.png`), fullPage: true });
        await ctx.close();
      }
    }
    expect(BRICK, "brick label resolved").toBeTruthy();
  });
});

/**
 * The inverse. Skipped while the venture is down, by design — see the file
 * header. Flip TITANS_ENABLED to true and this is the check that says the
 * revive landed.
 */
test.describe("TITANS.OFF.1 — the revive path", () => {
  test.skip(!TITANS_ENABLED, "Titans is hidden; this documents and verifies the revive.");

  test("flipping the flag restores the route, the nav and the act", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    expect(
      await page.locator(`a[href*="${TITANS_HREF}"]`).count(),
      "nav/footer link returns",
    ).toBeGreaterThan(0);

    await page.goto("/cinematic", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    await expect(page.locator(TITANS_SECTION), "cinematic act returns").toHaveCount(1);

    await page.goto(TITANS_HREF, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    await expect(page.locator("h1"), "route no longer 404s").not.toHaveText("404");

    // The static files cannot read the flag, so the revive is only complete
    // once both parked blocks are uncommented by hand.
    const sitemap = fs.readFileSync(path.join(process.cwd(), "public", "sitemap.xml"), "utf8");
    const live = sitemap.replace(/<!--[\s\S]*?-->/g, "");
    expect(live, "sitemap entry was un-parked").toContain("titans-agency");

    const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(JSON.stringify(JSON.parse(block![1])), "JSON-LD affiliation was restored").toContain(
      "Titans",
    );
  });
});
