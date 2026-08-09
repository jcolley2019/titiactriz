import { test, expect, type Page } from "@playwright/test";
import { attachDiagnostics, shot } from "./_helpers";
import {
  injectAdminSession,
  forceLanguage,
  routeSupabase,
  stubHeroVideoMedia,
  selectHeroVideoFile,
  uploadHeroVideoVia,
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

/**
 * PORT.2: image surfaces resolve their geometry through hero-framing and expose
 * the RESOLVED framing as data-hero-framing = "scale;posX;posY;fit;box". Render
 * assertions read that contract instead of object-position/wrapper transforms.
 */
const heroFraming = (page: Page, sel: string) =>
  page.locator(sel).first().getAttribute("data-hero-framing");

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
      expect(await heroFraming(page, HERO), "hero keeps TA.6d anchor, unzoomed").toContain(
        "1.00;50;8;fill;",
      );

      // CINE.FLOW.5: both promoted acts crop to their subject — the phone act
      // (V1 "Edge Veil") against the viewport, the wide act (W2 "Center Plate &
      // Rules") against its plate box. The letterbox mode is retired, so the
      // fit is `fill` on both device classes.
      await expect(page.locator(REEL).first()).toBeAttached();
      expect(await heroFraming(page, REEL), "reel centered, unzoomed — cover").toContain(
        "1.00;50;50;fill;",
      );

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

    expect(await heroFraming(page, HERO)).toContain("1.40;20;85;fill;");
    // CINE.FLOW.5: the wide act covers its plate; the letterbox is retired.
    expect(await heroFraming(page, REEL)).toContain("1.25;80;10;fill;");

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

    // Logged-in shell with every section (PORT.ACT.3 added portfolio, PORT.SOC.8
    // added links: seven now).
    await expect(page.locator('[data-qa="admin-shell"]')).toBeVisible();
    await expect(page.locator('[data-qa="admin-nav"] button')).toHaveCount(7);
    await page.screenshot({ path: shot("ADMIN.MEDIA-shell.png"), fullPage: true });

    // Media section → five slots (Hero, Reel 1–3, About — ABOUT.MEDIA.1).
    await page.locator('[data-qa="admin-nav-media"]').click();
    await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();
    await expect(page.locator('[data-qa="media-slot"]')).toHaveCount(5);

    // Open the hero framing editor.
    await page
      .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-edit"]')
      .click();
    const surface = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface).toBeVisible();
    await page.waitForTimeout(500); // image decode + surface measure
    await page.screenshot({ path: shot("ADMIN.MEDIA-editor.png") });

    // PORT.2: the image canvas is the live SectionPreview composition rendered
    // through the resolver — the framed img reports its geometry contract.
    const canvasImg = surface.locator('[data-qa="media-preview"] img').first();
    await expect(canvasImg, "resolver canvas renders the photo").toBeVisible();
    await expect
      .poll(async () => (await canvasImg.getAttribute("data-hero-framing")) ?? "")
      .not.toContain("pending");

    // Drag → the resolver repositions the media (its framing rectangle changes).
    const before = await canvasImg.getAttribute("data-hero-framing");
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 20, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const after = await canvasImg.getAttribute("data-hero-framing");
    expect(after, "drag repositions the framing").not.toBe(before);

    // Zoom slider → readout + zoom-in.
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
    await page.waitForTimeout(300);
    const aspectAfter = await surface.boundingBox().then((b) => b!.width / b!.height);
    expect(Math.abs(aspectAfter - aspectBefore), "device tab re-aspects the surface").toBeGreaterThan(0.3);
    await page.screenshot({ path: shot("MEDIA4-editor-image.png") });

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
    expect(row.value.hero.zoom, "slider zoom → cover-relative zoom").toBeCloseTo(2, 0);
    expect(typeof row.value.hero.focal.x).toBe("number");
    expect(Array.isArray(row.value.reel)).toBe(true);
    await expect(
      page.locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-badge"]'),
    ).toHaveText(/custom/i);

    // ADMIN.RESET.1a — Reset restores THIS tab's transform and stops there: the
    // editor stays open, nothing is persisted, and the slot keeps its badge. It
    // used to close the dialog and delete the key; that was the defect. Reset
    // followed by Save is what publishes the default (see adminreset.spec.ts).
    await page
      .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-edit"]')
      .click();
    const surfaceR = page.locator('[data-qa="media-editor-surface"]');
    await expect(surfaceR).toBeVisible();
    await page.waitForTimeout(300);
    const writesBefore = writes.filter((w) => /site_settings/.test(w.url)).length;
    await page.locator('[data-qa="media-editor-reset"]').click();
    await page.waitForTimeout(400);
    expect(
      writes.filter((w) => /site_settings/.test(w.url)).length,
      "Reset persists nothing on its own",
    ).toBe(writesBefore);
    await expect(surfaceR, "Reset leaves the editor open on the same slot").toBeVisible();
    // The zoom readout is back at the default, in place.
    await expect(page.locator('[data-qa="media-editor-zoom-value"]')).toHaveText(/1\.00/);

    // Save commits the reset TRANSFORM and nothing else — the slot keeps its
    // chosen photo, so it is still a customized slot, now framed at the default.
    const postsBefore = writes.filter((w) => w.method === "POST" && /site_settings/.test(w.url)).length;
    await page.locator('[data-qa="media-editor-save"]').click();
    await expect(surfaceR).toHaveCount(0);
    // The dialog closes before the upsert lands — wait for the write itself.
    await expect
      .poll(() => writes.filter((w) => w.method === "POST" && /site_settings/.test(w.url)).length, {
        timeout: 10_000,
      })
      .toBeGreaterThan(postsBefore);
    const afterReset = writes
      .filter((w) => w.method === "POST" && /site_settings/.test(w.url))
      .map((w) => w.body ?? "")
      .filter((b) => b.includes("cinematic_media"))
      .pop();
    expect(afterReset, "Save after Reset upserts the config").toBeTruthy();
    const resetRow = JSON.parse(afterReset!);
    const resetHero = (Array.isArray(resetRow) ? resetRow[0] : resetRow).value.hero;
    expect(resetHero.zoom, "the saved zoom is the default").toBeCloseTo(1, 5);
    expect(resetHero.focal.y, "the saved focal is the TA.6d hero default").toBeCloseTo(0.08, 5);
    expect(resetHero.photo_id, "Reset never dropped the slot's photo").toBe("p1");
    await expect(
      page.locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-badge"]'),
    ).toHaveText(/custom/i);

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

    // PORT.2: the resolver canvas renders the chosen photo live (no crop overlay).
    const canvasImg = surface.locator('[data-qa="media-preview"] img').first();
    await expect(canvasImg, "resolver canvas renders the chosen photo").toBeVisible();
    await expect
      .poll(async () => (await canvasImg.getAttribute("data-hero-framing")) ?? "")
      .not.toContain("pending");
    await page.screenshot({ path: shot("MEDIA4-frame-overlay.png") });

    // Drag → the resolver repositions the media (framing rectangle changes).
    const before = await canvasImg.getAttribute("data-hero-framing");
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 20, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const after = await canvasImg.getAttribute("data-hero-framing");
    expect(after, "drag repositions the framing").not.toBe(before);

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
    await page.waitForTimeout(300);
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
    expect(row.value.hero.zoom, "slider zoom → cover-relative zoom").toBeCloseTo(1.5, 0);
    await expect(
      page.locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-badge"]'),
    ).toHaveText(/custom/i);

    // Pencil re-opens the editor seeded from the saved framing; a round-trip
    // save preserves the zoom (the crop re-hydrates from focal/zoom).
    await page
      .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-edit"]')
      .click();
    const surface2 = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface2).toBeVisible();
    await expect(surface2.locator('[data-qa="media-preview"] img').first()).toBeVisible();
    await page.waitForTimeout(600);
    await page.locator('[data-qa="media-editor-save"]').click();
    await page.waitForTimeout(400);
    const upserts2 = writes.filter((w) => w.method === "POST" && /site_settings/.test(w.url));
    const row2 = (() => {
      const p = JSON.parse(upserts2[upserts2.length - 1].body || "{}");
      return Array.isArray(p) ? p[0] : p;
    })();
    expect(row2.value.hero.zoom, "re-opened framing round-trips").toBeCloseTo(1.5, 0);

    expect(pageErrors, "no uncaught errors during pick→frame→save").toEqual([]);
  });
});

