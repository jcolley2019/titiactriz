import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";
import { shot } from "./_helpers";

/**
 * ADMIN.ASPECT.1 — PER-SLIDE WIDE-PLATE ASPECT (PORTRAIT / LANDSCAPE).
 *
 * A landscape photograph should not be forced into a portrait plate on desktop.
 * Each wide reel slide now chooses its plate's SHAPE; the phone act is
 * edge-to-edge and hangs no plate, so it has no opinion and ignores the field.
 *
 * Four laws, each falsifiable, plus the brick's evidence:
 *
 *  1. ROUND TRIP — the Desktop tab's toggle re-frames the editor canvas to the
 *     landscape plate box, the choice saves onto the slide's WIDE record only,
 *     and after a reload the editor AND the live act both honor it. Flipping back
 *     to portrait removes the field again, so portrait is stored as absence.
 *  2. PORTRAIT IS UNCHANGED — a portrait slide, and a LEGACY pre-split record
 *     with no class records at all, both compute the W2 box to the same
 *     arithmetic they always did (asserted against the restated law, not against
 *     a golden screenshot).
 *  3. THE PHONE ACT IGNORES IT — at 390 a landscape-plate slide renders the V1
 *     phone act with no plate anywhere, and the phone class's own framing is
 *     untouched. The iPhone tab offers no toggle.
 *  4. THE PLATE'S LAWS HOLD ON A LANDSCAPE PLATE — the self-drawing gold frame
 *     traces the landscape box, the tonal ground and the gold seam are intact,
 *     nothing veils the photograph, and the plate is centred in its photo page:
 *     vertically against the full-height copy column, horizontally in the page.
 *
 * Evidence: _qa/aspect-editor-landscape.png, _qa/aspect-live-landscape-1440.png,
 * _qa/aspect-live-portrait-1440.png, _qa/aspect-phone-390.png.
 *
 * The plate laws are RESTATED below, not imported — the rule every parity spec
 * follows. A drift in the shipped geometry must fail here rather than follow
 * silently.
 */

/* ------------------------- the laws, restated ------------------------- */

/** src/components/cinematic/reelWide.tsx — the portrait (W2) plate. */
const PORTRAIT = { aspect: 0.563, heightVh: 76, maxWidthVw: 60 };
/** src/components/cinematic/reelWide.tsx — the 3:2 landscape plate. */
const LANDSCAPE = { aspect: 1.5, heightVh: 52, maxWidthVw: 78 };
/** The spread's split: the chapter column's fraction of the frame. */
const CHAPTER_FIELD_FRACTION = 0.42;
/** The plate's header-clearing top edge, before centring takes over. */
const PLATE_TOP_VH = 10;
/** The gold token the hairline frame and the seam are both drawn in. */
const GOLD_RGB = "201, 165, 92";

type Law = { aspect: number; heightVh: number; maxWidthVw: number };

/** `plateBox`, restated: the height rule and the width cap, smaller box wins. */
function plateBox(frameW: number, frameH: number, law: Law) {
  const hRule = (frameH * law.heightVh) / 100;
  const wFromH = hRule * law.aspect;
  const wCap = (frameW * law.maxWidthVw) / 100;
  if (wCap < wFromH) return { w: wCap, h: wCap / law.aspect };
  return { w: wFromH, h: hRule };
}

/* ----------------------------- fixtures ----------------------------- */

