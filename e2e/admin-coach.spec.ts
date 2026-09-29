import { expect, test, type Locator, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, markCoachSeen, MOCK_ADMIN_ID, routeSupabase } from "./_admin";
import { coachSeenKey } from "../src/lib/coachState";
import { TOUR_IDS } from "../src/components/admin/coach/tours";

/**
 * ADMIN.COACH.1 — coaching tips: the first time Titi opens a tab, it walks her
 * through the buttons in order.
 *
 *   C1 first open of Estudio: the overlay on the brain dump, "Paso 1 de N";
 *      Siguiente walks to Generar; Listo closes and marks "studio" seen
 *   C2 after a reload, Estudio opens with no overlay
 *   C3 Esc on step 2 marks the tour seen
 *   C4 Guía › Consejos is a card per tour in tab-bar order (icon, name, one
 *      line, "N pasos"); the Estudio card goes there and shows the tour,
 *      switch step included; Reiniciar todos los consejos removes the key
 *   C5 at 820×1180 the card stays inside the viewport on every Estudio step
 *   C6 the Blog tour on an empty blog skips the row step without error
 *   C7 the Blog editor tour fires on the first open entry, and its Consejos
 *      card (Editor del blog) opens a blank entry and walks it
 *   C8 the Estudio card: empty circle, the check once the tour is done, the
 *      empty circle again after Reiniciar
 *   C9 Consejos folds under a chevron (ADMIN.COACH.1d/1e): open on the first
 *      visit; a click anywhere on the row collapses it, "n/10 vistos" shows,
 *      a reload keeps it collapsed; Reiniciar (in the row, right-aligned)
 *      works while collapsed — toast, checks cleared, still collapsed; opened,
 *      a reload keeps it open (screenshots collapsed and open)
 *   grid: 3 columns at 1440, 2 at 1024, 1 at 820 (screenshots)
 *
 * Each test runs in a fresh browser context, so the seen-state starts empty;
 * the tours this spec is not about start seen, so only these ones can fire.
 * Screenshots land in _qa/admin-coach/.
 */

const SHOTS = "_qa/admin-coach";
const KEY = coachSeenKey(MOCK_ADMIN_ID);
const UNDER_TEST = ["studio", "blog", "blogEditor"];

/** The Estudio tour on a fresh Studio: no generation (no Publicar), no history. */
const STUDIO_STEPS = [
  "studio.brainDump",
  "studio.format",
  "studio.platforms",
  "studio.language",
  "studio.webSearch",
  "studio.generate",
  "studio.output",
  "studio.voice",
];

test.beforeEach(async ({ page }) => {
  await forceLanguage(page, "es");
  await injectAdminSession(page, { coachSeen: false });
  await markCoachSeen(page, TOUR_IDS.filter((id) => !UNDER_TEST.includes(id)));
  await routeSupabase(page);
});

const overlay = (page: Page) => page.locator('[data-qa="coach-overlay"]');
const next = (page: Page) => page.locator('[data-qa="coach-next"]');
const rawSeen = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);
/** The seen tours among the ones this spec is about; null when the key is absent. */
const seenIds = async (page: Page) => {
  const raw = await rawSeen(page);
  return raw === null ? null : (JSON.parse(raw) as string[]).filter((id) => UNDER_TEST.includes(id));
};

async function openSection(page: Page, id: string) {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-qa="admin-shell"]')).toBeVisible();
  await page.locator(`[data-qa="admin-nav-${id}"]`).click();
  await expect(page.locator(`[data-qa="admin-section-${id}"]`)).toBeVisible();
}

/** The spotlight's cut-out surrounds the target's box. */
async function expectSpotlightOn(page: Page, target: Locator) {
  await expect
    .poll(async () => {
      const hole = await page.locator('[data-qa="coach-spotlight"]').boundingBox();
      const box = await target.boundingBox();
      if (!hole || !box) return false;
      return (
        hole.x <= box.x + 1 &&
        hole.y <= box.y + 1 &&
        hole.x + hole.width >= box.x + box.width - 1 &&
        hole.y + hole.height >= box.y + box.height - 1
      );
    })
    .toBe(true);
}

