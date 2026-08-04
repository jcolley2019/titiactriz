import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";

/**
 * SKIPPED (EVENTS.1, 2026-08-04) — this gate has no subject.
 *
 * Owner ruling: the Book act is UNMOUNTED from the cinematic home; the Events
 * act took its slot (position 5, after the gallery, before Green World). The
 * laws below are measured on a live render of an act that no longer paints.
 *
 * Kept, not deleted — CinematicBook.tsx is still in the repo and re-mounting it
 * is the whole revive, which this gate is what would prove.
 *
 * PUBLISHER LAW is NOT suspended by this skip. It never depended on this file:
 * it binds the /book PAGE, which is untouched and still covered by its own
 * gates, and it binds the act itself the moment it is ever re-mounted. Nothing
 * about the swap clears the book to name a title, a date, a cover, a price, or
 * to capture an email — that still takes written publisher clearance.
 */
test.skip(true, "EVENTS.1 — the Book act is unmounted; the Events act holds its slot");

/**
 * BOOK.ACT.1 — the coming-soon book teaser act on the cinematic home.
 *
 * PUBLISHER LAW (strict): the act is a teaser ONLY — it may not name a title,
 * a date, a cover, or any way to buy. Its entire copy is the /book page's own
 * bilingual coming-soon strings, reused via the SAME locale keys (`book.*`,
 * `nav.book` on the CTA) — a census of what already exists, never new claims.
 *
 * Laws, each falsifiable on the live render:
 *
 *  1. PLACEMENT — the act renders on the home flow AFTER the gallery and
 *     immediately BEFORE Green World in document order.
 *  2. COPY CENSUS — both locales render exactly the /book strings, with no
 *     cross-language leak.
 *  3. NO PUBLISHER CLAIMS — no purchase, price, date or pre-order language in
 *     either locale.
 *  4. THE CTA NAVIGATES — one internal link, to /book.
 *  5. REDUCED MOTION IS STATIC — the act renders settled, with no entrance
 *     states and no scrub trigger.
 *
 * Evidence: _qa/review3-bookact-{1440,390}.png (ES — the site is ES-primary).
 */

const PATH = "/cinematic";
const ACT = '[data-qa="cinematic-book"]';
const EYEBROW = '[data-qa="book-act-eyebrow"]';
const HEADING = `${ACT} [data-qa="section-heading"]`;
const BODY = '[data-qa="book-act-body"]';
const CTA = '[data-qa="book-act-cta"]';
const GALLERY = '[data-qa="cinematic-gallery"]';
const GW = '[data-qa="cinematic-greenworld-seq"]';

const LANG_KEY = "ta_lang";

const EN = {
  eyebrow: "Coming soon",
  title: "New Book Coming Soon!",
  body: "Cristyna Polentino's book is being published. The release date and where to order it are coming soon.",
  cta: "Book",
};
const ES = {
  eyebrow: "Próximamente",
  title: "¡Nuevo Libro Muy Pronto!",
  body: "El libro de Cristyna Polentino está en proceso de publicación. Pronto compartiremos la fecha de lanzamiento y dónde conseguirlo.",
  cta: "El Libro",
};

/** Purchase/press language the publisher law forbids, in both languages. */
const FORBIDDEN = [
  "ISBN",
  "$",
  "€",
  "pre-order",
  "preorder",
  "preventa",
  "buy",
  "comprar ahora",
  "amazon",
];

function clearStoredLang(page: Page) {
  return page.addInitScript((key) => {
    try {
      localStorage.removeItem(key as string);
    } catch {
      /* storage may be unavailable */
    }
  }, LANG_KEY);
}

async function openHome(page: Page) {
  await clearStoredLang(page);
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await page.locator(ACT).waitFor({ timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

/**
 * Scroll the act to the top of the frame so its entrance scrub (end: "top
 * 22%") is fully behind it, then wait for the last line to settle.
 */
async function settleAct(page: Page) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)!;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
  }, ACT);
  await page.waitForTimeout(400);
  await expect
    .poll(
      async () => await page.locator(CTA).evaluate((el) => Number(getComputedStyle(el).opacity)),
      { timeout: 10_000, message: "the act settles its entrance" },
    )
    .toBeGreaterThan(0.95);
}