/** A source of a chosen pixel size, so aspect-dependent behavior is deliberate. */
function sizedPhoto(id: string, color: string, w: number, h: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='${color}'/></svg>`;
  return { id, image_url: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt_text: id };
}

/**
 * `land` is a true 3:2 LANDSCAPE photograph — the case this brick exists for. In
 * the portrait plate it paints 266% of the box's width (62% of the photograph
 * thrown away); in the landscape plate it is covered exactly.
 */
const PHOTOS = [
  sizedPhoto("p1", "crimson", 400, 500),
  sizedPhoto("land", "#2f6f8f", 900, 600),
  sizedPhoto("port", "goldenrod", 400, 500),
  sizedPhoto("legacy", "#7a4b8f", 400, 500),
];

/** Slot 0 landscape · slot 1 explicit portrait · slot 2 a LEGACY single record. */
const MEDIA_MIXED = {
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
    // Pre-split shape: one slot-level record, no phone/wide, no plate. This is
    // what production rows written before FRAME.SPLIT.1 actually look like.
    { photo_id: "legacy", focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
};

/** The editor fixture: slot 0 holds the landscape photograph, untouched. */
const MEDIA_EDIT = {
  hero: { photo_id: "p1", focal: { x: 0.5, y: 0.08 }, zoom: 1 },
  reel: [
    {
      photo_id: "land",
      phone: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      wide: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
};

const SURFACE = '[data-qa="media-editor-surface"]';
const CANVAS_IMG = `${SURFACE} [data-qa="media-preview-img"]`;
const CANVAS_PLATE = `${SURFACE} [data-qa="wide-plate"]`;
const PATH = "/cinematic";

type SavedSlot = {
  photo_id: string | null;
  phone: { focal: { x: number; y: number }; zoom: number; plate?: string };
  wide: { focal: { x: number; y: number }; zoom: number; plate?: string };
};

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function framingReady(page: Page) {
  await expect
    .poll(
      async () =>
        (await page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing")) ?? "absent",
      { timeout: 20_000 },
    )
    .not.toContain("pending");
}

/** The canvas photo's resolved rectangle: "scale;posX;posY;fit;w,h,l,t". */
async function painted(page: Page) {
  const attr = (await page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing")) ?? "";
  const [scale, posX, posY, , box] = attr.split(";");
  const [widthPct, heightPct] = (box ?? "").split(",");
  return {
    scale: parseFloat(scale),
    posX: parseFloat(posX),
    posY: parseFloat(posY),
    widthPct: parseFloat(widthPct),
    heightPct: parseFloat(heightPct),
  };
}

async function openReelEditor(page: Page, media: unknown, writes?: Write[]) {
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeSupabase(page, { media, photos: PHOTOS, writes });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await settle(page, 700);
  await page.locator('[data-qa="admin-nav-media"]').click();
  await page
    .locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]')
    .click();
  await expect(page.locator(SURFACE)).toBeVisible();
  await framingReady(page);
}

async function pickTab(page: Page, tab: string) {
  await page.locator(`[data-qa="media-device-${tab}"]`).click();
  await page.waitForTimeout(300);
  await framingReady(page);
}

/** The canvas plate's measured box — the box the framing is resolved against. */
async function canvasPlate(page: Page) {
  const b = (await page.locator(CANVAS_PLATE).boundingBox())!;
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

/** Drag the editor surface by (dx, dy) with the mouse (pointer events). */
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
  return (Array.isArray(rows) ? rows[0] : rows).value as { reel: SavedSlot[] };
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

/* ============ 1. THE ADMIN CONTROL, AND WHAT IT RE-FRAMES ============ */

test.describe("ADMIN.ASPECT.1 — the wide tabs choose the plate's shape", () => {
  test("the toggle re-frames the canvas to the landscape box; the phone tab has none", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openReelEditor(page, MEDIA_EDIT);

    // The iPhone tab is the phone act: no plate in the canvas, no control for one.
    await expect(page.locator('[data-qa="media-editor-aspect"]')).toHaveCount(0);
    await expect(page.locator(CANVAS_PLATE), "the phone canvas hangs no plate").toHaveCount(0);

    await pickTab(page, "desktop");
    const toggle = page.locator('[data-qa="media-editor-aspect"]');
    await expect(toggle, "the wide tab offers the shape control").toHaveCount(1);
    await expect(page.locator('[data-qa="media-editor-aspect-portrait"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Portrait: the W2 plate, and a 3:2 photograph is cropped hard to fill it.
    const before = await canvasPlate(page);
    expect(before.ratio, "the canvas starts on the portrait plate").toBeCloseTo(
      PORTRAIT.aspect,
      2,
    );
    await expect(page.locator(CANVAS_PLATE)).toHaveAttribute("data-plate", "portrait");
    const portraitPaint = await painted(page);
    expect(
      portraitPaint.widthPct,
      "a 3:2 photo in the portrait plate is cropped to a fraction of its width",
    ).toBeCloseTo((LANDSCAPE.aspect / PORTRAIT.aspect) * 100, 0);

    // Switch. The canvas re-frames to the landscape box — wider and shallower.
    await page.locator('[data-qa="media-editor-aspect-landscape"]').click();
    await page.waitForTimeout(300);
    await framingReady(page);

    await expect(page.locator('[data-qa="media-editor-aspect-landscape"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(CANVAS_PLATE)).toHaveAttribute("data-plate", "landscape");
    const after = await canvasPlate(page);
    expect(after.ratio, "the canvas plate is now 3:2").toBeCloseTo(LANDSCAPE.aspect, 2);
    expect(after.w, "the landscape plate is WIDER").toBeGreaterThan(before.w + 1);
    expect(after.h, "…and SHALLOWER").toBeLessThan(before.h - 1);

    // And the whole point: the photograph is now covered exactly, nothing thrown
    // away, where the portrait plate kept ~38% of its width.
    const landscapePaint = await painted(page);
    expect(landscapePaint.widthPct, "a 3:2 photo covers the 3:2 plate exactly").toBeCloseTo(
      100,
      0,
    );
    expect(landscapePaint.heightPct, "on both axes").toBeCloseTo(100, 0);

    await page.screenshot({ path: shot("aspect-editor-landscape.png") });

    // The iPad tab renders the wide act too, so it shows the SAME record's plate
    // — two tabs previewing one record, exactly as the zoom slider already is.
    await pickTab(page, "ipad-air");
    await expect(page.locator('[data-qa="media-editor-aspect-landscape"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect((await canvasPlate(page)).ratio, "the iPad canvas draws the wide act's plate")
      .toBeCloseTo(LANDSCAPE.aspect, 2);

    // The iPhone tab is untouched by any of it: still the phone act, no plate.
    await pickTab(page, "iphone-17-pro");
    await expect(page.locator('[data-qa="media-editor-aspect"]')).toHaveCount(0);
    await expect(page.locator(CANVAS_PLATE)).toHaveCount(0);
    const phonePaint = await painted(page);
    expect(phonePaint.scale, "the phone record kept its zoom").toBeCloseTo(1, 2);
    expect(phonePaint.posX, "the phone record kept its focal").toBeCloseTo(50, 1);
  });

  test("the pan law measures the LANDSCAPE plate: drag maps 1:1 to that box", async ({ page }) => {
    test.setTimeout(120_000);
    await openReelEditor(page, MEDIA_EDIT);
    await pickTab(page, "desktop");
    await page.locator('[data-qa="media-editor-aspect-landscape"]').click();
    await page.waitForTimeout(300);
    await setZoom(page, 1.5);
    await framingReady(page);

    // The photo and the plate are both 3:2, so at zoom Z the painted rectangle is
    // Z on BOTH axes and the horizontal overflow is exactly (Z - 1) x the plate's
    // measured width. That makes the expected focal travel arithmetic, not a
    // direction: 1:1 with the box the canvas paints (ADMIN.RESET.1c's law).
    const plate = await canvasPlate(page);
    const before = await painted(page);
    expect(before.widthPct, "the landscape plate has slack on both axes at 1.5x").toBeCloseTo(
      150,
      0,
    );
    expect(before.heightPct, "…equally, since photo and plate share their aspect").toBeCloseTo(
      150,
      0,
    );

    const DRAG_PX = 35;
    await drag(page, -DRAG_PX, 0);
    const after = await painted(page);

    const overflowX = (before.widthPct / 100 - 1) * plate.w;
    const expected = before.posX + (DRAG_PX / overflowX) * 100;
    // If the drag resolved its overflow against the PORTRAIT plate instead (the
    // ADMIN.RESET.1c bug, re-armed by a landscape plate), that box is both
    // narrower and far more overflowed, so the same gesture would move the focal
    // by roughly a third of this — which this tolerance excludes. The tolerance is
    // explicit rather than a precision: `data-hero-framing` reports posX as a whole
    // percent, so ±1 is the reporting granularity, not slack in the law.
    expect(
      Math.abs(after.posX - expected),
      `drag moved focal to ${after.posX}%, the landscape plate's slack predicts ${expected.toFixed(1)}%`,
    ).toBeLessThanOrEqual(1.5);
    expect(after.posY, "a pure horizontal drag leaves Y alone").toBeCloseTo(before.posY, 1);
  });

  test("Reset recentres inside the chosen plate and leaves the plate standing", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openReelEditor(page, MEDIA_EDIT);
    await pickTab(page, "desktop");
    await page.locator('[data-qa="media-editor-aspect-landscape"]').click();
    await page.waitForTimeout(300);

    // Zoom in, then Reset.
    await setZoom(page, 1.8);
    expect((await painted(page)).scale, "zoomed").toBeCloseTo(1.8, 1);

    await page.locator('[data-qa="media-editor-reset"]').click();
    await page.waitForTimeout(300);
    await framingReady(page);

    const reset = await painted(page);
    expect(reset.scale, "Reset restored the transform").toBeCloseTo(1, 2);
    expect(reset.posX, "…centred").toBeCloseTo(50, 1);
    // Reset is a transform control: the SHAPE is a composition choice and survives.
    await expect(page.locator('[data-qa="media-editor-aspect-landscape"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect((await canvasPlate(page)).ratio, "the landscape plate still stands").toBeCloseTo(
      LANDSCAPE.aspect,
      2,
    );
  });
});

