import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { forceLanguage, routeSupabase } from "./_admin";
import { ACTING_ACT_ENABLED } from "../src/lib/ventures";

/**
 * PORT.ACT.4 — the Acting act's PLACE in the cinematic home flow.
 *
 * Brick 2 proved the act's composition and brick 3 gave it an editor. This file
 * proves the third thing, which neither of those can: that dropping a new
 * PINNED act into the middle of the page leaves the page it landed in intact.
 *
 * Two laws, both falsifiable on the live render:
 *
 *  1. ORDER — the act sits between the reel and the gallery, exactly where the
 *     PORT.ACT.1 proposal placed it: it is built in the reel's own grammar, so
 *     it belongs beside the reel, and the gallery still follows so the
 *     photographic run stays together. Asserted as the whole page's act
 *     sequence, not just the two neighbours, so a stray act can't slip in.
 *
 *  2. NEITHER NEIGHBOUR IS DISTURBED — the act above keeps its full +=300%
 *     scrub, and the act BELOW still engages at its own spacer top. That second
 *     half is the real hazard and the reason this file exists: a pinned trigger
 *     created above existing ones leaves theirs measured against a page that
 *     just got 120vh taller, and every later act then pins early by the new
 *     pin's distance (measured at ~2160px when the reel rebuilt out of order —
 *     the Green World canvas swallowed the gallery). `ScrollTrigger.sort()`
 *     before `refresh()` is the fix, in both CinematicReel and CinematicActing;
 *     this is the proof that it holds with the two of them stacked.
 *
 * While ACTING_ACT_ENABLED is false the ORDER test still runs — against the
 * dark order — so this file cannot rot silently while the act waits for
 * Cristyna's credits. Everything else activates the moment the flag flips.
 *
 * Scroll assertions read OBSERVED state, never the aimed position: Lenis
 * momentum means the landed offset is not the requested one.
 *
 * Evidence: _qa/PORT.ACT.4-{viewport}-dwell.png — the act held mid-dwell at
 * each of the four frames.
 */

const PATH = "/";

/**
 * The index needs real rows at every frame or the geometry under it is not the
 * geometry a reader gets. Two live credits and one inert one, which is also the
 * content law's own shape: a row links only when it has somewhere to go.
 */
const CREDITS = [
  {
    id: "c1",
    kind: "document",
    title_es: "El Casting",
    title_en: "The Casting",
    role_es: null,
    role_en: null,
    production: "Mi Mundo de Roles",
    year: 2025,
    url: "https://www.youtube.com/watch?v=sjtUdw-rUT4",
    video_id: "sjtUdw-rUT4",
  },
  {
    id: "c2",
    kind: "reel",
    title_es: "Escenas Dramáticas",
    title_en: "Dramatic Scenes",
    role_es: null,
    role_en: null,
    production: null,
    year: 2025,
    url: "https://example.com/reel",
    video_id: null,
  },
  {
    id: "c3",
    kind: "reel",
    title_es: "Trabajo Comercial",
    title_en: "Commercial Work",
    role_es: null,
    role_en: null,
    production: null,
    year: null,
    url: null,
    video_id: null,
  },
];

/**
 * One marker per act, in the order the page is supposed to tell them. The reel
 * is matched on its slides rather than its section, because hero, About and
 * contact all share `data-qa="cinematic-section"`.
 */
const MARKERS: ReadonlyArray<{ name: string; sel: string }> = [
  // EVENTS.2 — the Events act moved to below the hero, above act 01 (owner
  // ruling, superseding the EVENTS.1 slot-5 placement). It is UNCONDITIONAL
  // here, unlike `acting` below: the act is dark, but the late-mount law puts
  // its (empty) section in the DOM at every paint, and this census is exactly
  // the thing that would catch it going missing — or drifting back.
  { name: "events", sel: '[data-qa="cinematic-events"]' },
  { name: "reel", sel: '[data-qa="reel-slide"]' },
  { name: "acting", sel: '[data-qa="cinematic-acting"]' },
  { name: "gallery", sel: '[data-qa="cinematic-gallery"]' },
  { name: "greenworld", sel: '[data-qa="cinematic-greenworld-seq"]' },
  { name: "titilinks", sel: '[data-qa="cinematic-titilinks"]' },
  { name: "about", sel: "#cinematic-about" },
  { name: "contact", sel: "#contact" },
];

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900, shape: "wide" },
  { name: "tablet-1024x1366", width: 1024, height: 1366, shape: "wide" },
  { name: "phone-390", width: 390, height: 844, shape: "phone" },
  { name: "phone-360", width: 360, height: 780, shape: "phone" },
] as const;

