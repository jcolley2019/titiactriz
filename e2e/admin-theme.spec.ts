import { expect, test, type Page, type Route } from "@playwright/test";
import { forceLanguage, injectAdminSession, markCoachSeen, routeSupabase } from "./_admin";
import { TOUR_IDS } from "../src/components/admin/coach/tours";

/**
 * ADMIN.THEME.1 — light and dark for the whole admin, light (the Studio's Luxe)
 * by default.
 *
 *  TH1 first open is light; the header toggle flips to dark, a reload keeps
 *      dark, and the toggle brings light back.
 *  TH2 the Studio's `.studio[data-theme]` matches the admin theme in both states.
 *  TH3 a public page never carries `data-admin-theme`, and its background is the
 *      site's own — on a fresh load and after leaving a light admin in-app. The
 *      site's own chrome stays dark over a light admin (Joey's ruling): the body
 *      keeps its charcoal and the header is a solid dark bar from the top.
 *  TH4 a `studio.theme=dark` left by the old Studio toggle (and no `admin.theme`)
 *      opens the admin dark, once, and the old key is gone.
 *  TH5 what renders outside the wrapper on the admin's behalf wears its theme:
 *      a menu and a dialog (Radix portals) and the toasts.
 *
 * Screenshots land in _qa/admin-theme/.
 */

const SHOTS = "_qa/admin-theme";
const CREAM = "rgb(250, 246, 240)"; // #faf6f0
const CHARCOAL = "rgb(18, 18, 18)"; // hsl(0 0% 7%), the site's --background

const SECTIONS = [
  "gallery",
  "media",
  "portfolio",
  "links",
  "events",
  "blog",
  "studio",
  "guide",
  "settings",
  "submissions",
] as const;

const root = (page: Page) => page.locator("[data-admin-theme]");
const toggle = (page: Page) => page.locator('[data-qa="admin-theme-toggle"]');
const bgOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

async function openAdmin(page: Page) {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-qa="admin-shell"]')).toBeVisible();
}