test.describe("BOOK.ACT.1 — placement and English copy", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

  test("renders after the gallery and immediately before Green World", async ({ page }) => {
    await openHome(page);

    await expect(page.locator(ACT)).toHaveCount(1);
    const order = await page.evaluate(
      ([gallerySel, actSel, gwSel]) => {
        const g = document.querySelector(gallerySel)!;
        const a = document.querySelector(actSel)!;
        const w = document.querySelector(gwSel)!;
        const before = (x: Element, y: Element) =>
          !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
        // "Immediately before": nothing between the act and the Green World
        // act at their shared depth — GW's wrapper is the act's next section-
        // bearing sibling.
        let between = 0;
        let n = a.nextElementSibling;
        while (n && n !== w && !n.contains(w)) {
          between += 1;
          n = n.nextElementSibling;
        }
        return { galleryBeforeAct: before(g, a), actBeforeGw: before(a, w), between };
      },
      [GALLERY, ACT, GW],
    );
    expect(order.galleryBeforeAct, "the gallery precedes the book act").toBe(true);
    expect(order.actBeforeGw, "the book act precedes Green World").toBe(true);
    expect(order.between, "nothing sits between the book act and Green World").toBe(0);
  });

  test("English copy is the /book census, and the CTA routes internally", async ({ page }) => {
    await openHome(page);
    const act = page.locator(ACT);

    await expect(act.locator(EYEBROW)).toHaveText(EN.eyebrow);
    await expect(page.locator(HEADING)).toHaveText(EN.title);
    await expect(act.locator(BODY)).toHaveText(EN.body);
    await expect(act.locator(CTA)).toHaveText(EN.cta);

    // No Spanish leaks through…
    await expect(act, "no Spanish copy leaks").not.toContainText(ES.eyebrow);
    await expect(act, "no Spanish copy leaks").not.toContainText("proceso de publicación");

    // …and the publisher law holds: coming-soon only, nothing saleable.
    const text = (await act.innerText()).toLowerCase();
    for (const word of FORBIDDEN) {
      expect(text, `publisher law: no "${word}"`).not.toContain(word.toLowerCase());
    }

    // One internal link, to /book.
    const href = await act.locator(CTA).getAttribute("href");
    expect(href, "CTA routes to /book").toBe("/book");
  });

  test("the CTA actually navigates to /book", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);
    await settleAct(page);
    await page.locator(CTA).click();
    await expect(page).toHaveURL(/\/book$/);
    await expect(page.locator('[data-qa="book-page"]')).toBeVisible();
  });
});

test.describe("BOOK.ACT.1 — Spanish copy (ES-primary)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

  test("Spanish copy is the /book census, with no English leak", async ({ page }) => {
    await openHome(page);
    const act = page.locator(ACT);

    await expect(act.locator(EYEBROW)).toHaveText(ES.eyebrow);
    await expect(page.locator(HEADING)).toHaveText(ES.title);
    await expect(act.locator(BODY)).toHaveText(ES.body);
    await expect(act.locator(CTA)).toHaveText(ES.cta);

    await expect(act, "no English copy leaks").not.toContainText(EN.title);
    await expect(act, "no English copy leaks").not.toContainText("is being published");

    const text = (await act.innerText()).toLowerCase();
    for (const word of FORBIDDEN) {
      expect(text, `publisher law: no "${word}"`).not.toContain(word.toLowerCase());
    }
  });

  test("evidence — the settled act at 1440", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);
    await settleAct(page);
    await page.screenshot({ path: shot("review3-bookact-1440.png") });
  });
});

test.describe("BOOK.ACT.1 — phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, locale: "es-CO" });

  test("renders and settles at 390, CTA tappable — with evidence", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page);
    await settleAct(page);
    await expect(page.locator(CTA)).toBeVisible();
    await page.screenshot({ path: shot("review3-bookact-390.png") });
  });
});

test.describe("BOOK.ACT.1 — reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

  test("the act renders static and settled", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await clearStoredLang(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await page.locator(ACT).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(600);

    // Every line is at rest with no entrance state — GSAP never touched it.
    for (const sel of [EYEBROW, BODY, CTA]) {
      const s = await page.locator(sel).evaluate((el) => ({
        opacity: Number(getComputedStyle(el).opacity),
        inline: el.getAttribute("style") ?? "",
      }));
      expect(s.opacity, `${sel} fully visible under reduced motion`).toBe(1);
      expect(s.inline, `${sel} carries no entrance transform`).not.toContain("translate");
    }
    const headingOpacity = await page
      .locator(HEADING)
      .evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(headingOpacity, "heading fully visible under reduced motion").toBe(1);
  });
});