/* ---------- (c3) TA.8a-b: hero controls consolidated into Media ---------- */
test.describe("ADMIN.MEDIA — hero controls live in Media, not Settings", () => {
  test("Settings drops the legacy hero picker and pointer note; Media hosts the hero slot", async ({ page }) => {
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MOCK_PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 700);

    // Settings: legacy hero picker gone; pointer note gone (POLISH.2); variant stays.
    await page.locator('[data-qa="admin-nav-settings"]').click();
    await expect(page.locator('[data-qa="admin-section-settings"]')).toBeVisible();
    await expect(
      page.locator('[data-qa="admin-cinematic-hero"]'),
      "legacy hero picker removed from Settings",
    ).toHaveCount(0);
    await expect(
      page.locator('[data-qa="settings-media-note"]'),
      "pointer card removed from Settings (POLISH.2)",
    ).toHaveCount(0);
    await expect(page.getByText(/home page variant/i)).toBeVisible();

    // Media: the Hero slot is the single place to choose AND frame the hero.
    await page.locator('[data-qa="admin-nav-media"]').click();
    const heroSlot = page.locator('[data-qa="media-slot"][data-slot="hero"]');
    await expect(heroSlot).toBeVisible();
    await expect(heroSlot.locator('[data-qa="media-slot-pick"]')).toBeVisible();
    await expect(heroSlot.locator('[data-qa="media-slot-edit"]')).toBeVisible();
  });
});