async function openSection(page: Page, id: string) {
  await page.locator(`[data-qa="admin-nav-${id}"]`).click();
  await expect(page.locator(`[data-qa="admin-section-${id}"]`)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await forceLanguage(page, "es");
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminSession(page);
    await routeSupabase(page);
  });

  test("TH1 first open is light; toggle → dark, reload → dark, toggle → light", async ({ page }) => {
    await openAdmin(page);
    await expect(root(page)).toHaveAttribute("data-admin-theme", "light");
    expect(await bgOf(page, "[data-admin-theme]")).toBe(CREAM);
    // The toggle names the theme it switches TO.
    await expect(toggle(page)).toHaveText("Oscuro");
    await expect(toggle(page)).toHaveAttribute("aria-label", "Tema: Claro");

    await toggle(page).click();
    await expect(root(page)).toHaveAttribute("data-admin-theme", "dark");
    expect(await bgOf(page, "[data-admin-theme]")).toBe(CHARCOAL);
    await expect(toggle(page)).toHaveText("Claro");
    expect(await stored(page, "admin.theme")).toBe("dark");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="admin-shell"]')).toBeVisible();
    await expect(root(page)).toHaveAttribute("data-admin-theme", "dark");

    await toggle(page).click();
    await expect(root(page)).toHaveAttribute("data-admin-theme", "light");
    expect(await bgOf(page, "[data-admin-theme]")).toBe(CREAM);
    expect(await stored(page, "admin.theme")).toBe("light");
  });

  test("TH1b the toggle sits in the header, left of Cerrar sesión", async ({ page }) => {
    await openAdmin(page);
    const t = await toggle(page).boundingBox();
    const out = await page.getByRole("button", { name: "Cerrar sesión" }).boundingBox();
    expect(t && out).toBeTruthy();
    expect(t!.x + t!.width).toBeLessThanOrEqual(out!.x);
    expect(Math.abs(t!.y - out!.y)).toBeLessThan(2);

    // At phone width both stay whole on screen (the body clips anything past
    // the edge, so a no-sideways-scroll check alone cannot see this).
    await page.setViewportSize({ width: 390, height: 844 });
    for (const button of [toggle(page), page.getByRole("button", { name: "Cerrar sesión" })]) {
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }
  });

  test("TH2 the Studio's data-theme follows the admin theme both ways", async ({ page }) => {
    await openAdmin(page);
    await openSection(page, "studio");
    const studio = page.locator('[data-qa="studio"]');
    await expect(studio).toHaveAttribute("data-theme", "light");
    await expect(page.locator('[data-qa="studio-theme-toggle"]')).toHaveCount(0);
    await toggle(page).click();
    await expect(studio).toHaveAttribute("data-theme", "dark");
    await expect(root(page)).toHaveAttribute("data-admin-theme", "dark");
    await toggle(page).click();
    await expect(studio).toHaveAttribute("data-theme", "light");
    await expect(root(page)).toHaveAttribute("data-admin-theme", "light");
  });

  test("TH3 a public page has no data-admin-theme and keeps the site's background", async ({ page }) => {
    // A fresh load of / with the admin's choice on record.
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("admin.theme", "light"));
    await page.reload();
    await expect(page.locator("#root main")).toBeVisible();
    await expect(root(page)).toHaveCount(0);
    expect(await bgOf(page, "body")).toBe(CHARCOAL);
    const tokens = () =>
      page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--background").trim());
    expect(await tokens()).toBe("0 0% 7%");

    // Over a light admin the site's chrome keeps the site's dark.
    await openAdmin(page);
    await expect(root(page)).toHaveAttribute("data-admin-theme", "light");
    expect(await bgOf(page, "body")).toBe(CHARCOAL);
    expect(await tokens()).toBe("0 0% 7%");
    await expect.poll(() => bgOf(page, "[data-site-header]")).toBe("rgba(18, 18, 18, 0.95)");
    expect(await bgOf(page, "footer")).toBe("rgba(18, 18, 18, 0.8)");

    // Leaving a light admin in-app: nothing of the admin's theme stays behind.
    await page.locator('a[aria-label="Cristyna Polentino — Home"]:visible').click();
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe("/");
    await expect(root(page)).toHaveCount(0);
    await expect.poll(() => bgOf(page, "body")).toBe(CHARCOAL);
    expect(await tokens()).toBe("0 0% 7%");
    // At the top of the cinematic home the header is transparent again.
    await expect.poll(() => bgOf(page, "[data-site-header]")).toBe("rgba(0, 0, 0, 0)");
  });

  test("TH4 an old studio.theme=dark opens the admin dark, and the old key is gone", async ({ page }) => {
    await page.addInitScript(() => {
      // Seed once: a reload must not put the old key back.
      if (sessionStorage.getItem("th4.seeded")) return;
      sessionStorage.setItem("th4.seeded", "1");
      localStorage.removeItem("admin.theme");
      localStorage.setItem("studio.theme", "dark");
    });
    await openAdmin(page);
    await expect(root(page)).toHaveAttribute("data-admin-theme", "dark");
    expect(await stored(page, "studio.theme")).toBeNull();
    expect(await stored(page, "admin.theme")).toBe("dark");
    await openSection(page, "studio");
    await expect(page.locator('[data-qa="studio"]')).toHaveAttribute("data-theme", "dark");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(root(page)).toHaveAttribute("data-admin-theme", "dark");
  });
});

