import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, svgPhoto, type Write } from "./_admin";
import { shot } from "./_helpers";

/**
 * ADMIN.RESET.1a — RESET RESETS THE FRAME. IT NEVER EXITS.
 *
 * The defect: "Reset to default" was wired to the owner's slot-level reset, which
 * closed the dialog and persisted a whole-slot wipe. Pressing it in the middle of
 * framing threw the owner back to the Media screen and discarded the slot — so the
 * one control whose job is "undo my crop" was the most destructive button on the
 * surface.
 *
 * The contract proved here, on the reel (per-class) AND the hero (single-record):
 *
 *  1. Reset restores the ACTIVE tab's transform to the loaded media's default —
 *     zoom 1 at the kind's default focal.
 *  2. The editor is STILL OPEN, on the same slot and the same tab.
 *  3. Nothing is written. Not an upsert, not a delete, nothing.
 *  4. Other tabs are untouched — resetting the wide class leaves phone's crop
 *     exactly where the owner left it.
 *  5. Cancel remains the separate exit-without-saving control.
 */

/** 3:4 portrait sources — the reel's real aspect, so a crop has slack to pan. */
const PHOTOS = [
  svgPhoto("p1", "crimson"),
  svgPhoto("port", "teal"),
  svgPhoto("p3", "goldenrod"),
  svgPhoto("p4", "navy"),
];

/** The framing defaults, mirroring src/hooks/useCinematicMedia.ts. */
const REEL_DEFAULT = { focal: { x: 0.5, y: 0.5 }, zoom: 1 };
const HERO_DEFAULT = { focal: { x: 0.5, y: 0.08 }, zoom: 1 };

/** Panned + zoomed fixtures, well off the defaults so a reset is unmistakable. */
const REEL_PHONE = { x: 0.2, y: 0.7 };
const REEL_WIDE = { x: 0.85, y: 0.25 };