/* ---------- (c4) ADMIN.MOBILE.2 / ABOUT.REMOVE.1: destructive controls ---------- */
test.describe("ADMIN.MEDIA — hero/reel cards carry no destructive control; About carries Remove", () => {
  test("configured About card adds a labeled Remove that deletes the key; the editor's Reset still clears nothing", async ({ page }) => {
    const writes: Write[] = [];
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, {
      // Only the About slot is configured — hero/reel stay default, so a write
      // that took the config all-default would be visible as a key DELETE.
      media: {
        hero: { photo_id: null, focal: { x: 0.5, y: 0.08 }, zoom: 1 },
        reel: [
          { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
          { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
          { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
        ],
        about: { photo_id: "p1", focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      },
      photos: MOCK_PHOTOS,
      writes,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    await page.locator('[data-qa="admin-nav-media"]').click();
    const aboutCard = page.locator('[data-qa="media-slot"][data-slot="about"]');
    await expect(aboutCard).toBeVisible();

    // Configured → the card renders the photo and a Custom badge.
    await expect(aboutCard.locator("img")).toBeVisible();
    await expect(aboutCard.locator('[data-qa="media-slot-badge"]')).toHaveText(/custom/i);

    // ADMIN.MOBILE.2 — the THUMBNAIL's only controls are camera (change photo)
    // and pencil (framing). ABOUT.REMOVE.1 — About is the one opt-in slot, so
    // its card alone carries a labeled Remove BELOW the card text (off the
    // thumbnail, so a stray tap on the photo can't blank the section). Hero and
    // reel cards stay camera+pencil only: their workflow is swap, never empty.
    await expect(aboutCard.locator('[data-qa="media-slot-pick"]')).toBeVisible();
    await expect(aboutCard.locator('[data-qa="media-slot-edit"]')).toBeVisible();
    await expect(aboutCard.locator('[data-qa="media-about-remove"]')).toBeVisible();
    await expect(aboutCard.locator('[data-qa="media-about-remove"]')).toHaveText(/remove/i);
    await expect(aboutCard.locator("button")).toHaveCount(3);
    const reelCard = page.locator('[data-qa="media-slot"][data-slot="reel-0"]');
    await expect(reelCard.locator("button")).toHaveCount(2);
    await expect(reelCard.locator('[data-qa="media-about-remove"]')).toHaveCount(0);

    // ADMIN.RESET.1a — Reset is a TRANSFORM control now, so it is no longer a
    // slot-clearing path either: it neither writes nor closes. (The old law here
    // asserted the opposite — Reset deleting the key — and that behavior is the
    // defect this brick fixes. See adminreset.spec.ts for the full contract.)
    await aboutCard.locator('[data-qa="media-slot-edit"]').click();
    const surface = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface).toBeVisible();
    await page.waitForTimeout(300);
    writes.length = 0;
    await page.locator('[data-qa="media-editor-reset"]').click();
    await page.waitForTimeout(400);
    expect(
      writes.filter((w) => /site_settings/.test(w.url)),
      "editor Reset writes nothing at all — no upsert, no key delete",
    ).toHaveLength(0);
    await expect(surface, "editor Reset does not close the editor").toBeVisible();

    // Cancel out: the slot is still configured, exactly as it was found.
    await page.locator('[data-qa="media-editor-cancel"]').click();
    await expect(surface).toHaveCount(0);
    await expect(aboutCard.locator('[data-qa="media-slot-badge"]')).toHaveText(/custom/i);
    await expect(aboutCard.locator("img")).toBeVisible();

    // ABOUT.REMOVE.1 — Remove unconfigures the panel back to text-only. Only
    // About was configured, so the config resolves all-default and the write is
    // the cinematic_media key DELETE (absent-is-default), never an upsert of a
    // half-empty object.
    writes.length = 0;
    await aboutCard.locator('[data-qa="media-about-remove"]').click();
    await expect
      .poll(() => writes.filter((w) => /site_settings/.test(w.url)).length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    const removal = writes.filter((w) => /site_settings/.test(w.url));
    expect(
      removal.every((w) => w.method === "DELETE" && /cinematic_media/.test(w.url)),
      "removal is the key DELETE, not an upsert",
    ).toBe(true);

    // The card falls to the opt-in empty state: no photo, badge None, and the
    // Remove control itself is gone — nothing destructive on an empty card.
    await expect(aboutCard.locator("img")).toHaveCount(0);
    await expect(aboutCard.locator('[data-qa="media-slot-badge"]')).toHaveText(/none/i);
    await expect(aboutCard.locator('[data-qa="media-about-remove"]')).toHaveCount(0);
    await expect(aboutCard.locator("button")).toHaveCount(2);
  });
});

/* ---------- (c5) ADMIN.MOBILE.2: picker grid uniform at production count ---------- */
test.describe("ADMIN.MEDIA — picker tiles hold 4:5 at production photo count", () => {
  // >=30 photos of MIXED natural aspects (portrait + landscape + square), like
  // the real ~30-photo gallery. The tile paints the photo through object-cover,
  // so the natural aspect must NOT leak into the tile's own box — every tile is
  // a uniform 4:5 regardless. Data-URL SVGs keep this offline + deterministic.
  const MIXED_ASPECTS = [
    [400, 600], // portrait 2:3
    [600, 400], // landscape 3:2
    [500, 500], // square
    [300, 700], // tall
    [800, 450], // wide 16:9
    [400, 500], // 4:5
  ];
  const MIXED_PHOTOS = Array.from({ length: 33 }, (_, i) => {
    const [w, h] = MIXED_ASPECTS[i % MIXED_ASPECTS.length];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='hsl(${(i * 37) % 360} 60% 50%)'/></svg>`;
    return {
      id: `mix${i}`,
      image_url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      alt_text: `mix ${i} (${w}x${h})`,
    };
  });

  test("30+ mixed-aspect photos → uniform 4:5 tiles, no collapse/overlap, at 390x844", async ({
    page,
  }) => {
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MIXED_PHOTOS });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    await page.locator('[data-qa="admin-nav-media"]').click();
    await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();
    await page
      .locator('[data-qa="media-slot"][data-slot="hero"] [data-qa="media-slot-pick"]')
      .click();
    const grid = page.locator('[data-qa="media-picker-grid"]');
    await expect(grid).toBeVisible();
    await page.waitForTimeout(600); // image decode + layout

    // This is the PRODUCTION condition: 33 photos over 3 columns overflow 60vh,
    // so the grid actually scrolls (the earlier "few photos" mock masked the bug).
    const scroll = await grid.evaluate((el) => ({
      scrollH: (el as HTMLElement).scrollHeight,
      clientH: (el as HTMLElement).clientHeight,
    }));
    expect(scroll.scrollH, "grid overflows and scrolls at production count").toBeGreaterThan(
      scroll.clientH + 50,
    );

    // Every one of the first 12 tiles is a true 4:5 box (0.8 ±0.02).
    const ratios = await grid.evaluate((el) => {
      const tiles = Array.from(
        el.querySelectorAll('[data-qa="media-picker-photo"]'),
      ).slice(0, 12) as HTMLElement[];
      return tiles.map((t) => {
        const r = t.getBoundingClientRect();
        return r.height ? +(r.width / r.height).toFixed(3) : 0;
      });
    });
    expect(ratios.length, "at least 12 tiles measured").toBeGreaterThanOrEqual(12);
    for (const [i, ratio] of ratios.entries()) {
      expect(ratio, `tile ${i} holds 4:5`).toBeGreaterThan(0.78);
      expect(ratio, `tile ${i} holds 4:5`).toBeLessThan(0.82);
    }

    // The real regression guard: pre-fix, each tile's OWN box was still 4:5, but
    // rows past the first collapsed so tiles overlapped (row pitch dropped from a
    // full tile height to ~34px). Assert consecutive rows are a full tile-height
    // apart — this is what fails on the pre-fix (grid-auto-rows:auto) code.
    const tops = await grid.evaluate((el) => {
      const tiles = Array.from(
        el.querySelectorAll('[data-qa="media-picker-photo"]'),
      ).slice(0, 12) as HTMLElement[];
      return tiles.map((t) => Math.round(t.getBoundingClientRect().top));
    });
    const rowTops = [...new Set(tops)].sort((a, b) => a - b);
    const pitches = rowTops.slice(1).map((t, i) => t - rowTops[i]);
    expect(pitches.length, "several rows present").toBeGreaterThanOrEqual(3);
    for (const [i, p] of pitches.entries()) {
      expect(p, `row ${i + 1} sits a full tile below row ${i} (no collapse/overlap)`).toBeGreaterThan(
        100,
      );
    }

    await page.screenshot({ path: shot("ADMIN.MOBILE.2-picker-390.png") });
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

    expect(await heroFraming(page, HERO)).toContain("1.00;30;70;fill;");
    const headings = page.locator('[data-qa="section-heading"]');
    expect(await headings.count()).toBeGreaterThan(0);
    await page.screenshot({ path: shot("ADMIN.MEDIA-reduced.png"), fullPage: true });
  });
});

/* ---------- (f) ADMIN.MEDIA.2 — hero video upload / frame / remove ---------- */
const heroVideoUpserts = (writes: Write[]) =>
  writes.filter(
    (w) => w.method === "POST" && /site_settings/.test(w.url) && (w.body || "").includes("cinematic_hero_video"),
  );
const cinematicMediaUpserts = (writes: Write[]) =>
  writes.filter(
    (w) => w.method === "POST" && /site_settings/.test(w.url) && (w.body || "").includes("cinematic_media"),
  );

/**
 * FIX.CI.1b — the toast BODY, never its announcer. Radix mounts every toast
 * twice: the visible `<li role="status" aria-live="off">` in the viewport, and a
 * portaled `<span role="status" aria-live="assertive">` screen-reader announcer
 * that fills one frame after mount with label + title + description run
 * together, then deletes itself at 1s. For that window a bare
 * getByText(/…/) matches BOTH — a strict-mode violation that surfaces only when
 * the page runs slowly enough for the announcer to fill before the assertion
 * samples (tracing does it every time; see playwright.config.ts). Scoping to the
 * `<li>` — the toast itself, of which the announcer is only a copy — leaves
 * exactly one match at any page speed.
 */
const toastSaying = (page: Page, text: RegExp) => page.locator('li[role="status"]').filter({ hasText: text });

test.describe("ADMIN.MEDIA.2 — hero video upload → frame → save", () => {
  test("rejects bad files; a valid upload sets the setting, opens the video editor, and saves decoupled framing", async ({
    page,
  }) => {
    const writes: Write[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await stubHeroVideoMedia(page);
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MOCK_PHOTOS, writes });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    await page.locator('[data-qa="admin-nav-media"]').click();
    await expect(page.locator('[data-qa="media-hero-video"]')).toBeVisible();

    // ---- validation: wrong type → oversize → overlong (TOAST_LIMIT=1 replaces) ----
    await selectHeroVideoFile(page, { type: "text/plain", name: "notes.txt", sizeBytes: 1024 });
    await expect(toastSaying(page, /Use an MP4 or WebM/i), "wrong type rejected").toBeVisible();

    await selectHeroVideoFile(page, { type: "video/mp4", name: "big.mp4", sizeBytes: 63 * 1024 * 1024 });
    await expect(toastSaying(page, /too large/i), "oversize rejected").toBeVisible();

    await selectHeroVideoFile(page, { type: "video/mp4", name: "long.mp4", sizeBytes: 4096, durationSec: 20 });
    await expect(toastSaying(page, /too long/i), "overlong rejected").toBeVisible();

    expect(heroVideoUpserts(writes).length, "no rejected file was uploaded/persisted").toBe(0);
    await expect(page.locator('[data-qa="media-editor-surface"]'), "no editor from a rejected file").toHaveCount(0);

    // ---- valid upload → setting written → video-mode editor opens automatically ----
    await selectHeroVideoFile(page, { type: "video/mp4", name: "hero.mp4", sizeBytes: 8192, durationSec: 8 });
    const surface = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface, "valid upload opens the framing editor").toBeVisible();
    await expect(surface.locator('[data-qa="media-preview-video"]').first(), "editor is in VIDEO mode").toBeVisible();
    await expect
      .poll(() => heroVideoUpserts(writes).length, { timeout: 8000 })
      .toBeGreaterThan(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot("MEDIA2-editor-videomode.png") });
    await page.screenshot({ path: shot("MEDIA4-editor-video.png") });

    // Drag repositions the video framing (PORT.3: read the resolved framing
    // contract — the resolver leaves CSS object-position untouched).
    const previewVideo = surface.locator('[data-qa="media-preview-video"]').first();
    const beforePos = await previewVideo.getAttribute("data-hero-framing");
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 - 40, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const afterPos = await previewVideo.getAttribute("data-hero-framing");
    expect(afterPos, "drag repositions the video preview").not.toBe(beforePos);

    // Zoom the video framing.
    await page.locator('[data-qa="media-editor-zoom"]').evaluate((el) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "1.5");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator('[data-qa="media-editor-zoom-value"]')).toHaveText(/1\.50/);

    // Save → cinematic_media carries the DECOUPLED hero.video shape.
    await page.locator('[data-qa="media-editor-save"]').click();
    await page.waitForTimeout(400);
    await expect(surface).toHaveCount(0);
    const upserts = cinematicMediaUpserts(writes);
    expect(upserts.length, "framing save persists cinematic_media").toBeGreaterThan(0);
    const payload = JSON.parse(upserts[upserts.length - 1].body || "{}");
    const row = Array.isArray(payload) ? payload[0] : payload;
    expect(row.key).toBe("cinematic_media");
    // VID.MODEL.1: per-viewport framing record. The editor opens on the iPhone
    // tab (aspect < 1), so an untouched-tab save edits the PORTRAIT record.
    expect(row.value.hero.video.portrait, "per-viewport framing record written").toBeTruthy();
    expect(row.value.hero.video.portrait.zoom).toBeCloseTo(1.5, 1);
    expect(typeof row.value.hero.video.portrait.focal.x).toBe("number");
    expect(typeof row.value.hero.video.portrait.focal.y).toBe("number");
    expect(row.value.hero.video.portrait.fit).toBe("fill");

    // The hero slot now shows the video with a VIDEO badge.
    const heroSlot = page.locator('[data-qa="media-slot"][data-slot="hero"]');
    await expect(heroSlot.locator('[data-qa="media-slot-video"]')).toBeVisible();
    await expect(heroSlot.locator('[data-qa="media-slot-video-badge"]')).toBeVisible();
    await page.screenshot({ path: shot("MEDIA2-heroslot-video.png") });

    expect(pageErrors, "no uncaught errors during the hero-video flow").toEqual([]);
  });
});

test.describe("ADMIN.MEDIA.2 — remove video reverts to image", () => {
  test("Remove video clears the setting and the hero slot falls back to the photo", async ({ page }) => {
    const writes: Write[] = [];
    await stubHeroVideoMedia(page);
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, {
      media: {
        hero: { photo_id: null, focal: { x: 0.5, y: 0.08 }, zoom: 1, video: { focal: { x: 0.3, y: 0.7 }, zoom: 1.4 } },
        reel: [
          { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
          { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
          { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
        ],
      },
      photos: MOCK_PHOTOS,
      heroVideo: "https://cdn.example.com/hero-loop.mp4",
      writes,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    await page.locator('[data-qa="admin-nav-media"]').click();
    const heroSlot = page.locator('[data-qa="media-slot"][data-slot="hero"]');
    await expect(heroSlot.locator('[data-qa="media-slot-video"]')).toBeVisible();
    await expect(heroSlot.locator('[data-qa="media-slot-video-badge"]')).toBeVisible();

    // Remove the video → BOTH the canonical and legacy portrait keys are deleted.
    await page.locator('[data-qa="media-hero-remove"]').click();
    await page.waitForTimeout(500);
    expect(
      writes.filter((w) => w.method === "DELETE" && /cinematic_hero_video(?!_portrait)/.test(w.url)).length,
      "canonical cinematic_hero_video deleted",
    ).toBeGreaterThan(0);
    expect(
      writes.filter((w) => w.method === "DELETE" && /cinematic_hero_video_portrait/.test(w.url)).length,
      "legacy portrait key also cleared",
    ).toBeGreaterThan(0);

    // Hero slot reverts to the photo (image + Ken Burns), video gone.
    await expect(heroSlot.locator('[data-qa="media-slot-video"]')).toHaveCount(0);
    await expect(heroSlot.locator('[data-qa="media-slot-video-badge"]')).toHaveCount(0);
    await expect(heroSlot.locator("img")).toBeVisible();
    await expect(page.locator('[data-qa="media-hero-upload"]')).toContainText(/Upload video/i);
  });
});

/* ---------- (g) VID.MODEL.1 — one video, per-viewport framing, fit, hint ---------- */
test.describe("VID.MODEL.1 — one hero video, per-viewport framing records", () => {
  test("one upload row; device tabs write distinct per-viewport records for the single video", async ({
    page,
  }) => {
    const writes: Write[] = [];
    await stubHeroVideoMedia(page);
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MOCK_PHOTOS, writes });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    await page.locator('[data-qa="admin-nav-media"]').click();
    // Exactly ONE hero-video row, initially unset.
    await expect(page.locator('[data-qa="media-hero-source"]')).toHaveCount(1);
    await expect(page.locator('[data-qa="media-hero-source"]')).toContainText(/Not set/i);

    // Upload the single clip → editor opens.
    await uploadHeroVideoVia(page, "media-hero-upload", { name: "hero.mp4", width: 1920, height: 1080 });
    const surface = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface).toBeVisible();
    await expect(page.locator('[data-qa="media-hero-remove"]')).toBeVisible();

    const previewVideo = surface.locator('[data-qa="media-preview-video"]').first();
    const dragBy = async (dx: number, dy: number) => {
      const box = (await surface.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(150);
    };

    // iPhone tab edits the PORTRAIT viewport record.
    await page.locator('[data-qa="media-device-iphone-17-pro"]').click();
    await page.waitForTimeout(200);
    await dragBy(-50, 0);
    const portraitPos = await previewVideo.getAttribute("data-hero-framing");

    // Desktop tab edits the LANDSCAPE viewport record — a separate default view.
    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(200);
    await dragBy(70, 0);
    const landscapePos = await previewVideo.getAttribute("data-hero-framing");
    expect(landscapePos, "each tab frames the same clip independently").not.toBe(portraitPos);

    // Save → cinematic_media carries BOTH viewport records, and they differ.
    await page.locator('[data-qa="media-editor-save"]').click();
    await page.waitForTimeout(400);
    const upserts = writes.filter(
      (w) => w.method === "POST" && /site_settings/.test(w.url) && (w.body || "").includes("cinematic_media"),
    );
    expect(upserts.length, "framing save persists cinematic_media").toBeGreaterThan(0);
    const value = (() => {
      const p = JSON.parse(upserts[upserts.length - 1].body || "{}");
      return (Array.isArray(p) ? p[0] : p).value;
    })();
    expect(value.hero.video.landscape, "landscape record present").toBeTruthy();
    expect(value.hero.video.portrait, "portrait record present").toBeTruthy();
    const lf = value.hero.video.landscape.focal;
    const pf = value.hero.video.portrait.focal;
    expect(lf.x !== pf.x || lf.y !== pf.y, "the two viewport records are distinct").toBe(true);

    // Single-video model: only the canonical hero-video key is ever upserted.
    const canonicalUpsert = writes.some(
      (w) => w.method === "POST" && (w.body || "").includes('"cinematic_hero_video"'),
    );
    const portraitKeyUpsert = writes.some(
      (w) => w.method === "POST" && (w.body || "").includes('"cinematic_hero_video_portrait"'),
    );
    expect(canonicalUpsert, "canonical hero-video setting written").toBe(true);
    expect(portraitKeyUpsert, "legacy portrait key is never written").toBe(false);

    await page.screenshot({ path: shot("VIDMODEL-per-viewport-records.png") });
  });

  test("Fit mode letterboxes without a spill copy, unlocks sub-cover zoom, and saves the fit shape", async ({
    page,
  }) => {
    const writes: Write[] = [];
    await stubHeroVideoMedia(page);
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MOCK_PHOTOS, writes });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    await page.locator('[data-qa="admin-nav-media"]').click();
    await uploadHeroVideoVia(page, "media-hero-upload", { name: "land.mp4", width: 1920, height: 1080 });
    const surface = page.locator('[data-qa="media-editor-surface"]');
    await expect(surface).toBeVisible();

    // Frame on the Desktop tab (landscape viewport record, no mismatch noise).
    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(200);

    // Fill mode: the zoom slider cannot go below cover (1.0).
    expect(await page.locator('[data-qa="media-editor-zoom"]').getAttribute("min")).toBe("1");

    // Switch to Fit → foreground becomes uncropped, zoom unlocks. HERO.WIDE.1:
    // the blurred backdrop copy is gone — one video, letterboxed on the base.
    await page.locator('[data-qa="media-editor-fit-fit"]').click();
    await page.waitForTimeout(200);
    await expect(surface.locator('[data-qa="media-preview-backdrop"]'), "no spill copy in fit mode").toHaveCount(0);
    await expect(surface.locator("video"), "one video in the editor surface").toHaveCount(1);
    // PORT.3: the foreground letterboxes via the resolver's contain math — the
    // resolved fit mode is read off the framing contract, not CSS object-fit.
    await expect
      .poll(
        async () =>
          (await surface
            .locator('[data-qa="media-preview-video"]')
            .first()
            .getAttribute("data-hero-framing")) ?? "absent",
        { timeout: 8000 },
      )
      .toContain(";fit;");
    const zoomMin = parseFloat((await page.locator('[data-qa="media-editor-zoom"]').getAttribute("min")) || "1");
    expect(zoomMin, "fit unlocks sub-cover zoom").toBeLessThan(1);
    await page.screenshot({ path: shot("MEDIA3-fit-mode.png") });

    // Set a sub-cover zoom and save → cinematic_media carries fit + sub-cover zoom.
    await page.locator('[data-qa="media-editor-zoom"]').evaluate((el) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "0.7");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator('[data-qa="media-editor-zoom-value"]')).toHaveText(/0\.70/);
    await page.locator('[data-qa="media-editor-save"]').click();
    await page.waitForTimeout(400);

    const upserts = writes.filter(
      (w) => w.method === "POST" && /site_settings/.test(w.url) && (w.body || "").includes("cinematic_media"),
    );
    expect(upserts.length).toBeGreaterThan(0);
    const row = JSON.parse(upserts[upserts.length - 1].body || "{}");
    const value = (Array.isArray(row) ? row[0] : row).value;
    expect(value.hero.video.landscape.fit).toBe("fit");
    expect(value.hero.video.landscape.zoom).toBeCloseTo(0.7, 1);
  });

  test("mismatch hint: a portrait clip previewed on the Desktop tab warns; the phone tab does not", async ({
    page,
  }) => {
    await stubHeroVideoMedia(page);
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: null, photos: MOCK_PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    await page.locator('[data-qa="admin-nav-media"]').click();
    // A portrait-shaped clip is the single hero video.
    await uploadHeroVideoVia(page, "media-hero-upload", { name: "port.mp4", width: 1080, height: 1920 });
    await expect(page.locator('[data-qa="media-editor-surface"]')).toBeVisible();

    // Phone tab: portrait clip on a portrait canvas → no heavy crop, no hint.
    await page.locator('[data-qa="media-device-iphone-17-pro"]').click();
    await page.waitForTimeout(250);
    await expect(page.locator('[data-qa="media-editor-hint"]'), "no hint on a matching canvas").toHaveCount(0);

    // Desktop tab: the portrait clip fights the wide canvas → mismatch hint.
    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(250);
    const hint = page.locator('[data-qa="media-editor-hint"]');
    await expect(hint, "mismatch hint appears on the Desktop tab").toBeVisible();
    await expect(hint).toContainText(/portrait/i);
    await expect(hint).toContainText(/desktop/i);
    await page.screenshot({ path: shot("MEDIA3-hint.png") });
  });
});
