import { expect, test, type Page } from "@playwright/test";

/**
 * NAV.SOON.1 + BOOK.0 — smoke coverage for what shipped alongside the Green
 * World redesign: the header's COMING SOON disclosure and the /book page it
 * links to.
 *
 * The disclosure is a button-plus-panel, not a nav link: its children are
 * announcements, and only the ones that have actually shipped carry a route.
 *
 * TL.LIVE.1 (2026-07-31) — TitiLinks SHIPPED, so it left this panel entirely and
 * is now an ordinary external nav link in all three navs (covered by the fit +
 * destination assertions below). The disclosure's remaining child is Book, which
 * is still a coming-soon teaser under the publisher law. The inert `path: null`
 * rendering is therefore no longer exercised by any current member — that is the
 * point, not a gap: the panel holds announcements, and there is one left.
 *
 * /book itself is asserted as what BOOK.0 is: a bilingual coming-soon page
 * with a real <title>, and copy that promises nothing that is not yet true
 * (no invented date, no pre-order).
 */

const TRIGGER = '[data-qa="nav-coming-soon"]';
const PANEL = '[data-qa="nav-coming-soon-panel"]';
const ITEM_BOOK = `${PANEL} [data-qa="nav-soon-book"]`;
const ITEM_TITILINKS = `${PANEL} [data-qa="nav-soon-titilinks"]`;

const LANG_KEY = "ta_lang";

function clearStoredLang(page: Page) {
  return page.addInitScript((key) => {
    try {
      localStorage.removeItem(key as string);
    } catch {
      /* storage may be unavailable */
    }
  }, LANG_KEY);
}

test.describe("NAV.SOON.1 — the COMING SOON disclosure", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("opens, lists Book, and no longer carries TitiLinks", async ({ page }) => {
    await clearStoredLang(page);
    // A quiet ordinary page, so the disclosure is measured without the
    // cinematic reel scrubbing underneath it.
    await page.goto("/green-world", { waitUntil: "domcontentloaded" });

    // A disclosure BUTTON, closed at rest.
    const trigger = page.locator(TRIGGER);
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-haspopup", "true");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(PANEL), "panel hidden at rest").not.toBeVisible();

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(PANEL)).toBeVisible();

    // Book is the panel's one remaining announcement, and it is a real link.
    const book = page.locator(ITEM_BOOK);
    await expect(book).toBeVisible();
    await expect(book).toHaveText("Book");
    expect(
      await book.evaluate((el) => el.tagName.toLowerCase()),
      "Book is a link",
    ).toBe("a");
    await expect(book).toHaveAttribute("href", "/book");

    // TL.LIVE.1 — TitiLinks has LEFT the panel. Asserted as an absence, because
    // a shipped product announced as "coming soon" is the exact defect this
    // brick closed.
    await expect(page.locator(ITEM_TITILINKS)).toHaveCount(0);

    // ...and it is now a real external nav link on the bar itself.
    const live = page.locator('nav.min-\\[1200px\\]\\:grid [data-qa="nav-titilinks"]');
    await expect(live).toBeVisible();
    await expect(live).toHaveText("TitiLinks");
    expect(
      await live.evaluate((el) => el.tagName.toLowerCase()),
      "TitiLinks is a link now",
    ).toBe("a");
    await expect(live).toHaveAttribute("href", "https://titilinks.com");
    await expect(live).toHaveAttribute("target", "_blank");
    await expect(live).toHaveAttribute("rel", "noopener noreferrer");

    // Escape dismisses without navigating.
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(PANEL)).not.toBeVisible();
    await expect(page).toHaveURL(/\/green-world$/);
  });

  test("BOOK navigates to /book", async ({ page }) => {
    await clearStoredLang(page);
    await page.goto("/green-world", { waitUntil: "domcontentloaded" });

    await page.locator(TRIGGER).click();
    await page.locator(ITEM_BOOK).click();
    await expect(page).toHaveURL(/\/book$/);
    await expect(page.locator('[data-qa="book-page"]')).toBeVisible();
    // The route change puts the panel away.
    await expect(page.locator(TRIGGER)).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("BOOK.0 — /book in English", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("renders the English coming-soon copy with a real title tag", async ({ page }) => {
    await clearStoredLang(page);
    await page.goto("/book", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="book-page"]')).toBeVisible();

    await expect(page).toHaveTitle("New Book Coming Soon | Cristyna Polentino");
    await expect(page.locator('[data-qa="book-eyebrow"]')).toHaveText("Coming soon");
    await expect(page.locator('[data-qa="book-title"]')).toHaveText("New Book Coming Soon!");
    await expect(page.locator('[data-qa="book-body"]')).toHaveText(
      "Cristyna Polentino's book is being published. The release date and where to order it are coming soon.",
    );
    await expect(page.locator('[data-qa="book-page"]'), "no Spanish copy leaks through").not.toContainText(
      "Nuevo Libro",
    );
  });
});

test.describe("BOOK.0 — /book in Spanish", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

  test("renders the Spanish coming-soon copy with a real title tag", async ({ page }) => {
    await clearStoredLang(page);
    await page.goto("/book", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="book-page"]')).toBeVisible();

    await expect(page).toHaveTitle("Nuevo Libro Muy Pronto | Cristyna Polentino");
    await expect(page.locator('[data-qa="book-eyebrow"]')).toHaveText("Próximamente");
    await expect(page.locator('[data-qa="book-title"]')).toHaveText("¡Nuevo Libro Muy Pronto!");
    await expect(page.locator('[data-qa="book-body"]')).toHaveText(
      "El libro de Cristyna Polentino está en proceso de publicación. Pronto compartiremos la fecha de lanzamiento y dónde conseguirlo.",
    );
    await expect(page.locator('[data-qa="book-page"]'), "no English copy leaks through").not.toContainText(
      "New Book",
    );
  });
});
