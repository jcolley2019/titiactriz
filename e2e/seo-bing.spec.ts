import { expect, test, webkit, type Locator, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * SEO.BING.1 — Bing sees a real <h1>, a short title, a full description and
 * visible intro content on the homepage. Bing Webmaster flagged the served
 * homepage: title too long, no <h1>, meta description short, insufficient
 * content. The hero always rendered an <h1>, but only after JS; the HTML the
 * server sends had an empty #root.
 *
 *  B1  Raw HTML from `/` (no JS): exactly one <h1>, reading "Cristyna
 *      Polentino"; <title> ≤ 62 chars; meta description 150–160 chars; the
 *      static shell is present; no retired role (TikToker, bailarina, dancer)
 *      anywhere in it.
 *  B2  Mounted page, Chromium AND WebKit at Joey's iPhone truth: React replaced
 *      the shell (exactly one h1, no [data-static-shell]); the boot cover is
 *      gone within 4s and lifted over React's output, never over the shell;
 *      the hero.intro text is visible.
 *  B3  390×844 and 440×792 at scroll 0: the intro never touches the scroll cue
 *      and sits wholly inside the viewport.
 *  B4  Reduced motion: intro visible, no boot cover.
 *
 * SEO.BING.1d — the ROLES LAW. Joey, verbatim: "her title should say actriz,
 * streamer, entreprenuer"; "we need to make sure that it keeps the subtitle
 * consistent on all 3 page layouts".
 *
 *  B5  Every home layout — cinematic, editorial, classic — renders the same
 *      roles line, in the same order: ACTRIZ STREAMER EMPRESARIA in ES, ACTRESS
 *      STREAMER ENTREPRENEUR in EN. There is no /editorial or /classic route:
 *      all three are `/`, chosen by the `home_variant` setting, so each layout
 *      is driven by serving that setting.
 *  B6  The footer on `/` names her a streamer, and never a dancer.
 */

const INTRO = '[data-qa="cinematic-hero-intro"]';
const CUE = '[data-qa="cinematic-scrollcue"]';
const INTRO_ES =
  "Actriz colombiana, streamer y empresaria en Medellín. Su historia, su comunidad y sus proyectos.";
const INTRO_EN =
  "Colombian actress, streamer and entrepreneur in Medellín. Her story, her community and her projects.";
const SHOTS = "_qa/seo-bing-1d";

/** A board with no banner: a live banner adds its bar above the hero and moves the fold. */
const BOARD_NO_BANNER = {
  pageVisible: true,
  mainBanner: { enabled: false, pages: { home: false, greenWorld: false, titans: false } },
  greenWorldBanner: { enabled: false },
  titansBanner: { enabled: false },
  items: [],
};

/** Characters, not UTF-16 units or bytes: "·" and "í" are one each, as a reader counts them. */
const chars = (s: string) => [...s].length;

/**
 * Record the moment the boot cover leaves the DOM and what #root held at that
 * moment. The observer's callback runs in the microtask checkpoint right after
 * the removal, before anything else can touch #root, so `shellUnderCover` is the
 * state the cover actually lifted over.
 */
async function watchBootCover(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cover?: { at: number; shellUnderCover: boolean } };
    // The observer is armed before the parser reaches the cover, so "absent"
    // only means "removed" once the cover has been seen present.
    let seen = false;
    const mo = new MutationObserver(() => {
      if (document.getElementById("ta-boot-cover")) {
        seen = true;
        return;
      }
      if (!seen || w.__cover) return;
      const first = document.getElementById("root")?.firstElementChild;
      w.__cover = {
        at: performance.now(),
        shellUnderCover: !first || first.hasAttribute("data-static-shell"),
      };
      mo.disconnect();
    });
    mo.observe(document, { childList: true, subtree: true });
  });
}

/** The intro's fade-up (restRef's GSAP tween) has finished: fully opaque, no offset. */
async function introSettled(page: Page) {
  await expect
    .poll(
      () =>
        page.locator(INTRO).evaluate((el) => {
          const rest = el.parentElement as HTMLElement;
          const cs = getComputedStyle(rest);
          const ty = cs.transform === "none" ? 0 : new DOMMatrix(cs.transform).m42;
          return cs.opacity === "1" && Math.abs(ty) < 0.5;
        }),
      { message: "intro fade-up settles", timeout: 10_000 },
    )
    .toBe(true);
}

