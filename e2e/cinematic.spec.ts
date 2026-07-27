import { test, expect } from "@playwright/test";
import { attachDiagnostics, scrollThrough, shot, BRICK } from "./_helpers";

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
    // prove the track advances on its own over a 2s window.
    await page.mouse.move(5, 5);
    await page.waitForTimeout(150);
    const t0 = await readTransform();
    await page.waitForTimeout(2000);
    const t1 = await readTransform();
    expect(t0, "marquee should be transformed by GSAP").not.toBe("none");
    expect(t1, "marquee transform should advance over 2s (self-driving)").not.toBe(t0);

    // Hover the marquee → it must pause: transform stays put over 500ms.
    // Hover the viewport-sized wrapper (not the ~19k-px-wide track, whose
    // centre is far off-screen and therefore not hoverable).
    await page.locator('[data-qa="cinematic-marquee"]').hover();
    await page.waitForTimeout(200); // let the pause take effect
    const h0 = await readTransform();
    await page.waitForTimeout(500);
    const h1 = await readTransform();
    expect(h1, "marquee transform should be stable while hovered (paused)").toBe(h0);
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
   * carry W2 "Center Plate & Rules" — a bounded plate, two vertical hairlines,
   * and no phone lockup or edge veil anywhere in the section — while 390 must
   * carry V1 "Edge Veil", exactly one lockup and one veil per slide over a cover
   * photo, and no plate. Both halves are asserted so a split that inverts fails
   * too.
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
   * WIDE (W2 "Center Plate & Rules"):
   *  4. UNVEILED — nothing with a gradient paints inside the plate box, and the
   *     retired WIDE_VEIL does not paint anywhere in the section. The lockup
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

    // The retired flat wash does not paint anywhere in the section.
    const washes = await reel.evaluate((sec) =>
      Array.from(sec.querySelectorAll("*"))
        .map((el) => getComputedStyle(el as HTMLElement).backgroundImage)
        .filter((bg) => bg.includes("gradient")),
    );
    expect(washes, "WIDE_VEIL is deleted, not merely hidden").toEqual([]);
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
