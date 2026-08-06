import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * MARQUEE.1 — the nav/banner chrome block.
 *
 * Three defects from Joey's on-screen review, each with a law here that fails
 * if the defect returns:
 *
 *  1. THE NAV HAS NO SEAM. Verbatim: "half the nav bar is showing the top of
 *     the video and the top half of it is dark you can see the line with the
 *     navbar text." The cause was NOT a short nav backdrop — on the cinematic
 *     home the nav has none (NAV.CLEAR.1 keeps it transparent). It was the
 *     banner's own 38px flow spacer pushing the hero to y=38 while the nav
 *     spans 0-75, so the spacer/hero boundary cut straight across the nav's
 *     text row. The regression test is therefore not "is there a background"
 *     but "is anything reachable behind the nav at any height": an OPAQUE
 *     ground must sit under every point of the nav's content box.
 *
 *  2. THE BANNER OWNS ITS HAIRLINES. Verbatim: "the line on the top that boxes
 *     the marquee/banner disappears when you scroll down and we want that to
 *     remain." The bar was pinned at a hardcoded `top-[60px] md:top-[68px]`
 *     while the header really measures 70/70/75 — so its 2px gold top border
 *     sat UNDER the z-50 header and vanished the moment the header took its
 *     scrolled ground. The law: the bar's top edge is flush with the header's
 *     bottom edge, and both hairlines are 2px gold, in every scroll state.
 *
 *  3. ONE TRACK ON SMALL SCREENS. Verbatim: "on mobile I think the whole
 *     banner needs to scroll." The pinned label cap was ~370px wide on a 390px
 *     screen, leaving no window for the marquee. Below the site's own 1200px
 *     desktop boundary (NAV.FIT.1) the caps collapse and label+text scroll as
 *     one diamond-separated track, with the dismiss control still tappable.
 *
 * Plus the readability law the three share: the track runs at a CONSTANT
 * px/second at every width — duration derived from the measured track length,
 * not a fixed 180s — and its edges are masked so a word dissolves instead of
 * being guillotined at a cap.
 */

const BAR = '[data-qa="events-banner"]';
const GROUND = '[data-qa="events-banner-navground"]';
const TRACK = '[data-qa="events-banner-track"]';
const CAP = '[data-qa="events-banner-cap"]';
const DISMISS = '[data-qa="events-banner-dismiss"]';
const SEGMENT = '[data-qa="events-banner-segment"]';
const HERO = '[data-qa="cinematic-section"]';

const GOLD = "rgb(201, 165, 92)";

/** A board whose main banner runs on home, in both languages. */
const BOARD = {
  pageVisible: true,
  homeVisible: false, // the act stays dark, so the marquee is the subject
  mainBanner: {
    enabled: true,
    label: { es: "EVENTOS", en: "EVENTS" },
    text: {
      es: "ESTE SÁBADO 8 DE AGOSTO A LAS 8:00PM",
      en: "THIS SATURDAY, AUGUST 8TH AT 8:00PM",
    },
    link: "",
    pages: { home: true, greenWorld: true, titans: true },
    bold: false,
    textColor: "#C9A55C",
  },
  items: [],
};

async function open(
  page: Page,
  opts: { width: number; height: number; lang?: "es" | "en"; path?: string } ,
) {
  await page.setViewportSize({ width: opts.width, height: opts.height });
  await forceLanguage(page, opts.lang ?? "es");
  await routeSupabase(page, { eventsBoard: BOARD });
  await page.goto(opts.path ?? "/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await expect(page.locator(BAR)).toBeVisible();
}

/** The header's and the bar's measured edges, in one round trip. */
const chromeGeometry = (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector("header")!;
    const bar = document.querySelector('[data-qa="events-banner"]')!;
    const h = header.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    return {
      headerBottom: h.bottom,
      headerHeight: h.height,
      barTop: b.top,
      barHeight: b.height,
      borderTop: `${cs.borderTopWidth} ${cs.borderTopColor}`,
      borderBottom: `${cs.borderBottomWidth} ${cs.borderBottomColor}`,
    };
  });

/* ───────────────── law 1 — the nav's full content box is backed ───────────────── */