/** The card sits inside the viewport, at least 16px from every edge. */
async function expectCardInside(page: Page) {
  await expect
    .poll(async () => {
      const card = await page.locator('[data-qa="coach-card"]').boundingBox();
      const vp = await page.evaluate(() => ({
        w: document.documentElement.clientWidth,
        h: document.documentElement.clientHeight,
      }));
      if (!card) return "no card";
      const ok =
        card.x >= 15.5 && card.y >= 15.5 && card.x + card.width <= vp.w - 15.5 && card.y + card.height <= vp.h - 15.5;
      return ok ? "inside" : JSON.stringify({ card, vp });
    })
    .toBe("inside");
}

test("C1: first open of Estudio walks from the brain dump to Generar, and Listo marks it seen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSection(page, "studio");

  await expect(overlay(page)).toHaveAttribute("data-tour", "studio");
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.brainDump");
  await expect(page.locator('[data-qa="coach-progress"]')).toHaveText(`Paso 1 de ${STUDIO_STEPS.length}`);
  await expect(page.locator('[data-qa="coach-back"]')).toBeDisabled();
  await expectSpotlightOn(page, page.locator('[data-qa="studio-brain-dump"]'));
  await expectCardInside(page);
  await page.screenshot({ path: `${SHOTS}/estudio-step1-light-1440.png` });

  // Siguiente walks the controls in order, up to Generar.
  for (const [i, step] of STUDIO_STEPS.slice(1, 6).entries()) {
    await next(page).click();
    await expect(overlay(page)).toHaveAttribute("data-step", step);
    await expect(page.locator('[data-qa="coach-progress"]')).toHaveText(`Paso ${i + 2} de ${STUDIO_STEPS.length}`);
    if (step === "studio.webSearch") {
      await expectSpotlightOn(page, page.locator('[data-qa="studio-web-search"]'));
      await expect(page.locator('[data-qa="coach-title"]')).toHaveText("Investigar en la web");
      await expectCardInside(page);
      await page.screenshot({ path: `${SHOTS}/estudio-switch-light-1440.png` });
    }
  }
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.generate");
  await expectSpotlightOn(page, page.locator('[data-qa="studio-generate"]'));

  // The rest: Contenido generado, then Voz (Publicar and Historial need a generation).
  await next(page).click();
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.output");
  await next(page).click();
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.voice");
  await expect(next(page)).toHaveText("Listo");
  expect((await seenIds(page)) ?? []).not.toContain("studio");

  await next(page).click();
  await expect(overlay(page)).toHaveCount(0);
  expect(await seenIds(page)).toContain("studio");
});

test("C2: after a reload, Estudio opens with no overlay", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSection(page, "studio");
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.brainDump");
  await page.locator('[data-qa="coach-skip"]').click();
  await expect(overlay(page)).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  // The admin reopens on Estudio (ADMIN.TAB.1).
  await expect(page.locator('[data-qa="studio"]')).toBeVisible();
  await expect(page.locator('[data-qa="studio-brain-dump"]')).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(overlay(page)).toHaveCount(0);
  expect(await seenIds(page)).toEqual(["studio"]);
});

test("C3: Esc on step 2 marks the tour seen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSection(page, "studio");
  await next(page).click();
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.format");

  await page.keyboard.press("ArrowLeft");
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.brainDump");
  await page.keyboard.press("ArrowRight");
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.format");

  await page.keyboard.press("Escape");
  await expect(overlay(page)).toHaveCount(0);
  expect(await seenIds(page)).toEqual(["studio"]);
});

