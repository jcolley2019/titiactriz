import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase } from "./_admin";
import { guideSections } from "../src/lib/guide";

// The same files the panel bundles (Vite `?raw`), read from disk here.
const guideEs = readFileSync(new URL("../src/content/guide.es.md", import.meta.url), "utf8");
const guideEn = readFileSync(new URL("../src/content/guide.en.md", import.meta.url), "utf8");

/**
 * ADMIN.GUIDE.1 — the Guía tab: how Titi uses the admin, in her words.
 *
 *   G1 the Guía tab renders the ES guide with the Estudio H2
 *   G2 switching the site language to EN renders the EN guide
 *   G3 the TOC link scrolls to Blog
 *   G4 the TOC follows the tab bar left to right (ADMIN.GUIDE.1c)
 *
 * Screenshots at 1440×900 and 820×1180 land in _qa/admin-guide/.
 */

const SHOTS = "_qa/admin-guide";

const esSections = guideSections(guideEs);
const enSections = guideSections(guideEn);

test.beforeEach(async ({ page }) => {
  await forceLanguage(page, "es");
  await injectAdminSession(page);
  await routeSupabase(page);
});

/** Viewport-relative top edge, as the eye sees it. */
const topOf = (el: Locator) => el.evaluate((n) => n.getBoundingClientRect().top);

async function openGuide(page: Page) {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-qa="admin-shell"]')).toBeVisible();
  await page.locator('[data-qa="admin-nav-guide"]').click();
  await expect(page.locator('[data-qa="admin-section-guide"]')).toBeVisible();
}

test("G1: the Guía tab renders the ES guide with the Estudio H2", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuide(page);

  await expect(page.locator('[data-qa="admin-nav-guide"]')).toHaveText(/Guía/);
  const guide = page.locator('[data-qa="admin-guide"]');
  await expect(guide).toHaveAttribute("data-lang", "es");
  await expect(guide.locator("h1")).toHaveText("Guía del admin");
  await expect(guide.locator("h2#estudio")).toHaveText("Estudio");

  // Every H2 in the file is on the page with its id, and the TOC lists each one.
  const h2s = guide.locator("article h2");
  await expect(h2s).toHaveCount(esSections.length);
  for (const s of esSections) {
    await expect(guide.locator(`h2#${s.id}`)).toHaveText(s.title);
    await expect(guide.locator(`[data-qa="admin-guide-toc-${s.id}"]`)).toBeVisible();
  }
  // Sections follow the tab bar left to right (ADMIN.GUIDE.1c), Reglas de la casa last.
  expect(esSections.map((s) => s.id)).toEqual([
    "empezar",
    "galeria-y-medios",
    "portafolio",
    "enlaces",
    "eventos",
    "blog",
    "estudio",
    "ajustes",
    "mensajes",
    "reglas-de-la-casa",
  ]);
  // Each section opens with the "Úsalo cuando…" line.
  for (const s of esSections) {
    const opener = guide.locator(`h2#${s.id} + p`);
    await expect(opener).toHaveText(/^Úsalo cuando…/);
  }

  await page.screenshot({ path: `${SHOTS}/G1-es-1440.png`, fullPage: false });
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(guide).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/G1-es-820.png`, fullPage: false });
});

test("G2: switching the site language to EN renders the EN guide", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuide(page);
  const guide = page.locator('[data-qa="admin-guide"]');
  await expect(guide).toHaveAttribute("data-lang", "es");

  // The site's own language menu, on the admin page's header.
  await page.locator('[data-qa="lang-menu-trigger"]').first().click();
  await page.locator('[data-qa="lang-en"]').click();
  await page.keyboard.press("Escape");

  await expect(page.locator('[data-qa="admin-nav-guide"]')).toHaveText(/Guide/);
  await expect(guide).toHaveAttribute("data-lang", "en");
  await expect(guide.locator("h1")).toHaveText("Admin guide");
  await expect(guide.locator("h2#studio")).toHaveText("Studio");
  await expect(guide.locator("article h2")).toHaveCount(enSections.length);
  expect(enSections.length).toBe(esSections.length);
  for (const s of enSections) {
    await expect(guide.locator(`h2#${s.id} + p`)).toHaveText(/^Use it when…/);
  }

  await page.screenshot({ path: `${SHOTS}/G2-en-1440.png`, fullPage: false });
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.screenshot({ path: `${SHOTS}/G2-en-820.png`, fullPage: false });
});

test("G3: the TOC link scrolls to Blog", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuide(page);
  const blog = page.locator('[data-qa="admin-guide"] h2#blog');
  await expect(blog).toHaveText("Blog");

  // Before: the Blog heading sits well below the fold.
  expect(await topOf(blog)).toBeGreaterThan(900);

  await page.locator('[data-qa="admin-guide-toc-blog"]').click();

  // After: the heading rests near the top of the viewport, clear of the fixed
  // header (scroll-mt-28 = 112px), and is the first heading in view.
  await expect.poll(() => topOf(blog), { timeout: 5000 }).toBeLessThan(200);
  expect(await topOf(blog)).toBeGreaterThanOrEqual(0);
  await expect(blog).toBeInViewport();
  // The heading before Blog (ADMIN.GUIDE.1c order) has scrolled out above.
  const eventos = page.locator('[data-qa="admin-guide"] h2#eventos');
  await expect(eventos).not.toBeInViewport();

  await page.screenshot({ path: `${SHOTS}/G3-toc-blog-1440.png`, fullPage: false });
});

test("G4: the TOC follows the tab bar left to right", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuide(page);
  const toc = page.locator('[data-qa="admin-guide-toc"]');
  await expect(toc).toBeVisible();

  // Exactly these ten, in this order; each entry reads "N." then its title.
  const titles = [
    "Empezar",
    "Galería y Medios",
    "Portafolio",
    "Enlaces",
    "Eventos",
    "Blog",
    "Estudio",
    "Ajustes",
    "Mensajes",
    "Reglas de la casa",
  ];
  await expect(toc.locator("li button")).toHaveText(
    titles.map((t, i) => new RegExp(`^${i + 1}\\.\\s*${t}$`)),
  );

  await page.screenshot({ path: `${SHOTS}/G4-toc-1440.png`, fullPage: false });
});
