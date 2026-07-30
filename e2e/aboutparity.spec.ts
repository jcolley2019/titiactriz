import { expect, test, type Locator, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, svgPhoto, type Write } from "./_admin";
import { shot } from "./_helpers";

/**
 * ADMIN.RESET.1b — THE ABOUT PHOTO JOINS FULL REEL PARITY.
 *
 * Before this brick the About slot's "Frame · About" editor was a single generic
 * canvas: no device tabs, one framing record, one crop for every screen. Reels
 * had iPhone / iPad / Desktop tabs and an independent record per device class.
 * About now has the same editor, the same tabs, the same class split, and the
 * same (fixed) Reset, saving through the same resolver contract.
 *
 * Two things are load-bearing and both are proved here:
 *
 *  A. THE TABS ARE REAL. The About editor shows the standard tab set, and a
 *     framing set on one tab round-trips: save → reload → that tab (and the LIVE
 *     panel at that class's viewport) shows it, while the other class does not.
 *
 *  B. THE SEEDING LAW HOLDS. An About slot stored in the legacy single-record
 *     shape renders pixel-identical on BOTH classes to what that one record
 *     describes — no migration, no drift. This is the regression that would
 *     silently re-crop every published About panel, so it is asserted on the
 *     live panel at both viewports and on every editor tab.
 *
 * ADMIN.ABOUT.2 amended what a tab CHANGES. This spec used to assert that every
 * About tab drew the same 3:4 canvas, because the live panel was 3:4 on every
 * device. It no longer is: the panel is a reel-class plate, so each tab draws its
 * own DEVICE frame with the plate hung inside it, and the wide tabs additionally
 * choose the plate's shape. The two laws above are unchanged and still asserted
 * here; the canvas-shape assertion now reads the device frame, and about2.spec.ts
 * owns the plate/shape laws in full.
 */

const CINE = "/cinematic";

/** The phone/wide line, mirroring src/components/cinematic/reelSpotlight.ts. */
const PHONE_BREAKPOINT = 768;

/** 3:4 portrait source (400x500) — overflows a 3:4 frame only once zoomed. */
const PHOTOS = [
  svgPhoto("p1", "crimson"),
  svgPhoto("port", "teal"),
  svgPhoto("p3", "goldenrod"),
  svgPhoto("p4", "navy"),
];

/** An About slot as it exists in production TODAY: one slot-level record. */
const LEGACY_FOCAL = { x: 0.35, y: 0.7 };
const LEGACY_ZOOM = 1.2;

