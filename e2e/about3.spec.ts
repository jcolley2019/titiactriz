import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase } from "./_admin";
import { shot } from "./_helpers";

/**
 * ADMIN.ABOUT.3 — THE ABOUT PLATE IS SIZED BY THE REEL'S PLATE LAW.
 *
 * ABOUT.2 made About a reel-class surface and gave the panel the plate law's
 * ASPECT — but left ABOUT.MEDIA.1's rail clamp (`clamp(300px, 32vw, 400px)`, and a
 * second `clamp(340px, 42vw, 520px)` for landscape) holding its WIDTH. A clamp
 * stops growing; the plate law does not. So an About plate and a reel plate on the
 * same page at the same viewport were two visibly different sizes — 400px against
 * 462px at 1920 portrait, 520px against 842px at 1920 landscape.
 *
 * Joey's ruling: About's plate takes the reel plate's SIZING law at both classes and
 * both shapes — same height caps, same proportions — and the section's layout adapts
 * around it. Three laws, each falsifiable:
 *
 *  1. THE PLATE IS THE LAW'S OWN BOX, to within a pixel, at 390 and 1440, portrait
 *     and landscape. Asserted against `plateBox` RESTATED here (the rule every
 *     parity spec in this repo follows), not against whatever the app computed.
 *  2. THE CLAMP IS GONE. At the frames where the law outgrows the old clamp the
 *     panel is strictly WIDER than it — the one assertion a surviving clamp
 *     cannot pass — and the section still composes: the copy column keeps its
 *     floor, the container stays inside the act's padding, and every part of the
 *     act still renders beside the plate.
 *  3. THE REEL IS UNCHANGED, and is now the same box. Under motion (where the
 *     reel's stage is its full pinned 100svh, the frame the law is declared
 *     against) an About plate and a reel plate of the same shape at the same
 *     viewport measure the same rectangle.
 *
 * Evidence: _qa/about3-{390,1440}-{portrait,landscape}.png.
 *
 * The plate laws are RESTATED, never imported — the rule every parity spec follows.
 */

/* ------------------------- the laws, restated ------------------------- */

/** src/components/cinematic/reelWide.tsx — the portrait (W2) plate. */
const PORTRAIT = { aspect: 0.563, heightVh: 76, maxWidthVw: 60 };
/** src/components/cinematic/reelWide.tsx — the 3:2 landscape plate. */
const LANDSCAPE = { aspect: 1.5, heightVh: 52, maxWidthVw: 78 };
/** src/components/cinematic/reelWide.tsx — the spread's copy column. */
const CHAPTER_FIELD_FRACTION = 0.42;
/** src/components/cinematic/cinematic.css — the copy measure the rail may not eat. */
const COPY_FLOOR = 456;
/** The act's own `px-6`, both sides. */
const SECTION_PAD_X = 48;
/** src/components/cinematic/cinematic.css — the container's floor (Tailwind 5xl). */
const CONTAINER_BASE = 1024;
/** The old rail clamps, kept ONLY so their death can be asserted. */
const LEGACY_RAIL_PORTRAIT_MAX = 400;
const LEGACY_RAIL_LANDSCAPE_MAX = 520;
/** The phone/wide line, mirroring src/components/cinematic/reelSpotlight.ts. */
const PHONE_BREAKPOINT = 768;

type Law = { aspect: number; heightVh: number; maxWidthVw: number };

/**
 * `plateBox`, restated: a box at the shape's aspect, sized by whichever of the two
 * declared rules yields the SMALLER box.
 */
function plateBox(pageW: number, frameH: number, law: Law) {
  const hRule = (frameH * law.heightVh) / 100;
  const wFromH = hRule * law.aspect;
  const wCap = (pageW * law.maxWidthVw) / 100;
  return wCap < wFromH ? { w: wCap, h: wCap / law.aspect } : { w: wFromH, h: hRule };
}