test("C4: Guía › Consejos cards: the Estudio card shows the tour again; Reiniciar removes the key", async ({ page }) => {
  await markCoachSeen(page, ["studio"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSection(page, "guide");
  const tips = page.locator('[data-qa="coach-tips"]');
  await expect(tips).toBeVisible();
  await expect(tips.locator("h2")).toHaveText("Consejos");
  await expect(overlay(page)).toHaveCount(0);

  // One card per tour, in tab-bar order, each a button with its step count.
  const cards = tips.locator('[data-qa^="coach-replay-"]');
  await expect(cards).toHaveCount(TOUR_IDS.length);
  expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-qa")))).toEqual(
    ["gallery", "media", "portfolio", "links", "events", "blog", "blogEditor", "studio", "settings", "submissions"].map(
      (id) => `coach-replay-${id}`,
    ),
  );
  const studioCard = page.locator('[data-qa="coach-replay-studio"]');
  expect(await studioCard.evaluate((e) => e.tagName)).toBe("BUTTON");
  await expect(studioCard).toContainText("Estudio");
  await expect(studioCard).toContainText("Cuenta lo que tienes en la cabeza y conviértelo en artículo y posts");
  await expect(studioCard.locator("svg").first()).toHaveClass(/lucide-sparkles/);
  await expect(page.locator('[data-qa="coach-steps-studio"]')).toHaveText("10 pasos");
  await expect(page.locator('[data-qa="coach-steps-blogEditor"]')).toHaveText("6 pasos");
  await expect(page.locator('[data-qa="coach-replay-blogEditor"]').locator("svg").first()).toHaveClass(/lucide-pen-line/);
  await expect(page.locator('[data-qa="coach-steps-submissions"]')).toHaveText("1 paso");
  await expect(page.locator('[data-qa="coach-reset"]')).toHaveText("Reiniciar todos los consejos");
  await expect(page.locator('[data-qa="coach-reset"]').locator("svg")).toHaveClass(/lucide-rotate-ccw/);
  await page.screenshot({ path: `${SHOTS}/consejos-card-1440.png` });

  await studioCard.click();
  await expect(page.locator('[data-qa="admin-section-studio"]')).toBeVisible();
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.brainDump");
  await page.keyboard.press("Enter");
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.format");
  while ((await overlay(page).getAttribute("data-step")) !== "studio.webSearch") await next(page).click();
  await expectSpotlightOn(page, page.locator('[data-qa="studio-web-search"]'));
  await page.locator('[data-qa="coach-skip"]').click();
  await expect(overlay(page)).toHaveCount(0);

  await page.locator('[data-qa="admin-nav-guide"]').click();
  expect(await seenIds(page)).toContain("studio");
  await page.locator('[data-qa="coach-reset"]').click();
  await expect(page.getByText("Consejos reiniciados", { exact: true })).toBeVisible();
  expect(await rawSeen(page)).toBeNull();
});

test("C5: at 820×1180 the card stays inside the viewport on every Estudio step", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openSection(page, "studio");
  for (const [i, step] of STUDIO_STEPS.entries()) {
    await expect(overlay(page)).toHaveAttribute("data-step", step);
    await expectCardInside(page);
    if (i < STUDIO_STEPS.length - 1) await next(page).click();
  }
  await next(page).click();
  await expect(overlay(page)).toHaveCount(0);
});

test("C6: the Blog tour on an empty blog skips the row step without error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 820, height: 1180 });
  await openSection(page, "blog");
  await expect(page.locator('[data-qa="blog-empty"]')).toBeVisible();

  await expect(overlay(page)).toHaveAttribute("data-tour", "blog");
  await expect(overlay(page)).toHaveAttribute("data-step", "blog.new");
  await expect(page.locator('[data-qa="coach-progress"]')).toHaveText("Paso 1 de 1");
  await expectSpotlightOn(page, page.locator('[data-qa="blog-new"]'));
  await expectCardInside(page);
  await expect(next(page)).toHaveText("Listo");
  await page.screenshot({ path: `${SHOTS}/blog-step1-820.png` });

  await next(page).click();
  await expect(overlay(page)).toHaveCount(0);
  expect(await seenIds(page)).toEqual(["blog"]);
  expect(errors).toEqual([]);
});

test("C7: the Blog editor tour fires on the first open entry, and its card opens a blank one", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSection(page, "blog");
  await expect(overlay(page)).toHaveAttribute("data-step", "blog.new");
  await next(page).click();
  await expect(overlay(page)).toHaveCount(0);

  // A new entry: the editor tour, without Ver en el sitio / Eliminar (nothing saved yet).
  await page.locator('[data-qa="blog-new"]').click();
  await expect(page.locator('[data-qa="blog-editor"]')).toBeVisible();
  const editorSteps = ["blogEditor.fields", "blogEditor.cover", "blogEditor.translation", "blogEditor.status", "blogEditor.save"];
  for (const [i, step] of editorSteps.entries()) {
    await expect(overlay(page)).toHaveAttribute("data-step", step);
    await expect(page.locator('[data-qa="coach-progress"]')).toHaveText(`Paso ${i + 1} de ${editorSteps.length}`);
    await expectCardInside(page);
    await next(page).click();
  }
  await expect(overlay(page)).toHaveCount(0);
  expect(await seenIds(page)).toEqual(["blog", "blogEditor"]);

  // Guía › Consejos › Editor del blog: a blank entry, walked again.
  await page.locator('[data-qa="blog-back"]').click();
  await page.locator('[data-qa="admin-nav-guide"]').click();
  await page.locator('[data-qa="coach-replay-blogEditor"]').click();
  await expect(page.locator('[data-qa="blog-editor"]')).toBeVisible();
  await expect(page.locator('[data-qa="blog-editor"]')).toHaveAttribute("data-post-id", "");
  await expect(overlay(page)).toHaveAttribute("data-step", "blogEditor.fields");
  await expectSpotlightOn(page, page.locator('[data-qa="blog-field-title"]'));
});

