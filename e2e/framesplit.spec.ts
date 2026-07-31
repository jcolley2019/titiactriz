import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, svgPhoto, type Write } from "./_admin";
import { shot } from "./_helpers";

/**
 * FRAME.SPLIT.1 — per-device-class framing for the reel slots.
 *
 * Two things are proved here, and they are the two halves of the brick:
 *
 *  A. THE SEEDING LAW. A slot stored in the LEGACY single-record shape must
 *     render pixel-identical on both device classes to what that one record
 *     describes — no migration, no drift, nothing to do on load. This is the
 *     regression that would silently re-crop every published slide, so it is
 *     asserted numerically AND photographed (_qa/framesplit-<w>-<lang>.png) at
 *     390 and 1440 in both languages, at the first slide's dead-stop.
 *
 *  B. INDEPENDENCE. Editing the WIDE class through the real editor UI and
 *     saving must leave the PHONE record byte-unchanged — asserted three ways:
 *     on the saved payload, on the live phone act's resolved framing string,
 *     and on the wide plate, which must move.
 *
 * The evidence in A is captured BEFORE any edit exists in this file, so the
 * screenshots are of the pre-split rendering by construction.
 */

const CINE = "/cinematic";

/** The phone/wide line, mirroring src/components/cinematic/reelSpotlight.ts. */
const PHONE_BREAKPOINT = 768;

/** 3:4 portrait source — the reel's real aspect, so the crop has overflow to pan. */
const PHOTOS = [
  svgPhoto("p1", "crimson"),
  svgPhoto("port", "teal"),
  svgPhoto("p3", "goldenrod"),
  svgPhoto("p4", "navy"),
];

/**
 * A slot as it exists in production TODAY: one slot-level {focal, zoom}, panned
 * and zoomed so a regression cannot hide behind the centered default.
 */
const LEGACY_FOCAL = { x: 0.8, y: 0.3 };
const LEGACY_ZOOM = 1.25;

const LEGACY_MEDIA = {
  hero: { photo_id: "p1", focal: { x: 0.5, y: 0.08 }, zoom: 1 },
  reel: [
    { photo_id: "port", focal: LEGACY_FOCAL, zoom: LEGACY_ZOOM },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
};

/**
 * The prefix FramedImage publishes in `data-hero-framing`, mirroring
 * heroFramingAttr: "scale;posX;posY;fit;box". The reel paints fill on both acts
 * (CINE.FLOW.5), so only the record's own numbers vary between classes.
 */
const attrPrefix = (focal: { x: number; y: number }, zoom: number) =>
  `${zoom.toFixed(2)};${(focal.x * 100).toFixed(0)};${(focal.y * 100).toFixed(0)};fill;`;

const LEGACY_PREFIX = attrPrefix(LEGACY_FOCAL, LEGACY_ZOOM);

const REEL_IMG = '[data-qa="cinematic-reel-img"]';

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wait until FramedImage has decoded + measured (its attr is no longer pending). */
async function framingReady(page: Page, selector: string, nth = 0) {
  await expect
    .poll(async () => (await page.locator(selector).nth(nth).getAttribute("data-hero-framing")) ?? "absent", {
      timeout: 20_000,
    })
    .not.toContain("pending");
}

/**
 * Wheel the document to `y`. Lenis owns the scroll on this route, so a direct
 * scrollTo would be fought by its RAF loop; wheeling in bounded steps converges
 * the same way a thumb does.
 */
async function wheelTo(page: Page, y: number) {
  await page.mouse.move(200, 300);
  // Steps are capped at 900px: under a CPU-starved run every evaluate
  // roundtrip here stretches to seconds, so iteration count IS the time
  // budget. Overshoot from the bigger step doesn't matter — the caller polls
  // the observed dead-stop state and re-aims.
  for (let i = 0; i < 40; i++) {
    const at = await page.evaluate(() => window.scrollY);
    const delta = y - at;
    if (Math.abs(delta) < 8) break;
    await page.mouse.wheel(0, Math.max(-900, Math.min(900, Math.round(delta))));
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(500);
}

/** Absolute document Y at which the reel's pin engages (its top hits 0). */
async function pinStartY(page: Page) {
  return page.evaluate(() => {
    const img = document.querySelector('[data-qa="cinematic-reel-img"]');
    const pin = img?.closest('[data-qa="cinematic-section"]')?.firstElementChild;
    if (!pin) throw new Error("reel pin container not found");
    return pin.getBoundingClientRect().top + window.scrollY;
  });
}

/** Drive to slide 1's dead-stop and confirm nothing is mid-tween before shooting. */
async function toFirstSlideDeadStop(page: Page, viewportH: number) {
  // The aim is derived from pinStartY, and pinStartY MOVES: images that finish
  // decoding late change the document height above the pin, so a Y computed
  // against the unsettled layout aims at the wrong plateau. Re-measure on
  // every aim, never reuse a stored target.
  const aim = async () => {
    const y0 = await pinStartY(page);
    await wheelTo(page, y0 + (0.5 / 3) * 3 * viewportH);
  };
  await aim();
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
  // The ledgered capture flake: a one-shot opacity read raced the scrub tween,
  // which settles late under a loaded run, and Lenis momentum can drift past
  // the wheel aim. Wait for the OBSERVED dead-stop state, re-aiming (against
  // the settled layout) if the scroll drifted; the hard assertions below stay
  // as the authoritative gate and now judge a settled carousel.
  const atDeadStop = () =>
    page
      .waitForFunction(
        () => {
          const els = [...document.querySelectorAll('[data-qa="reel-slide"]')];
          if (els.length !== 3) return false;
          const op = els.map((el) => parseFloat(getComputedStyle(el).opacity));
          return op[0] > 0.99 && op[1] < 0.01 && op[2] < 0.01;
        },
        { timeout: 6_000 },
      )
      .then(() => true)
      .catch(() => false);
  let settled = await atDeadStop();
  for (let attempt = 0; !settled && attempt < 2; attempt++) {
    await aim();
    settled = await atDeadStop();
  }
  const op = await page
    .locator('[data-qa="reel-slide"]')
    .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).opacity)));
  expect(op.length, "three slides").toBe(3);
  expect(op[0], "slide 1 opaque at its dead-stop").toBeGreaterThan(0.99);
  expect(op[1], "slide 2 out at slide 1's dead-stop").toBeLessThan(0.01);
  expect(op[2], "slide 3 out at slide 1's dead-stop").toBeLessThan(0.01);
}

