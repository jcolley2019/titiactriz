import { expect, test, type Locator, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";
import { shot } from "./_helpers";

/**
 * ADMIN.ABOUT.2 — THE ABOUT PHOTO IS A REEL-CLASS SURFACE.
 *
 * Joey's ruling, total: About is not a special case of anything. It is governed by
 * the plate law, edited by the reel's editor, and the ABOUT.MEDIA.1 fixed 3:4 frame
 * is superseded everywhere — live panel and editor canvas alike.
 *
 * Four laws, each falsifiable:
 *
 *  1. STRUCTURAL EQUALITY OF THE EDITOR. Tab by tab, the About editor's control
 *     inventory EQUALS the reel editor's — including the Shape Portrait / Landscape
 *     toggle on the wide-class tabs and its absence on the phone tab — and both
 *     draw the same device-shaped canvas. Asserted as set equality on the controls
 *     themselves, so an About-only omission or extra cannot pass.
 *  2. FRAMING + SHAPE ROUND-TRIP, PER TAB, AGAINST THE LIVE PANEL. The shape saves
 *     onto the About slot's WIDE record only, reloads, and paints: at 1440 the live
 *     panel is the chosen plate and resolves the wide record; at 390 it is the
 *     portrait plate and resolves the phone record, unmoved by the wide choice. The
 *     editor canvas and the live panel resolve the SAME rectangle per class.
 *     Portrait is stored as absence, so the toggle is a true round trip.
 *  3. THE RESET AND PAN LAWS ARE THE REEL'S. Pan slack derives from the About
 *     plate's own box (ADMIN.RESET.1c); Reset restores the active tab's transform
 *     in place, leaves the plate standing (ADMIN.RESET.1a) and writes nothing.
 *  4. THE REEL IS UNCHANGED. The wide act still draws exactly three plates with
 *     their own shapes, the reel's phone act still hangs none, and the reel editor's
 *     phone tab still offers no shape control.
 *
 * Evidence: _qa/about2-editor-phone.png, _qa/about2-editor-wide.png,
 * _qa/about2-live-390.png, _qa/about2-live-1440.png.
 *
 * The plate laws are RESTATED, never imported — the rule every parity spec follows.
 */

/* ------------------------- the laws, restated ------------------------- */

/** src/components/cinematic/reelWide.tsx — the portrait (W2) plate. */
const PORTRAIT = { aspect: 0.563, heightVh: 76, maxWidthVw: 60 };
/** src/components/cinematic/reelWide.tsx — the 3:2 landscape plate. */
const LANDSCAPE = { aspect: 1.5, heightVh: 52, maxWidthVw: 78 };
/**
 * ADMIN.ABOUT.3 — the md+ About rail IS the plate: `plateBox` against the reel's own
 * frame (the viewport's height, and a photo page that is the frame minus the copy
 * column). The two `clamp()` rails this spec used to assert against are deleted;
 * about3.spec.ts owns the sizing law in full. Restated here only so THIS spec's own
 * shape assertions still have a size to check against.
 */
const CHAPTER_FIELD_FRACTION = 0.42;
const railWidth = (vw: number, vh: number, law: { aspect: number; heightVh: number; maxWidthVw: number }) =>
  Math.min(((vh * law.heightVh) / 100) * law.aspect, (vw * (1 - CHAPTER_FIELD_FRACTION) * law.maxWidthVw) / 100);
/** The phone/wide line, mirroring src/components/cinematic/reelSpotlight.ts. */
const PHONE_BREAKPOINT = 768;

const CINE = "/cinematic";

/* ----------------------------- fixtures ----------------------------- */

function sizedPhoto(id: string, color: string, w: number, h: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='${color}'/></svg>`;
  return { id, image_url: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt_text: id };
}

/** `land` is a true 3:2 photograph — covered exactly by the landscape plate. */
const PHOTOS = [
  sizedPhoto("p1", "crimson", 400, 500),
  sizedPhoto("land", "#2f6f8f", 900, 600),
  sizedPhoto("port", "goldenrod", 400, 500),
];

/** The two About class records differ on every field, so class routing is real. */
const ABOUT_PHONE = { focal: { x: 0.8, y: 0.3 }, zoom: 1.25 };
const ABOUT_WIDE = { focal: { x: 0.25, y: 0.65 }, zoom: 1.6 };

/**
 * Reel slot 0 carries a photo (so the reel editor opens and the inventories can be
 * compared) and the About slot carries the landscape photograph this brick is for.
 */
const MEDIA = {
  hero: { photo_id: "p1", focal: { x: 0.5, y: 0.08 }, zoom: 1 },
  reel: [
    {
      photo_id: "port",
      phone: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      wide: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
  about: { photo_id: "land", phone: ABOUT_PHONE, wide: ABOUT_WIDE },
};

/** Slide 0 landscape · slide 1 portrait · slide 2 a LEGACY pre-split record. */
const MEDIA_REEL_MIXED = {
  hero: { photo_id: "p1", focal: { x: 0.5, y: 0.08 }, zoom: 1 },
  reel: [
    {
      photo_id: "land",
      phone: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      wide: { focal: { x: 0.5, y: 0.5 }, zoom: 1, plate: "landscape" },
    },
    {
      photo_id: "port",
      phone: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      wide: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    },
    { photo_id: "p1", focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
  about: { photo_id: "land", phone: ABOUT_PHONE, wide: ABOUT_WIDE },
};

const DEVICE_TABS = ["iphone-17-pro", "ipad-air", "desktop"] as const;
const PHONE_TAB = "iphone-17-pro";

const SURFACE = '[data-qa="media-editor-surface"]';
const CANVAS_IMG = `${SURFACE} [data-qa="media-preview-img"]`;
const ABOUT_PLATE = `${SURFACE} [data-qa="about-plate"]`;
const WIDE_PLATE = `${SURFACE} [data-qa="wide-plate"]`;
const ABOUT_CARD = '[data-qa="media-slot"][data-slot="about"]';
const REEL_CARD = '[data-qa="media-slot"][data-slot="reel-0"]';
const LIVE_PANEL = '[data-qa="cinematic-about-panel"]';
const LIVE_ABOUT_IMG = '[data-qa="cinematic-about-img"]';

/**
 * THE EDITOR'S CONTROL INVENTORY — every control the framing editor can offer,
 * named. Law 1 compares the About slot's presence map against the reel slot's, tab
 * by tab, so this list is the vocabulary of the comparison: a control that exists on
 * one slot and not the other shows up as an inequality rather than as a silence.
 * Composition nodes (the plate, the veil, the lockup) are deliberately NOT here —
 * they are what a canvas DRAWS, not what an owner can operate.
 */
const CONTROLS = [
  "media-editor-devices",
  "media-device-iphone-17-pro",
  "media-device-ipad-air",
  "media-device-desktop",
  "media-editor-surface",
  "media-editor-aspect",
  "media-editor-aspect-portrait",
  "media-editor-aspect-landscape",
  "media-editor-fit",
  "media-editor-zoom",
  "media-editor-zoom-value",
  "media-editor-reset",
  "media-editor-cancel",
  "media-editor-save",
] as const;

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function framingReady(loc: Locator) {
  await expect
    .poll(async () => (await loc.first().getAttribute("data-hero-framing")) ?? "absent", {
      timeout: 20_000,
    })
    .not.toContain("pending");
}

/** The resolved rectangle a surface REPORTS: "scale;posX;posY;fit;w,h,l,t". */
function parseFraming(attr: string | null) {
  const [scale, posX, posY, fit, box] = (attr ?? "").split(";");
  const [widthPct, heightPct, leftPct, topPct] = (box ?? "").split(",");
  return {
    prefix: `${scale};${posX};${posY};${fit}`,
    scale: parseFloat(scale),
    posX: parseFloat(posX),
    posY: parseFloat(posY),
    widthPct: parseFloat(widthPct),
    heightPct: parseFloat(heightPct),
    leftPct: parseFloat(leftPct),
    topPct: parseFloat(topPct),
  };
}

const canvasFraming = async (page: Page) =>
  parseFraming(await page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing"));

/** The framing PREFIX a stored record must resolve to (the panel is always fill). */
const prefixOf = (rec: { focal: { x: number; y: number }; zoom: number }) =>
  `${rec.zoom.toFixed(2)};${(rec.focal.x * 100).toFixed(0)};${(rec.focal.y * 100).toFixed(0)};fill`;

async function openAdminMedia(page: Page, media: unknown, writes?: Write[]) {
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeSupabase(page, { media, photos: PHOTOS, writes });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await settle(page, 700);
  await page.locator('[data-qa="admin-nav-media"]').click();
  await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();
}

async function openEditor(page: Page, card: string) {
  await page.locator(`${card} [data-qa="media-slot-edit"]`).click();
  await expect(page.locator(SURFACE)).toBeVisible();
  await framingReady(page.locator(CANVAS_IMG));
}

async function closeEditor(page: Page) {
  await page.locator('[data-qa="media-editor-cancel"]').click();
  await expect(page.locator(SURFACE)).toHaveCount(0);
}

async function pickTab(page: Page, tab: string) {
  await page.locator(`[data-qa="media-device-${tab}"]`).click();
  await page.waitForTimeout(300);
  await framingReady(page.locator(CANVAS_IMG));
}

/** Which controls this editor currently offers, and the canvas's own shape. */
async function inventory(page: Page) {
  const controls: Record<string, number> = {};
  for (const qa of CONTROLS) {
    controls[qa] = await page.locator(`[data-qa="${qa}"]`).count();
  }
  const box = (await page.locator(SURFACE).boundingBox())!;
  return { controls, canvasAspect: box.width / box.height };
}

/** The canvas plate's measured box — what the framing is resolved against. */
async function plateBoxOf(page: Page, sel: string) {
  const b = (await page.locator(sel).boundingBox())!;
  return { w: b.width, h: b.height, ratio: b.width / b.height };
}

async function setZoom(page: Page, v: number) {
  await page.locator('[data-qa="media-editor-zoom"]').evaluate((el, value) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
  await page.waitForTimeout(250);
}

async function drag(page: Page, dx: number, dy: number) {
  const b = (await page.locator(SURFACE).boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx / 2, cy + dy / 2, { steps: 8 });
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

function lastMediaUpsert(writes: Write[]) {
  const body = writes
    .filter((w) => w.method === "POST" && /site_settings/.test(w.url))
    .map((w) => w.body ?? "")
    .filter((b) => b.includes("cinematic_media"))
    .pop();
  expect(body, "a cinematic_media upsert fired").toBeTruthy();
  const rows = JSON.parse(body!);
  return (Array.isArray(rows) ? rows[0] : rows).value as {
    reel: { wide: Record<string, unknown> }[];
    about: {
      photo_id: string;
      phone: Record<string, unknown>;
      wide: Record<string, unknown> & { plate?: string };
    };
  };
}

async function waitForUpsert(page: Page, writes: Write[], atLeast: number) {
  await expect
    .poll(
      () =>
        writes.filter(
          (w) =>
            w.method === "POST" &&
            /site_settings/.test(w.url) &&
            (w.body ?? "").includes("cinematic_media"),
        ).length,
      { timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(atLeast);
  await page.waitForTimeout(100);
}

/**
 * Load the live act and measure the About panel. Reduced motion so the section's
 * dwell pin never transforms the box being measured; the plate geometry and the
 * framing maths are motion-agnostic.
 */
async function liveAboutPanel(page: Page, media: unknown, w: number, h: number) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await routeSupabase(page, { media, photos: PHOTOS });
  await page.setViewportSize({ width: w, height: h });
  await page.goto(CINE, { waitUntil: "domcontentloaded" });
  await settle(page, 600);
  const panel = page.locator(LIVE_PANEL).first();
  await panel.scrollIntoViewIfNeeded().catch(() => {});
  const img = page.locator(LIVE_ABOUT_IMG).first();
  await framingReady(img);
  const b = (await panel.boundingBox())!;
  return {
    plate: await panel.getAttribute("data-plate"),
    box: { w: b.width, h: b.height, ratio: b.width / b.height },
    framing: parseFraming(await img.getAttribute("data-hero-framing")),
  };
}

/* ========== 1. THE EDITOR IS THE REEL'S EDITOR, CONTROL FOR CONTROL ========== */

test.describe("ADMIN.ABOUT.2 — the About editor IS the reel editor", () => {
  test("control inventory and canvas shape match the reel's, tab by tab", async ({ page }) => {
    test.setTimeout(180_000);
    await openAdminMedia(page, MEDIA);

    const collect = async (card: string) => {
      await openEditor(page, card);
      const per: Record<string, Awaited<ReturnType<typeof inventory>>> = {};
      for (const tab of DEVICE_TABS) {
        await pickTab(page, tab);
        per[tab] = await inventory(page);
      }
      await closeEditor(page);
      return per;
    };

    const reel = await collect(REEL_CARD);
    const about = await collect(ABOUT_CARD);

    for (const tab of DEVICE_TABS) {
      expect(
        about[tab].controls,
        `${tab}: the About editor offers exactly the reel editor's controls`,
      ).toEqual(reel[tab].controls);
      // The canvas is the DEVICE frame for both kinds now — About's fixed 3:4
      // canvas is gone. Same tab, same shape, to within a subpixel.
      expect(
        Math.abs(about[tab].canvasAspect - reel[tab].canvasAspect),
        `${tab}: same canvas shape (about ${about[tab].canvasAspect.toFixed(4)} vs reel ${reel[tab].canvasAspect.toFixed(4)})`,
      ).toBeLessThan(0.01);
    }

    // And the inventory is not vacuously equal: the Shape toggle is genuinely
    // present on the wide tabs of BOTH slots and absent from the phone tab of both.
    for (const tab of ["ipad-air", "desktop"] as const) {
      expect(about[tab].controls["media-editor-aspect"], `${tab}: About offers Shape`).toBe(1);
      expect(reel[tab].controls["media-editor-aspect"], `${tab}: reel offers Shape`).toBe(1);
    }
    expect(about[PHONE_TAB].controls["media-editor-aspect"], "no Shape on the phone tab").toBe(0);
    expect(reel[PHONE_TAB].controls["media-editor-aspect"], "…on either slot").toBe(0);
  });

  test("the About canvas hangs the plate at BOTH classes; the reel's phone act hangs none", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openAdminMedia(page, MEDIA);

    await openEditor(page, ABOUT_CARD);
    // Phone tab: the portrait plate, because a phone record stores no shape.
    await expect(page.locator(ABOUT_PLATE)).toHaveAttribute("data-plate", "portrait");
    expect((await plateBoxOf(page, ABOUT_PLATE)).ratio, "About phone canvas is the portrait plate")
      .toBeCloseTo(PORTRAIT.aspect, 2);
    // …and it resolves the PHONE record.
    expect((await canvasFraming(page)).prefix, "phone tab shows the phone record").toBe(
      prefixOf(ABOUT_PHONE),
    );
    await page.screenshot({ path: shot("about2-editor-phone.png") });

    await pickTab(page, "desktop");
    expect((await plateBoxOf(page, ABOUT_PLATE)).ratio, "wide canvas starts on portrait")
      .toBeCloseTo(PORTRAIT.aspect, 2);
    expect((await canvasFraming(page)).prefix, "desktop tab shows the wide record").toBe(
      prefixOf(ABOUT_WIDE),
    );
    // The About canvas draws NO reel chrome — it is a panel, not an act.
    await expect(page.locator(WIDE_PLATE), "no W2 plate node on an About canvas").toHaveCount(0);
    await expect(page.locator(`${SURFACE} [data-qa="wide-lockup"]`)).toHaveCount(0);
    await expect(page.locator(`${SURFACE} [data-qa="wide-rule"]`)).toHaveCount(0);
    await expect(page.locator(`${SURFACE} [data-qa="reel-lockup"]`)).toHaveCount(0);
    await closeEditor(page);

    // The reel's phone act is untouched by any of this: still edge-to-edge.
    await openEditor(page, REEL_CARD);
    await expect(page.locator(ABOUT_PLATE)).toHaveCount(0);
    await expect(page.locator(WIDE_PLATE), "the reel phone canvas hangs no plate").toHaveCount(0);
  });
});