test("screenshots: Estudio step 1 and the switch step, dark, 1440×900", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("admin.theme", "dark"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSection(page, "studio");
  await expect(page.locator('[data-qa="studio"]')).toHaveAttribute("data-theme", "dark");
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.brainDump");
  await expectSpotlightOn(page, page.locator('[data-qa="studio-brain-dump"]'));
  await page.screenshot({ path: `${SHOTS}/estudio-step1-dark-1440.png` });
  while ((await overlay(page).getAttribute("data-step")) !== "studio.webSearch") await next(page).click();
  await expectSpotlightOn(page, page.locator('[data-qa="studio-web-search"]'));
  await page.screenshot({ path: `${SHOTS}/estudio-switch-dark-1440.png` });
});

test("C8: the Estudio card shows the empty circle, the check once the tour is done, and the empty circle after Reiniciar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSection(page, "guide");
  const card = page.locator('[data-qa="coach-replay-studio"]');
  await expect(card).toHaveAttribute("data-seen", "false");
  await expect(card.locator('[data-qa="coach-unseen-studio"]')).toBeVisible();
  await expect(card.locator('[data-qa="coach-seen-studio"]')).toHaveCount(0);

  // Walk the whole tour to Listo.
  await card.click();
  await expect(overlay(page)).toHaveAttribute("data-step", "studio.brainDump");
  while ((await next(page).textContent()) !== "Listo") await next(page).click();
  await next(page).click();
  await expect(overlay(page)).toHaveCount(0);

  await page.locator('[data-qa="admin-nav-guide"]').click();
  await expect(card).toHaveAttribute("data-seen", "true");
  await expect(card.locator('[data-qa="coach-seen-studio"]')).toBeVisible();
  await expect(card.locator('[data-qa="coach-seen-studio"]')).toHaveClass(/lucide-circle-check|lucide-check-circle/);
  await expect(card.locator('[data-qa="coach-unseen-studio"]')).toHaveCount(0);

  // Reiniciar flips it back on the spot, no reload.
  await page.locator('[data-qa="coach-reset"]').click();
  await expect(card).toHaveAttribute("data-seen", "false");
  await expect(card.locator('[data-qa="coach-unseen-studio"]')).toBeVisible();
  expect(await rawSeen(page)).toBeNull();
});

