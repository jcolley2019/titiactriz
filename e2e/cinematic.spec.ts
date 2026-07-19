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
  const SETTING_MATCH = "cinematic_hero_photo";

  const heroSrc = (page: import("@playwright/test").Page) =>
    page.locator(HERO).first().getAttribute("src");

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
    await page.route(`**/site_settings*${SETTING_MATCH}*`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
    );
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    const order = await galleryOrder(page);
    expect(order.length, "gallery should expose the published pool").toBeGreaterThan(1);
    const hero = await heroSrc(page);
    expect(hero, "default hero should be the first published photo").toBe(order[0]);
  });

  test("honors cinematic_hero_photo when set to a non-default photo", async ({ page }) => {
    // First, learn the real published pool with the key forced absent.
    await page.route(`**/site_settings*${SETTING_MATCH}*`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
    );
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);
    const order = await galleryOrder(page);
    const defaultHero = await heroSrc(page);
    expect(order.length).toBeGreaterThan(1);
    const chosen = order[1]; // a genuinely different, non-default published photo
    expect(chosen).not.toBe(order[0]);

    // Now mock the setting to that photo's URL (the reader accepts id OR url).
    await page.unroute(`**/site_settings*${SETTING_MATCH}*`);
    await page.route(`**/site_settings*${SETTING_MATCH}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ value: chosen }),
      }),
    );
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

const VENTURES = '[data-qa="cinematic-ventures"]';
const GW_PANEL = '[data-qa="venture-green-world"]';
const TITANS_PANEL = '[data-qa="venture-titans"]';
const GW_CTA = '[data-qa="venture-green-world-cta"]';
const TITANS_CTA = '[data-qa="venture-titans-cta"]';

test.describe("cinematic — ventures split-panel (TA.6b) desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("renders both panels; GW href matches the Green World page, Titans routes internally", async ({
    page,
  }) => {
    const diag = attachDiagnostics(page);

    // Canonical Green World shop destination straight from its own page CTA.
    await page.goto("/green-world", { waitUntil: "domcontentloaded" });
    await settle(page, 500);
    const pageShopHref = await page
      .getByRole("link", { name: /shop green world/i })
      .first()
      .getAttribute("href");
    expect(pageShopHref, "green world page has a shop destination").toBeTruthy();

    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    await expect(page.locator(VENTURES), "ventures section present").toHaveCount(1);
    await expect(page.locator(GW_PANEL)).toBeVisible();
    await expect(page.locator(TITANS_PANEL)).toBeVisible();

    const gwHref = await page.locator(GW_CTA).getAttribute("href");
    const titansHref = await page.locator(TITANS_CTA).getAttribute("href");

    expect(gwHref, "ventures GW href matches the Green World page destination").toBe(pageShopHref);
    expect(gwHref ?? "", "GW CTA points at the external store").toContain("world-food.com");
    await expect(page.locator(GW_CTA)).toHaveAttribute("target", "_blank");
    await expect(page.locator(GW_CTA)).toHaveAttribute("rel", /noopener/);

    expect(titansHref ?? "", "Titans routes internally to its page").toContain("/titans-agency");
    expect(titansHref ?? "", "Titans link is not external").not.toContain("http");

    await page.locator(VENTURES).scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.screenshot({ path: shot(`TA.${BRICK}-ventures-desktop.png`) });

    expect(diag.consoleErrors, "console errors on ventures").toEqual([]);
    expect(diag.failedResponses, "failed requests on ventures").toEqual([]);
  });

  test("hovering a half expands it (flex width shift)", async ({ page }) => {
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 800);

    const gw = page.locator(GW_PANEL);
    const titans = page.locator(TITANS_PANEL);
    await gw.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800); // let the entrance reveal settle

    const gwBefore = (await gw.boundingBox())!.width;
    const titansBefore = (await titans.boundingBox())!.width;

    await gw.hover();
    await page.waitForTimeout(750); // flex-grow transition (500ms) + margin
    await page.screenshot({ path: shot(`TA.${BRICK}-ventures-hover.png`) });

    const gwAfter = (await gw.boundingBox())!.width;
    const titansAfter = (await titans.boundingBox())!.width;

    expect(gwAfter, "hovered Green World half widens").toBeGreaterThan(gwBefore + 10);
    expect(titansAfter, "the other half narrows").toBeLessThan(titansBefore);
  });
});

test.describe("cinematic — ventures split-panel (TA.6b) mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("panels stack full-width with working CTAs", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 600);

    await page.locator(VENTURES).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(page.locator(GW_PANEL)).toBeVisible();
    await expect(page.locator(TITANS_PANEL)).toBeVisible();
    await expect(page.locator(GW_CTA)).toBeVisible();
    await expect(page.locator(TITANS_CTA)).toBeVisible();

    await page.screenshot({ path: shot(`TA.${BRICK}-ventures-mobile.png`) });

    expect(diag.consoleErrors, "console errors (ventures mobile)").toEqual([]);
    expect(diag.failedResponses, "failed requests (ventures mobile)").toEqual([]);
  });
});

test.describe("cinematic — ventures split-panel (TA.6b) reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("static side-by-side with both CTAs functional", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 500);

    await page.locator(VENTURES).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await expect(page.locator(GW_PANEL)).toBeVisible();
    await expect(page.locator(TITANS_PANEL)).toBeVisible();

    const gwCta = page.locator(GW_CTA);
    const titansCta = page.locator(TITANS_CTA);
    await expect(gwCta).toBeVisible();
    await expect(titansCta).toBeVisible();
    expect(await gwCta.getAttribute("href"), "GW CTA still has its destination").toContain(
      "world-food.com",
    );
    expect(await titansCta.getAttribute("href"), "Titans CTA still routes internally").toContain(
      "/titans-agency",
    );

    await page.screenshot({ path: shot(`TA.${BRICK}-ventures-reduced.png`) });
  });
});