async function assertMounted(page: Page, intro: string) {
  await expect(page.locator(INTRO), "hero.intro rendered").toBeVisible({ timeout: 15_000 });
  await expect(page.locator(INTRO)).toHaveText(intro);
  await expect(page.locator("#ta-boot-cover"), "boot cover gone within 4s").toHaveCount(0, {
    timeout: 4_000,
  });
  await expect(page.locator("[data-static-shell]"), "React replaced the static shell").toHaveCount(0);
  await expect(page.locator("h1"), "exactly one h1 once mounted").toHaveCount(1);
  await expect(page.locator("h1")).toHaveAttribute("aria-label", "Cristyna Polentino");

  const cover = await page.evaluate(
    () => (window as unknown as { __cover?: { at: number; shellUnderCover: boolean } }).__cover,
  );
  expect(cover, "boot cover removal observed").toBeTruthy();
  expect(cover!.shellUnderCover, "cover lifted over React's output, not the shell").toBe(false);
  expect(cover!.at, "lifted by readiness, before the 4s safety net").toBeLessThan(4_000);
}

/** Intro and scroll-cue boxes at scroll 0. Returns the vertical gap (cue top − intro bottom). */
async function phoneLaw(page: Page) {
  await introSettled(page);
  const m = await page.evaluate(
    ([introSel, cueSel]) => {
      const a = document.querySelector(introSel)!.getBoundingClientRect();
      const b = document.querySelector(cueSel)!.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        iw: window.innerWidth,
        ih: window.innerHeight,
        intro: { top: a.top, bottom: a.bottom, left: a.left, right: a.right },
        cue: { top: b.top, bottom: b.bottom, left: b.left, right: b.right },
      };
    },
    [INTRO, CUE] as const,
  );
  const { intro, cue } = m;
  const intersects = !(
    intro.bottom <= cue.top ||
    cue.bottom <= intro.top ||
    intro.right <= cue.left ||
    cue.right <= intro.left
  );
  expect(m.scrollY, "hero at scroll 0").toBe(0);
  expect(intersects, `intro ${JSON.stringify(intro)} vs cue ${JSON.stringify(cue)}`).toBe(false);
  expect(intro.top, "intro top inside viewport").toBeGreaterThanOrEqual(0);
  expect(intro.bottom, "intro bottom inside viewport").toBeLessThan(m.ih);
  expect(intro.left, "intro left inside viewport").toBeGreaterThanOrEqual(0);
  expect(intro.right, "intro right inside viewport").toBeLessThanOrEqual(m.iw);
  return Math.round((cue.top - intro.bottom) * 10) / 10;
}

type Layout = "cinematic" | "editorial" | "classic";