test("C9: Consejos folds under a chevron — open by default, remembered, and Reiniciar works folded without unfolding", async ({ page }) => {
  const TIPS_KEY = "admin.coach.tipsOpen";
  await page.setViewportSize({ width: 1440, height: 900 });
  const tips = page.locator('[data-qa="coach-tips"]');
  const toggle = page.locator('[data-qa="coach-tips-toggle"]');
  const body = page.locator('[data-qa="coach-tips-body"]');
  const count = page.locator('[data-qa="coach-tips-count"]');
  const reset = page.locator('[data-qa="coach-reset"]');
  const tipsOpen = () => page.evaluate((k) => localStorage.getItem(k), TIPS_KEY);
  const expectOpen = async () => {
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator('[data-qa="coach-replay-studio"]')).toBeVisible();
    await expect(count).toHaveCount(0);
    await expect(reset).toBeVisible();
  };
  const expectCollapsed = async () => {
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator('[data-qa="coach-replay-studio"]')).toBeHidden();
    // The grid is gone from the layout, not just faded; Reiniciar stays in the row.
    await expect.poll(async () => (await body.boundingBox())?.height ?? -1).toBeLessThan(1);
    await expect(reset).toBeVisible();
  };
  // Reiniciar sits at the right of the title row, after the count when there is one.
  const expectResetInRow = async () => {
    const r = (await reset.boundingBox())!;
    const t = (await tips.boundingBox())!;
    const g = (await toggle.boundingBox())!;
    expect(Math.abs(r.x + r.width - (t.x + t.width - 24))).toBeLessThan(2);
    expect(r.y).toBeLessThan(g.y + 40);
    if (await count.count()) expect((await count.boundingBox())!.x + (await count.boundingBox())!.width).toBeLessThanOrEqual(r.x);
  };

  // First visit: open, nothing remembered yet.
  await openSection(page, "guide");
  await expect(toggle).toHaveAttribute("aria-controls", (await body.getAttribute("id"))!);
  await expectOpen();
  await expectResetInRow();
  expect(await tipsOpen()).toBeNull();

  // Collapse (by a click on the intro: anywhere on the row toggles), remembered.
  const intro = (await page.getByText("La primera vez que abres una pestaña", { exact: false }).boundingBox())!;
  await page.mouse.click(intro.x + intro.width / 2, intro.y + intro.height / 2);
  await expectCollapsed();
  expect(await tipsOpen()).toBe("false");
  const seenBefore = TOUR_IDS.length - UNDER_TEST.length; // beforeEach marks every other tour seen
  await expect(count).toHaveText(`${seenBefore}/${TOUR_IDS.length} vistos`);
  await expectResetInRow();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(350); // the height/opacity transition
  await tips.screenshot({ path: `${SHOTS}/consejos-collapsed-1440.png` });

  // A reload stays collapsed.
  await openSection(page, "guide");
  await expectCollapsed();

  // Reiniciar works while collapsed: the toast, every check cleared, still collapsed.
  await reset.click();
  await expect(page.getByText("Consejos reiniciados", { exact: true })).toBeVisible();
  expect(await rawSeen(page)).toBeNull();
  await expect(count).toHaveText(`0/${TOUR_IDS.length} vistos`);
  await expect(page.locator('[data-qa^="coach-replay-"][data-seen="true"]')).toHaveCount(0);
  await expectCollapsed();
  expect(await tipsOpen()).toBe("false");
  // Close the toast so it is not in the open screenshot.
  await page.locator("[data-toasts] li [toast-close]").first().click({ force: true });
  await expect(page.locator("[data-toasts] li")).toHaveCount(0);

  // Open it: the empty circles, remembered.
  await toggle.click();
  await expectOpen();
  await expect(page.locator('[data-qa^="coach-unseen-"]')).toHaveCount(TOUR_IDS.length);
  await expect(page.locator('[data-qa="coach-tips-chevron"]')).toHaveClass(/rotate-180/);
  expect(await tipsOpen()).toBe("true");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(350);
  await tips.screenshot({ path: `${SHOTS}/consejos-open-1440.png` });

  // A reload stays open.
  await openSection(page, "guide");
  await expectOpen();
  await expectResetInRow();
});

const gridColumns = (page: Page) =>
  page
    .locator('[data-qa="coach-tips"] ul')
    .evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").filter(Boolean).length);

test("grid: 3 columns at 1440, 2 at 1024, 1 at 820; screenshots", async ({ page }) => {
  await markCoachSeen(page, ["studio", "blog"]);
  for (const [w, h, cols, name] of [
    [1440, 900, 3, "consejos-grid-dark-1440x900"],
    [1024, 1366, 2, "consejos-grid-1024x1366"],
    [820, 1180, 1, "consejos-grid-820x1180"],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    if (w === 1440) await openSection(page, "guide");
    await expect.poll(() => gridColumns(page)).toBe(cols);
    const reset = await page.locator('[data-qa="coach-reset"]').boundingBox();
    const tips = await page.locator('[data-qa="coach-tips"]').boundingBox();
    // Right-aligned: the button ends where the card's padding ends.
    expect(Math.abs(reset!.x + reset!.width - (tips!.x + tips!.width - 24))).toBeLessThan(2);
    await page.locator('[data-qa="coach-tips"]').screenshot({ path: `${SHOTS}/${name}.png` });
  }
});
