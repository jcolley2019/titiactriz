import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, svgPhoto } from "./_admin";
import { shot } from "./_helpers";

/**
 * ADMIN.ABOUT.4 — THE ABOUT SLOT OPENS THE REEL EDITOR. LITERALLY.
 *
 * ADMIN.ABOUT.2 claimed "there is no longer an About mode of this component at
 * all". It was not true. Three About-shaped branches survived and they were the
 * ones that draw:
 *
 *   SectionPreview  — an `aboutPlate` branch that painted a bare plate and then
 *                     explicitly suppressed the composition (`aboutPlate ? null`),
 *                     so every About tab rendered a photo crop on black: no phone
 *                     veil + numeral, no ambient ground, no W2 rules, no lockup.
 *   previewFrame    — `kind === "about"` forced the plate box on BOTH classes, so
 *                     the About phone tab framed against a plate the reel's phone
 *                     act does not hang.
 *   FramingEditor   — `isAbout` chose the Reset anchor and the class-split path.
 *
 * They are deleted. About now reaches the editor as a REEL: one adapter in
 * CinematicMediaManager (`editorKind`) maps the stored slot kind to the rendered
 * one, and below that line nothing in the editor chain can tell the two apart —
 * the `kind` union of SectionPreview, previewFrame and FramingEditor no longer
 * contains "about" at all, so an About branch is not merely absent, it is
 * unspellable.
 *
 * THIS SPEC IS THE ONE THAT COULD NOT LIE ABOUT IT. The parity claim is not read
 * off a control inventory (ADMIN.RESET.1b's spec did that and passed while every
 * tab drew the wrong picture); it is read off the RENDERED PREVIEW DOM. For each
 * device tab the About surface's skeleton — every element's depth, tag and
 * data-qa hook, in order — must equal Reel 1's, through the SAME hooks, because
 * there are no About-specific hooks left to compare instead.
 */

const PHOTOS = [
  svgPhoto("p1", "crimson"),
  svgPhoto("port", "teal"),
  svgPhoto("p3", "goldenrod"),
  svgPhoto("p4", "navy"),
];