/* ================ 2. SAVE, RELOAD, AND BACK AGAIN ================ */

test.describe("ADMIN.ASPECT.1 — the shape round-trips", () => {
  test("landscape saves on the WIDE record only, reloads, and flips back to absence", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const writes: Write[] = [];
    await openReelEditor(page, MEDIA_EDIT, writes);

    await pickTab(page, "desktop");
    await page.locator('[data-qa="media-editor-aspect-landscape"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-qa="media-editor-save"]').click();
    await expect(page.locator(SURFACE)).toHaveCount(0);
    await waitForUpsert(page, writes, 1);

    const saved = lastMediaUpsert(writes);
    const slot0 = saved.reel[0];
    expect(slot0.wide.plate, "the wide record carries the landscape plate").toBe("landscape");
    expect(
      Object.keys(slot0.phone),
      "the phone record carries no plate — it hangs none",
    ).not.toContain("plate");
    expect(slot0.photo_id, "and the photo is untouched").toBe("land");
    expect(
      Object.keys(saved.reel[1].wide),
      "an untouched slot gains nothing",
    ).not.toContain("plate");

    // RELOAD on the saved value: the Desktop tab reopens on the landscape plate.
    await injectAdminSession(page);
    await routeSupabase(page, {
      media: saved as unknown as Record<string, unknown>,
      photos: PHOTOS,
      writes,
    });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 700);
    await page.locator('[data-qa="admin-nav-media"]').click();
    await page
      .locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]')
      .click();
    await expect(page.locator(SURFACE)).toBeVisible();
    await pickTab(page, "desktop");

    await expect(page.locator('[data-qa="media-editor-aspect-landscape"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      (await canvasPlate(page)).ratio,
      "the landscape plate round-tripped through save + reload",
    ).toBeCloseTo(LANDSCAPE.aspect, 2);

    // Flip back: portrait is stored as the ABSENCE of the field, so the record
    // returns to exactly the JSON it had before this brick existed.
    await page.locator('[data-qa="media-editor-aspect-portrait"]').click();
    await page.waitForTimeout(300);
    expect((await canvasPlate(page)).ratio, "the canvas is the W2 plate again").toBeCloseTo(
      PORTRAIT.aspect,
      2,
    );
    const beforeCount = writes.filter((w) => (w.body ?? "").includes("cinematic_media")).length;
    await page.locator('[data-qa="media-editor-save"]').click();
    await expect(page.locator(SURFACE)).toHaveCount(0);
    await waitForUpsert(page, writes, beforeCount + 1);

    const reverted = lastMediaUpsert(writes);
    expect(
      Object.keys(reverted.reel[0].wide),
      "back on portrait, the plate field is gone — not stored as \"portrait\"",
    ).not.toContain("plate");
  });
});