/**
 * THE WIDE-CLASS ABOUT PLATE — the law against the REEL's own frame: the viewport's
 * height, and a photo page that is the frame minus the copy column. Identical
 * arguments to the ones CinematicReel feeds `plateBox`, which is what makes the two
 * plates the same box.
 */
const wideAboutPlate = (vw: number, vh: number, law: Law) =>
  plateBox(vw * (1 - CHAPTER_FIELD_FRACTION), vh, law);

/**
 * THE PHONE-CLASS ABOUT PLATE — the panel fills its column, trimmed by the law's
 * HEIGHT cap. The width cap has nothing to measure against here: the phone act is
 * edge-to-edge and hangs no plate, so the class has no photo page. Same height cap,
 * same proportions — which is the ruling — without inventing a page that isn't there.
 */
const phoneAboutPlate = (colW: number, vh: number, law: Law) => {
  const w = Math.min(colW, ((vh * law.heightVh) / 100) * law.aspect);
  return { w, h: w / law.aspect };
};

const CINE = "/cinematic";

/* ----------------------------- fixtures ----------------------------- */

function sizedPhoto(id: string, color: string, w: number, h: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='${color}'/></svg>`;
  return { id, image_url: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt_text: id };
}

const PHOTOS = [
  sizedPhoto("p1", "crimson", 400, 500),
  sizedPhoto("land", "#2f6f8f", 900, 600),
  sizedPhoto("port", "goldenrod", 400, 500),
];

const ABOUT_PHONE = { focal: { x: 0.8, y: 0.3 }, zoom: 1.25 };
const ABOUT_WIDE = { focal: { x: 0.25, y: 0.65 }, zoom: 1.6 };

/**
 * Reel slide 0 is portrait and slide 1 landscape, so ONE page carries a reel plate
 * of each shape to compare the About plate against.
 */
const mediaWith = (plate?: "landscape") => ({
  hero: { photo_id: "p1", focal: { x: 0.5, y: 0.08 }, zoom: 1 },
  reel: [
    {
      photo_id: "port",
      phone: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      wide: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    },
    {
      photo_id: "land",
      phone: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      wide: { focal: { x: 0.5, y: 0.5 }, zoom: 1, plate: "landscape" },
    },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
  about: {
    photo_id: "land",
    phone: ABOUT_PHONE,
    wide: plate ? { ...ABOUT_WIDE, plate } : ABOUT_WIDE,
  },
});

const MEDIA_PORTRAIT = mediaWith();
const MEDIA_LANDSCAPE = mediaWith("landscape");

const LIVE_PANEL = '[data-qa="cinematic-about-panel"]';
const LIVE_ABOUT_IMG = '[data-qa="cinematic-about-img"]';

async function settle(page: Page, ms = 700) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function framingReady(page: Page, sel: string) {
  await expect
    .poll(async () => (await page.locator(sel).first().getAttribute("data-hero-framing")) ?? "absent", {
      timeout: 20_000,
    })
    .not.toContain("pending");
}

/**
 * Load the live act and measure the About section's geometry. `reduced` is the
 * default for the plate-size laws: the About section's dwell pin must never
 * transform the box being measured, and the plate's geometry is motion-agnostic —
 * it is declared in viewport units, not measured off a stage.
 */
async function liveAbout(
  page: Page,
  media: unknown,
  vw: number,
  vh: number,
  opts: { reduced?: boolean } = {},
) {
  await page.emulateMedia({ reducedMotion: opts.reduced === false ? "no-preference" : "reduce" });
  await forceLanguage(page, "es");
  await routeSupabase(page, { media, photos: PHOTOS });
  await page.setViewportSize({ width: vw, height: vh });
  await page.goto(CINE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.locator("#cinematic-about").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await framingReady(page, LIVE_ABOUT_IMG);

  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    };
    const panel = document.querySelector('[data-qa="cinematic-about-panel"]');
    const grid = document.querySelector(".cine-about-grid");
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns : "none";
    const reel = Array.from(document.querySelectorAll('[data-qa="wide-plate"]')).map((el) => ({
      plate: el.getAttribute("data-plate") ?? "portrait",
      ...box(el)!,
    }));
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      plate: panel?.getAttribute("data-plate") ?? null,
      panel: box(panel),
      container: box(grid),
      /** The copy column, when the md+ grid exists: the first track. */
      copyCol: cols === "none" ? null : parseFloat(cols.split(" ")[0]),
      reel,
    };
  });
}

/** The law's box for whichever class this viewport is in. */
function expectedPlate(seen: Awaited<ReturnType<typeof liveAbout>>, law: Law) {
  return seen.vw < PHONE_BREAKPOINT
    ? phoneAboutPlate(seen.container!.w, seen.vh, law)
    : wideAboutPlate(seen.vw, seen.vh, law);
}

const near = (a: number, b: number) => Math.abs(a - b);

/* ============ 1. THE PLATE IS THE PLATE LAW'S OWN BOX, TO 1px ============ */

test.describe("ADMIN.ABOUT.3 — the About plate is the plate law's own box", () => {
  for (const shape of ["portrait", "landscape"] as const) {
    const law = shape === "landscape" ? LANDSCAPE : PORTRAIT;
    const media = shape === "landscape" ? MEDIA_LANDSCAPE : MEDIA_PORTRAIT;

    test(`1440 — a ${shape} About plate measures the law's output`, async ({ page }) => {
      test.setTimeout(180_000);
      const seen = await liveAbout(page, media, 1440, 900);
      expect(seen.plate, `the wide class draws the ${shape} plate`).toBe(shape);

      const want = expectedPlate(seen, law);
      expect(
        near(seen.panel!.w, want.w),
        `width ${seen.panel!.w.toFixed(2)} == the law's ${want.w.toFixed(2)}`,
      ).toBeLessThanOrEqual(1);
      expect(
        near(seen.panel!.h, want.h),
        `height ${seen.panel!.h.toFixed(2)} == the law's ${want.h.toFixed(2)}`,
      ).toBeLessThanOrEqual(1);
      expect(seen.panel!.w / seen.panel!.h, "…at the law's aspect").toBeCloseTo(law.aspect, 2);
    });

    test(`390 — the phone plate is the law's, and the ${shape} wide choice never reaches it`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      const seen = await liveAbout(page, media, 390, 844);
      // A phone record stores no shape, so the phone class is the portrait plate
      // whatever the wide record chose — asserted for BOTH fixtures.
      expect(seen.plate, "the phone class is always the portrait plate").toBe("portrait");

      const want = expectedPlate(seen, PORTRAIT);
      expect(
        near(seen.panel!.w, want.w),
        `width ${seen.panel!.w.toFixed(2)} == the law's ${want.w.toFixed(2)}`,
      ).toBeLessThanOrEqual(1);
      expect(
        near(seen.panel!.h, want.h),
        `height ${seen.panel!.h.toFixed(2)} == the law's ${want.h.toFixed(2)}`,
      ).toBeLessThanOrEqual(1);
      // The panel fills its column here, so the law is the HEIGHT cap not binding —
      // which is only meaningful if the cap is genuinely above the column's width.
      expect(seen.panel!.w, "the phone panel still fills its column").toBeCloseTo(
        seen.container!.w,
        1,
      );
      expect(
        seen.panel!.h,
        "…and stays under the law's height cap",
      ).toBeLessThanOrEqual((844 * PORTRAIT.heightVh) / 100 + 1);
    });
  }

  test("a short phone IS trimmed by the law's height cap", async ({ page }) => {
    test.setTimeout(150_000);
    // 390x667: the column is 342 wide, but 76svh of 667 admits only a 285px plate.
    // Without the cap the panel would run 607px tall in a 667px viewport.
    const seen = await liveAbout(page, MEDIA_PORTRAIT, 390, 667);
    const want = phoneAboutPlate(seen.container!.w, 667, PORTRAIT);
    expect(want.w, "the cap genuinely binds at this frame").toBeLessThan(seen.container!.w - 1);
    expect(
      near(seen.panel!.w, want.w),
      `width ${seen.panel!.w.toFixed(2)} == the capped ${want.w.toFixed(2)}`,
    ).toBeLessThanOrEqual(1);
    expect(
      seen.panel!.h,
      "the plate no longer overruns a short phone's viewport",
    ).toBeLessThanOrEqual((667 * PORTRAIT.heightVh) / 100 + 1);
  });
});