test.describe("MARQUEE.1 — no seam across the nav", () => {
  for (const vp of [
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "phone-390", width: 390, height: 844 },
  ]) {
    test(`${vp.name} — an opaque ground covers the nav's full content box`, async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, vp);

      const result = await page.evaluate(() => {
        const header = document.querySelector("header")!;
        const ground = document.querySelector('[data-qa="events-banner-navground"]');
        if (!ground) return null;

        // The ground is `pointer-events-none` on purpose — it must never
        // intercept a nav click — so it is invisible to hit testing. Coverage
        // is therefore proved geometrically: an opaque box that contains the
        // header's box leaves nothing behind the nav able to show through, and
        // that is exactly what the seam needed.
        const alpha = getComputedStyle(ground).backgroundColor.match(/[\d.]+/g);
        const hb = header.getBoundingClientRect();
        const gb = ground.getBoundingClientRect();
        const hero = document.querySelector('[data-qa="cinematic-section"]');
        return {
          opaque: !alpha || alpha.length < 4 || Number(alpha[3]) === 1,
          coversTop: gb.top <= hb.top + 0.5,
          coversBottom: gb.bottom >= hb.bottom - 0.5,
          coversWidth: gb.left <= 0.5 && gb.right >= window.innerWidth - 0.5,
          groundHeight: Math.round(gb.height * 10) / 10,
          headerHeight: Math.round(hb.height * 10) / 10,
          // The seam's own source: the first page pixel sits INSIDE the nav box
          // (that is what made the line), and must be hidden behind the ground.
          heroTop: hero ? Math.round(hero.getBoundingClientRect().top * 10) / 10 : null,
        };
      });

      expect(result, "the chrome paints a nav ground").not.toBeNull();
      expect(result!.opaque, "the nav ground is fully opaque").toBe(true);
      expect(result!.coversTop, "the ground starts at or above the nav's top edge").toBe(true);
      expect(
        result!.coversBottom,
        `the ground reaches the nav's bottom edge (${result!.groundHeight} vs ${result!.headerHeight})`,
      ).toBe(true);
      expect(result!.coversWidth, "…across the full width").toBe(true);
      // The falsifier for the original defect: the hero's top edge still falls
      // inside the nav's box, so a ground that stopped short would put that
      // boundary back on screen, mid-nav, exactly where Joey saw it.
      expect(result!.heroTop, "the page's first edge is still inside the nav box").toBeLessThan(
        result!.headerHeight,
      );
    });
  }

  test("dismissing takes the ground with it and the hero returns to y=0", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, { width: 1440, height: 900 });

    // With the banner up, the spacer holds the hero below the chrome.
    expect(await page.locator(HERO).first().evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(0);

    await page.locator(DISMISS).click();
    await page.waitForTimeout(600);

    // Dismissed: no bar, no ground, and the hero runs to the top again — which
    // is why the transparent nav has no seam in THAT state either.
    await expect(page.locator(BAR)).toHaveCount(0);
    await expect(page.locator(GROUND)).toHaveCount(0);
    const heroTop = await page.locator(HERO).first().evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(heroTop), "the hero starts at the viewport top once dismissed").toBeLessThanOrEqual(1);
  });
});

/* ───────────── law 2 — the bar owns both hairlines, in every state ───────────── */

test.describe("MARQUEE.1 — the banner owns its frame", () => {
  for (const vp of [
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "phone-390", width: 390, height: 844 },
  ]) {
    test(`${vp.name} — flush under the nav with both gold hairlines, landing and scrolled`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await open(page, vp);

      const landing = await chromeGeometry(page);
      expect(
        Math.abs(landing.barTop - landing.headerBottom),
        `landing: the bar's top edge is the header's bottom edge (${landing.barTop} vs ${landing.headerBottom})`,
      ).toBeLessThanOrEqual(0.6);
      expect(landing.borderTop, "landing: 2px gold top hairline").toBe(`2px ${GOLD}`);
      expect(landing.borderBottom, "landing: 2px gold bottom hairline").toBe(`2px ${GOLD}`);

      // …and the state Joey caught it in: scrolled, where the header takes its
      // own opaque ground and used to swallow the bar's top line.
      await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.4, behavior: "instant" as ScrollBehavior }));
      await page.waitForTimeout(900);

      const scrolled = await chromeGeometry(page);
      expect(
        Math.abs(scrolled.barTop - scrolled.headerBottom),
        `scrolled: still flush (${scrolled.barTop} vs ${scrolled.headerBottom})`,
      ).toBeLessThanOrEqual(0.6);
      expect(scrolled.borderTop, "scrolled: the TOP hairline is still there").toBe(`2px ${GOLD}`);
      expect(scrolled.borderBottom, "scrolled: the bottom hairline is still there").toBe(`2px ${GOLD}`);

      // Nothing paints over the bar's top edge: the header stops where it ends.
      const covered = await page.evaluate(() => {
        const bar = document.querySelector('[data-qa="events-banner"]')!;
        const b = bar.getBoundingClientRect();
        const header = document.querySelector("header")!;
        const stack = document.elementsFromPoint(Math.round(window.innerWidth / 2), b.top + 1);
        return stack.includes(header);
      });
      expect(covered, "the header does not overlap the bar's top hairline").toBe(false);

      await page.screenshot({ path: shot(`marquee-${vp.name}-scrolled.png`) });
    });
  }
});

