import { test, expect, type Page, type Route } from "@playwright/test";
import { attachDiagnostics, scrollThrough, shot, BRICK } from "./_helpers";
import { forceLanguage, MOCK_PHOTOS, routeSupabase } from "./_admin";

/**
 * Per-brick self-verification for /cinematic (TA.SPRINT.1 + TA.5 polish).
 * Adaptive: sections are feature-detected via data-qa hooks, so the same
 * spec passes from the bare TA.0 shell through the finished page.
 *
 * TA.5a adds live-motion proof for the gallery: it is now a self-driving
 * infinite marquee (no scroll pinning), so we assert its transform advances on
 * its own over a 2s window and freezes while hovered.
 */
const PATH = "/cinematic";
const MARQUEE = '[data-qa="cinematic-marquee-track"]';

async function settle(page: import("@playwright/test").Page, ms = 700) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe("cinematic — desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("loads clean, scrolls, gallery photos come from owned backend", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    // Hero framing evidence: exact-viewport shot of the top of the page so the
    // top-anchored object-position can be judged (no cropping of her head).
    await page.screenshot({ path: shot(`TA.${BRICK}-hero-desktop.png`) });

    await page.screenshot({ path: shot(`TA.${BRICK}-desktop.png`), fullPage: true });
    await scrollThrough(page, `TA.${BRICK}`);

    // Every gallery <img> must be served from the owned Supabase project.
    const gallery = page.locator('[data-qa="cinematic-gallery"]');
    if (await gallery.count()) {
      const imgs = gallery.locator("img");
      const n = await imgs.count();
      expect(n, "gallery should render images").toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const src = await imgs.nth(i).getAttribute("src");
        expect(src ?? "", `gallery img ${i} src`).toContain("nsmstwkjbjicpdclgecq");
      }
    }

    expect(diag.consoleErrors, "console errors during load + scroll").toEqual([]);
    expect(diag.failedResponses, "failed network requests").toEqual([]);
  });

  test("gallery marquee self-drives and pauses on hover", async ({ page }) => {
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    const track = page.locator(MARQUEE);
    await expect(track, "marquee track should be present under motion").toHaveCount(1);

    const readTransform = () =>
      track.evaluate((el) => getComputedStyle(el as HTMLElement).transform);

    // Park the cursor well away from the marquee so nothing is paused, then
    // prove the track advances on its own. The ledgered flake: a fixed 2s
    // window read two identical frames whenever a loaded run starved RAF (and
    // with it GSAP's ticker) for that stretch, and called a healthy marquee
    // dead. Poll until advancement is OBSERVED instead of sampling a schedule.
    await page.mouse.move(5, 5);
    await page.waitForTimeout(150);
    const t0 = await readTransform();
    expect(t0, "marquee should be transformed by GSAP").not.toBe("none");
    await expect
      .poll(readTransform, {
        message: "marquee transform should advance (self-driving)",
        timeout: 15_000,
      })
      .not.toBe(t0);

    // Hover the marquee → it must pause. Hover the viewport-sized wrapper (not
    // the ~19k-px-wide track, whose centre is far off-screen and therefore not
    // hoverable). The pause is an instant tween.pause() on mouseenter, but the
    // event pipeline can lag under load — so poll until the transform is
    // observed stable across a 500ms sample rather than trusting a fixed delay.
    await page.locator('[data-qa="cinematic-marquee"]').hover();
    await expect
      .poll(
        async () => {
          const a = await readTransform();
          await page.waitForTimeout(500);
          const b = await readTransform();
          return a === b ? "stable" : "moving";
        },
        {
          message: "marquee transform should go stable while hovered (paused)",
          timeout: 10_000,
        },
      )
      .toBe("stable");
  });
});

test.describe("cinematic — admin-selectable hero (TA.6a)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const HERO = '[data-qa="cinematic-hero-img"]';

  const heroSrc = (page: import("@playwright/test").Page) =>
    page.locator(HERO).first().getAttribute("src");

  // Deterministically mock ALL /cinematic site_settings reads: the hero-photo
  // key returns `heroPhotoBody`; cinematic_media / cinematic_hero_video resolve
  // absent so this LEGACY-path test is isolated from mutable admin state. (A real
  // cinematic_media.hero.photo_id — now writable via ADMIN.MEDIA — would
  // otherwise, correctly, take precedence over the legacy cinematic_hero_photo.)
  const routeSettings = (page: import("@playwright/test").Page, heroPhotoBody: string) =>
    page.route("**/site_settings*", (route) => {
      const url = route.request().url();
      const body = url.includes("cinematic_hero_photo") ? heroPhotoBody : "null";
      return route.fulfill({ status: 200, contentType: "application/json", body });
    });

  // Collect the distinct published photo srcs from the gallery marquee, in order.
  async function galleryOrder(page: import("@playwright/test").Page) {
    const imgs = page.locator('[data-qa="cinematic-marquee-track"] img');
    const n = await imgs.count();
    const seen: string[] = [];
    for (let i = 0; i < n; i++) {
      const src = await imgs.nth(i).getAttribute("src");
      if (src && !seen.includes(src)) seen.push(src);
    }
    return seen;
  }

  test("defaults to the first published photo when the key is absent", async ({ page }) => {
    // Force the absent-key case regardless of production state (no DB write).
    await routeSettings(page, "null");
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    const order = await galleryOrder(page);
    expect(order.length, "gallery should expose the published pool").toBeGreaterThan(1);
    const hero = await heroSrc(page);
    expect(hero, "default hero should be the first published photo").toBe(order[0]);
  });

  test("honors cinematic_hero_photo when set to a non-default photo", async ({ page }) => {
    // First, learn the real published pool with the key forced absent.
    await routeSettings(page, "null");
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);
    const order = await galleryOrder(page);
    const defaultHero = await heroSrc(page);
    expect(order.length).toBeGreaterThan(1);
    const chosen = order[1]; // a genuinely different, non-default published photo
    expect(chosen).not.toBe(order[0]);

    // Now mock the setting to that photo's URL (the reader accepts id OR url).
    await page.unroute("**/site_settings*");
    await routeSettings(page, JSON.stringify({ value: chosen }));
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    const hero = await heroSrc(page);
    expect(hero, "hero should honor the selected photo").toBe(chosen);
    expect(hero, "selected hero differs from the default").not.toBe(defaultHero);
    expect(hero ?? "", "hero image from owned backend").toContain("nsmstwkjbjicpdclgecq");

    await page.screenshot({ path: shot(`TA.${BRICK}-hero-selected.png`) });
  });
});