const ACT = '[data-qa="cinematic-acting"]';
/**
 * The PINNED element is the stage, not the section around it: ScrollTrigger
 * wraps the stage in the spacer, so the section is the spacer's ancestor and
 * asking the section for `closest(".pin-spacer")` finds nothing. Every pin
 * measurement below reads the stage; only presence and order read the section.
 */
const STAGE = '[data-qa="acting-stage"]';
const GALLERY = '[data-qa="cinematic-gallery"]';

/* ────────────────────────────── helpers ────────────────────────────── */

const spacerOf = (page: Page, sel: string) =>
  page.locator(sel).first().locator("xpath=ancestor::*[contains(@class,'pin-spacer')]");

async function settle(page: Page, ms = 900) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

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

const rawPinStartOf = (page: Page, sel: string) =>
  spacerOf(page, sel)
    .first()
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

/**
 * The pin start, once it has stopped moving. The page re-measures for a while
 * after load — media lands, the reel rebuilds its wide timeline against the
 * mounted plate frames, fonts settle — and each refresh can shift every later
 * act. A start read mid-shuffle aims at a stale offset, so it is trusted only
 * after two consecutive reads agree.
 */
async function pinStartOf(page: Page, sel: string) {
  let prev = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < 25; i++) {
    const cur = await rawPinStartOf(page, sel);
    if (Math.abs(cur - prev) < 1) return cur;
    prev = cur;
    await page.waitForTimeout(350);
  }
  return prev;
}

/**
 * Wheel until the act genuinely holds the top of the frame, and hand back the
 * pin start it engaged on. A refresh landing between the read and the end of
 * the wheel re-flows every later act and leaves the aim short, so the aim is
 * re-taken against a fresh measurement — the LAW is unchanged, because the
 * caller still asserts the act is pinned when this returns.
 */
async function engage(page: Page, sel: string) {
  let pinStart = await pinStartOf(page, sel);
  for (let i = 0; i < 4; i++) {
    await wheelTo(page, pinStart + 60);
    if (Math.abs(await topOf(page, sel)) <= 2) break;
    pinStart = await pinStartOf(page, sel);
  }
  return pinStart;
}

/** The distance a pinned act holds the frame for: spacer height − section height. */
const pinDistanceOf = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const section = document.querySelector(s)!;
    const spacer = section.closest(".pin-spacer")!;
    return spacer.getBoundingClientRect().height - section.getBoundingClientRect().height;
  }, sel);

async function openHome(page: Page, width: number, height: number, lng: "es" | "en" = "es") {
  await page.setViewportSize({ width, height });
  await forceLanguage(page, lng);
  await routeSupabase(page, { actingCredits: CREDITS });
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await settle(page);
}

/* ─────────────────────────── law 1 — the order ─────────────────────────── */

test.describe("PORT.ACT.4 — where the act sits", () => {
  test("the page tells its acts in the flow's order", async ({ page }) => {
    test.setTimeout(120_000);
    await openHome(page, 1440, 900);

    const present = await page.evaluate((markers) => {
      // Document order survives ScrollTrigger's pin-spacer wrapping, so the
      // flow position is read from the DOM rather than from geometry that a pin
      // could be holding still. One walk of the tree indexes every node; each
      // marker's first match then reports where in that walk it appeared.
      const at = new Map<Element, number>();
      document.querySelectorAll("*").forEach((el, i) => at.set(el, i));
      return markers
        .map((m) => ({ name: m.name, el: document.querySelector(m.sel) }))
        .filter((m): m is { name: string; el: Element } => m.el !== null)
        .map((m) => ({ name: m.name, at: at.get(m.el) ?? -1 }))
        .sort((a, b) => a.at - b.at)
        .map((m) => m.name);
    }, MARKERS as unknown as { name: string; sel: string }[]);

    const expected = MARKERS.map((m) => m.name).filter(
      (n) => n !== "acting" || ACTING_ACT_ENABLED,
    );

    // The whole sequence, not just the two neighbours — so a stray act cannot
    // slip in above or below without this failing.
    expect(present, "the cinematic home's act order").toEqual(expected);
  });
});