/* ============ 3. THE LIVE SPREAD, BOTH SHAPES, ONE ACT ============ */

test.describe("ADMIN.ASPECT.1 — the live wide act honors the shape", () => {
  test("1440 — landscape, portrait and a LEGACY record each draw their own plate", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await forceLanguage(page, "es");
    await routeSupabase(page, { media: MEDIA_MIXED, photos: PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    await expect(page.locator('[data-qa="wide-plate"]')).toHaveCount(3);

    // Each slide declares the shape it drew...
    const declared = await page
      .locator('[data-qa="wide-plate"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-plate")));
    expect(declared, "slide 1 landscape; slide 2 portrait; the LEGACY slide portrait").toEqual([
      "landscape",
      "portrait",
      "portrait",
    ]);

    // ...and the box it drew matches that shape's law, measured against the room.
    const room = (await page.locator('[data-qa="wide-room"]').first().boundingBox())!;
    const zoneW = room.width * (1 - CHAPTER_FIELD_FRACTION);

    const boxes: { w: number; h: number; x: number; y: number }[] = [];
    for (const i of [0, 1, 2]) {
      const b = (await page
        .locator(`[data-qa="reel-slide"][data-slide="${i}"] [data-qa="wide-plate"]`)
        .boundingBox())!;
      boxes.push({ w: b.width, h: b.height, x: b.x, y: b.y });

      const law = i === 0 ? LANDSCAPE : PORTRAIT;
      const want = plateBox(zoneW, room.height, law);
      expect(b.width, `slide ${i + 1} plate width follows its law`).toBeCloseTo(want.w, 0);
      expect(b.height, `slide ${i + 1} plate height follows its law`).toBeCloseTo(want.h, 0);

      // Centred horizontally in its own photo page, never crossing the seam.
      const copyLeft = i % 2 === 1;
      const zoneX = copyLeft ? room.width * CHAPTER_FIELD_FRACTION : 0;
      expect(b.x - room.x, `slide ${i + 1} plate centred in its photo page`).toBeCloseTo(
        zoneX + (zoneW - want.w) / 2,
        0,
      );

      // Vertically: centred in the frame, but never above the header-clearing
      // top edge. One expression, both shapes.
      const wantTop = Math.max(
        (room.height * PLATE_TOP_VH) / 100,
        (room.height - want.h) / 2,
      );
      expect(b.y - room.y, `slide ${i + 1} plate vertical placement`).toBeCloseTo(wantTop, 0);
    }

    // The landscape plate is wider and shallower than the portrait ones — the
    // whole purpose, asserted on the live render.
    expect(boxes[0].w, "landscape plate is wider").toBeGreaterThan(boxes[1].w + 1);
    expect(boxes[0].h, "landscape plate is shallower").toBeLessThan(boxes[1].h - 1);
    // And it is genuinely centred against the full-height copy column.
    expect(boxes[0].y + boxes[0].h / 2, "landscape plate centred on the room's midline")
      .toBeCloseTo(room.y + room.height / 2, 0);

    // A landscape source in the landscape plate keeps ALL of itself.
    const paint =
      (await page
        .locator('[data-qa="reel-slide"][data-slide="0"] [data-qa="cinematic-reel-img"]')
        .getAttribute("data-hero-framing")) ?? "";
    const [w0, h0] = (paint.split(";")[4] ?? "").split(",");
    expect(parseFloat(w0), "the 3:2 photo covers the 3:2 plate exactly").toBeCloseTo(100, 0);
    expect(parseFloat(h0), "on both axes").toBeCloseTo(100, 0);
  });

  test("1440 — the plate's own laws hold on a landscape plate", async ({ page }) => {
    test.setTimeout(120_000);
    await forceLanguage(page, "es");
    await routeSupabase(page, { media: MEDIA_MIXED, photos: PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    const slide0 = '[data-qa="reel-slide"][data-slide="0"]';
    const plate = page.locator(`${slide0} [data-qa="wide-plate"]`);
    const line = page.locator(`${slide0} [data-qa="plate-frame-line"]`);

    // The self-drawing gold hairline frame traces the LANDSCAPE box.
    await expect(line, "the plate frame is drawn on a landscape plate too").toHaveCount(1);
    const pb = (await plate.boundingBox())!;
    const lb = (await line.boundingBox())!;
    expect(Math.abs(lb.width - pb.width), "frame width tracks the plate").toBeLessThanOrEqual(2);
    expect(Math.abs(lb.height - pb.height), "frame height tracks the plate").toBeLessThanOrEqual(
      2,
    );
    const stroke = await line.evaluate((el) => getComputedStyle(el).stroke);
    expect(stroke, "the frame is the gold token").toContain(GOLD_RGB);

    // The ground laws: one tonal room, its gold seam, its filigree — and NO veil
    // over the photograph.
    await expect(page.locator(`${slide0} [data-qa="wide-chapter-seam"]`)).toHaveCount(1);
    await expect(page.locator(`${slide0} [data-qa="chapter-ornament"]`)).toHaveCount(1);
    await expect(page.locator(`${slide0} [data-qa="reel-veil"]`)).toHaveCount(0);
    const room = page.locator(`${slide0} [data-qa="wide-room"]`);
    const ground = await room.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(ground, "the room keeps its opaque tonal ground").not.toBe("rgba(0, 0, 0, 0)");
    const seam = await page
      .locator(`${slide0} [data-qa="wide-chapter-seam"]`)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(seam, "the seam is the gold token").toContain(GOLD_RGB);
  });

  test("1440 — evidence: the landscape spread and the portrait spread", async ({ page }) => {
    test.setTimeout(180_000);
    await forceLanguage(page, "es");
    await routeSupabase(page, { media: MEDIA_MIXED, photos: PHOTOS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    const y0 = await page.evaluate(() => {
      const img = document.querySelector('[data-qa="cinematic-reel-img"]');
      const pin = img?.closest('[data-qa="cinematic-section"]')?.firstElementChild;
      if (!pin) throw new Error("reel pin container not found");
      return pin.getBoundingClientRect().top + window.scrollY;
    });

    // Slide 1 (landscape) and slide 2 (portrait) at their dead-stops.
    const stops = { 1: 0.5 / 3, 2: 1.75 / 3 } as const;
    const names = { 1: "aspect-live-landscape-1440.png", 2: "aspect-live-portrait-1440.png" };
    for (const slide of [1, 2] as const) {
      const target = y0 + stops[slide] * 3 * 900;
      await page.mouse.move(200, 300);
      for (let i = 0; i < 80; i++) {
        const at = await page.evaluate(() => window.scrollY);
        const delta = target - at;
        if (Math.abs(delta) < 8) break;
        await page.mouse.wheel(0, Math.max(-600, Math.min(600, Math.round(delta))));
        await page.waitForTimeout(90);
      }
      await page.waitForTimeout(500);
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('[data-qa="cinematic-reel-img"]')].every(
            (i) =>
              (i as HTMLImageElement).complete &&
              (i as HTMLImageElement).naturalWidth > 0 &&
              !(i.getAttribute("data-hero-framing") ?? "").includes("pending"),
          ),
        { timeout: 30_000 },
      );

      const op = await page
        .locator('[data-qa="reel-slide"]')
        .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).opacity)));
      expect(op[slide - 1], `slide ${slide} opaque at its dead-stop`).toBeGreaterThan(0.99);
      await page.screenshot({ path: shot(names[slide]) });
    }
  });
});

