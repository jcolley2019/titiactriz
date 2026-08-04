import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * EVENTS.I18N.1 — the public side, asserted UNCHANGED.
 *
 * The admin became a single field, and the stored `Localized` grew two pieces of
 * bookkeeping (`src`, `pending`). Neither is a public concept: a visitor still
 * reads whichever slot their language asks for, every string, always.
 *
 * This gate exists because the change that makes it interesting is invisible from
 * the admin. A parser that dropped a slot, or a card that started rendering its
 * `src` slot instead of the visitor's, would sail through every admin test and
 * break the site for half the audience.
 *
 * Laws:
 *
 *  1. ES VISITOR READS SPANISH — every localized string on the card.
 *  2. EN VISITOR READS ENGLISH — the same card, the other slot.
 *  3. `src` IS NOT A PUBLIC CONCEPT — a card the owner typed in English still
 *     reads Spanish to a Spanish visitor. Which slot was typed decides nothing
 *     about which slot is served.
 */

const CARD = {
  id: "birthday",
  size: "full",
  // Typed in English (src: "en"), translated into Spanish. A visitor must never
  // see this field — only its effect must be nothing.
  title: { es: "Fiesta de Cumpleaños", en: "Birthday Party", src: "en" },
  badge: { es: "ESTE SÁBADO", en: "THIS SATURDAY", src: "es" },
  description: {
    es: "Ven a celebrar conmigo el 8 de agosto.",
    en: "Come celebrate with me on August 8th.",
    src: "es",
  },
  note: { es: "Trae a quien quieras.", en: "Bring whoever you like.", src: "es" },
  buttons: [],
};

const BOARD = { pageVisible: true, items: [CARD] };

async function openEvents(page: Page, lng: "es" | "en") {
  await forceLanguage(page, lng);
  await routeSupabase(page, { eventsBoard: BOARD });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/events", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
}

test.describe("EVENTS.I18N.1 — the public site still serves per-locale", () => {
  test("a Spanish visitor reads every string in Spanish", async ({ page }) => {
    test.setTimeout(60_000);
    await openEvents(page, "es");

    // The shell renders its own <main>; the Events page is the inner one.
    const main = page.locator("main").last();
    // Law 1, and law 3 with it: the title was TYPED in English, and a Spanish
    // visitor still reads the Spanish.
    await expect(main).toContainText("Fiesta de Cumpleaños");
    await expect(main).toContainText("ESTE SÁBADO");
    await expect(main).toContainText("Ven a celebrar conmigo el 8 de agosto.");
    await expect(main).toContainText("Trae a quien quieras.");

    // The other locale is not leaking through alongside it.
    await expect(main).not.toContainText("Birthday Party");
    await expect(main).not.toContainText("Come celebrate with me");
  });

  test("an English visitor reads every string in English", async ({ page }) => {
    test.setTimeout(60_000);
    await openEvents(page, "en");

    // The shell renders its own <main>; the Events page is the inner one.
    const main = page.locator("main").last();
    await expect(main).toContainText("Birthday Party");
    await expect(main).toContainText("THIS SATURDAY");
    await expect(main).toContainText("Come celebrate with me on August 8th.");
    await expect(main).toContainText("Bring whoever you like.");

    await expect(main).not.toContainText("Fiesta de Cumpleaños");
    await expect(main).not.toContainText("Ven a celebrar conmigo");
  });
});