/* ──────────── law 2 — the neighbours, live when the flag flips ──────────── */

test.describe("PORT.ACT.4 — the act in the scroll", () => {
  test.skip(!ACTING_ACT_ENABLED, "ACTING_ACT_ENABLED is false — the act is dark by design");

  for (const vp of VIEWPORTS) {
    test(`${vp.name} — the act dwells and neither neighbour is disturbed`, async ({ page }) => {
      test.setTimeout(300_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await openHome(page, vp.width, vp.height);

      const DWELL = 1.2 * vp.height;

      // The act picked the right shape for this frame before anything moves.
      await expect(page.locator('[data-qa="acting-stage"]')).toHaveAttribute(
        "data-shape",
        vp.shape,
      );

      // ── the act ABOVE: the reel keeps its whole +=300% scrub ──
      const reelDist = await pinDistanceOf(page, '[data-qa="reel-slide"]');
      expect(
        Math.abs(reelDist - 3 * vp.height),
        `the reel still scrubs +=300% (got ${Math.round(reelDist)})`,
      ).toBeLessThanOrEqual(14);

      // ── the act ITSELF: engage → hold → release, on the uniform dwell ──
      const actDist = await pinDistanceOf(page, STAGE);
      expect(
        Math.abs(actDist - DWELL),
        `the Acting act dwells for +=120% (got ${Math.round(actDist)})`,
      ).toBeLessThanOrEqual(14);

      const pinStart = await engage(page, STAGE);
      expect(Math.abs(await topOf(page, STAGE)), "acting pinned at engage").toBeLessThanOrEqual(2);

      await wheelTo(page, pinStart + 0.6 * DWELL);
      expect(
        Math.abs(await topOf(page, STAGE)),
        "acting still pinned mid-dwell",
      ).toBeLessThanOrEqual(2);

      // The index is READ during the dwell, so it has to be on screen and lit
      // while the frame is held — not merely present in the DOM.
      const index = page.locator('[data-qa="acting-index"]');
      await expect(index).toBeVisible();
      const geo = await index.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, opacity: Number(getComputedStyle(el).opacity) };
      });
      expect(geo.opacity, "the index is painted mid-dwell").toBeGreaterThan(0.1);
      expect(geo.top, "the index is inside the held frame").toBeGreaterThan(0);
      expect(geo.bottom, "the index is inside the held frame").toBeLessThan(vp.height);

      await page.screenshot({ path: shot(`PORT.ACT.4-${vp.name}-dwell.png`) });

      await wheelTo(page, pinStart + DWELL + 320);
      expect(
        await topOf(page, STAGE),
        "acting released after its dwell",
      ).toBeLessThan(-200);

      // ── the act BELOW: the gallery still pins at its OWN spacer top ──
      // This is the falsifier. If the new pin had staled the triggers beneath
      // it, the gallery's trigger would fire at an offset that no longer
      // matches where its spacer sits, and aiming at the spacer would leave
      // the section hundreds of pixels from the top of the frame.
      await engage(page, GALLERY);
      expect(
        Math.abs(await topOf(page, GALLERY)),
        "the gallery below still engages at its own spacer top",
      ).toBeLessThanOrEqual(2);

      const galleryDist = await pinDistanceOf(page, GALLERY);
      expect(
        Math.abs(galleryDist - DWELL),
        `the gallery below keeps its own +=120% (got ${Math.round(galleryDist)})`,
      ).toBeLessThanOrEqual(14);

      expect(errors, "no page errors through the sweep").toEqual([]);
    });
  }

  test("1440 reduced motion — the act joins the page without pinning", async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openHome(page, 1440, 900);

    // The dwell law's law 6: reduced motion skips every pin, this act included.
    await expect(spacerOf(page, STAGE), "acting unpinned under reduced motion").toHaveCount(0);

    // …and it still renders complete, because every entrance is a gsap.from().
    await page.locator(ACT).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    for (const sel of [
      `${ACT} [data-qa="chapter-eyebrow"]`,
      `${ACT} [data-qa="section-heading"]`,
      '[data-qa="acting-index"]',
    ]) {
      await expect(page.locator(sel)).toBeVisible();
      const opacity = await page.locator(sel).evaluate((el) => getComputedStyle(el).opacity);
      expect(Number(opacity), `${sel} painted under reduced motion`).toBeGreaterThan(0.9);
    }
  });
});