async function openHome(page: Page, lng: "es" | "en" = "es", layout: Layout = "cinematic") {
  await forceLanguage(page, lng);
  await routeSupabase(page, { eventsBoard: BOARD_NO_BANNER, homeVariant: layout });
  await watchBootCover(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

/** B5 — the one roles line, per layout, in the order the law fixes. */
const ROLES_LINE = {
  es: "ACTRIZ STREAMER EMPRESARIA",
  en: "ACTRESS STREAMER ENTREPRENEUR",
} as const;

/**
 * Each layout's roles element, found by the markup the layout already has:
 * cinematic's is the <p> right above the intro, editorial's carries its own
 * class, classic's is the one holding the gold `|` separators.
 */
const ROLES: Record<Layout, (page: Page) => Locator> = {
  cinematic: (page) => page.locator(INTRO).locator("xpath=preceding-sibling::p[1]"),
  editorial: (page) => page.locator("p.editorial-roles"),
  classic: (page) =>
    page.locator("p", { has: page.locator("span.text-accent", { hasText: "|" }) }),
};

/** Uppercase, every separator (· or |) and whitespace run collapsed to one space. */
const normalizeRoles = (s: string) =>
  s.toUpperCase().replace(/[·|]/g, " ").replace(/\s+/g, " ").trim();

test.describe("SEO.BING.1", () => {
  test("B1 — the raw HTML carries one h1, a short title, a full description and the shell", async ({
    request,
  }) => {
    const res = await request.get("/");
    expect(res.ok()).toBe(true);
    const html = await res.text();

    const h1s = html.match(/<h1[\s>]/g) ?? [];
    expect(h1s.length, "exactly one <h1 in the served HTML").toBe(1);
    expect(html.match(/<h1>([^<]*)<\/h1>/)?.[1]).toBe("Cristyna Polentino");

    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    expect(title).toBe("Cristyna Polentino | Actriz, Streamer y Empresaria · Medellín");
    expect(chars(title), `title length: ${title}`).toBeLessThanOrEqual(62);

    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    expect(chars(description), `description length: ${description}`).toBeGreaterThanOrEqual(150);
    expect(chars(description), `description length: ${description}`).toBeLessThanOrEqual(160);

    expect(html).toContain("data-static-shell");
    expect(html).toContain(INTRO_ES);
    expect(html).toContain(INTRO_EN);

    for (const retired of ["TikToker", "Bailarina", "dancer"]) {
      expect(html, `the served HTML names no "${retired}"`).not.toMatch(new RegExp(retired, "i"));
    }
  });

  test.describe("B2 — mounted (Chromium)", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("React replaces the shell; the cover lifts over React; intro visible (ES)", async ({ page }) => {
      await openHome(page, "es");
      await assertMounted(page, INTRO_ES);
      await introSettled(page);
      await page.screenshot({ path: `${SHOTS}/B2-chromium-1440x900.png` });
    });

    test("the intro reads in English at EN (key parity)", async ({ page }) => {
      await openHome(page, "en");
      await assertMounted(page, INTRO_EN);
    });
  });

  test("B2 — mounted (WebKit, iPhone 440×792)", async ({ baseURL }) => {
    // The webkit-iphone project only claims the phone snap/carousel files, so
    // this spec launches the same device itself rather than widening that list.
    const browser = await webkit.launch();
    try {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 440, height: 792 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      });
      const page = await context.newPage();
      await openHome(page, "es");
      await assertMounted(page, INTRO_ES);
      const gap = await phoneLaw(page);
      console.log(`[SEO.BING.1] webkit 440x792 intro→cue gap: ${gap}px`);
      await page.screenshot({ path: `${SHOTS}/B2-webkit-440x792.png` });
      await context.close();
    } finally {
      await browser.close();
    }
  });

  for (const vp of [
    { w: 390, h: 844 },
    { w: 440, h: 792 },
  ]) {
    test.describe(`B3 — phone law ${vp.w}×${vp.h}`, () => {
      test.use({ viewport: { width: vp.w, height: vp.h } });

      test("the intro clears the scroll cue and sits inside the viewport at scroll 0", async ({ page }) => {
        await openHome(page, "es");
        await expect(page.locator(INTRO)).toBeVisible({ timeout: 15_000 });
        const gap = await phoneLaw(page);
        console.log(`[SEO.BING.1] chromium ${vp.w}x${vp.h} intro→cue gap: ${gap}px`);
        await page.screenshot({ path: `${SHOTS}/B3-chromium-${vp.w}x${vp.h}.png` });
      });
    });
  }

  test.describe("B4 — reduced motion", () => {
    test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

    test("intro visible, no boot cover", async ({ page }) => {
      await openHome(page, "es");
      await expect(page.locator(INTRO)).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(INTRO)).toHaveText(INTRO_ES);
      await expect(page.locator("#ta-boot-cover")).toHaveCount(0, { timeout: 4_000 });
      const gap = await phoneLaw(page);
      console.log(`[SEO.BING.1] reduced-motion 390x844 intro→cue gap: ${gap}px`);
      await page.screenshot({ path: `${SHOTS}/B4-reduced-390x844.png` });
    });
  });

  test.describe("B5 — one roles line on all three layouts", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    for (const layout of ["cinematic", "editorial", "classic"] as const) {
      for (const lng of ["es", "en"] as const) {
        test(`${layout} (${lng.toUpperCase()}) reads ${ROLES_LINE[lng]}`, async ({ page }) => {
          await openHome(page, lng, layout);
          const roles = ROLES[layout](page);
          await expect(roles, `the ${layout} layout renders one roles line`).toHaveCount(1, {
            timeout: 15_000,
          });
          await expect(roles).toBeVisible();
          expect(normalizeRoles((await roles.textContent()) ?? "")).toBe(ROLES_LINE[lng]);
        });
      }
    }
  });

  test.describe("B6 — the footer", () => {
    for (const lng of ["es", "en"] as const) {
      test(`the footer on / (${lng.toUpperCase()}) names her a streamer, never a dancer`, async ({
        page,
      }) => {
        await openHome(page, lng);
        const footer = page.locator("footer");
        await expect(footer).toHaveCount(1, { timeout: 15_000 });
        await expect(footer).toContainText(/streamer/i);
        await expect(footer).not.toContainText(/bailarina|dancer/i);
      });
    }
  });
});
