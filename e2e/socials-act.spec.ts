import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { forceLanguage, routeSupabase } from "./_admin";
import { SOCIALS_ACT_ENABLED, SOCIALS_ACT_VARIANT } from "../src/lib/ventures";
import { PLATFORM_LABELS } from "../src/lib/platform-catalog";

/**
 * PORT.SOC.9 — the Socials act.
 *
 * The act is built in THREE candidate compositions and none is chosen: the
 * PORT.ACT.1 proposal settled the room, the material and the placement but not
 * what a tile says, so `SOCIALS_ACT_VARIANT` is null until Joey picks one.
 *
 * PORT.SOC.9a — while that pick is outstanding the act is not merely gated, it
 * is NOT WIRED: HomeCinematic does not import it, because importing it costs
 * the home page measurable first-paint budget in dev for an act that cannot
 * render (see the comment where the mount will go). So the dark gate below is
 * currently proving an absence that is structural rather than conditional. The
 * brick that picks a variant adds the import and the mount, and turns the rest
 * of this file on.
 *
 * Two constants gate the act once it IS wired, and this file has two halves:
 *
 *   · The DARK gate runs always. While either constant is unset the act must
 *     not exist on the page at any scroll offset — asserted as an ABSENCE.
 *   · Everything after it activates the moment BOTH are set, so switching the
 *     act on turns its own proof back on rather than trusting a build-time
 *     screenshot.
 *
 * Scroll assertions read OBSERVED state, never the aimed position.
 */

const PATH = "/";
const ACT = '[data-qa="cinematic-socials"]';
const STAGE = '[data-qa="socials-stage"]';
const GRID = '[data-qa="socials-grid"]';
const TILE = '[data-qa="socials-tile"]';
const ABOUT = "#cinematic-about";

const LINKS = [
  { id: "s1", platform: "TikTok", url: "https://www.tiktok.com/@titi", handle: "@titi", title_es: null, title_en: null, og_title: null, og_image: null, order_index: 1, enabled: true },
  { id: "s2", platform: "Instagram", url: "https://www.instagram.com/titi", handle: "@titi", title_es: null, title_en: null, og_title: null, og_image: null, order_index: 2, enabled: true },
  { id: "s3", platform: "YouTube", url: "https://www.youtube.com/@mimundoderoles", handle: "Mi Mundo de Roles", title_es: null, title_en: null, og_title: null, og_image: null, order_index: 3, enabled: true },
  { id: "s4", platform: "Facebook", url: "https://facebook.com/titi", handle: null, title_es: null, title_en: null, og_title: null, og_image: null, order_index: 4, enabled: true },
  { id: "s5", platform: "Bigo Live", url: "https://bigo.tv/titi", handle: "titi", title_es: null, title_en: null, og_title: null, og_image: null, order_index: 5, enabled: true },
  // Custom per-locale label — proves the override beats the platform name.
  { id: "s6", platform: "Spotify", url: "https://open.spotify.com/user/titi", handle: null, title_es: "Mi música", title_en: "My music", og_title: null, og_image: null, order_index: 6, enabled: true },
];

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-1024x1366", width: 1024, height: 1366 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-360", width: 360, height: 780 },
] as const;

const spacerOf = (page: Page, sel: string) =>
  page.locator(sel).first().locator("xpath=ancestor::*[contains(@class,'pin-spacer')]");

const topOf = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top);

async function settle(page: Page, ms = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function wheelTo(page: Page, y: number) {
  await page.mouse.move(200, 300);
  for (let i = 0; i < 260; i++) {
    const at = await page.evaluate(() => window.scrollY);
    const d = y - at;
    if (Math.abs(d) < 8) break;
    await page.mouse.wheel(0, Math.max(-700, Math.min(700, Math.round(d))));
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(450);
}

async function pinStartOf(page: Page, sel: string) {
  let prev = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < 25; i++) {
    const cur = await spacerOf(page, sel)
      .first()
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    if (Math.abs(cur - prev) < 1) return cur;
    prev = cur;
    await page.waitForTimeout(350);
  }
  return prev;
}

async function engage(page: Page, sel: string) {
  let start = await pinStartOf(page, sel);
  for (let i = 0; i < 4; i++) {
    await wheelTo(page, start + 60);
    if (Math.abs(await topOf(page, sel)) <= 2) break;
    start = await pinStartOf(page, sel);
  }
  return start;
}

async function openHome(
  page: Page,
  opts: { width: number; height: number; lang?: "es" | "en"; links?: unknown[] },
) {
  await page.setViewportSize({ width: opts.width, height: opts.height });
  await forceLanguage(page, opts.lang ?? "es");
  await routeSupabase(page, { socialLinks: opts.links ?? LINKS });
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await settle(page);
}

/* ─────────────────────────── the dark gate ─────────────────────────── */

test.describe("PORT.SOC.9 — the Socials act while it is dark", () => {
  test("does not mount anywhere on the cinematic home while either constant is unset", async ({
    page,
  }) => {
    test.skip(
      SOCIALS_ACT_ENABLED && SOCIALS_ACT_VARIANT !== null,
      "both constants are set — the act is supposed to be here",
    );
    await openHome(page, { width: 1440, height: 900 });

    // A gated act must be absent at EVERY offset, not merely above the fold.
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior }),
    );
    await page.waitForTimeout(800);
    await expect(page.locator(ACT)).toHaveCount(0);
    await expect(page.locator(GRID)).toHaveCount(0);
    await expect(page.locator(TILE)).toHaveCount(0);
  });
});