/** The resolved framing string slot 0's photo reports on the current page. */
const reel0Attr = (page: Page) => page.locator(REEL_IMG).first().getAttribute("data-hero-framing");

/* ============================ A. THE SEEDING LAW ============================ */

test.describe("FRAME.SPLIT.1 — legacy slots seed both classes (evidence)", () => {
  for (const frame of [
    { w: 390, h: 844 },
    { w: 1440, h: 900 },
  ] as const) {
    for (const lang of ["es", "en"] as const) {
      const phone = frame.w < PHONE_BREAKPOINT;
      test(`${phone ? "phone" : "wide"} ${frame.w} ${lang.toUpperCase()} renders the legacy record`, async ({
        page,
      }) => {
        // 300s is headroom, not expectation: serial runs finish in 3-6s, but
        // under a loaded machine every protocol roundtrip stretches and the
        // stress battery burned 180s on slowness alone (2026-07-31).
        test.setTimeout(300_000);
        await forceLanguage(page, lang);
        await routeSupabase(page, { media: LEGACY_MEDIA, photos: PHOTOS });
        await page.setViewportSize({ width: frame.w, height: frame.h });
        await page.goto(CINE, { waitUntil: "domcontentloaded" });
        await settle(page, 900);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));

        // The correct act must be mounted, or the evidence photographs nothing.
        if (phone) {
          await expect(page.locator('[data-qa="reel-lockup"]')).toHaveCount(3);
        } else {
          await expect(page.locator('[data-qa="wide-plate"]')).toHaveCount(3);
        }

        await toFirstSlideDeadStop(page, frame.h);
        await framingReady(page, REEL_IMG);

        // THE LAW: this class resolved the legacy single record, untouched.
        expect(
          await reel0Attr(page),
          `${phone ? "phone" : "wide"} class reads the legacy record`,
        ).toContain(LEGACY_PREFIX);

        await page.screenshot({ path: shot(`framesplit-${frame.w}-${lang}.png`) });
      });
    }
  }
});

/* ========================= B. THE CLASSES ARE INDEPENDENT ========================= */