/** Open the first gallery row's menu, archive it (a toast), then ask to delete the next (a dialog). */
async function walkPortals(page: Page, shoot?: (name: string) => Promise<void>) {
  await openSection(page, "gallery");
  await page.getByRole("button", { name: "Más", exact: true }).first().click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await shoot?.("menu");
  const menuBg = await menu.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.getByRole("menuitem", { name: "Archivar" }).click();
  const toast = page.locator("[data-toasts] li").first();
  await expect(toast).toBeVisible();
  await shoot?.("toast");
  const toastBg = await toast.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.getByRole("button", { name: "Más", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await shoot?.("dialog");
  const dialogBg = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
  // A dialog's title has no colour class: it inherits, and must inherit the
  // admin's ink rather than the dark body's ivory.
  const titleInk = await dialog
    .getByRole("heading")
    .evaluate((el) => getComputedStyle(el).color === getComputedStyle(document.querySelector("[data-admin-theme]")!).color);
  return { menuBg, toastBg, dialogBg, titleInk };
}

test.describe("portals", () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminSession(page);
    await routeSupabase(page);
  });

  test("TH5 a menu, a toast and a dialog wear the admin theme, light and dark", async ({ page }) => {
    await openAdmin(page);
    expect(await walkPortals(page)).toEqual({
      menuBg: "rgb(245, 239, 230)", // --popover, #f5efe6
      toastBg: CREAM, // --background
      dialogBg: CREAM,
      titleInk: true,
    });
    await page.evaluate(() => localStorage.setItem("admin.theme", "dark"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(root(page)).toHaveAttribute("data-admin-theme", "dark");
    expect(await walkPortals(page)).toEqual({
      menuBg: "rgb(26, 26, 26)", // hsl(0 0% 10%)
      toastBg: CHARCOAL,
      dialogBg: CHARCOAL,
      titleInk: true,
    });
  });
});

test("TH1c the sign-in screen wears the admin theme", async ({ page }) => {
  await routeSupabase(page);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.locator("form #email")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-admin-theme", "light");
  expect(await bgOf(page, "[data-admin-theme]")).toBe(CREAM);
  await page.evaluate(() => localStorage.setItem("admin.theme", "dark"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("form #email")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-admin-theme", "dark");
});

/* ---------------- Screenshots ---------------- */

const LINKS = [
  { id: "s1", platform: "TikTok", url: "https://www.tiktok.com/@titi", handle: "@titi", title_es: null, title_en: null,
    og_title: "Titi on TikTok", og_description: "Dancer and actress", og_image: null,
    og_fetched_at: "2026-08-01T12:00:00.000Z", order_index: 1, enabled: true },
  { id: "s2", platform: "Instagram", url: "https://www.instagram.com/titi", handle: null, title_es: null, title_en: null,
    og_title: null, og_description: null, og_image: null, og_fetched_at: null, order_index: 2, enabled: false },
];

const CREDITS = [
  { id: "c1", kind: "reel", title_es: "El Casting", title_en: "The Casting", role_es: null, role_en: null,
    production: null, year: 2025, url: "https://example.com/el-casting", video_id: null, order_index: 1, enabled: true },
  { id: "c2", kind: "film", title_es: "Segundo", title_en: "Second", role_es: null, role_en: null,
    production: null, year: null, url: null, video_id: null, order_index: 2, enabled: false },
];

const iso = (d: string) => new Date(d).toISOString();
const POSTS = [
  { id: "b2", slug: "bailar-en-medellin", status: "published", published_at: iso("2026-09-12T15:00:00Z"),
    created_at: iso("2026-09-10T15:00:00Z"), updated_at: iso("2026-09-12T15:00:00Z"),
    title: { es: "Bailar en Medellín", en: "Dancing in Medellín", src: "es" },
    excerpt: { es: "Lo que la ciudad me enseña.", en: "", src: "es" },
    body: { es: "La ciudad baila.", en: "The city dances.", src: "es" },
    meta_description: null, tags: ["baile"], cover_photo_id: null },
  { id: "b3", slug: "borrador", status: "draft", published_at: null,
    created_at: iso("2026-09-22T15:00:00Z"), updated_at: iso("2026-09-22T15:00:00Z"),
    title: { es: "Un borrador", en: "", src: "es" },
    excerpt: { es: "", en: "", src: "es" }, body: { es: "Texto.", en: "", src: "es" },
    meta_description: null, tags: [], cover_photo_id: null },
];

async function routeContent(page: Page) {
  await routeSupabase(page, { actingCredits: CREDITS, socialLinks: LINKS });
  await page.route("**/rest/v1/blog_posts*", (route: Route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(POSTS) })
      : route.fallback(),
  );
}

async function settle(page: Page) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(700);
}

test.describe("screenshots", () => {
  test("every tab, light and dark, 1440×900", async ({ page }) => {
    test.setTimeout(240_000);
    await injectAdminSession(page);
    await routeContent(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await page.evaluate((t) => localStorage.setItem("admin.theme", t), theme);
      await openAdmin(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(root(page)).toHaveAttribute("data-admin-theme", theme);
      for (const id of SECTIONS) {
        await openSection(page, id);
        await settle(page);
        await page.screenshot({ path: `${SHOTS}/${id}-${theme}-1440x900.png`, fullPage: true });
      }
    }
  });

  test("the sign-in screen, light and dark", async ({ page }) => {
    await routeSupabase(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await page.evaluate((t) => localStorage.setItem("admin.theme", t), theme);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("form #email")).toBeVisible();
      await expect(root(page)).toHaveAttribute("data-admin-theme", theme);
      await settle(page);
      await page.screenshot({ path: `${SHOTS}/signin-${theme}-1440x900.png`, fullPage: true });
    }
  });

  test("the coach on Estudio step 1, light and dark", async ({ page }) => {
    await injectAdminSession(page, { coachSeen: false });
    await markCoachSeen(page, TOUR_IDS.filter((id) => id !== "studio"));
    await routeContent(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      // Reopen straight onto Estudio (ADMIN.TAB.1 remembers it): its tour then
      // starts before any tab click, which the overlay would intercept.
      await page.evaluate((t) => {
        localStorage.setItem("admin.theme", t);
        localStorage.setItem("admin.section", "studio");
      }, theme);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-qa="admin-section-studio"]')).toBeVisible();
      const overlay = page.locator('[data-qa="coach-overlay"]');
      await expect(overlay).toHaveAttribute("data-step", "studio.brainDump");
      await settle(page);
      await page.screenshot({ path: `${SHOTS}/coach-estudio-step1-${theme}-1440x900.png` });
    }
  });

  test("a menu, a toast, a dialog, a failed-write toast and the dirty save bars, light and dark", async ({ page }) => {
    test.setTimeout(180_000);
    await injectAdminSession(page);
    await routeContent(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await page.evaluate((t) => {
        localStorage.setItem("admin.theme", t);
        localStorage.setItem("admin.section", "gallery");
      }, theme);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(root(page)).toHaveAttribute("data-admin-theme", theme);
      await walkPortals(page, async (name) => {
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/portal-${name}-${theme}-1440x900.png` });
      });
      await page.keyboard.press("Escape");
      // A write that fails: the destructive toast.
      await page.route("**/rest/v1/gallery_photos*", (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' })
          : route.fallback(),
      );
      await page.getByRole("switch").first().click();
      await expect(page.locator("[data-toasts] li.destructive").first()).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/portal-toast-failed-${theme}-1440x900.png` });
      await page.unroute("**/rest/v1/gallery_photos*");
      // Let it close (Radix's 5 s) so it does not cover the save bars below.
      await expect(page.locator("[data-toasts] li")).toHaveCount(0, { timeout: 15_000 });
      // The save bars, dirty: the Events board, then Ajustes › Portada.
      await openSection(page, "events");
      await page.locator('[data-qa="event-title"]').first().fill("Un evento sin guardar");
      await expect(page.locator('[data-qa="events-save-bar"]')).toHaveAttribute("data-dirty", "true");
      await settle(page);
      await page.screenshot({ path: `${SHOTS}/savebar-events-${theme}-1440x900.png` });
      await page.getByRole("button", { name: "Descartar" }).first().click();
      await openSection(page, "settings");
      await page.locator('[data-qa="hero-copy-intro"]').fill("Una frase sin guardar.");
      await settle(page);
      await page.screenshot({ path: `${SHOTS}/savebar-settings-${theme}-1440x900.png` });
      await page.getByRole("button", { name: "Descartar" }).first().click();
    }
  });

  test("Estudio and Blog, light, 820×1180", async ({ page }) => {
    await injectAdminSession(page);
    await routeContent(page);
    await page.setViewportSize({ width: 820, height: 1180 });
    await openAdmin(page);
    await expect(root(page)).toHaveAttribute("data-admin-theme", "light");
    for (const id of ["studio", "blog"]) {
      await openSection(page, id);
      await settle(page);
      await page.screenshot({ path: `${SHOTS}/${id}-light-820x1180.png`, fullPage: true });
    }
  });
});