/** Reel 1 and About both configured, on the same photo, at the same framing. */
const SAME_FRAMING = { focal: { x: 0.4, y: 0.45 }, zoom: 1.25 };
const MEDIA = {
  hero: { photo_id: "p1", focal: { x: 0.5, y: 0.08 }, zoom: 1 },
  reel: [
    { photo_id: "port", phone: { ...SAME_FRAMING }, wide: { ...SAME_FRAMING } },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
  about: { photo_id: "port", phone: { ...SAME_FRAMING }, wide: { ...SAME_FRAMING } },
};

const TABS = [
  { id: "iphone-17-pro", name: "iphone" },
  { id: "ipad-air", name: "ipad" },
  { id: "desktop", name: "desktop" },
] as const;

const SURFACE = '[data-qa="media-editor-surface"]';
const PREVIEW = `${SURFACE} [data-qa="media-preview"]`;
const CANVAS_IMG = `${SURFACE} [data-qa="media-preview-img"]`;
const ABOUT_CARD = '[data-qa="media-slot"][data-slot="about"]';
const REEL_CARD = '[data-qa="media-slot"][data-slot="reel-0"]';

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function framingReady(page: Page) {
  await expect
    .poll(async () => (await page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing")) ?? "absent", {
      timeout: 20_000,
    })
    .not.toContain("pending");
}

async function openAdminMedia(page: Page) {
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeSupabase(page, { media: MEDIA, photos: PHOTOS });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await settle(page, 700);
  await page.locator('[data-qa="admin-nav-media"]').click();
  await expect(page.locator('[data-qa="admin-media"]')).toBeVisible();
}

async function openEditor(page: Page, card: string) {
  await page.locator(`${card} [data-qa="media-slot-edit"]`).click();
  await expect(page.locator(SURFACE)).toBeVisible();
  await framingReady(page);
}

async function closeEditor(page: Page) {
  await page.locator('[data-qa="media-editor-cancel"]').click();
  await expect(page.locator(SURFACE)).toHaveCount(0);
}

async function selectTab(page: Page, id: string) {
  await page.locator(`[data-qa="media-device-${id}"]`).click();
  await page.waitForTimeout(350);
  await framingReady(page);
}

/**
 * THE PREVIEW SKELETON — the composition's rendered structure, and nothing that
 * could vary with the photograph in the slot.
 *
 * Every element under the preview root, in document order, as
 * `depth|tag|data-qa`. That is exactly the thing the screenshots disagreed about:
 * a missing veil, a missing pair of rules, a missing lockup and a missing
 * ambient ground are each a missing line here. Attribute VALUES that legitimately
 * differ per slot (a photo's src, a framing string, the numeral's text) are not
 * read, so the comparison states "same composition", never "same picture".
 */
async function skeleton(page: Page): Promise<string[]> {
  return page.locator(PREVIEW).first().evaluate((root) => {
    const out: string[] = [];
    const walk = (el: Element, depth: number) => {
      out.push(`${depth}|${el.tagName.toLowerCase()}|${el.getAttribute("data-qa") ?? "-"}`);
      for (const child of Array.from(el.children)) walk(child, depth + 1);
    };
    walk(root, 0);
    return out;
  });
}

/** The composition elements a tab must draw, by the hook the LIVE act uses. */
const REQUIRED = {
  "iphone-17-pro": ['[data-qa="reel-veil"]', '[data-qa="reel-lockup"]', '[data-qa="reel-numeral"]'],
  "ipad-air": ['[data-qa="wide-plate"]', '[data-qa="wide-rule"]', '[data-qa="wide-lockup"]'],
  desktop: ['[data-qa="wide-plate"]', '[data-qa="wide-rule"]', '[data-qa="wide-lockup"]'],
} as const;

/* ============ A. PER-TAB SCREENSHOTS: the pairs are the evidence ============ */

test.describe("ADMIN.ABOUT.4 — About renders the reel editor's compositions", () => {
  test("every About tab draws the SAME preview skeleton as Reel 1's", async ({ page }) => {
    test.setTimeout(240_000);
    await openAdminMedia(page);

    // Reel 1 first — the reference the About surface is judged against.
    const reel: Record<string, string[]> = {};
    await openEditor(page, REEL_CARD);
    for (const tab of TABS) {
      await selectTab(page, tab.id);
      reel[tab.id] = await skeleton(page);
      await page.locator(SURFACE).screenshot({ path: shot(`reel-${tab.name}.png`) });
    }
    await closeEditor(page);

    // About second — same tabs, same reading, same hooks.
    const about: Record<string, string[]> = {};
    await openEditor(page, ABOUT_CARD);
    for (const tab of TABS) {
      await selectTab(page, tab.id);
      about[tab.id] = await skeleton(page);
      await page.locator(SURFACE).screenshot({ path: shot(`about4-${tab.name}.png`) });
    }

    // 1. THE COMPOSITION IS PRESENT AT ALL. Stated positively per tab, so a
    //    failure names the missing piece rather than dumping a skeleton diff.
    for (const tab of TABS) {
      await selectTab(page, tab.id);
      for (const sel of REQUIRED[tab.id]) {
        await expect(
          page.locator(`${SURFACE} ${sel}`).first(),
          `${tab.name} About tab draws ${sel}`,
        ).toBeAttached();
      }
    }

    // 2. AND IT IS THE REEL'S, ELEMENT FOR ELEMENT.
    for (const tab of TABS) {
      expect(about[tab.id], `${tab.name}: About preview skeleton equals Reel 1's`).toEqual(
        reel[tab.id],
      );
      expect(about[tab.id].length, `${tab.name}: the skeleton is non-trivial`).toBeGreaterThan(3);
    }
  });

  /* ---- B. THE PAINTED BOX: same geometry law, not just the same elements ---- */

  test("the About surface and the Reel surface frame at identical boxes", async ({ page }) => {
    test.setTimeout(240_000);
    await openAdminMedia(page);

    const boxes = async (card: string) => {
      await openEditor(page, card);
      const out: Record<string, { frame: number; media: number; attr: string }> = {};
      for (const tab of TABS) {
        await selectTab(page, tab.id);
        const surface = (await page.locator(SURFACE).boundingBox())!;
        const img = (await page.locator(CANVAS_IMG).first().boundingBox())!;
        out[tab.id] = {
          frame: surface.width / surface.height,
          media: img.width / img.height,
          attr: (await page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing")) ?? "",
        };
      }
      await closeEditor(page);
      return out;
    };

    const reel = await boxes(REEL_CARD);
    const about = await boxes(ABOUT_CARD);

    for (const tab of TABS) {
      expect(
        Math.abs(about[tab.id].frame - reel[tab.id].frame),
        `${tab.name}: same device frame`,
      ).toBeLessThan(0.01);
      expect(
        Math.abs(about[tab.id].media - reel[tab.id].media),
        `${tab.name}: same painted media box`,
      ).toBeLessThan(0.01);
      // Same photo, same stored framing, same box ⇒ byte-identical resolver
      // output. This is the assertion that catches a geometry branch surviving
      // somewhere the skeleton cannot see (previewFrame's plate law, say).
      expect(about[tab.id].attr, `${tab.name}: the resolver framing matches`).toBe(
        reel[tab.id].attr,
      );
    }
  });

  /* ---- C. THE CONTROLS: the Shape toggle appears on the same tabs ---- */

  test("the Shape toggle is offered on exactly the tabs a reel offers it on", async ({ page }) => {
    test.setTimeout(180_000);
    await openAdminMedia(page);

    const shapeTabs = async (card: string) => {
      await openEditor(page, card);
      const seen: string[] = [];
      for (const tab of TABS) {
        await selectTab(page, tab.id);
        if (await page.locator('[data-qa="media-editor-aspect"]').isVisible()) seen.push(tab.name);
      }
      await closeEditor(page);
      return seen;
    };

    const reel = await shapeTabs(REEL_CARD);
    const about = await shapeTabs(ABOUT_CARD);
    expect(reel, "the reel offers Shape on the wide tabs").toEqual(["ipad", "desktop"]);
    expect(about, "About offers Shape on exactly the same tabs").toEqual(reel);
  });

  /* ---- D. THE SHAPE TOGGLE RE-FRAMES the About canvas like a reel's ---- */

  test("switching About to landscape re-shapes its plate, exactly as a reel's does", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await openAdminMedia(page);

    const platesFor = async (card: string) => {
      await openEditor(page, card);
      await selectTab(page, "desktop");
      const read = async () => {
        const b = (await page.locator(`${SURFACE} [data-qa="wide-plate"]`).boundingBox())!;
        return b.width / b.height;
      };
      const portrait = await read();
      await page.locator('[data-qa="media-editor-aspect-landscape"]').click();
      await page.waitForTimeout(350);
      const landscape = await read();
      await closeEditor(page);
      return { portrait, landscape };
    };

    const reel = await platesFor(REEL_CARD);
    const about = await platesFor(ABOUT_CARD);

    expect(Math.abs(about.portrait - reel.portrait), "portrait plates match").toBeLessThan(0.01);
    expect(Math.abs(about.landscape - reel.landscape), "landscape plates match").toBeLessThan(0.01);
    expect(about.landscape, "the toggle genuinely re-shapes the About plate").toBeGreaterThan(
      about.portrait + 0.5,
    );
  });
});
