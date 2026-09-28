import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, markCoachSeen, MOCK_ADMIN_ID, routeSupabase } from "./_admin";
import { coachSeenKey } from "../src/lib/coachState";
import { TOUR_IDS } from "../src/components/admin/coach/tours";

/**
 * ADMIN.COACH.1b — the tours of the other seven tabs (Galería, Medios,
 * Portafolio, Enlaces, Eventos, Ajustes, Mensajes). One test per tab, with only
 * that tab's tour unseen: on the first open it starts, each step spotlights its
 * control with the card inside the viewport, Siguiente walks it in order, and
 * Listo marks it seen — without a page error. Step 1 of each, at 1440×900,
 * lands in _qa/admin-coach/.
 */

const SHOTS = "_qa/admin-coach";
const KEY = coachSeenKey(MOCK_ADMIN_ID);

const CREDIT = {
  id: "c1",
  kind: "film",
  title_es: "El Casting",
  title_en: "The Casting",
  role_es: null,
  role_en: null,
  production: null,
  year: 2025,
  url: "https://example.com/el-casting",
  video_id: null,
  order_index: 1,
  enabled: true,
};

const LINK = {
  id: "s1",
  platform: "TikTok",
  url: "https://www.tiktok.com/@titi",
  handle: "@titi",
  title_es: null,
  title_en: null,
  og_title: "Titi on TikTok",
  og_description: "Dancer and actress",
  og_image: null,
  og_fetched_at: "2026-08-01T12:00:00.000Z",
  order_index: 1,
  enabled: true,
};

const TABS: { id: string; steps: string[]; route?: Parameters<typeof routeSupabase>[1] }[] = [
  // Four published mock photos; the first row carries the list and switch targets.
  { id: "gallery", steps: ["gallery.upload", "gallery.list", "gallery.published"] },
  { id: "media", steps: ["media.video", "media.slots", "media.slotActions"] },
  { id: "portfolio", steps: ["portfolio.add", "portfolio.credit"], route: { actingCredits: [CREDIT] } },
  { id: "links", steps: ["links.add", "links.order", "links.visible"], route: { socialLinks: [LINK] } },
  // No stored board: the default one, with its seeded card.
  { id: "events", steps: ["events.add", "events.date", "events.banner", "events.showUntil", "events.save"] },
  { id: "settings", steps: ["settings.fields", "settings.save"] },
  { id: "submissions", steps: ["submissions.soon"] },
];

/** The spotlight surrounds every element carrying the step's data-coach id. */
async function expectSpotlightOn(page: Page, step: string) {
  await expect
    .poll(async () => {
      const hole = await page.locator('[data-qa="coach-spotlight"]').boundingBox();
      const target = await page.evaluate((id) => {
        const rs = [...document.querySelectorAll(`[data-coach="${id}"]`)]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 || r.height > 0);
        if (rs.length === 0) return null;
        const top = Math.min(...rs.map((r) => r.top));
        const left = Math.min(...rs.map((r) => r.left));
        return {
          x: left,
          y: top,
          right: Math.max(...rs.map((r) => r.right)),
          bottom: Math.max(...rs.map((r) => r.bottom)),
        };
      }, step);
      if (!hole || !target) return false;
      return (
        hole.x <= target.x + 1 &&
        hole.y <= target.y + 1 &&
        hole.x + hole.width >= target.right - 1 &&
        hole.y + hole.height >= target.bottom - 1
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

for (const [n, tab] of TABS.entries()) {
  test(`T${n + 1}: the ${tab.id} tour walks its ${tab.steps.length} step(s) on the first open`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await forceLanguage(page, "es");
    await injectAdminSession(page, { coachSeen: false });
    await markCoachSeen(page, TOUR_IDS.filter((id) => id !== tab.id));
    await routeSupabase(page, tab.route);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="admin-shell"]')).toBeVisible();
    // Galería is the tab the admin opens on, so its tour greets the sign-in itself.
    if (tab.id !== "gallery") await page.locator(`[data-qa="admin-nav-${tab.id}"]`).click();

    const overlay = page.locator('[data-qa="coach-overlay"]');
    const next = page.locator('[data-qa="coach-next"]');
    for (const [i, step] of tab.steps.entries()) {
      await expect(overlay).toHaveAttribute("data-tour", tab.id);
      await expect(overlay).toHaveAttribute("data-step", step);
      await expect(page.locator('[data-qa="coach-progress"]')).toHaveText(`Paso ${i + 1} de ${tab.steps.length}`);
      await expectSpotlightOn(page, step);
      await expectCardInside(page);
      if (i === 0) await page.screenshot({ path: `${SHOTS}/tour-${tab.id}-step1-1440.png` });
      await expect(next).toHaveText(i === tab.steps.length - 1 ? "Listo" : "Siguiente");
      await next.click();
    }
    await expect(overlay).toHaveCount(0);
    const seen = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "[]") as string[], KEY);
    expect(seen).toContain(tab.id);
    expect(errors).toEqual([]);
  });
}
