import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * SEO.TITIACTRIZ.NAME.1 — titiactriz.com ranks for "Cristyna Polentino" and
 * "Titi Polentino". One pass: the name title, a Person + WebSite schema pair,
 * and a crawlable bio paragraph with her credit.
 *
 *  N1  Raw HTML from `/` (no JS): the title and description are es.json's
 *      hero.seoTitle / hero.seoDescription verbatim (description < 155 chars,
 *      naming her and "Titi"); exactly one <h1> reading her name; the static
 *      shell carries hero.bio in both languages (80–140 words each); exactly
 *      two JSON-LD blocks, both parse — a Person with the brief's fields and
 *      a WebSite naming the site. The portrait the Person names is served.
 *  N2  Mounted, ES and EN: the helmet title and description follow the
 *      locale's pair; exactly one h1; the bio is visible, reads the locale's
 *      hero.bio, sits below the hero and ahead of the Events act, and no
 *      placeholder token ever reaches the page.
 *  N3  Phone 440×792: the hero still owns the fold (the bio starts at or below
 *      the hero's bottom), and scrolled into view the bio sits inside the
 *      viewport's width.
 */

type Hero = { bio: string; seoTitle: string; seoDescription: string };
const locale = (lng: "es" | "en"): Hero =>
  JSON.parse(readFileSync(new URL(`../src/i18n/locales/${lng}.json`, import.meta.url), "utf8")).hero;
const HERO = { es: locale("es"), en: locale("en") };

const SITE = "https://www.titiactriz.com";
const SAME_AS = [
  "https://www.tiktok.com/@titina_polen",
  "https://www.instagram.com/cristinapolentino_actriz",
  "https://www.youtube.com/@mimundoderoles6875",
];

const BIO = '[data-qa="cinematic-bio-text"]';

/** A board with no banner: a live banner adds its bar above the hero and moves the fold. */
const BOARD_NO_BANNER = {
  pageVisible: true,
  mainBanner: { enabled: false, pages: { home: false, greenWorld: false, titans: false } },
  greenWorldBanner: { enabled: false },
  titansBanner: { enabled: false },
  items: [],
};

const chars = (s: string) => [...s].length;
const words = (s: string) => s.trim().split(/\s+/).length;

/** The HTML parser's view of an attribute or text node: the four entities index.html could carry. */
const unescape = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

async function openHome(page: Page, lng: "es" | "en") {
  await forceLanguage(page, lng);
  await routeSupabase(page, { eventsBoard: BOARD_NO_BANNER, homeVariant: "cinematic" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(BIO)).toBeAttached({ timeout: 15_000 });
}

test.describe("SEO.TITIACTRIZ.NAME.1", () => {
  test("N1 — the served HTML names her: title, description, h1, bio and two JSON-LD blocks", async ({
    request,
  }) => {
    const res = await request.get("/");
    expect(res.ok()).toBe(true);
    const html = await res.text();

    const title = unescape(html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "");
    expect(title).toBe(HERO.es.seoTitle);
    expect(title).toBe("Cristyna Polentino — Actriz | Sitio Oficial");

    const description = unescape(
      html.match(/<meta[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/)?.[1] ?? "",
    );
    expect(description).toBe(HERO.es.seoDescription);
    for (const lng of ["es", "en"] as const) {
      const d = HERO[lng].seoDescription;
      expect(chars(d), `${lng} description length: ${d}`).toBeLessThan(155);
      // SEO.BING.1's floor: Bing flagged the old description as short.
      expect(chars(d), `${lng} description length: ${d}`).toBeGreaterThanOrEqual(150);
      expect(d).toContain("Cristyna Polentino");
      expect(d).toContain("Titi");
    }

    const h1s = html.match(/<h1[\s>][\s\S]*?<\/h1>/g) ?? [];
    expect(h1s, "exactly one <h1> in the served HTML").toEqual(["<h1>Cristyna Polentino</h1>"]);

    for (const lng of ["es", "en"] as const) {
      const bio = HERO[lng].bio;
      expect(html, `the static shell carries the ${lng} bio`).toContain(`<p lang="${lng}">${bio}</p>`);
      expect(words(bio), `${lng} bio word count`).toBeGreaterThanOrEqual(80);
      expect(words(bio), `${lng} bio word count`).toBeLessThanOrEqual(140);
      expect(bio).toContain("Cristyna Polentino");
      expect(bio).toContain("Medellín");
      expect(bio).toContain("El Casting");
    }
    expect(html).not.toContain("[CREDITS]");

    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1]),
    );
    expect(blocks.map((b) => b["@type"]), "exactly a Person and a WebSite").toEqual(["Person", "WebSite"]);

    const [person, website] = blocks;
    expect(person).toMatchObject({
      "@context": "https://schema.org",
      "@id": `${SITE}/#person`,
      name: "Cristyna Polentino",
      jobTitle: "Actress",
      url: `${SITE}/`,
      image: `${SITE}/hero-portrait.webp`,
      sameAs: SAME_AS,
    });
    expect(person.alternateName).toEqual([
      "Titi Polentino",
      "Cristina Polentino",
      "Cristina Polentino Vanegas",
      "Titi Actriz",
      "Titina Polen",
      "Titi",
    ]);
    expect(website).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Cristyna Polentino",
      url: `${SITE}/`,
      publisher: { "@id": `${SITE}/#person` },
    });

    const portrait = await request.get("/hero-portrait.webp");
    expect(portrait.ok(), "the Person's image is served").toBe(true);
  });

  test.describe("N2 — mounted", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    for (const lng of ["es", "en"] as const) {
      test(`the helmet and the bio follow the locale (${lng.toUpperCase()})`, async ({ page }) => {
        await openHome(page, lng);

        await expect(page).toHaveTitle(HERO[lng].seoTitle);
        await expect(page.locator('meta[name="description"][data-rh="true"]')).toHaveAttribute(
          "content",
          HERO[lng].seoDescription,
        );
        await expect(page.locator("h1"), "exactly one h1 once mounted").toHaveCount(1);
        await expect(page.locator("h1")).toHaveAttribute("aria-label", "Cristyna Polentino");

        const bio = page.locator(BIO);
        await expect(bio).toHaveText(HERO[lng].bio);
        await bio.scrollIntoViewIfNeeded();
        await expect(bio).toBeVisible();
        await expect(page.locator("body")).not.toContainText("[CREDITS]");

        const order = await page.evaluate(() => {
          const hero = document.querySelector('[data-qa="cinematic-section"]')!;
          const bioSection = document.querySelector('[data-qa="cinematic-bio"]')!;
          const events = document.querySelector('[data-qa="cinematic-events"]');
          return {
            heroFirst: !!(hero.compareDocumentPosition(bioSection) & Node.DOCUMENT_POSITION_FOLLOWING),
            eventsAfter: events
              ? !!(bioSection.compareDocumentPosition(events) & Node.DOCUMENT_POSITION_FOLLOWING)
              : null,
            heroIsPrevious: bioSection.previousElementSibling === hero,
          };
        });
        expect(order.heroFirst, "the bio follows the hero").toBe(true);
        expect(order.heroIsPrevious, "directly under the hero").toBe(true);
        if (order.eventsAfter !== null) expect(order.eventsAfter, "and precedes the Events act").toBe(true);
      });
    }
  });

  test.describe("N3 — phone 440×792", () => {
    test.use({ viewport: { width: 440, height: 792 } });

    test("the hero keeps the fold; the bio fits the width", async ({ page }) => {
      await openHome(page, "es");
      const atRest = await page.evaluate(() => {
        const hero = document.querySelector('[data-qa="cinematic-section"]')!.getBoundingClientRect();
        const bio = document.querySelector('[data-qa="cinematic-bio"]')!.getBoundingClientRect();
        return { heroBottom: hero.bottom, bioTop: bio.top, ih: window.innerHeight };
      });
      expect(atRest.bioTop, "the bio starts at or below the hero").toBeGreaterThanOrEqual(atRest.heroBottom - 0.5);
      expect(atRest.bioTop, "and outside the first fold").toBeGreaterThanOrEqual(atRest.ih);

      const bio = page.locator(BIO);
      await bio.scrollIntoViewIfNeeded();
      const box = (await bio.boundingBox())!;
      expect(box.x, "bio left inside the viewport").toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, "bio right inside the viewport").toBeLessThanOrEqual(440);
    });
  });
});
