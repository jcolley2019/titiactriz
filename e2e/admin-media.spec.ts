import { test, expect, type Page } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";
import {
  injectAdminSession,
  forceLanguage,
  routeSupabase,
  MOCK_PHOTOS,
  type Write,
} from "./_admin";

/**
 * ADMIN.MEDIA.1 final gate. Covers:
 *  (a) absent cinematic_media renders today's framing (desktop + mobile),
 *  (b) mocked cinematic_media focal/zoom is reflected in the render,
 *  (c) the admin media flow (slots, editor drag+zoom+device tabs, save, reset),
 *  (d) shell navigation reaches every wrapped legacy section,
 *  (e) EN/ES labels + reduced-motion framing.
 */
const CINE = "/cinematic";
const HERO = '[data-qa="cinematic-hero-img"]';
const REEL = '[data-qa="cinematic-reel-img"]';

async function settle(page: Page, ms = 700) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

const objectPosition = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => getComputedStyle(el as HTMLElement).objectPosition);

const wrapperTransform = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el) => getComputedStyle((el as HTMLElement).parentElement as HTMLElement).transform);

const scaleOf = (transform: string): number => {
  if (transform === "none") return 1;
  const m = transform.match(/matrix\(([-\d.]+)/);
  return m ? parseFloat(m[1]) : NaN;
};

/* ---------- (a) regression: absent = today's framing ---------- */
test.describe("ADMIN.MEDIA — render regression (absent = default)", () => {
  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`hero 50% 8% + reel centered + no zoom — ${vp.name}`, async ({ page }) => {
      await routeSupabase(page, { media: null, photos: MOCK_PHOTOS });
      const diag = attachDiagnostics(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(CINE, { waitUntil: "domcontentloaded" });
      await settle(page, 800);

      await expect(page.locator(HERO)).toHaveCount(1);
      expect(await objectPosition(page, HERO), "hero keeps TA.6d anchor").toBe("50% 8%");
      expect(await wrapperTransform(page, HERO), "hero unzoomed").toBe("none");

      await expect(page.locator(REEL).first()).toBeAttached();
      expect(await objectPosition(page, REEL), "reel centered").toBe("50% 50%");
      expect(await wrapperTransform(page, REEL), "reel unzoomed").toBe("none");

      expect(diag.consoleErrors, "console errors").toEqual([]);
      expect(diag.failedResponses, "failed requests").toEqual([]);
    });
  }
});