test.describe("cinematic — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders on a 390×844 viewport with no errors", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    // Hero framing evidence at phone size.
    await page.screenshot({ path: shot(`TA.${BRICK}-hero-mobile.png`) });
    await page.screenshot({ path: shot(`TA.${BRICK}-mobile.png`), fullPage: true });

    expect(diag.consoleErrors, "console errors (mobile)").toEqual([]);
    expect(diag.failedResponses, "failed network requests (mobile)").toEqual([]);
  });
});

/* ---------- CINE.FLOW.5: the phone/wide reel split holds ---------- */
test.describe("cinematic — reel composition split", () => {
  /**
   * The two promoted acts belong to their own device classes ONLY. This is the
   * guard against either leaking across the 768px line: at 1440 the reel must
   * carry the CINE.FLOW.6 editorial spread — the bounded W2 plate beside its
   * story chapter, and no phone lockup or edge veil anywhere in the section —
   * while 390 must carry V1 "Edge Veil", exactly one lockup and one veil per
   * slide over a cover photo, and no plate. Both halves are asserted so a split
   * that inverts fails too.
   */
  const LOCKUP = '[data-qa="reel-lockup"]';
  const VEIL = '[data-qa="reel-veil"]';
  const PLATE = '[data-qa="wide-plate"]';

  for (const vp of [
    { name: "desktop 1440", width: 1440, height: 900, phone: false },
    { name: "phone 390", width: 390, height: 844, phone: true },
  ]) {
    test(`${vp.name} renders ${vp.phone ? "the V1 edge-veil act" : "the W2 plate act, no phone lockup"}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(PATH, { waitUntil: "domcontentloaded" });
      await settle(page, 700);

      const reel = page
        .locator('[data-qa="cinematic-section"]')
        .filter({ has: page.locator('[data-qa="cinematic-reel-img"]') })
        .first();
      await expect(reel).toBeAttached();

      await expect(
        reel.locator(LOCKUP),
        vp.phone ? "one phone lockup per slide" : "no phone lockup above the breakpoint",
      ).toHaveCount(vp.phone ? 3 : 0);
      await expect(
        reel.locator(VEIL),
        vp.phone ? "one edge veil per slide" : "no edge veil above the breakpoint",
      ).toHaveCount(vp.phone ? 3 : 0);
      await expect(
        reel.locator(PLATE),
        vp.phone ? "no plate below the breakpoint" : "one plate per slide",
      ).toHaveCount(vp.phone ? 0 : 3);

      // CINE.FLOW.5 retired the letterbox: every reel surface covers now, the
      // phone act against the viewport and the wide act against its plate.
      const framing = await reel
        .locator('[data-qa="cinematic-reel-img"]')
        .first()
        .getAttribute("data-hero-framing");
      expect(framing, `${vp.name}: photo fit`).toContain(";fill;");

      // Type is CONTINUOUS across the breakpoint and caption-scale on both
      // sides: the phone numeral is a flat 66px, the wide numeral
      // clamp(22, 2.5vw, 38) → 36px at 1440. The old 240px display numeral is
      // gone, so neither act carries anything near that size.
      const numeralPx = await reel
        .locator(vp.phone ? '[data-qa="reel-numeral"]' : '[data-qa="wide-numeral"]')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      if (vp.phone) {
        expect(numeralPx, "phone numeral is V1's 82px reduced 20%").toBeCloseTo(66, 0);
      } else {
        expect(numeralPx, "wide numeral is clamp(22, 2.5vw, 38) at 1440").toBeCloseTo(36, 0);
      }
    });
  }
});

/* ---------- CINE.FLOW.5: both acts are inside the veil band ---------- */
test.describe("cinematic — reel veil law: V1 on phones, no veil at all on wide", () => {
  /**
   * The promoted acts' veil laws, each falsifiable on the LIVE render.
   *
   * PHONE (V1 "Edge Veil"):
   *  1. ONE VEIL, DIRECTIONAL — a single full-frame linear gradient, fully
   *     transparent at the top edge, rising monotonically to 0.32 at the bottom.
   *     A flat wash fails on the first stop; an inverted ramp fails on
   *     monotonicity.
   *  2. INSIDE THE BAND — the peak never exceeds DESIGN.md's 0.35 ceiling. The
   *     retired 0.5 → 0.8 wash fails here, and so would any re-darkening.
   *  3. NOTHING ELSE — no radial beam (4C's retired spotlight), no
   *     lockup-bound scrim, and no rules flanking the numeral. The promoted
   *     lockup is a bare numeral over its title.
   *
   * WIDE (CINE.FLOW.6 spread, plate laws from W2):
   *  4. UNVEILED — nothing with a gradient paints inside the plate box, and the
   *     retired WIDE_VEIL does not paint anywhere in the section: the only
   *     gradients permitted are the chapter fields' HERO.WIDE.1 luminance
   *     light, which sits BESIDE the photograph, never over it. The chapter
   *     never crosses the photograph, so there is no type to protect there.
   */
  const VEIL = '[data-qa="reel-veil"]';
  const PLATE = '[data-qa="wide-plate"]';
  const RETIRED_SCRIM = '[data-qa="reel-lockup-scrim"]';
  const RETIRED_RULE = '[data-qa="reel-rule"]';

  /** The veil's own contract, from src/components/cinematic/reelSpotlight.ts. */
  const VEIL_PEAK = 0.32;
  const BAND_CEILING = 0.35;

  const reelOf = (page: import("@playwright/test").Page) =>
    page
      .locator('[data-qa="cinematic-section"]')
      .filter({ has: page.locator('[data-qa="cinematic-reel-img"]') })
      .first();

  test("phone 390 — one directional edge veil, inside the band, nothing else", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 700);

    const reel = reelOf(page);
    await expect(reel).toBeAttached();

    // 3. NOTHING ELSE — no radial beam, no scrim, no rules.
    const radials = await reel.evaluate((sec) =>
      Array.from(sec.querySelectorAll("*"))
        .map((el) => getComputedStyle(el as HTMLElement).backgroundImage)
        .filter((bg) => bg.includes("radial-gradient")),
    );
    expect(radials, "the retired 4C focal beam is not back").toEqual([]);
    await expect(reel.locator(RETIRED_SCRIM), "the 4C scrim is retired").toHaveCount(0);
    await expect(reel.locator(RETIRED_RULE), "the phone numeral has no rules").toHaveCount(0);

    // 1. ONE VEIL per slide, covering the whole frame.
    await expect(reel.locator(VEIL), "one edge veil per slide").toHaveCount(3);
    const frame = await reel.locator('[data-qa="cinematic-reel-img"]').first().evaluate(
      () => ({ w: window.innerWidth, h: window.innerHeight }),
    );
    const box = await reel.locator(VEIL).first().boundingBox();
    expect(box, "veil measurable").not.toBeNull();
    expect(box!.width, "veil spans the full frame width").toBeGreaterThanOrEqual(frame.w - 1);
    expect(box!.height, "veil spans the full frame height").toBeGreaterThanOrEqual(frame.h - 1);

    // ...and the ramp itself: transparent at the top edge, opening nothing until
    // past the half-way line, then rising monotonically to its peak at the foot.
    const probe = await reel.locator(VEIL).first().evaluate((el) => ({
      bg: getComputedStyle(el as HTMLElement).backgroundImage,
      h: el.getBoundingClientRect().height,
    }));
    const ramp = Array.from(probe.bg.matchAll(/rgba?\(([^)]*)\)\s+([\d.]+)(px|%)/g)).map((m) => {
      const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
      const n = parseFloat(m[2]);
      return {
        y: m[3] === "px" ? n : (n / 100) * probe.h,
        alpha: parts.length > 3 ? parts[3] : 1,
      };
    });
    expect(ramp.length, "veil ramp has stops").toBeGreaterThan(3);
    expect(ramp[0].alpha, "veil is transparent at its top edge").toBe(0);
    expect(ramp[ramp.length - 1].alpha, "veil peaks at the bottom edge").toBeCloseTo(VEIL_PEAK, 3);
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i].alpha, `stop ${i} never lightens`).toBeGreaterThanOrEqual(ramp[i - 1].alpha);
    }

    // 2. INSIDE THE BAND — the peak is under DESIGN.md's 0.35 ceiling, and the
    // photograph's top half is left completely open.
    expect(
      Math.max(...ramp.map((s) => s.alpha)),
      "veil peak stays inside the mandated 0.15-0.35 band",
    ).toBeLessThanOrEqual(BAND_CEILING);
    const firstDark = ramp.find((s) => s.alpha > 0)!;
    expect(
      firstDark.y,
      "suppression starts only where the type lands (past 50% of the frame)",
    ).toBeGreaterThanOrEqual(0.5 * probe.h - 1);
  });

  test("desktop 1440 — the wide plate is unveiled and WIDE_VEIL is gone", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 700);

    const reel = reelOf(page);
    await expect(reel).toBeAttached();

    // 4. UNVEILED — nothing gradient-backed paints inside any plate.
    await expect(reel.locator(PLATE), "one plate per slide").toHaveCount(3);
    const inPlate = await reel.locator(PLATE).first().evaluate((el) =>
      Array.from(el.querySelectorAll("*"))
        .map((n) => getComputedStyle(n as HTMLElement).backgroundImage)
        .filter((bg) => bg.includes("gradient")),
    );
    expect(inPlate, "the plate photograph is unveiled").toEqual([]);

    // The retired flat wash does not paint anywhere in the section. REVIEW.2
    // narrows the law again: the ONLY gradient-backed elements permitted in
    // the wide section are the three tonal ROOMS — HERO.WIDE.1's luminance
    // light on each spread's single opaque ground, which sits beside and
    // behind the photograph's plate, never over it. Any other gradient (a
    // restored WIDE_VEIL above all) still fails.
    const gradientOwners = await reel.evaluate((sec) =>
      Array.from(sec.querySelectorAll("*"))
        .filter((el) => getComputedStyle(el as HTMLElement).backgroundImage.includes("gradient"))
        .map((el) => el.getAttribute("data-qa") ?? "unmarked"),
    );
    expect(
      gradientOwners,
      "the only gradients are the three rooms' luminance light",
    ).toEqual(["wide-room", "wide-room", "wide-room"]);
    await expect(reel.locator(VEIL), "no phone edge veil above the breakpoint").toHaveCount(0);
  });
});

test.describe("cinematic — reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("static layout still renders every section heading", async ({ page }) => {
    // NOTE: the `reducedMotion` test-fixture option is not honoured in this
    // Playwright build (1.61.1) — matchMedia still reports no-preference. Emulate
    // it explicitly on the page so the reduced-motion branch is actually exercised.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 400);

    await page.screenshot({ path: shot(`TA.${BRICK}-reduced.png`), fullPage: true });

    // Under reduced motion the marquee is replaced by a static grid.
    await expect(page.locator(MARQUEE), "no marquee under reduced motion").toHaveCount(0);

    const headings = page.locator('[data-qa="section-heading"]');
    const n = await headings.count();
    expect(n, "at least one section heading present").toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await expect(headings.nth(i)).toBeVisible();
    }
  });
});

/* ---------- HOME.BLOGACT.1: the Blog act ---------- */

/**
 * HOME.BLOGACT.1 — the Blog act, between the gallery and Green World.
 *
 *  BA1  it renders at most four posts, newest first, each linking to its post
 *       (cards at 1440, tiles at 390), and its footer links to /blog
 *  BA2  1440×900: the act pins and holds — its top stays at 0 for ≥100vh of
 *       further scroll — and neither neighbour is disturbed: the gallery above
 *       keeps its +=120% and engages at its own spacer top, and Green World
 *       below engages at ITS spacer top with its +=300% intact (the
 *       acting-flow.spec dwell assertion, applied to this act's neighbours)
 *  BA3  390×844: four tiles, each ≤72px tall; at the pin the act's title, every
 *       tile and the footer links are inside the 844px frame; nothing overflows
 *       sideways; the pin holds
 *  BA4  reduced motion: no pin, and the act is static, settled and visible
 *  BA5  no published posts: the act paints nothing and the gallery is followed
 *       directly by Green World
 *  BA6  a greenworld tile wears the lane green frame and hairline, a personal one
 *       gold; the cards carry the same lane; "Green World →" only when a shown
 *       post walks the lane. BLOG.GW.2a: a kinded greenworld tile's caps line is
 *       "<kind> · <date>" (the frame carries Green World), and at 390×844 no
 *       tile's caps line is truncated; the card keeps "Green World · <kind>"
 *  BA7  768×1024 (HOME.BLOGACT.1a): a tablet frame too short for the 2×2 takes
 *       the tiles, and the act's title, every tile and the footer links are
 *       inside the viewport at the pin
 *
 * blog_posts is answered from fixtures, served OUT of order and with a newer
 * draft, so newest-first and published-only must come from the hook's own query.
 * Scroll assertions read OBSERVED state (Lenis momentum), as acting-flow does.
 */

const BLOG_ACT = '[data-qa="cinematic-blog"]';
const BLOG_STAGE = '[data-qa="blog-act-stage"]';
const GALLERY = '[data-qa="cinematic-gallery"]';
const GW_SECTION = '[data-qa="cinematic-greenworld-seq"]';
const GW_STAGE = `${GW_SECTION} [data-qa="seq-stage"]`;

const LANE_RGB = [18, 160, 59]; // #12A03B
const GOLD_RGB = [201, 165, 92]; // #C9A55C

type BlogRow = Record<string, unknown> & { slug: string; status: string };

const blogRow = (
  slug: string,
  category: "personal" | "greenworld",
  day: string,
  es: string,
  en: string,
  cover: number | null,
  status = "published",
): BlogRow => ({
  id: slug,
  slug,
  category,
  status,
  published_at: status === "published" ? new Date(`2026-09-${day}T15:00:00Z`).toISOString() : null,
  created_at: new Date(`2026-09-${day}T12:00:00Z`).toISOString(),
  updated_at: new Date(`2026-09-${day}T15:00:00Z`).toISOString(),
  title: { es, en, src: "es" },
  excerpt: { es: `Sobre ${es.toLowerCase()}.`, en: `About ${en.toLowerCase()}.`, src: "es" },
  body: { es: "Un texto corto.", en: "A short text.", src: "es" },
  meta_description: null,
  tags: [],
  cover_photo_id: cover === null ? null : MOCK_PHOTOS[cover].id,
  cover: cover === null ? null : MOCK_PHOTOS[cover],
});

/** Five published (one too many) and a newer draft, deliberately out of order. */
const blogRows = (): BlogRow[] => [
  blogRow("cuaderno-de-rodaje", "personal", "02", "Cuaderno de rodaje", "Shoot notebook", null),
  blogRow("mi-rutina-de-la-manana", "greenworld", "28", "Mi rutina de la mañana", "My morning routine", 0),
  blogRow("borrador-nuevo", "personal", "30", "Borrador nuevo", "New draft", 1, "draft"),
  blogRow("un-dia-en-el-set", "personal", "26", "Un día en el set", "A day on set", 1),
  blogRow("te-verde-en-casa", "greenworld", "22", "Té verde en casa", "Green tea at home", null),
  blogRow("bailar-en-medellin", "personal", "18", "Bailar en Medellín", "Dancing in Medellín", 2),
];
/** What the act must show, in order: the four newest published posts. */
const SHOWN = ["mi-rutina-de-la-manana", "un-dia-en-el-set", "te-verde-en-casa", "bailar-en-medellin"];

/** blog_posts from fixtures, honouring the eq filters and the order the hook asks for. */
async function routeBlogPosts(page: Page, rows: BlogRow[]) {
  await page.route("**/rest/v1/blog_posts*", (route: Route) => {
    const url = new URL(route.request().url());
    let out = [...rows];
    for (const [key, raw] of url.searchParams) {
      const m = raw.match(/^eq\.(.*)$/);
      if (m && !["select", "order", "limit", "offset"].includes(key)) {
        out = out.filter((r) => String(r[key]) === m[1]);
      }
    }
    const order = url.searchParams.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      out.sort((a, b) => {
        const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
        return dir === "desc" ? -cmp : cmp;
      });
    }
    const single = (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
    return route.fulfill({
      status: single && !out.length ? 406 : 200,
      contentType: "application/json",
      body: JSON.stringify(single ? (out[0] ?? {}) : out),
    });
  });
}

async function openBlogAct(
  page: Page,
  {
    width,
    height,
    rows = blogRows(),
    reduced = false,
  }: { width: number; height: number; rows?: BlogRow[]; reduced?: boolean },
) {
  await page.setViewportSize({ width, height });
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  await forceLanguage(page, "es");
  await routeSupabase(page);
  await routeBlogPosts(page, rows); // after routeSupabase: routes are LIFO, so this one owns the table
  const answered = page.waitForResponse((r) => r.url().includes("/rest/v1/blog_posts"));
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await answered;
  await settle(page, 900);
}

const spacerOf = (page: Page, sel: string) =>
  page.locator(sel).first().locator("xpath=ancestor::*[contains(@class,'pin-spacer')]");

/** Wheel the document to `y` — Lenis owns the scroll on this route. */
async function wheelTo(page: Page, y: number) {
  await page.mouse.move(200, 300);
  for (let i = 0; i < 260; i++) {
    const at = await page.evaluate(() => window.scrollY);
    const delta = y - at;
    if (Math.abs(delta) < 8) break;
    await page.mouse.wheel(0, Math.max(-700, Math.min(700, Math.round(delta))));
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(450);
}

const topOf = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top);

/** The pin start, trusted only once two consecutive reads agree (acting-flow). */
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

/** Wheel until `sel` genuinely holds the top of the frame; re-aim after a late refresh. */
async function engage(page: Page, sel: string, offset = 6) {
  let pinStart = await pinStartOf(page, sel);
  for (let i = 0; i < 4; i++) {
    await wheelTo(page, pinStart + offset);
    if (Math.abs(await topOf(page, sel)) <= 2) break;
    pinStart = await pinStartOf(page, sel);
  }
  return pinStart;
}

/** The distance a pinned element holds the frame for: spacer height − its own height. */
const pinDistanceOf = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)!;
    const spacer = el.closest(".pin-spacer")!;
    return spacer.getBoundingClientRect().height - el.getBoundingClientRect().height;
  }, sel);

/** "rgb(a, b, c)" / "rgba(a, b, c, d)" → numbers. */
const channels = (css: string) => (css.match(/[\d.]+/g) ?? []).map(Number);
function expectColor(css: string, rgb: number[], alpha: number, what: string) {
  const [r, g, b, a = 1] = channels(css);
  expect(
    Math.abs(r - rgb[0]) + Math.abs(g - rgb[1]) + Math.abs(b - rgb[2]),
    `${what} — got ${css}`,
  ).toBeLessThanOrEqual(3);
  expect(Math.abs(a - alpha), `${what} alpha — got ${css}`).toBeLessThan(0.02);
}

test.describe("Blog act", () => {
  test("BA1 at most four posts, newest first, each linking to its post", async ({ page }) => {
    test.setTimeout(120_000);
    await openBlogAct(page, { width: 1440, height: 900 });

    const act = page.locator(BLOG_ACT);
    await expect(act.locator('[data-qa="section-heading"]')).toHaveText("Últimos artículos");

    // Desktop: the Entry cards, in the hook's order; the draft and the fifth post are absent.
    const cards = act.locator('[data-qa="blog-act-card"]');
    await expect(cards).toHaveCount(4);
    expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")))).toEqual(SHOWN);
    for (const slug of SHOWN) {
      await expect(act.locator(`[data-qa="blog-act-card"][data-slug="${slug}"] a`)).toHaveAttribute(
        "href",
        `/blog/${slug}`,
      );
    }
    await expect(act.locator('[data-qa="blog-act-tile"]').first()).toBeHidden();

    // The footer line.
    await expect(act.locator('[data-qa="blog-act-all"]')).toHaveAttribute("href", "/blog");
    await expect(act.locator('[data-qa="blog-act-all"]')).toContainText("Ver todos los artículos");
    await expect(act.locator('[data-qa="blog-act-gw"]')).toHaveAttribute("href", "/blog?c=greenworld");

    // Phone: the same four, as tiles, each its own link.
    await page.setViewportSize({ width: 390, height: 844 });
    const tiles = act.locator('[data-qa="blog-act-tile"]');
    await expect(tiles.first()).toBeVisible();
    expect(await tiles.evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")))).toEqual(SHOWN);
    expect(await tiles.evaluateAll((els) => els.map((e) => e.getAttribute("href")))).toEqual(
      SHOWN.map((s) => `/blog/${s}`),
    );
    await expect(cards.first()).toBeHidden();

    // A link is a link: the first tile takes the reader to its post.
    await tiles.first().evaluate((el) => (el as HTMLAnchorElement).click());
    await page.waitForURL(`**/blog/${SHOWN[0]}`);
  });

  test("BA2 1440×900 — the act holds for ≥100vh and neither neighbour is disturbed", async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const VH = 900;
    const DWELL = 1.2 * VH;
    await openBlogAct(page, { width: 1440, height: VH });
    await expect(spacerOf(page, BLOG_STAGE), "the act is pinned").toHaveCount(1);

    // ── the act ABOVE: the gallery keeps its +=120% and engages at its own spacer top ──
    expect(
      Math.abs((await pinDistanceOf(page, GALLERY)) - DWELL),
      "the gallery keeps its +=120%",
    ).toBeLessThanOrEqual(14);
    await engage(page, GALLERY);
    expect(
      Math.abs(await topOf(page, GALLERY)),
      "the gallery engages at its own spacer top",
    ).toBeLessThanOrEqual(2);

    // ── the act ITSELF: engage → hold ≥100vh → release, on the story dwell ──
    expect(
      Math.abs((await pinDistanceOf(page, BLOG_STAGE)) - DWELL),
      "the Blog act dwells for +=120%",
    ).toBeLessThanOrEqual(14);
    const pinStart = await engage(page, BLOG_STAGE);
    expect(Math.abs(await topOf(page, BLOG_STAGE)), "blog pinned at engage").toBeLessThanOrEqual(2);

    // The entrance finished before the pin engaged: the frame is settled.
    const arrived = await page
      .locator('[data-qa="blog-act-card"]')
      .evaluateAll((els) => els.map((el) => Number(getComputedStyle(el.parentElement!).opacity)));
    expect(Math.min(...arrived), "every card has arrived when the hold begins").toBeGreaterThan(0.99);

    await wheelTo(page, pinStart + 0.5 * VH);
    expect(Math.abs(await topOf(page, BLOG_STAGE)), "still pinned half a viewport in").toBeLessThanOrEqual(2);
    await wheelTo(page, pinStart + VH + 10);
    expect(Math.abs(await topOf(page, BLOG_STAGE)), "still pinned a full viewport in").toBeLessThanOrEqual(2);
    await page.screenshot({ path: shot("HOME.BLOGACT.1-1440-dwell.png") });

    await wheelTo(page, pinStart + DWELL + 320);
    expect(await topOf(page, BLOG_STAGE), "the act released after its dwell").toBeLessThan(-200);

    // ── the act BELOW: Green World engages at ITS spacer top, its +=300% intact ──
    // The falsifier: a late pin that staled the triggers beneath it would fire
    // Green World at an offset that no longer matches where its spacer sits.
    expect(
      Math.abs((await pinDistanceOf(page, GW_STAGE)) - 3 * VH),
      "Green World keeps its +=300%",
    ).toBeLessThanOrEqual(14);
    await engage(page, GW_STAGE);
    expect(
      Math.abs(await topOf(page, GW_STAGE)),
      "Green World engages at its own spacer top",
    ).toBeLessThanOrEqual(2);

    expect(errors, "no page errors through the sweep").toEqual([]);
  });

  test("BA3 390×844 — four tiles ≤72px, the whole act inside one screen at the pin", async ({ page }) => {
    test.setTimeout(240_000);
    const VW = 390;
    const VH = 844;
    await openBlogAct(page, { width: VW, height: VH });

    const tiles = page.locator('[data-qa="blog-act-tile"]');
    await expect(tiles).toHaveCount(4);
    for (const h of await tiles.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
      expect(h, "a tile is compact").toBeLessThanOrEqual(72);
      expect(h, "a tile is compact, not collapsed").toBeGreaterThanOrEqual(60);
    }

    const pinStart = await engage(page, BLOG_STAGE);
    expect(Math.abs(await topOf(page, BLOG_STAGE)), "blog pinned at engage").toBeLessThanOrEqual(2);

    const boxes = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      const act = document.querySelector('[data-qa="cinematic-blog"]')!;
      return {
        title: box(act.querySelector('[data-qa="section-heading"]')!),
        tiles: Array.from(act.querySelectorAll('[data-qa="blog-act-tile"]')).map(box),
        links: Array.from(act.querySelectorAll('[data-qa="blog-act-all"], [data-qa="blog-act-gw"]')).map(box),
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(boxes.links, "both footer links render").toHaveLength(2);
    const parts: [string, { top: number; bottom: number; left: number; right: number }][] = [
      ["the act's title", boxes.title],
      ...boxes.tiles.map((t, i): [string, typeof t] => [`tile ${i + 1}`, t]),
      ...boxes.links.map((l, i): [string, typeof l] => [`footer link ${i + 1}`, l]),
    ];
    for (const [what, b] of parts) {
      expect(b.top, `${what} below the frame's top`).toBeGreaterThanOrEqual(0);
      expect(b.bottom, `${what} inside the 844px frame`).toBeLessThanOrEqual(VH);
      expect(b.left, `${what} inside the frame's left edge`).toBeGreaterThanOrEqual(0);
      expect(b.right, `${what} inside the frame's right edge`).toBeLessThanOrEqual(VW);
    }
    expect(boxes.scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(VW);
    await page.screenshot({ path: shot("HOME.BLOGACT.1-390-pin.png") });

    await wheelTo(page, pinStart + 0.6 * 1.2 * VH);
    expect(Math.abs(await topOf(page, BLOG_STAGE)), "the pin holds mid-dwell").toBeLessThanOrEqual(2);
  });

  test("BA4 reduced motion — no pin, a static and visible act", async ({ page }) => {
    test.setTimeout(120_000);
    await openBlogAct(page, { width: 1440, height: 900, reduced: true });

    await expect(spacerOf(page, BLOG_STAGE), "unpinned under reduced motion").toHaveCount(0);
    await page.locator(BLOG_STAGE).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const stage = await page.locator(BLOG_STAGE).boundingBox();
    expect(stage!.height, "the act still fills its stage").toBeGreaterThanOrEqual(899);
    for (const sel of [
      `${BLOG_ACT} [data-qa="section-heading"]`,
      `${BLOG_ACT} [data-qa="blog-act-rule"]`,
      ...SHOWN.map((s) => `[data-qa="blog-act-card"][data-slug="${s}"]`),
      '[data-qa="blog-act-footer"]',
    ]) {
      const el = page.locator(sel);
      await expect(el).toBeVisible();
      const style = await el.evaluate((e) => {
        // A card's tweened box is its list item; everything else tweens itself.
        const tweened = e.closest("li") ?? e;
        const cs = getComputedStyle(tweened);
        return { opacity: Number(cs.opacity), transform: cs.transform };
      });
      expect(style.opacity, `${sel} painted`).toBeGreaterThan(0.99);
      expect(style.transform, `${sel} settled, no tween offset`).toBe("none");
    }
  });

  test("BA5 no published posts — the act is absent; the gallery hands straight to Green World", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // A draft only: the table answers, but nothing is published.
    await openBlogAct(page, {
      width: 1440,
      height: 900,
      rows: [blogRow("solo-borrador", "personal", "30", "Solo borrador", "Draft only", null, "draft")],
    });

    const act = page.locator(BLOG_ACT);
    await expect(act).toHaveAttribute("data-empty", "true");
    expect((await act.boundingBox())?.height ?? 0, "the act takes no height").toBeLessThanOrEqual(1);
    await expect(page.locator(BLOG_STAGE)).toHaveCount(0);
    await expect(act.locator('[data-qa="section-heading"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="blog-act-tile"], [data-qa="blog-act-card"]')).toHaveCount(0);

    // Directly: the first box with height after the gallery (or its pin-spacer)
    // is Green World, and the two meet without a gap.
    const seam = await page.evaluate(
      ({ g, w }) => {
        const outer = (el: Element) =>
          el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el;
        const gallery = outer(document.querySelector(g)!);
        let next = gallery.nextElementSibling;
        while (next && next.getBoundingClientRect().height === 0) next = next.nextElementSibling;
        const gw = document.querySelector(w)!;
        return {
          nextIsGreenWorld: !!next && (next === gw || next.contains(gw)),
          gap: gw.getBoundingClientRect().top - gallery.getBoundingClientRect().bottom,
        };
      },
      { g: GALLERY, w: GW_SECTION },
    );
    expect(seam.nextIsGreenWorld, "Green World follows the gallery directly").toBe(true);
    expect(Math.abs(seam.gap), "no room between them").toBeLessThanOrEqual(1);
  });

  test("BA6 the lane — green on a greenworld tile and card, gold on a personal one", async ({ page }) => {
    test.setTimeout(150_000);
    // One shown greenworld post is a Capacitación — the longest kind label.
    const rows = blogRows().map((r) => (r.slug === "te-verde-en-casa" ? { ...r, gw_kind: "capacitacion" } : r));
    await openBlogAct(page, { width: 390, height: 844, rows });

    const tileLane = (slug: string) =>
      page.locator(`[data-qa="blog-act-tile"][data-slug="${slug}"]`).evaluate((el) => ({
        lane: el.getAttribute("data-lane"),
        frame: getComputedStyle(el.querySelector('[data-qa="blog-act-tile-frame"]')!).borderTopColor,
        rule: getComputedStyle(el.querySelector('[data-qa="blog-act-tile-rule"]')!).backgroundColor,
        meta: getComputedStyle(el.querySelector('[data-qa="blog-act-tile-meta"]')!).color,
        label: el.querySelector('[data-qa="blog-act-tile-meta"]')!.textContent ?? "",
      }));

    const gw = await tileLane("mi-rutina-de-la-manana");
    expect(gw.lane).toBe("greenworld");
    expectColor(gw.frame, LANE_RGB, 0.4, "greenworld tile frame");
    expectColor(gw.rule, LANE_RGB, 1, "greenworld tile hairline");
    expectColor(gw.meta, LANE_RGB, 1, "greenworld tile label + date");
    // `\s`: the dot is bound to the word before it by a no-break space (META_SEP, BLOG.GW.2).
    expect(gw.label).toMatch(/^Green World\s· 28 sept\.? 2026$/i);

    const personal = await tileLane("un-dia-en-el-set");
    expect(personal.lane).toBe("personal");
    expectColor(personal.frame, GOLD_RGB, 0.4, "personal tile frame");
    expectColor(personal.rule, GOLD_RGB, 1, "personal tile hairline");
    expectColor(personal.meta, GOLD_RGB, 1, "personal tile label + date");
    expect(personal.label).toMatch(/^Personal\s· 26 sept\.? 2026$/i);

    // BLOG.GW.2a: a kinded greenworld tile leads with its kind — the frame carries Green World.
    const kinded = await tileLane("te-verde-en-casa");
    expectColor(kinded.meta, LANE_RGB, 1, "kinded greenworld tile kind + date");
    expect(kinded.label).toMatch(/^Capacitación\s· 22 sept\.? 2026$/i);

    // …and at 390×844 no tile's caps line is truncated: its date is whole.
    const caps = await page.locator('[data-qa="blog-act-tile-meta"]').evaluateAll((els) =>
      els.map((el) => ({ text: el.textContent ?? "", scroll: el.scrollWidth, client: el.clientWidth })),
    );
    expect(caps).toHaveLength(4);
    for (const c of caps) {
      expect(c.scroll, `"${c.text}" fits its caps line`).toBeLessThanOrEqual(c.client);
    }

    // The cards walk the same lane at 1440: the hairline and date line in green
    // for a greenworld post; no hairline and a gold date for a personal one.
    await page.setViewportSize({ width: 1440, height: 900 });
    const cardLane = (slug: string) =>
      page.locator(`[data-qa="blog-act-card"][data-slug="${slug}"]`).evaluate((el) => {
        const rule = el.querySelector<HTMLElement>('[data-qa="blog-act-card-rule"]');
        return {
          rule: rule ? getComputedStyle(rule).backgroundColor : null,
          date: getComputedStyle(el.querySelector('[data-qa="blog-act-card-date"]')!).color,
        };
      });
    const gwCard = await cardLane("te-verde-en-casa");
    // The card is unchanged by BLOG.GW.2a: it still names the lane before the kind.
    await expect(
      page.locator('[data-qa="blog-act-card"][data-slug="te-verde-en-casa"] [data-qa="blog-act-card-date"]'),
    ).toHaveText(/^Green World\s· Capacitación\s· 22 sept\.? 2026$/i);
    expectColor(gwCard.rule ?? "", LANE_RGB, 1, "greenworld card hairline");
    expectColor(gwCard.date, LANE_RGB, 1, "greenworld card date line");
    const personalCard = await cardLane("bailar-en-medellin");
    expect(personalCard.rule, "a personal card walks no lane").toBeNull();
    expectColor(personalCard.date, GOLD_RGB, 1, "personal card date line");

    // "Green World →" belongs to the lane: absent when no shown post walks it.
    await page.unroute("**/rest/v1/blog_posts*");
    await routeBlogPosts(page, blogRows().filter((r) => r.category === "personal"));
    const answered = page.waitForResponse((r) => r.url().includes("/rest/v1/blog_posts"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await answered;
    await expect(page.locator('[data-qa="blog-act-card"]')).toHaveCount(3);
    await expect(page.locator('[data-qa="blog-act-gw"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="blog-act-all"]')).toHaveCount(1);
  });

  test("BA7 768×1024 — a frame too short for the 2×2 takes the tiles, all inside it at the pin", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const VW = 768;
    const VH = 1024;
    await openBlogAct(page, { width: VW, height: VH });

    // The 2×2 needs ≥1140px of frame; this one gets the phone tiles instead.
    await expect(page.locator('[data-qa="blog-act-tile"]')).toHaveCount(4);
    await expect(page.locator('[data-qa="blog-act-tile"]').first()).toBeVisible();
    await expect(page.locator('[data-qa="blog-act-card"]').first()).toBeHidden();

    await engage(page, BLOG_STAGE);
    expect(Math.abs(await topOf(page, BLOG_STAGE)), "blog pinned at engage").toBeLessThanOrEqual(2);

    const boxes = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      const act = document.querySelector('[data-qa="cinematic-blog"]')!;
      return {
        title: box(act.querySelector('[data-qa="section-heading"]')!),
        tiles: Array.from(act.querySelectorAll('[data-qa="blog-act-tile"]')).map(box),
        links: Array.from(act.querySelectorAll('[data-qa="blog-act-all"], [data-qa="blog-act-gw"]')).map(box),
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(boxes.links, "both footer links render").toHaveLength(2);
    const parts: [string, { top: number; bottom: number; left: number; right: number }][] = [
      ["the act's title", boxes.title],
      ...boxes.tiles.map((t, i): [string, typeof t] => [`tile ${i + 1}`, t]),
      ...boxes.links.map((l, i): [string, typeof l] => [`footer link ${i + 1}`, l]),
    ];
    for (const [what, b] of parts) {
      expect(b.top, `${what} below the frame's top`).toBeGreaterThanOrEqual(0);
      expect(b.bottom, `${what} inside the 1024px frame`).toBeLessThanOrEqual(VH);
      expect(b.left, `${what} inside the frame's left edge`).toBeGreaterThanOrEqual(0);
      expect(b.right, `${what} inside the frame's right edge`).toBeLessThanOrEqual(VW);
    }
    expect(boxes.scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(VW);
    await page.screenshot({ path: shot("HOME.BLOGACT.1a-768x1024-pin.png") });
  });
});