/* ====== 2. THE LEGACY CLAMP IS GONE, AND THE SECTION STILL COMPOSES ====== */

test.describe("ADMIN.ABOUT.3 — the rail clamp is dead and the act still balances", () => {
  test("the plate outgrows the old clamps where the law says it should", async ({ page }) => {
    test.setTimeout(200_000);

    // 1440 landscape: the law wants 651px, the old clamp capped at 520px.
    const wide = await liveAbout(page, MEDIA_LANDSCAPE, 1440, 900);
    expect(
      wide.panel!.w,
      `a landscape plate at 1440 is ${wide.panel!.w.toFixed(0)}px — past the dead ${LEGACY_RAIL_LANDSCAPE_MAX}px clamp`,
    ).toBeGreaterThan(LEGACY_RAIL_LANDSCAPE_MAX + 1);

    // 1920 portrait: the law wants 462px, the old clamp capped at 400px. This is
    // the frame where the defect was most visible — the reel plate kept growing
    // and the About plate did not.
    const tall = await liveAbout(page, MEDIA_PORTRAIT, 1920, 1080);
    expect(
      tall.panel!.w,
      `a portrait plate at 1920 is ${tall.panel!.w.toFixed(0)}px — past the dead ${LEGACY_RAIL_PORTRAIT_MAX}px clamp`,
    ).toBeGreaterThan(LEGACY_RAIL_PORTRAIT_MAX + 1);
    expect(
      near(tall.panel!.w, wideAboutPlate(1920, 1080, PORTRAIT).w),
      "…because it is the law's box, not a bigger clamp",
    ).toBeLessThanOrEqual(1);
  });

  test("the composition balances at 390 and 1440, portrait and landscape", async ({ page }) => {
    test.setTimeout(300_000);

    for (const [vw, vh] of [
      [390, 844],
      [1440, 900],
      [1920, 1080],
    ] as const) {
      for (const [shape, media] of [
        ["portrait", MEDIA_PORTRAIT],
        ["landscape", MEDIA_LANDSCAPE],
      ] as const) {
        const seen = await liveAbout(page, media, vw, vh);
        const where = `${shape} @ ${vw}x${vh}`;

        // The act still reads: every part of it rendered beside the plate.
        await expect(
          page.locator('#cinematic-about [data-qa="section-heading"]'),
          `${where}: the belief statement`,
        ).toBeVisible();
        await expect(
          page.locator('#cinematic-about a[href="/work"]'),
          `${where}: the CTA`,
        ).toBeVisible();
        expect(
          await page.locator("#cinematic-about .cine-a-chips span").count(),
          `${where}: the four strength chips`,
        ).toBe(4);

        // Nothing overflows the act's own padding, at any frame.
        expect(
          seen.container!.w,
          `${where}: the container stays inside the section's px-6`,
        ).toBeLessThanOrEqual(vw - SECTION_PAD_X + 1);

        if (vw < PHONE_BREAKPOINT) {
          expect(seen.copyCol, `${where}: no rail below md`).toBeNull();
          continue;
        }

        // THE LAYOUT ADAPTS TO THE PLATE. The copy column keeps a true measure
        // (its 456px floor), and under ABOUT.VCENTER.1 it may GROW to
        // clamp(456px, 42vw, 700px) at the >=1200 desktop line so the stack
        // fits — and centres on — the dwell page. The container is exactly
        // rail + gap + that copy column, inside the section's padding.
        expect(seen.copyCol!, `${where}: the copy column keeps its floor`).toBeGreaterThanOrEqual(
          COPY_FLOOR - 1,
        );
        const copyExpected = Math.min(700, Math.max(COPY_FLOOR, 0.42 * vw));
        const needed = seen.panel!.w + 48 + copyExpected;
        expect(
          seen.container!.w,
          `${where}: the container is plate + gap + the VCENTER copy column`,
        ).toBeCloseTo(Math.min(vw - SECTION_PAD_X, needed), 0);
      }
    }
  });

  test("evidence — the live About act at 390 and 1440, both shapes", async ({ page }) => {
    test.setTimeout(240_000);
    for (const [vw, vh] of [
      [390, 844],
      [1440, 900],
    ] as const) {
      for (const [shape, media] of [
        ["portrait", MEDIA_PORTRAIT],
        ["landscape", MEDIA_LANDSCAPE],
      ] as const) {
        await liveAbout(page, media, vw, vh);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await page.locator("#cinematic-about").scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: shot(`about3-${vw}-${shape}.png`) });
      }
    }
  });
});