const MEDIA = {
  hero: { photo_id: "p1", focal: { x: 0.3, y: 0.6 }, zoom: 1.4 },
  reel: [
    {
      photo_id: "port",
      phone: { focal: REEL_PHONE, zoom: 1.3 },
      wide: { focal: REEL_WIDE, zoom: 1.6 },
    },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
};

const SURFACE = '[data-qa="media-editor-surface"]';
const CANVAS_IMG = '[data-qa="media-editor-surface"] [data-qa="media-preview-img"]';

/** heroFramingAttr's prefix: "scale;posX;posY;fit;" — the record, before the box. */
const attrPrefix = (focal: { x: number; y: number }, zoom: number) =>
  `${zoom.toFixed(2)};${(focal.x * 100).toFixed(0)};${(focal.y * 100).toFixed(0)};fill;`;

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wait until the canvas image has decoded + measured (attr is no longer pending). */
async function framingReady(page: Page) {
  await expect
    .poll(async () => (await page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing")) ?? "absent", {
      timeout: 20_000,
    })
    .not.toContain("pending");
}

const canvasAttr = (page: Page) =>
  page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing");

const zoomText = (page: Page) => page.locator('[data-qa="media-editor-zoom-value"]').innerText();

/** Writes that would touch the cinematic config — upserts AND key deletes. */
const configWrites = (writes: Write[]) => writes.filter((w) => /site_settings/.test(w.url));

async function openAdminMedia(page: Page, writes?: Write[]) {
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeSupabase(page, { media: MEDIA, photos: PHOTOS, writes });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await settle(page, 700);
  await page.locator('[data-qa="admin-nav-media"]').click();
  await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();
}

async function openEditor(page: Page, slot: string) {
  await page.locator(`[data-qa="media-slot"][data-slot="${slot}"] [data-qa="media-slot-edit"]`).click();
  await expect(page.locator(SURFACE)).toBeVisible();
  await framingReady(page);
}

/** Set the zoom slider through React's value setter (the framesplit idiom). */
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

/** Drag the surface by (dx, dy) in CSS px. */
async function dragSurface(page: Page, dx: number, dy: number) {
  const box = (await page.locator(SURFACE).boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx / 2, cy + dy / 2, { steps: 6 });
  await page.mouse.move(cx + dx, cy + dy, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

/* ================== 1. THE REEL: reset the active class only ================== */

test.describe("ADMIN.RESET.1a — Reset restores the tab's transform, in place", () => {
  test("reel: zoom+pan then Reset → default transform, editor still open, phone tab untouched, no write", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const writes: Write[] = [];
    await openAdminMedia(page, writes);
    await openEditor(page, "reel-0");

    // The editor opens on the iPhone tab = the PHONE class. Photograph the
    // as-found state of the tab we are about to prove is left alone.
    expect(await zoomText(page), "iPhone tab opens on the stored phone zoom").toContain("1.30");
    const phoneBefore = await canvasAttr(page);
    expect(phoneBefore, "phone tab shows the stored phone record").toContain(
      attrPrefix(REEL_PHONE, 1.3),
    );

    // Move to Desktop = the WIDE class, and confirm it carries its own record.
    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(300);
    await framingReady(page);
    expect(await zoomText(page), "Desktop tab reads the wide record").toContain("1.60");

    // Edit it further — zoom AND pan — so Reset has real work to undo.
    await setZoom(page, 2.2);
    await dragSurface(page, -60, -40);
    const wideDirty = await canvasAttr(page);
    expect(wideDirty, "the wide record took the zoom+pan edit").not.toBe(null);
    expect(await zoomText(page), "wide zoom is dirty before Reset").toContain("2.20");
    await page.screenshot({ path: shot("adminreset-before.png") });

    /* --- THE ACT --- */
    writes.length = 0;
    await page.locator('[data-qa="media-editor-reset"]').click();
    await page.waitForTimeout(400);
    await framingReady(page);

    // (1) the transform IS the default, (2) the editor is still open, on the
    // same slot and the same tab.
    expect(await zoomText(page), "Reset restores the default zoom").toContain(
      REEL_DEFAULT.zoom.toFixed(2),
    );
    expect(await canvasAttr(page), "Reset restores the default focal + zoom").toContain(
      attrPrefix(REEL_DEFAULT.focal, REEL_DEFAULT.zoom),
    );
    await expect(page.locator(SURFACE), "Reset does not close the editor").toBeVisible();
    await expect(
      page.locator('[data-qa="media-device-desktop"]'),
      "Reset stays on the tab it was pressed from",
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('[data-qa="admin-media"]'),
      "the Media screen is behind the dialog, not navigated to",
    ).toBeVisible();
    await page.screenshot({ path: shot("adminreset-after.png") });

    // (3) nothing was written.
    expect(configWrites(writes), "Reset persists nothing").toHaveLength(0);

    // (4) the OTHER tab is untouched.
    await page.locator('[data-qa="media-device-iphone-17-pro"]').click();
    await page.waitForTimeout(300);
    await framingReady(page);
    expect(await zoomText(page), "the phone class kept its own zoom").toContain("1.30");
    expect(await canvasAttr(page), "the phone class is byte-unchanged").toBe(phoneBefore);
  });

  test("hero: Reset restores the hero default focal (center 8%), in place, no write", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const writes: Write[] = [];
    await openAdminMedia(page, writes);
    await openEditor(page, "hero");

    expect(await canvasAttr(page), "hero opens on its stored record").toContain(
      attrPrefix({ x: 0.3, y: 0.6 }, 1.4),
    );

    await setZoom(page, 1.9);
    await dragSurface(page, 50, 30);
    writes.length = 0;

    await page.locator('[data-qa="media-editor-reset"]').click();
    await page.waitForTimeout(400);
    await framingReady(page);

    // The hero's default is the TA.6d anchor — center 8%, NOT center 50%.
    expect(await canvasAttr(page), "hero Reset lands on the TA.6d default").toContain(
      attrPrefix(HERO_DEFAULT.focal, HERO_DEFAULT.zoom),
    );
    await expect(page.locator(SURFACE), "hero Reset keeps the editor open").toBeVisible();
    expect(configWrites(writes), "hero Reset persists nothing").toHaveLength(0);
  });
});

/* ===================== 2. CANCEL IS THE EXIT, NOT RESET ===================== */

test.describe("ADMIN.RESET.1a — Cancel exits without saving", () => {
  test("edit, Cancel → editor closes, nothing written, slot unchanged on reopen", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const writes: Write[] = [];
    await openAdminMedia(page, writes);
    await openEditor(page, "reel-0");

    const asFound = await canvasAttr(page);
    await setZoom(page, 2.5);
    await dragSurface(page, -40, 25);
    expect(await canvasAttr(page), "the edit is live on the canvas").not.toBe(asFound);

    writes.length = 0;
    await page.locator('[data-qa="media-editor-cancel"]').click();
    await expect(page.locator(SURFACE), "Cancel closes the editor").toHaveCount(0);
    expect(configWrites(writes), "Cancel persists nothing").toHaveLength(0);

    // Reopen: the slot still holds what it held before the discarded edit.
    await openEditor(page, "reel-0");
    expect(await canvasAttr(page), "the discarded edit never reached the slot").toBe(asFound);
  });

  test("Reset then Save DOES persist the default — Reset stages, Save commits", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const writes: Write[] = [];
    await openAdminMedia(page, writes);
    await openEditor(page, "reel-0");

    // Reset the phone class (the tab the editor opens on), then commit.
    await page.locator('[data-qa="media-editor-reset"]').click();
    await page.waitForTimeout(300);
    writes.length = 0;
    await page.locator('[data-qa="media-editor-save"]').click();
    await expect(page.locator(SURFACE)).toHaveCount(0);

    const upsert = writes
      .filter((w) => w.method === "POST" && /site_settings/.test(w.url))
      .map((w) => w.body ?? "")
      .filter((b) => b.includes("cinematic_media"))
      .pop();
    expect(upsert, "Save after Reset writes the config").toBeTruthy();
    const rows = JSON.parse(upsert!);
    const saved = (Array.isArray(rows) ? rows[0] : rows).value as {
      reel: {
        photo_id: string | null;
        phone: { focal: { x: number; y: number }; zoom: number };
        wide: { focal: { x: number; y: number }; zoom: number };
      }[];
    };
    const slot0 = saved.reel[0];

    // The reset class is default; the OTHER class and the photo survive — Reset
    // never widened into a slot wipe.
    expect(slot0.phone.zoom, "reset phone zoom is the default").toBeCloseTo(REEL_DEFAULT.zoom, 5);
    expect(slot0.phone.focal.x, "reset phone focal.x is the default").toBeCloseTo(
      REEL_DEFAULT.focal.x,
      5,
    );
    expect(slot0.phone.focal.y, "reset phone focal.y is the default").toBeCloseTo(
      REEL_DEFAULT.focal.y,
      5,
    );
    expect(slot0.wide.zoom, "the untouched wide class is preserved").toBeCloseTo(1.6, 5);
    expect(slot0.wide.focal.x, "the untouched wide focal is preserved").toBeCloseTo(REEL_WIDE.x, 5);
    expect(slot0.photo_id, "Reset did not clear the slot's photo").toBe("port");
  });
});