/* ─────────── the composition, live when both constants are set ─────────── */

test.describe("PORT.SOC.9 — the Socials act composition", () => {
  test.skip(
    !SOCIALS_ACT_ENABLED || SOCIALS_ACT_VARIANT === null,
    "the act is dark, or no composition has been picked yet",
  );

  for (const vp of VIEWPORTS) {
    test(`renders the picked composition at ${vp.name}`, async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await openHome(page, vp);

      await expect(page.locator(STAGE)).toHaveAttribute("data-variant", String(SOCIALS_ACT_VARIANT));
      await engage(page, STAGE);

      // Header and grid, present and PAINTED — opacity, not just existence.
      for (const sel of ['[data-qa="socials-eyebrow"]', `${ACT} [data-qa="section-heading"]`, GRID]) {
        await expect(page.locator(sel)).toBeVisible();
        const opacity = await page.locator(sel).evaluate((el) => getComputedStyle(el).opacity);
        expect(Number(opacity), `${sel} is painted`).toBeGreaterThan(0.1);
      }

      await expect(page.locator(TILE)).toHaveCount(LINKS.length);

      /**
       * The whole act fits the VIEWPORT, header included — not merely "inside
       * the stage".
       *
       * Measuring against the stage was the first version of this check and it
       * was worthless: the stage is `min-height:100vh`, so content taller than
       * the screen makes the STAGE taller too, and every tile is dutifully
       * "inside" a box that runs off the screen. Candidate C sailed through it
       * at 390 and 360 while its eyebrow was pushed off the top of the frame and
       * its last tile off the bottom.
       *
       * And on a PINNED act that is not a cosmetic problem — the pin holds the
       * frame still, so whatever is outside the viewport cannot be scrolled to.
       * It is simply gone. So the viewport is the frame that matters.
       */
      const geo = await page.evaluate(
        (sel) => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const tiles = [...document.querySelectorAll(sel.tile)].map((t) =>
            t.getBoundingClientRect(),
          );
          const header = document.querySelector(sel.header)!.getBoundingClientRect();
          const parts = [...tiles, header];
          const off = parts.filter(
            (r) => r.top < -1 || r.bottom > vh + 1 || r.left < -1 || r.right > vw + 1,
          );
          return {
            offCount: off.length,
            worst: off.length
              ? { top: Math.round(Math.min(...off.map((r) => r.top))), bottom: Math.round(Math.max(...off.map((r) => r.bottom))), vh }
              : null,
            minTile: Math.min(...tiles.map((r) => Math.min(r.width, r.height))),
          };
        },
        { stage: STAGE, tile: TILE, header: '[data-qa="socials-header"]' },
      );
      expect(
        geo.offCount,
        `everything the act draws is inside the held frame — ${JSON.stringify(geo.worst)}`,
      ).toBe(0);
      // A tile below ~44px is under the tap-target floor on a phone.
      expect(geo.minTile, "tiles stay tappable").toBeGreaterThanOrEqual(44);

      await page.screenshot({ path: shot(`PORT.SOC.9-${SOCIALS_ACT_VARIANT}-${vp.name}.png`) });
      expect(errors, "no page errors").toEqual([]);
    });
  }

  test("every tile is a real destination, opened safely", async ({ page }) => {
    test.setTimeout(240_000);
    await openHome(page, { width: 1440, height: 900 });
    await engage(page, STAGE);

    const tiles = await page.locator(TILE).evaluateAll((els) =>
      els.map((e) => ({
        tag: e.tagName,
        href: e.getAttribute("href"),
        rel: e.getAttribute("rel"),
        target: e.getAttribute("target"),
        platform: e.getAttribute("data-platform"),
        label: e.getAttribute("aria-label"),
        marks: e.querySelectorAll("svg").length,
      })),
    );
    expect(tiles.length).toBeGreaterThan(0);

    for (const t of tiles) {
      // STRIP.FAKE.1's law: a tile is an anchor with somewhere to go, or it is
      // not drawn at all. There is no inert tile in this act.
      expect(t.tag).toBe("A");
      expect(t.href).toBeTruthy();
      expect(t.href).not.toBe("#");
      expect(t.target).toBe("_blank");
      expect(t.rel).toMatch(/noopener/);
      // Every tile names itself for a screen reader even where the name is not
      // drawn at rest (candidate A hides it until hover).
      expect(t.label, "the tile is named").toBeTruthy();
      // The brand mark is drawn. Catalog platforms without a mark fall back to
      // the generic glyph, which is still an svg — so this asserts "a mark is
      // painted", not "the right brand".
      expect(t.marks, "a mark is drawn").toBeGreaterThan(0);
      expect(PLATFORM_LABELS, "the platform is a catalog platform").toContain(t.platform);
    }
  });

  test("a per-locale label beats the platform name, in both languages", async ({ page }) => {
    test.setTimeout(240_000);
    await openHome(page, { width: 1440, height: 900, lang: "es" });
    await engage(page, STAGE);
    await expect(page.locator(`${TILE}[data-platform="Spotify"]`)).toHaveAttribute(
      "aria-label",
      "Mi música",
    );

    await openHome(page, { width: 1440, height: 900, lang: "en" });
    await engage(page, STAGE);
    await expect(page.locator(`${TILE}[data-platform="Spotify"]`)).toHaveAttribute(
      "aria-label",
      "My music",
    );
    // A row with no override keeps the platform's own name.
    await expect(page.locator(`${TILE}[data-platform="TikTok"]`)).toHaveAttribute(
      "aria-label",
      "TikTok",
    );
  });

  test("an act with nothing to point at paints nothing and takes no height", async ({ page }) => {
    test.setTimeout(180_000);

    // Not an empty room, not a "coming soon" — nothing. The section NODE stays
    // (see the comment in CinematicSocials: a late-arriving section crashes
    // React once GSAP has re-parented the pinned acts below it), but it paints
    // nothing and occupies no space.
    const paintsNothing = async () => {
      await expect(page.locator(ACT)).toHaveAttribute("data-empty", "true");
      await expect(page.locator(GRID)).toHaveCount(0);
      await expect(page.locator(TILE)).toHaveCount(0);
      await expect(page.locator('[data-qa="socials-header"]')).toHaveCount(0);
      const h = await page.locator(ACT).evaluate((el) => el.getBoundingClientRect().height);
      expect(h, "an empty act takes no height").toBeLessThanOrEqual(1);
    };

    await openHome(page, { width: 1440, height: 900, links: [] });
    await paintsNothing();

    // A row that is enabled but has no address is the same case: it never
    // reaches the act, so a lone empty row leaves the act blank.
    await openHome(page, { width: 1440, height: 900, links: [{ ...LINKS[0], url: "" }] });
    await paintsNothing();

    // …and the page it sits in is still whole: the act BELOW an empty Socials
    // still pins, which is the crash this shape exists to prevent.
    await expect(spacerOf(page, ABOUT)).toHaveCount(1);
  });

  test("the page survives the act arriving after its rows load", async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await openHome(page, { width: 1440, height: 900 });

    // The exact failure this act's shape prevents, asserted by name: React
    // reconciling a page whose pinned sections GSAP has re-parented.
    expect(
      errors.filter((e) => /insertBefore|NotFoundError/.test(e)),
      "no DOM reconciliation crash when the act fills in",
    ).toEqual([]);
    expect(errors, "no page errors at all").toEqual([]);
    await expect(page.locator(TILE)).toHaveCount(LINKS.length);
  });

  test("the act dwells on the uniform +=120% and leaves About undisturbed", async ({ page }) => {
    test.setTimeout(300_000);
    await openHome(page, { width: 1440, height: 900 });
    const DWELL = 1.2 * 900;

    const dist = await page.evaluate((sel) => {
      const stage = document.querySelector(sel)!;
      const spacer = stage.closest(".pin-spacer")!;
      return spacer.getBoundingClientRect().height - stage.getBoundingClientRect().height;
    }, STAGE);
    expect(Math.abs(dist - DWELL), `dwells for +=120% (got ${Math.round(dist)})`).toBeLessThanOrEqual(14);

    const start = await engage(page, STAGE);
    expect(Math.abs(await topOf(page, STAGE)), "pinned at engage").toBeLessThanOrEqual(2);
    await wheelTo(page, start + 0.6 * DWELL);
    expect(Math.abs(await topOf(page, STAGE)), "still pinned mid-dwell").toBeLessThanOrEqual(2);
    await wheelTo(page, start + DWELL + 320);
    expect(await topOf(page, STAGE), "released after the dwell").toBeLessThan(-200);

    // The act BELOW still engages at its own spacer top — the falsifier for a
    // late-mounted pin staling every trigger under it.
    await engage(page, ABOUT);
    expect(
      Math.abs(await topOf(page, ABOUT)),
      "About below still engages at its own spacer top",
    ).toBeLessThanOrEqual(2);
  });

  test("reduced motion renders the act complete and static", async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openHome(page, { width: 1440, height: 900 });

    await expect(spacerOf(page, STAGE), "unpinned under reduced motion").toHaveCount(0);
    await page.locator(ACT).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    for (const sel of ['[data-qa="socials-header"]', GRID]) {
      await expect(page.locator(sel)).toBeVisible();
      const opacity = await page.locator(sel).evaluate((el) => getComputedStyle(el).opacity);
      expect(Number(opacity), `${sel} painted under reduced motion`).toBeGreaterThan(0.9);
    }
  });
});