/* ──────────── law 3 — caps at desktop, one track at tablet and below ──────────── */

test.describe("MARQUEE.1 — the responsive track", () => {
  test("desktop 1440 — the caps stay pinned and only the centre scrolls", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, { width: 1440, height: 900 });

    const caps = page.locator(CAP);
    await expect(caps).toHaveCount(2);
    for (const cap of await caps.all()) await expect(cap).toBeVisible();

    // The pinned caps carry the label, so the moving track does not repeat it.
    const seg = await page.locator(SEGMENT).first().innerText();
    expect(seg.toUpperCase()).toContain("SÁBADO");
    expect(seg.toUpperCase(), "the label rides in the caps, not the track").not.toContain("EVENTOS");
  });

  for (const vp of [
    { name: "tablet-1024", width: 1024, height: 768 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "phone-390", width: 390, height: 844 },
  ]) {
    test(`${vp.name} — caps collapse and the WHOLE message scrolls as one track`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await open(page, vp);

      // No pinned cap is rendered at all below the site's 1200px boundary.
      const visibleCaps = await page
        .locator(CAP)
        .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).length);
      expect(visibleCaps, "no pinned caps below 1200").toBe(0);

      // Label AND text travel together, diamond separated.
      const seg = (await page.locator(SEGMENT).first().innerText()).toUpperCase();
      expect(seg, "the label scrolls with the message").toContain("EVENTOS");
      expect(seg, "…and so does the text").toContain("SÁBADO");
      expect(seg, "…separated by the diamond").toContain("◆");

      // The dismiss control stays a real target, floating above the track.
      const x = page.locator(DISMISS);
      await expect(x).toBeVisible();
      const box = (await x.boundingBox())!;
      expect(box.width, "the dismiss target is at least 44px wide").toBeGreaterThanOrEqual(43);
      const gap = vp.width - (box.x + box.width);
      expect(Math.abs(gap), "…and it is pinned to the right edge").toBeLessThanOrEqual(1);

      await page.screenshot({ path: shot(`marquee-${vp.name}-landing.png`) });

      // And it works.
      await x.click();
      await page.waitForTimeout(500);
      await expect(page.locator(BAR)).toHaveCount(0);
    });
  }
});

/* ─────────── the readability law — constant speed, masked track edges ─────────── */

test.describe("MARQUEE.1 — readability", () => {
  test("the track runs at the same px/second at every width", async ({ page }) => {
    test.setTimeout(180_000);
    const speeds: Record<string, number> = {};

    for (const vp of [
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "phone-390", width: 390, height: 844 },
    ]) {
      await open(page, vp);
      const s = await page.evaluate(() => {
        const track = document.querySelector('[data-qa="events-banner-track"]')!;
        const period = track.scrollWidth / 2; // the -50% loop's travel
        const secs = parseFloat(getComputedStyle(track).animationDuration);
        return period / secs;
      });
      speeds[vp.name] = Math.round(s * 10) / 10;
    }

    const values = Object.values(speeds);
    const spread = Math.max(...values) - Math.min(...values);
    expect(
      spread,
      `one speed at every width, not one duration: ${JSON.stringify(speeds)}`,
    ).toBeLessThanOrEqual(3);
    // A fixed 180s duration produced ~21px/s on desktop; the phone's long track
    // is the reason this is a rate rather than a time.
    for (const [name, v] of Object.entries(speeds)) {
      expect(v, `${name} moves at a readable rate`).toBeGreaterThan(30);
      expect(v, `${name} is not a blur`).toBeLessThan(90);
    }
  });

  test("the track's edges are masked, so a word dissolves instead of being cut", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await open(page, { width: 1440, height: 900 });
    const mask = await page
      .locator('[data-qa="events-banner-window"]')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return cs.maskImage || cs.webkitMaskImage || "none";
      });
    expect(mask, "an edge fade is applied to the scrolling window").toContain("linear-gradient");
    expect(mask, "…that starts transparent").toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  });
});