test.describe("FRAME.SPLIT.1 — editing wide leaves phone untouched", () => {
  test("wide zoom edit on slot 1: phone framing byte-unchanged, wide plate moves", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    /* --- 1. Baseline: what the phone act renders BEFORE any edit exists. --- */
    await routeSupabase(page, { media: LEGACY_MEDIA, photos: PHOTOS });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 700);
    await page.locator(REEL_IMG).first().scrollIntoViewIfNeeded().catch(() => {});
    await framingReady(page, REEL_IMG);
    const phoneBefore = await reel0Attr(page);
    expect(phoneBefore, "baseline phone framing is the legacy record").toContain(LEGACY_PREFIX);

    /* --- 2. Edit the WIDE class through the real editor UI, and save. --- */
    const writes: Write[] = [];
    await injectAdminSession(page);
    await forceLanguage(page, "en");
    await routeSupabase(page, { media: LEGACY_MEDIA, photos: PHOTOS, writes });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 700);
    await page.locator('[data-qa="admin-nav-media"]').click();
    await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();

    await page
      .locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]')
      .click();
    await expect(page.locator('[data-qa="media-editor-surface"]')).toBeVisible();

    // The editor opens on the iPhone tab — the PHONE class. Read its zoom, then
    // move to Desktop, which is the WIDE class, and change only that.
    const zoomValue = () => page.locator('[data-qa="media-editor-zoom-value"]').innerText();
    const phoneZoomShown = await zoomValue();
    expect(phoneZoomShown, "iPhone tab opens on the seeded legacy zoom").toContain(
      LEGACY_ZOOM.toFixed(2),
    );

    await page.locator('[data-qa="media-device-desktop"]').click();
    await page.waitForTimeout(300);
    expect(await zoomValue(), "Desktop tab starts from the same seeded record").toContain(
      LEGACY_ZOOM.toFixed(2),
    );

    const NEW_WIDE_ZOOM = 2.4;
    await page.locator('[data-qa="media-editor-zoom"]').evaluate((el, v) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, String(v));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, NEW_WIDE_ZOOM);
    await page.waitForTimeout(300);
    expect(await zoomValue(), "the wide record took the edit").toContain(NEW_WIDE_ZOOM.toFixed(2));

    // Back to the iPhone tab: the phone record must NOT have followed.
    await page.locator('[data-qa="media-device-iphone-17-pro"]').click();
    await page.waitForTimeout(300);
    expect(await zoomValue(), "the phone record is untouched by the wide edit").toContain(
      LEGACY_ZOOM.toFixed(2),
    );

    await page.locator('[data-qa="media-editor-save"]').click();
    await expect(page.locator('[data-qa="media-editor-surface"]')).toHaveCount(0);
    // The dialog closes SYNCHRONOUSLY (setEditor(null)) and the upsert follows on
    // the network, so a closed dialog is not evidence the write landed. Polling
    // for the write itself is what fixes this spec's long-standing flake under a
    // loaded run (it always passed in isolation).
    await expect
      .poll(
        () =>
          writes.filter(
            (w) =>
              w.method === "POST" &&
              /site_settings/.test(w.url) &&
              (w.body ?? "").includes("cinematic_media"),
          ).length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    /* --- 3. The saved payload: two records, only one of them moved. --- */
    const upsert = writes
      .filter((w) => w.method === "POST" && /site_settings/.test(w.url))
      .map((w) => w.body ?? "")
      .filter((b) => b.includes("cinematic_media"))
      .pop();
    expect(upsert, "a cinematic_media upsert fired").toBeTruthy();
    const rows = JSON.parse(upsert!);
    const saved = (Array.isArray(rows) ? rows[0] : rows).value as {
      reel: { photo_id: string; phone: { focal: { x: number; y: number }; zoom: number }; wide: { zoom: number } }[];
    };
    const slot0 = saved.reel[0];

    expect(slot0.phone.zoom, "saved phone zoom is the legacy value").toBeCloseTo(LEGACY_ZOOM, 5);
    expect(slot0.phone.focal.x, "saved phone focal.x is the legacy value").toBeCloseTo(
      LEGACY_FOCAL.x,
      5,
    );
    expect(slot0.phone.focal.y, "saved phone focal.y is the legacy value").toBeCloseTo(
      LEGACY_FOCAL.y,
      5,
    );
    expect(slot0.wide.zoom, "saved wide zoom is the edit").toBeCloseTo(NEW_WIDE_ZOOM, 5);

    /* --- 4. The live site, served the SAVED value. --- */
    const savedMedia = (Array.isArray(rows) ? rows[0] : rows).value;

    // Phone act: byte-identical to the baseline string, not merely equivalent.
    await routeSupabase(page, { media: savedMedia, photos: PHOTOS });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 700);
    await page.locator(REEL_IMG).first().scrollIntoViewIfNeeded().catch(() => {});
    await framingReady(page, REEL_IMG);
    expect(await reel0Attr(page), "phone framing is byte-unchanged by the wide edit").toBe(
      phoneBefore,
    );
    await toFirstSlideDeadStop(page, 844);
    await page.screenshot({ path: shot("framesplit-edited-390-phone-unchanged.png") });

    // Wide plate: the edit landed, and it is NOT the phone string.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CINE, { waitUntil: "domcontentloaded" });
    await settle(page, 700);
    await expect(page.locator('[data-qa="wide-plate"]')).toHaveCount(3);
    await framingReady(page, REEL_IMG);
    const wideAfter = await reel0Attr(page);
    expect(wideAfter, "wide plate reflects the edited zoom").toContain(
      attrPrefix(LEGACY_FOCAL, NEW_WIDE_ZOOM),
    );
    expect(wideAfter, "the two classes now genuinely differ").not.toBe(phoneBefore);
    await toFirstSlideDeadStop(page, 900);
    await page.screenshot({ path: shot("framesplit-edited-1440-wide-moved.png") });
  });
});