/* ====== 2. FRAMING + SHAPE ROUND-TRIP, PER TAB, AGAINST THE LIVE PANEL ====== */

test.describe("ADMIN.ABOUT.2 — the About shape round-trips to the live panel", () => {
  test("landscape saves on about.wide only, reloads, paints at 1440, and leaves 390 alone", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    /* --- 1. Baseline: the live panel before any shape is chosen. --- */
    const wideBefore = await liveAboutPanel(page, MEDIA, 1440, 900);
    expect(wideBefore.plate, "the panel starts on the portrait plate").toBe("portrait");
    expect(wideBefore.box.ratio, "…and measures it").toBeCloseTo(PORTRAIT.aspect, 2);
    expect(
      Math.abs(wideBefore.box.w - railWidth(1440, 900, PORTRAIT)),
      "the portrait rail is the plate law's own width",
    ).toBeLessThanOrEqual(1);
    const phoneBefore = await liveAboutPanel(page, MEDIA, 390, 844);
    expect(phoneBefore.framing.prefix, "the phone panel resolves the phone record").toBe(
      prefixOf(ABOUT_PHONE),
    );

    /* --- 2. Toggle the shape on the Desktop tab and save. --- */
    const writes: Write[] = [];
    await openAdminMedia(page, MEDIA, writes);
    await openEditor(page, ABOUT_CARD);
    await pickTab(page, "desktop");
    await expect(page.locator('[data-qa="media-editor-aspect-portrait"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const beforeBox = await plateBoxOf(page, ABOUT_PLATE);
    await page.locator('[data-qa="media-editor-aspect-landscape"]').click();
    await page.waitForTimeout(300);
    await framingReady(page.locator(CANVAS_IMG));

    await expect(page.locator(ABOUT_PLATE)).toHaveAttribute("data-plate", "landscape");
    const afterBox = await plateBoxOf(page, ABOUT_PLATE);
    expect(afterBox.ratio, "the About canvas re-framed to 3:2").toBeCloseTo(LANDSCAPE.aspect, 2);
    expect(afterBox.w, "the landscape plate is WIDER").toBeGreaterThan(beforeBox.w + 1);
    expect(afterBox.h, "…and SHALLOWER").toBeLessThan(beforeBox.h - 1);
    const editorWide = await canvasFraming(page);
    await page.screenshot({ path: shot("about2-editor-wide.png") });

    // The phone tab did NOT follow — it cannot: its record stores no shape.
    await pickTab(page, PHONE_TAB);
    await expect(page.locator(ABOUT_PLATE)).toHaveAttribute("data-plate", "portrait");
    await expect(page.locator('[data-qa="media-editor-aspect"]')).toHaveCount(0);
    const editorPhone = await canvasFraming(page);
    expect(editorPhone.prefix, "the phone record is untouched").toBe(prefixOf(ABOUT_PHONE));

    await page.locator('[data-qa="media-editor-save"]').click();
    await expect(page.locator(SURFACE)).toHaveCount(0);
    await waitForUpsert(page, writes, 1);

    /* --- 3. The payload: the WIDE record only, portrait still absence. --- */
    const saved = lastMediaUpsert(writes);
    expect(saved.about.wide.plate, "about.wide carries the landscape plate").toBe("landscape");
    expect(
      Object.keys(saved.about.phone),
      "about.phone carries no plate — a phone panel has no shape to choose",
    ).not.toContain("plate");
    expect(saved.about.photo_id, "the About photo survived").toBe("land");
    expect(Object.keys(saved.reel[0].wide), "an untouched reel slide gains nothing").not.toContain(
      "plate",
    );

    /* --- 4. RELOAD: the editor reopens on the saved shape. --- */
    const savedMedia = saved as unknown as Record<string, unknown>;
    await openAdminMedia(page, savedMedia);
    await openEditor(page, ABOUT_CARD);
    await pickTab(page, "desktop");
    await expect(page.locator('[data-qa="media-editor-aspect-landscape"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      (await plateBoxOf(page, ABOUT_PLATE)).ratio,
      "the landscape plate round-tripped through save + reload",
    ).toBeCloseTo(LANDSCAPE.aspect, 2);

    /* --- 5. THE LIVE PANEL, per class, against the editor's own canvas. --- */
    const wideAfter = await liveAboutPanel(page, savedMedia, 1440, 900);
    expect(wideAfter.plate, "the desktop panel is the landscape plate").toBe("landscape");
    expect(wideAfter.box.ratio, "…and measures 3:2").toBeCloseTo(LANDSCAPE.aspect, 2);
    expect(wideAfter.box.w, "the landscape rail is wider than the portrait one").toBeGreaterThan(
      wideBefore.box.w + 1,
    );
    expect(
      Math.abs(wideAfter.box.w - railWidth(1440, 900, LANDSCAPE)),
      "…and is the landscape plate's own width",
    ).toBeLessThanOrEqual(1);
    expect(wideAfter.framing.prefix, "the panel resolves the wide record").toBe(
      prefixOf(ABOUT_WIDE),
    );
    // A 3:2 photograph in the 3:2 plate keeps all of itself at zoom 1 — here the
    // wide record is zoomed 1.6, so it covers by exactly that on both axes.
    expect(wideAfter.framing.widthPct, "3:2 photo in a 3:2 plate: pure zoom").toBeCloseTo(160, 0);
    expect(wideAfter.framing.heightPct, "on both axes").toBeCloseTo(160, 0);

    // EDITOR ≡ LIVE, per class: the same shape resolves the same rectangle. The
    // two boxes differ in SIZE (a canvas is not a rail), so the law is the resolved
    // rectangle, reported in percentages, not a shared pixel count.
    for (const k of ["widthPct", "heightPct", "leftPct", "topPct"] as const) {
      expect(
        Math.abs(editorWide[k] - wideAfter.framing[k]),
        `wide class: editor canvas ${k} ${editorWide[k]} == live panel ${wideAfter.framing[k]}`,
      ).toBeLessThanOrEqual(0.2);
    }

    const phoneAfter = await liveAboutPanel(page, savedMedia, 390, 844);
    expect(phoneAfter.plate, "the phone panel is STILL the portrait plate").toBe("portrait");
    expect(phoneAfter.box.ratio, "…and measures it").toBeCloseTo(PORTRAIT.aspect, 2);
    expect(
      phoneAfter.framing.prefix,
      "the wide landscape choice did not leak into the phone panel",
    ).toBe(prefixOf(ABOUT_PHONE));
    for (const k of ["widthPct", "heightPct", "leftPct", "topPct"] as const) {
      expect(
        Math.abs(editorPhone[k] - phoneAfter.framing[k]),
        `phone class: editor canvas ${k} == live panel ${k}`,
      ).toBeLessThanOrEqual(0.2);
    }

    /* --- 6. Flip back: portrait is ABSENCE, so the JSON returns to today's. --- */
    await openAdminMedia(page, savedMedia, writes);
    await openEditor(page, ABOUT_CARD);
    await pickTab(page, "desktop");
    const before = writes.filter((w) => (w.body ?? "").includes("cinematic_media")).length;
    await page.locator('[data-qa="media-editor-aspect-portrait"]').click();
    await page.waitForTimeout(300);
    expect((await plateBoxOf(page, ABOUT_PLATE)).ratio, "back on the portrait plate").toBeCloseTo(
      PORTRAIT.aspect,
      2,
    );
    await page.locator('[data-qa="media-editor-save"]').click();
    await expect(page.locator(SURFACE)).toHaveCount(0);
    await waitForUpsert(page, writes, before + 1);
    expect(
      Object.keys(lastMediaUpsert(writes).about.wide),
      'portrait is stored as absence — never as plate: "portrait"',
    ).not.toContain("plate");
  });

  test("evidence — the live About panel at 390 and 1440, both shapes", async ({ page }) => {
    test.setTimeout(240_000);
    const LANDSCAPE_MEDIA = {
      ...MEDIA,
      about: { photo_id: "land", phone: ABOUT_PHONE, wide: { ...ABOUT_WIDE, plate: "landscape" } },
    };
    await forceLanguage(page, "es");

    for (const vp of [
      // The toggled wide shape, the DEFAULT wide shape, and the phone class (which
      // is the portrait plate either way — its record cannot carry a shape).
      { w: 1440, h: 900, media: LANDSCAPE_MEDIA, want: "landscape", name: "about2-live-1440.png" },
      { w: 1440, h: 900, media: MEDIA, want: "portrait", name: "about2-live-1440-portrait.png" },
      { w: 390, h: 844, media: LANDSCAPE_MEDIA, want: "portrait", name: "about2-live-390.png" },
    ] as const) {
      const seen = await liveAboutPanel(page, vp.media, vp.w, vp.h);
      const cls = vp.w < PHONE_BREAKPOINT ? "phone" : "wide";
      expect(seen.plate, `${vp.w}px (${cls} class) draws the ${vp.want} plate`).toBe(vp.want);
      // The section still reads: its copy, its chips and its CTA all rendered
      // beside/around the panel, with the act's own heading intact.
      await expect(page.locator('#cinematic-about [data-qa="section-heading"]')).toBeVisible();
      await expect(page.locator('#cinematic-about a[href="/work"]')).toBeVisible();
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.locator('#cinematic-about').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: shot(vp.name) });
    }
  });
});