/* ---------- (b) render reflects mocked focal/zoom ---------- */
test.describe("ADMIN.MEDIA — render reflects cinematic_media", () => {
  test("off-center focal + zoom on hero and reel 1", async ({ page }) => {
    const media = {
      hero: { photo_id: "p1", focal: { x: 0.2, y: 0.85 }, zoom: 1.4 },
      reel: [
        { photo_id: "p2", focal: { x: 0.8, y: 0.1 }, zoom: 1.25 },
        { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
        { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      ],
    };
    await routeSupabase(page, { media, photos: MOCK_PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    expect(await objectPosition(page, HERO)).toBe("20% 85%");
    expect(scaleOf(await wrapperTransform(page, HERO))).toBeCloseTo(1.4, 1);

    expect(await objectPosition(page, REEL)).toBe("80% 10%");
    expect(scaleOf(await wrapperTransform(page, REEL))).toBeCloseTo(1.25, 1);

    await page.screenshot({ path: shot("ADMIN.MEDIA-hero-reframed.png") });
  });
});

/* ---------- (c) admin media flow ---------- */
test.describe("ADMIN.MEDIA — media manager flow", () => {
  test("slots, editor drag+zoom+device, save, reset", async ({ page }) => {
    const writes: Write[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MOCK_PHOTOS, writes });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    // Logged-in shell with all five sections.
    await expect(page.locator('[data-qa="admin-shell"]')).toBeVisible();
    await expect(page.locator('[data-qa="admin-nav"] button')).toHaveCount(5);
    await page.screenshot({ path: shot("ADMIN.MEDIA-shell.png"), fullPage: true });

    // Media section → four slots.
    await page.locator('[data-qa="admin-nav-media"]').click();
    await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();
    await expect(page.locator('[data-qa="media-slot"]')).toHaveCount(4);

    // Open the hero framing editor.
    await page
      .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-edit"]')
      .click();
    const surface = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface).toBeVisible();
    await page.waitForTimeout(500); // image decode + surface measure
    await page.screenshot({ path: shot("ADMIN.MEDIA-editor.png") });

    // Drag horizontally → the preview's framing changes.
    const previewImg = surface.locator("img").first();
    const before = await previewImg.evaluate((el) => getComputedStyle(el as HTMLElement).objectPosition);
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 55, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const after = await previewImg.evaluate((el) => getComputedStyle(el as HTMLElement).objectPosition);
    expect(after, "drag repositions the preview").not.toBe(before);

    // Zoom slider → readout + preview update.
    await page.locator('[data-qa="media-editor-zoom"]').evaluate((el) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "2");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator('[data-qa="media-editor-zoom-value"]')).toHaveText(/2\.00/);

    // Device tabs switch → surface aspect changes.
    const aspectBefore = await surface.boundingBox().then((b) => b!.width / b!.height);
    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(200);
    const aspectAfter = await surface.boundingBox().then((b) => b!.width / b!.height);
    expect(Math.abs(aspectAfter - aspectBefore), "device tab re-aspects the surface").toBeGreaterThan(0.3);
    await page.screenshot({ path: shot("ADMIN.MEDIA-device-tabs.png") });

    // Save → upsert cinematic_media with the expected shape.
    await page.locator('[data-qa="media-editor-save"]').click();
    await page.waitForTimeout(400);
    await expect(surface).toHaveCount(0);
    const upserts = writes.filter((w) => w.method === "POST" && /site_settings/.test(w.url));
    expect(upserts.length, "a cinematic_media upsert fired").toBeGreaterThan(0);
    const payload = JSON.parse(upserts[upserts.length - 1].body || "{}");
    const row = Array.isArray(payload) ? payload[0] : payload;
    expect(row.key).toBe("cinematic_media");
    expect(row.value.hero.photo_id).toBe("p1");
    expect(row.value.hero.zoom).toBeCloseTo(2, 1);
    expect(typeof row.value.hero.focal.x).toBe("number");
    expect(Array.isArray(row.value.reel)).toBe(true);
    await expect(
      page.locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-badge"]'),
    ).toHaveText(/custom/i);

    // Reset → clears the slot (all-default → cinematic_media key removed).
    await page
      .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-edit"]')
      .click();
    await expect(page.locator('[data-qa="media-editor-surface"]')).toBeVisible();
    await page.waitForTimeout(300);
    await page.locator('[data-qa="media-editor-reset"]').click();
    await page.waitForTimeout(400);
    expect(
      writes.filter((w) => w.method === "DELETE" && /site_settings/.test(w.url)).length,
      "reset removes the key",
    ).toBeGreaterThan(0);
    await expect(
      page.locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-badge"]'),
    ).toHaveText(/default/i);

    expect(pageErrors, "no uncaught errors during the admin flow").toEqual([]);
  });
});

/* ---------- (c2) TA.8a-c: pick → frame → save is mandatory ---------- */
test.describe("ADMIN.MEDIA — pick opens the framing editor (never auto-saves)", () => {
  test("choose photo → editor opens → drag/zoom/devices → save → pencil re-opens", async ({ page }) => {
    const writes: Write[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MOCK_PHOTOS, writes });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    await page.locator('[data-qa="admin-nav-media"]').click();
    await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();

    // Open the gallery picker for the Hero slot.
    await page
      .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-pick"]')
      .click();
    await expect(page.locator('[data-qa="media-picker-grid"]')).toBeVisible();

    // Choosing a photo opens the framing editor immediately — and saves NOTHING.
    const writesBefore = writes.length;
    await page.locator('[data-qa="media-picker-photo"]').first().click();
    const surface = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface, "selection opens the framing editor automatically").toBeVisible();
    await page.waitForTimeout(500); // image decode + surface measure
    expect(writes.length, "selection alone never persists").toBe(writesBefore);
    await page.screenshot({ path: shot("TA.8a-editor-open.png") });

    // Drag → focal changes.
    const previewImg = surface.locator("img").first();
    const before = await previewImg.evaluate((el) => getComputedStyle(el as HTMLElement).objectPosition);
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 55, box.y + box.height / 2 - 30, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const after = await previewImg.evaluate((el) => getComputedStyle(el as HTMLElement).objectPosition);
    expect(after, "drag repositions the preview").not.toBe(before);

    // Zoom slider → readout + scale.
    await page.locator('[data-qa="media-editor-zoom"]').evaluate((el) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "1.5");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator('[data-qa="media-editor-zoom-value"]')).toHaveText(/1\.50/);

    // Device preview tabs render (phone/tablet/desktop).
    const deviceTabs = page.locator('[data-qa="media-editor-devices"] > button');
    expect(await deviceTabs.count(), "device preview tabs render").toBeGreaterThanOrEqual(3);
    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: shot("TA.8a-editor-devicetabs.png") });

    // Save → upsert carries the chosen photo + framing.
    await page.locator('[data-qa="media-editor-save"]').click();
    await page.waitForTimeout(400);
    await expect(surface).toHaveCount(0);
    const upserts = writes.filter((w) => w.method === "POST" && /site_settings/.test(w.url));
    expect(upserts.length, "save persists cinematic_media").toBeGreaterThan(0);
    const payload = JSON.parse(upserts[upserts.length - 1].body || "{}");
    const row = Array.isArray(payload) ? payload[0] : payload;
    expect(row.key).toBe("cinematic_media");
    expect(row.value.hero.photo_id).toBe("p1");
    expect(row.value.hero.zoom).toBeCloseTo(1.5, 1);
    await expect(
      page.locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-badge"]'),
    ).toHaveText(/custom/i);

    // Pencil re-opens the editor for the current photo WITH the saved values.
    await page
      .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-edit"]')
      .click();
    await expect(page.locator('[data-qa="media-editor-surface"]')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(
      page.locator('[data-qa="media-editor-zoom-value"]'),
      "pencil re-opens with the saved zoom",
    ).toHaveText(/1\.50/);

    expect(pageErrors, "no uncaught errors during pick→frame→save").toEqual([]);
  });
});