/* ================= 4. THE PHONE ACT IGNORES THE FIELD ================= */

test.describe("ADMIN.ASPECT.1 — the phone act ignores the plate entirely", () => {
  test("390 — a landscape-plate slide renders the untouched V1 act", async ({ page }) => {
    test.setTimeout(120_000);
    await forceLanguage(page, "es");
    await routeSupabase(page, { media: MEDIA_MIXED, photos: PHOTOS });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    // No plate, no frame, no spread — the CINE.FLOW.5 phone composition, whole.
    await expect(page.locator('[data-qa="wide-plate"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="plate-frame-line"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="wide-chapter"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="reel-lockup"]')).toHaveCount(3);
    await expect(page.locator('[data-qa="reel-veil"]')).toHaveCount(3);

    // And the phone class's own framing is what paints: the landscape slide's
    // photo fills the frame at its phone record's zoom, cropped by the viewport
    // and not by any plate.
    const attr =
      (await page
        .locator('[data-qa="reel-slide"][data-slide="0"] [data-qa="cinematic-reel-img"]')
        .getAttribute("data-hero-framing")) ?? "";
    const [scale, posX, posY] = attr.split(";");
    expect(parseFloat(scale), "the phone record's zoom").toBeCloseTo(1, 2);
    expect(parseFloat(posX), "the phone record's focal x").toBeCloseTo(50, 1);
    expect(parseFloat(posY), "the phone record's focal y").toBeCloseTo(50, 1);

    await page.screenshot({ path: shot("aspect-phone-390.png") });
  });
});