/* ============ 3. THE RESET AND PAN LAWS ARE THE REEL'S, VERBATIM ============ */

test.describe("ADMIN.ABOUT.2 — About obeys the reel's pan and Reset laws", () => {
  test("pan slack derives from the About plate's own box", async ({ page }) => {
    test.setTimeout(150_000);
    await openAdminMedia(page, MEDIA);
    await openEditor(page, ABOUT_CARD);
    await pickTab(page, "desktop");
    await page.locator('[data-qa="media-editor-aspect-landscape"]').click();
    await page.waitForTimeout(300);
    await setZoom(page, 1.5);
    await framingReady(page.locator(CANVAS_IMG));

    // Photo and plate are both 3:2, so at zoom Z the painted rectangle is Z on both
    // axes and the horizontal overflow is exactly (Z - 1) x the plate's measured
    // width. The expected focal travel is therefore arithmetic, not a direction.
    const plate = await plateBoxOf(page, ABOUT_PLATE);
    const before = await canvasFraming(page);
    expect(before.widthPct, "slack on both axes at 1.5x").toBeCloseTo(150, 0);
    expect(before.heightPct, "…equally, photo and plate sharing their aspect").toBeCloseTo(150, 0);

    const DRAG_PX = 35;
    await drag(page, -DRAG_PX, 0);
    const after = await canvasFraming(page);
    const overflowX = (before.widthPct / 100 - 1) * plate.w;
    const expected = before.posX + (DRAG_PX / overflowX) * 100;
    // Resolving the drag against the device-shaped surface, or against the portrait
    // plate, both predict a materially different travel — which this excludes. The
    // ±1.5 is `data-hero-framing`'s whole-percent reporting, not slack in the law.
    expect(
      Math.abs(after.posX - expected),
      `drag moved focal to ${after.posX}%, the About plate's slack predicts ${expected.toFixed(1)}%`,
    ).toBeLessThanOrEqual(1.5);
    expect(after.posY, "a pure horizontal drag leaves Y alone").toBeCloseTo(before.posY, 1);
  });

  test("Reset restores the active tab in place, keeps the plate, writes nothing", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const writes: Write[] = [];
    await openAdminMedia(page, MEDIA, writes);
    await openEditor(page, ABOUT_CARD);
    await pickTab(page, "desktop");
    await page.locator('[data-qa="media-editor-aspect-landscape"]').click();
    await page.waitForTimeout(300);
    await setZoom(page, 1.9);
    await drag(page, 30, -22);
    expect((await canvasFraming(page)).scale, "dirtied").toBeCloseTo(1.9, 1);

    writes.length = 0;
    await page.locator('[data-qa="media-editor-reset"]').click();
    await page.waitForTimeout(400);
    await framingReady(page.locator(CANVAS_IMG));

    const reset = await canvasFraming(page);
    expect(reset.scale, "Reset restored the transform").toBeCloseTo(1, 2);
    expect(reset.posX, "…centred").toBeCloseTo(50, 1);
    expect(reset.posY, "…on both axes").toBeCloseTo(50, 1);
    // Reset is a transform control: the SHAPE is a composition choice and stands.
    await expect(page.locator('[data-qa="media-editor-aspect-landscape"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect((await plateBoxOf(page, ABOUT_PLATE)).ratio, "the landscape plate still stands")
      .toBeCloseTo(LANDSCAPE.aspect, 2);
    await expect(page.locator(SURFACE), "Reset keeps the editor open").toBeVisible();
    await expect(
      page.locator('[data-qa="media-device-desktop"]'),
      "…on the tab it was pressed from",
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      writes.filter((w) => /site_settings/.test(w.url)),
      "Reset persists nothing",
    ).toHaveLength(0);

    // And the untouched class is untouched.
    await pickTab(page, PHONE_TAB);
    expect((await canvasFraming(page)).prefix, "the phone class survived the wide reset").toBe(
      prefixOf(ABOUT_PHONE),
    );
  });
});

/* ================== 4. REGRESSION — THE REEL IS UNCHANGED ================== */

test.describe("ADMIN.ABOUT.2 — the reel act is unchanged", () => {
  test("1440 — three plates, their own shapes, and the About panel is not one of them", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await forceLanguage(page, "es");
    await routeSupabase(page, { media: MEDIA_REEL_MIXED, photos: PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    // Exactly three reel plates — the About panel is a plate by LAW, not by node:
    // it must never join the reel's own count.
    await expect(page.locator('[data-qa="wide-plate"]')).toHaveCount(3);
    const declared = await page
      .locator('[data-qa="wide-plate"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-plate")));
    expect(declared, "landscape · portrait · LEGACY-portrait, as before").toEqual([
      "landscape",
      "portrait",
      "portrait",
    ]);
    await expect(page.locator(LIVE_PANEL), "and the About panel renders beside them")
      .toHaveCount(1);
  });

  test("390 — the reel's phone act still hangs no plate", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await forceLanguage(page, "es");
    await routeSupabase(page, { media: MEDIA_REEL_MIXED, photos: PHOTOS });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    await expect(page.locator('[data-qa="wide-plate"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="wide-chapter"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="reel-veil"]')).toHaveCount(3);
    // The About panel, by contrast, IS a plate on the phone class.
    await expect(page.locator(LIVE_PANEL)).toHaveAttribute("data-plate", "portrait");
  });
});