/* ---------- (c3) TA.8a-b: hero controls consolidated into Media ---------- */
test.describe("ADMIN.MEDIA — hero controls live in Media, not Settings", () => {
  test("Settings drops the legacy hero picker (note only); Media hosts the hero slot", async ({ page }) => {
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MOCK_PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 700);

    // Settings: legacy hero picker gone; bilingual pointer note present; variant stays.
    await page.locator('[data-qa="admin-nav-settings"]').click();
    await expect(page.locator('[data-qa="admin-section-settings"]')).toBeVisible();
    await expect(
      page.locator('[data-qa="admin-cinematic-hero"]'),
      "legacy hero picker removed from Settings",
    ).toHaveCount(0);
    await expect(page.locator('[data-qa="settings-media-note"]')).toBeVisible();
    await expect(page.getByText(/home page variant/i)).toBeVisible();

    // Media: the Hero slot is the single place to choose AND frame the hero.
    await page.locator('[data-qa="admin-nav-media"]').click();
    const heroSlot = page.locator('[data-qa="media-slot"][data-slot="hero"]');
    await expect(heroSlot).toBeVisible();
    await expect(heroSlot.locator('[data-qa="media-slot-pick"]')).toBeVisible();
    await expect(heroSlot.locator('[data-qa="media-slot-edit"]')).toBeVisible();
  });
});

/* ---------- (d) shell navigation reaches legacy sections ---------- */
test.describe("ADMIN.MEDIA — shell navigation", () => {
  test("reaches gallery, events, settings, submissions", async ({ page }) => {
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MOCK_PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    // Gallery (default) list renders.
    await expect(page.locator('[data-qa="admin-section-gallery"]')).toBeVisible();
    expect(await page.locator('[data-qa="admin-section-gallery"] img').count()).toBeGreaterThan(0);

    // Events board renders.
    await page.locator('[data-qa="admin-nav-events"]').click();
    await expect(page.locator('[data-qa="admin-section-events"]')).toBeVisible();

    // Settings — home-variant toggle present.
    await page.locator('[data-qa="admin-nav-settings"]').click();
    await expect(page.locator('[data-qa="admin-section-settings"]')).toBeVisible();
    await expect(page.getByText(/home page variant/i)).toBeVisible();

    // Submissions placeholder.
    await page.locator('[data-qa="admin-nav-submissions"]').click();
    await expect(page.locator('[data-qa="admin-submissions-empty"]')).toBeVisible();
  });
});

/* ---------- (e) EN/ES labels + reduced motion ---------- */
test.describe("ADMIN.MEDIA — i18n + reduced motion", () => {
  test("shell labels render in English", async ({ page }) => {
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { photos: MOCK_PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 600);
    await expect(page.locator('[data-qa="admin-nav-media"]')).toHaveText(/Media/);
    await expect(page.locator('[data-qa="admin-nav-gallery"]')).toHaveText(/Gallery/);
  });

  test("shell labels render in Spanish", async ({ page }) => {
    await injectAdminSession(page);
    await forceLanguage(page, "es");
    await routeSupabase(page, { photos: MOCK_PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 600);
    await expect(page.locator('[data-qa="admin-nav-media"]')).toHaveText(/Medios/);
    await expect(page.locator('[data-qa="admin-nav-gallery"]')).toHaveText(/Galería/);
  });

  test("reduced motion still applies hero framing", async ({ page }) => {
    const media = {
      hero: { photo_id: "p1", focal: { x: 0.3, y: 0.7 }, zoom: 1 },
      reel: [
        { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
        { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
        { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      ],
    };
    await routeSupabase(page, { media, photos: MOCK_PHOTOS });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 500);

    expect(await objectPosition(page, HERO)).toBe("30% 70%");
    const headings = page.locator('[data-qa="section-heading"]');
    expect(await headings.count()).toBeGreaterThan(0);
    await page.screenshot({ path: shot("ADMIN.MEDIA-reduced.png"), fullPage: true });
  });
});