/* ====== 3. THE REEL IS UNCHANGED — AND IS NOW THE SAME BOX ====== */

test.describe("ADMIN.ABOUT.3 — About and the reel are the same plate", () => {
  test("under motion, an About plate equals the reel plate of its shape", async ({ page }) => {
    test.setTimeout(300_000);

    for (const [vw, vh] of [
      [1440, 900],
      [1920, 1080],
    ] as const) {
      for (const [shape, media, law] of [
        ["portrait", MEDIA_PORTRAIT, PORTRAIT],
        ["landscape", MEDIA_LANDSCAPE, LANDSCAPE],
      ] as const) {
        // MOTION, deliberately: the reel's stage is its full pinned 100svh here,
        // which is the frame the plate law is declared against. (Under reduced
        // motion the reel act collapses to 70svh slides and its plate shrinks with
        // them — its own pre-existing law, and not one the About act shares, since
        // About has no scrubbed stage to collapse.)
        const seen = await liveAbout(page, media, vw, vh, { reduced: false });
        const where = `${shape} @ ${vw}x${vh}`;

        // The reel still draws exactly three plates with their own shapes.
        expect(
          seen.reel.map((p) => p.plate),
          `${where}: the reel's own shapes are untouched`,
        ).toEqual(["portrait", "landscape", "portrait"]);

        const twin = seen.reel.find((p) => p.plate === shape)!;
        expect(
          near(seen.panel!.w, twin.w),
          `${where}: About ${seen.panel!.w.toFixed(2)}w == reel ${twin.w.toFixed(2)}w`,
        ).toBeLessThanOrEqual(1);
        expect(
          near(seen.panel!.h, twin.h),
          `${where}: About ${seen.panel!.h.toFixed(2)}h == reel ${twin.h.toFixed(2)}h`,
        ).toBeLessThanOrEqual(1);
        // And both are the law's box, so this is equality ON the law rather than
        // two surfaces that happen to agree.
        expect(
          near(twin.w, wideAboutPlate(vw, vh, law).w),
          `${where}: …and that box is plateBox's`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  test("390 — the reel's phone act still hangs no plate; About still does", async ({ page }) => {
    test.setTimeout(150_000);
    const seen = await liveAbout(page, MEDIA_LANDSCAPE, 390, 844);
    expect(seen.reel, "the reel's phone act hangs no plate").toHaveLength(0);
    expect(seen.plate, "the About panel is a plate at both classes").toBe("portrait");
  });
});