const LEGACY_MEDIA = {
  hero: { photo_id: "p1", focal: { x: 0.5, y: 0.08 }, zoom: 1 },
  reel: [
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
  about: { photo_id: "port", focal: LEGACY_FOCAL, zoom: LEGACY_ZOOM },
};

/**
 * The three editor tabs and their frames, mirroring src/lib/device-presets.ts.
 * ADMIN.ABOUT.2 — the About canvas is the DEVICE frame now, on every kind, so the
 * aspect a tab must draw is a number this spec can state.
 */
const DEVICE_FRAMES = {
  "iphone-17-pro": 402 / 874,
  "ipad-air": 820 / 1180,
  desktop: 1440 / 900,
} as const;
const DEVICE_TABS = ["iphone-17-pro", "ipad-air", "desktop"] as const;
/** src/components/cinematic/reelWide.tsx — the portrait plate the panel hangs in. */
const PORTRAIT_PLATE = 0.563;
const ABOUT_IMG = '[data-qa="cinematic-about-img"]';
const SURFACE = '[data-qa="media-editor-surface"]';
const CANVAS_IMG = '[data-qa="media-editor-surface"] [data-qa="media-preview-img"]';
const ABOUT_CARD = '[data-qa="media-slot"][data-slot="about"]';

/** heroFramingAttr's prefix: "scale;posX;posY;fit;". The panel is always fill. */
const attrPrefix = (focal: { x: number; y: number }, zoom: number) =>
  `${zoom.toFixed(2)};${(focal.x * 100).toFixed(0)};${(focal.y * 100).toFixed(0)};fill;`;

const LEGACY_PREFIX = attrPrefix(LEGACY_FOCAL, LEGACY_ZOOM);

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

const canvasAttr = (page: Page) =>
  page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing");

const zoomText = (page: Page) => page.locator('[data-qa="media-editor-zoom-value"]').innerText();

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

async function openAboutEditor(page: Page) {
  await page.locator(`${ABOUT_CARD} [data-qa="media-slot-edit"]`).click();
  await expect(page.locator(SURFACE)).toBeVisible();
  await framingReady(page.locator(CANVAS_IMG));
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

/** The last cinematic_media value the admin upserted. */
function savedMediaFrom(writes: Write[]) {
  const upsert = writes
    .filter((w) => w.method === "POST" && /site_settings/.test(w.url))
    .map((w) => w.body ?? "")
    .filter((b) => b.includes("cinematic_media"))
    .pop();
  expect(upsert, "a cinematic_media upsert fired").toBeTruthy();
  const rows = JSON.parse(upsert!);
  return (Array.isArray(rows) ? rows[0] : rows).value;
}

/** The framing the LIVE About panel reports at this viewport. */
async function livePanelAttr(page: Page, media: unknown, w: number, h: number) {
  await routeSupabase(page, { media, photos: PHOTOS });
  await page.setViewportSize({ width: w, height: h });
  await page.goto(CINE, { waitUntil: "domcontentloaded" });
  await settle(page, 600);
  const panel = page.locator(ABOUT_IMG).first();
  await panel.scrollIntoViewIfNeeded().catch(() => {});
  await framingReady(panel);
  return panel.getAttribute("data-hero-framing");
}

/* ===================== A. THE ABOUT EDITOR HAS THE TAB SET ===================== */

test.describe("ADMIN.RESET.1b — About editor reaches reel parity", () => {
  test("About editor shows the standard device tabs, each on its own device canvas", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openAdminMedia(page, LEGACY_MEDIA);
    await openAboutEditor(page);

    // The tab row exists and carries the same presets every other slot offers.
    const tabs = page.locator('[data-qa="media-editor-devices"] > button');
    await expect(tabs, "About editor shows the standard tab set").toHaveCount(DEVICE_TABS.length);
    for (const tab of DEVICE_TABS) {
      await expect(page.locator(`[data-qa="media-device-${tab}"]`)).toBeVisible();
    }

    // ADMIN.ABOUT.2 — each tab draws ITS OWN device frame, with the plate hung
    // inside it. A tab is a device now, not just a record.
    for (const tab of DEVICE_TABS) {
      await page.locator(`[data-qa="media-device-${tab}"]`).click();
      await page.waitForTimeout(300);
      const box = (await page.locator(SURFACE).boundingBox())!;
      expect(
        Math.abs(box.width / box.height - DEVICE_FRAMES[tab]),
        `${tab} tab draws its device frame (got ${(box.width / box.height).toFixed(4)})`,
      ).toBeLessThan(0.01);
      const plate = (await page.locator(`${SURFACE} [data-qa="about-plate"]`).boundingBox())!;
      expect(
        Math.abs(plate.width / plate.height - PORTRAIT_PLATE),
        `${tab} tab hangs the portrait plate (got ${(plate.width / plate.height).toFixed(4)})`,
      ).toBeLessThan(0.01);
    }

    await page.locator('[data-qa="media-device-iphone-17-pro"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("aboutparity-tabs.png") });
  });

  /* ------- B. THE SEEDING LAW: a legacy About slot seeds both classes ------- */

  test("legacy single-record About seeds BOTH classes — live panel and every tab", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // The LIVE panel, on both sides of the breakpoint, reads the legacy record.
    for (const vp of [
      { w: 390, h: 844 },
      { w: 1440, h: 900 },
    ] as const) {
      const cls = vp.w < PHONE_BREAKPOINT ? "phone" : "wide";
      const attr = await livePanelAttr(page, LEGACY_MEDIA, vp.w, vp.h);
      expect(attr, `${cls} class (${vp.w}px) resolves the legacy About record`).toContain(
        LEGACY_PREFIX,
      );
    }

    // And every editor tab opens on it too — no migration, no drift.
    await openAdminMedia(page, LEGACY_MEDIA);
    await openAboutEditor(page);
    for (const tab of DEVICE_TABS) {
      await page.locator(`[data-qa="media-device-${tab}"]`).click();
      await page.waitForTimeout(300);
      await framingReady(page.locator(CANVAS_IMG));
      expect(await canvasAttr(page), `${tab} tab seeds from the legacy record`).toContain(
        LEGACY_PREFIX,
      );
      expect(await zoomText(page), `${tab} tab shows the legacy zoom`).toContain(
        LEGACY_ZOOM.toFixed(2),
      );
    }
  });
});

/* =============== C. PER-TAB ROUND TRIP: set, save, reload, applied =============== */

test.describe("ADMIN.RESET.1b — About framing round-trips per tab", () => {
  test("wide edit saves, reloads, and applies to the desktop panel — phone untouched", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    /* --- 1. Baseline: what the phone panel renders before any edit. --- */
    const phoneBefore = await livePanelAttr(page, LEGACY_MEDIA, 390, 844);
    expect(phoneBefore, "baseline phone panel is the legacy record").toContain(LEGACY_PREFIX);

    /* --- 2. Edit the WIDE class through the real editor, and save. --- */
    const writes: Write[] = [];
    await openAdminMedia(page, LEGACY_MEDIA, writes);
    await openAboutEditor(page);

    // Opens on the iPhone tab = the PHONE class. Move to Desktop = WIDE.
    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(300);
    await framingReady(page.locator(CANVAS_IMG));

    const NEW_WIDE_ZOOM = 1.8;
    await setZoom(page, NEW_WIDE_ZOOM);
    await dragSurface(page, -40, -30);
    expect(await zoomText(page), "the wide record took the edit").toContain(
      NEW_WIDE_ZOOM.toFixed(2),
    );
    const wideEdited = await canvasAttr(page);

    // Back to iPhone: the phone record must NOT have followed.
    await page.locator('[data-qa="media-device-iphone-17-pro"]').click();
    await page.waitForTimeout(300);
    await framingReady(page.locator(CANVAS_IMG));
    expect(await zoomText(page), "the phone record is untouched by the wide edit").toContain(
      LEGACY_ZOOM.toFixed(2),
    );
    expect(await canvasAttr(page), "the phone canvas is byte-unchanged").toContain(LEGACY_PREFIX);

    await page.locator('[data-qa="media-editor-save"]').click();
    await expect(page.locator(SURFACE)).toHaveCount(0);
    await expect
      .poll(
        () =>
          writes.filter(
            (w) => w.method === "POST" && /site_settings/.test(w.url) && (w.body ?? "").includes("cinematic_media"),
          ).length,
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    /* --- 3. The saved payload: the class-split shape, one class moved. --- */
    const saved = savedMediaFrom(writes) as {
      about: {
        photo_id: string;
        phone: { focal: { x: number; y: number }; zoom: number };
        wide: { focal: { x: number; y: number }; zoom: number };
      };
    };
    expect(saved.about.photo_id, "the About photo survived the save").toBe("port");
    expect(saved.about.phone.zoom, "saved phone zoom is the legacy value").toBeCloseTo(
      LEGACY_ZOOM,
      5,
    );
    expect(saved.about.phone.focal.x, "saved phone focal.x is the legacy value").toBeCloseTo(
      LEGACY_FOCAL.x,
      5,
    );
    expect(saved.about.phone.focal.y, "saved phone focal.y is the legacy value").toBeCloseTo(
      LEGACY_FOCAL.y,
      5,
    );
    expect(saved.about.wide.zoom, "saved wide zoom is the edit").toBeCloseTo(NEW_WIDE_ZOOM, 5);

    /* --- 4. RELOAD, and assert applied: the live panel per class. --- */
    const savedMedia = (saved as unknown) as Record<string, unknown>;

    // Desktop panel: the wide edit landed.
    const wideAfter = await livePanelAttr(page, savedMedia, 1440, 900);
    expect(wideAfter, "the desktop panel reflects the edited wide record").toContain(
      attrPrefix(saved.about.wide.focal, NEW_WIDE_ZOOM),
    );
    expect(wideAfter, "the two classes now genuinely differ").not.toBe(phoneBefore);
    await page.screenshot({ path: shot("aboutparity-1440-wide-edited.png") });

    // Phone panel: byte-identical to the baseline string, not merely equivalent.
    const phoneAfter = await livePanelAttr(page, savedMedia, 390, 844);
    expect(phoneAfter, "the phone panel is byte-unchanged by the wide edit").toBe(phoneBefore);

    /* --- 5. REOPEN the editor on the saved value: each tab shows its own. --- */
    await openAdminMedia(page, savedMedia);
    await openAboutEditor(page);
    expect(await zoomText(page), "iPhone tab reopens on the phone record").toContain(
      LEGACY_ZOOM.toFixed(2),
    );
    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(300);
    await framingReady(page.locator(CANVAS_IMG));
    expect(await zoomText(page), "Desktop tab reopens on the saved wide record").toContain(
      NEW_WIDE_ZOOM.toFixed(2),
    );
    expect(await canvasAttr(page), "the reopened wide canvas equals what was edited").toBe(
      wideEdited,
    );
  });

  /* -------- D. ITEM A's Reset, on the About slot's tabs -------- */

  test("About Reset restores the active tab only, in place, without writing", async ({ page }) => {
    test.setTimeout(120_000);
    const writes: Write[] = [];
    await openAdminMedia(page, LEGACY_MEDIA, writes);
    await openAboutEditor(page);

    // Dirty the WIDE class, then reset it.
    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(300);
    await framingReady(page.locator(CANVAS_IMG));
    await setZoom(page, 2.0);
    await dragSurface(page, 35, -25);

    writes.length = 0;
    await page.locator('[data-qa="media-editor-reset"]').click();
    await page.waitForTimeout(400);
    await framingReady(page.locator(CANVAS_IMG));

    // The About default is a centred, unzoomed crop of its plate.
    expect(await canvasAttr(page), "About Reset lands on the centred default").toContain(
      attrPrefix({ x: 0.5, y: 0.5 }, 1),
    );
    await expect(page.locator(SURFACE), "About Reset keeps the editor open").toBeVisible();
    await expect(
      page.locator('[data-qa="media-device-desktop"]'),
      "About Reset stays on the tab it was pressed from",
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      writes.filter((w) => /site_settings/.test(w.url)),
      "About Reset persists nothing — it no longer clears the slot",
    ).toHaveLength(0);

    // The phone tab kept the legacy record.
    await page.locator('[data-qa="media-device-iphone-17-pro"]').click();
    await page.waitForTimeout(300);
    await framingReady(page.locator(CANVAS_IMG));
    expect(await canvasAttr(page), "the phone class survived the wide reset").toContain(
      LEGACY_PREFIX,
    );

    // And the card still shows a configured About panel.
    await page.locator('[data-qa="media-editor-cancel"]').click();
    await expect(page.locator(SURFACE)).toHaveCount(0);
    await expect(page.locator(`${ABOUT_CARD} [data-qa="media-slot-badge"]`)).toHaveText(/custom/i);
  });
});
