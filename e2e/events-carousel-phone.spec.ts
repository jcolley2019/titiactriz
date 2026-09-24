import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { stillStrip, swipe } from "./_touch";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * EVENTS.ACT.CAROUSEL.1 — the strip and the modal on a REAL mobile WebKit.
 *
 * EVENTS.SNAP.2 established why this file exists at all: Chromium emulation is
 * not iOS, and it has already passed a snap law on the desk that the phone
 * failed in Joey's hand. Anything that depends on how mobile Safari actually
 * handles touch, snapping and a fixed dialog is measured here instead — in the
 * `webkit-iphone` project, at Joey's measured device truth of 440x792.
 *
 * ## What this file can and cannot measure, stated up front
 *
 * Playwright has `touchscreen.tap()` and no swipe primitive in any engine, and a
 * SYNTHESISED touch cannot drive NATIVE scrolling. So:
 *
 *   - the modal's swipe grammar IS measured for real — it is JS, reading touch
 *     events, so a dispatched gesture exercises exactly the code a finger does;
 *   - the strip's seize/release and snap ARMING are measured for real, because
 *     those are our handlers too;
 *   - the strip's native momentum and where iOS chooses to rest is NOT measured
 *     here, because nothing in this harness can honestly produce it. That half
 *     is Joey's on-device gate, which is where it belongs (law 2).
 *
 * Mobile WebKit also refuses `mouse.wheel` outright, so the act is reached by
 * driving the page scroll directly and then asserting the OBSERVED stage top —
 * never the aimed position, which Lenis's momentum makes a lie.
 */

const PATH = "/cinematic";
const STAGE = '[data-qa="events-stage"]';
const STRIP = '[data-qa="events-cards"][data-carousel="true"]';
const CELL = '[data-qa="events-card-cell"]';
const MODAL = '[data-qa="event-lightbox"]';
const MODAL_CLOSE = '[data-qa="event-lightbox-close"]';

const card = (i: number) => ({
  id: `ev-${i}`,
  size: "full",
  title: { es: `Evento ${i}`, en: `Event ${i}` },
  badge: { es: `SÁBADO ${i}`, en: `SATURDAY ${i}` },
  description: { es: `Descripción del evento ${i}.`, en: `Event ${i} description.` },
  note: { es: "", en: "" },
  buttons: [],
});

const board = (n: number) => ({
  pageVisible: true,
  homeVisible: true,
  items: Array.from({ length: n }, (_, i) => card(i + 1)),
});

/**
 * Reach the act without a wheel. `window.scrollTo` is a second authority beside
 * Lenis, so it is issued repeatedly and judged only by what the stage reports.
 */
async function reachAct(page: Page) {
  for (let i = 0; i < 40; i++) {
    const top = await page
      .locator(STAGE)
      .evaluate((el) => el.getBoundingClientRect().top)
      .catch(() => Number.NaN);
    if (!Number.isFinite(top)) return false;
    if (Math.abs(top) <= 4) break;
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: "instant" }), Math.round(top));
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(500);
  return true;
}

async function open(page: Page, cards = 4) {
  await forceLanguage(page, "es");
  await routeSupabase(page, { eventsBoard: board(cards) });
  await page.goto(`${PATH}?events=A&actstage=carousel`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector(STAGE, { timeout: 20_000 });
  await page.waitForTimeout(900);
  await reachAct(page);
}

const stripState = (page: Page) =>
  page.evaluate((s) => {
    const el = document.querySelector<HTMLElement>(s);
    if (!el) return null;
    return {
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      snapType: getComputedStyle(el).scrollSnapType,
      snap: el.dataset.snap ?? null,
      drift: el.dataset.drift ?? null,
      copies: Number(el.dataset.copies ?? 0),
    };
  }, STRIP);

test.describe("EVENTS.ACT.CAROUSEL.1 — the strip on the phone (WebKit)", () => {
  test("the act stages a doubled, drifting strip at device truth", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);

    const s = await stripState(page);
    expect(s, "the strip is on the phone too").not.toBeNull();
    expect(s!.copies).toBe(2);
    expect(s!.drift, "drifting on arrival").toBe("running");
    expect(s!.scrollWidth, "the strip really does overflow its own box").toBeGreaterThan(
      s!.clientWidth,
    );
    await page.screenshot({ path: shot("events-carousel-webkit-strip.png") });
  });

  test("the document never scrolls sideways on the phone", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);
    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScroll: document.body.scrollWidth,
      bodyClient: document.body.clientWidth,
    }));
    expect(doc.scrollWidth, "the strip clips itself — the page does not widen").toBe(
      doc.clientWidth,
    );
    expect(doc.bodyScroll, "…and neither does the body").toBe(doc.bodyClient);
  });

  test("a touch seizes the drift, and lifting off arms the snap", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);

    const strip = page.locator(STRIP);
    const box = (await strip.boundingBox())!;
    const y = box.y + box.height / 2;

    // Touch DOWN only — the gesture is still in progress.
    await strip.evaluate((el) => {
      const legacy = document as unknown as {
        createTouch: (w: Window, t: EventTarget, i: number, a: number, b: number, c: number, d: number) => Touch;
        createTouchList: (...t: Touch[]) => TouchList;
      };
      const t = legacy.createTouch(window, el, 1, 200, 300, 200, 300);
      el.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: legacy.createTouchList(t),
          changedTouches: legacy.createTouchList(t),
        }),
      );
    });
    await page.waitForTimeout(200);

    const held = await stripState(page);
    expect(held!.drift, "the drift yielded to the finger").toBe("paused");
    expect(held!.snapType, "no re-snap under the finger — that would jerk the strip").toBe("none");

    const a = await stripState(page);
    await page.waitForTimeout(900);
    const b = await stripState(page);
    expect(b!.scrollLeft, "held still while touched").toBeCloseTo(a!.scrollLeft, 0);

    // …and the lift-off arms it.
    await swipe(strip, { x: 300, y }, { x: 120, y: y + 4 });
    await page.waitForTimeout(300);
    const rested = await stripState(page);
    expect(rested!.snap, "snap armed at lift-off").toBe("on");
    expect(rested!.snapType, "mobile WebKit really is mandatory now").toBe("x mandatory");
  });
});

test.describe("EVENTS.ACT.CAROUSEL.1 — the modal on the phone (WebKit)", () => {
  test("a real tap opens the card, and the dialog is the whole screen", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);
    await stillStrip(page.locator(STRIP));

    // A REAL touch, through the device's own touchscreen.
    const target = await page.evaluate((s) => {
      const el = document.querySelector<HTMLElement>(s)!;
      const b = el.getBoundingClientRect();
      for (const cell of Array.from(
        el.querySelectorAll<HTMLElement>('[data-qa="events-card-cell"]'),
      )) {
        const r = cell.getBoundingClientRect();
        if (r.left >= b.left - 1 && r.right <= b.right + 1) {
          return { index: cell.dataset.index!, x: r.left + r.width / 2, y: r.top + 40 };
        }
      }
      return null;
    }, STRIP);
    expect(target, "a fully visible cell to tap").not.toBeNull();

    await page.touchscreen.tap(target!.x, target!.y);
    await expect(page.locator(MODAL)).toBeVisible();
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", target!.index);

    // The fixed-inside-a-pinned-act falsifier, on the engine that matters.
    const geo = await page.evaluate((s) => {
      const r = document.querySelector(s)!.getBoundingClientRect();
      return {
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        vp: [window.innerWidth, window.innerHeight],
      };
    }, MODAL);
    expect(geo.box, "the dialog covers the screen, uncropped by the pin").toEqual([
      0,
      0,
      geo.vp[0],
      geo.vp[1],
    ]);
    await page.screenshot({ path: shot("events-carousel-webkit-modal.png") });
  });

  test("the card is whole and inside the stage at device truth", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);
    await stillStrip(page.locator(STRIP));
    await page.locator(`${STRIP} ${CELL}`).first().click({ position: { x: 30, y: 30 } });
    await expect(page.locator(MODAL)).toBeVisible();

    const fit = await page.evaluate(
      ({ m, st }) => {
        const modal = document.querySelector<HTMLElement>(m)!;
        const stage = document.querySelector<HTMLElement>(st)!;
        const card = modal.querySelector("article")!;
        const c = card.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        return {
          scale: Number(modal.dataset.scale),
          fits: c.top >= s.top - 1 && c.bottom <= s.bottom + 1 && c.left >= s.left - 1 && c.right <= s.right + 1,
        };
      },
      { m: MODAL, st: '[data-qa="event-lightbox-stage"]' },
    );
    expect(fit.scale, "never blown up past its reading size").toBeLessThanOrEqual(1);
    expect(fit.scale, "never shrunk past the floor").toBeGreaterThanOrEqual(0.65);
    expect(fit.fits, "the whole card is inside the stage").toBe(true);
  });

  test("swipe advances between cards, and a swipe down closes — TitiLinks' thresholds", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await open(page);
    await stillStrip(page.locator(STRIP));
    await page.locator(`${STRIP} ${CELL}[data-index="1"]`).first().click({ position: { x: 30, y: 30 } });
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "1");

    const modal = page.locator(MODAL);
    await swipe(modal, { x: 340, y: 400 }, { x: 200, y: 408 });
    await expect(modal, "past the 48px commit — the next card").toHaveAttribute("data-index", "2");

    await swipe(modal, { x: 120, y: 400 }, { x: 280, y: 396 });
    await expect(modal, "…and back").toHaveAttribute("data-index", "1");

    await swipe(modal, { x: 220, y: 400 }, { x: 190, y: 404 });
    await expect(modal, "under the commit — nothing moves").toHaveAttribute("data-index", "1");

    // Dominance: a mostly-vertical drag must not be read as a horizontal step.
    await swipe(modal, { x: 220, y: 300 }, { x: 260, y: 480 });
    await expect(modal, "the downward swipe closed it").toHaveCount(0);
  });

  test("closing returns the strip position and the page position", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);
    await stillStrip(page.locator(STRIP));

    const beforeStrip = await stripState(page);
    const beforeY = await page.evaluate(() => Math.round(window.scrollY));

    const t = await page.evaluate((s) => {
      const el = document.querySelector<HTMLElement>(s)!;
      const b = el.getBoundingClientRect();
      for (const cell of Array.from(
        el.querySelectorAll<HTMLElement>('[data-qa="events-card-cell"]'),
      )) {
        const r = cell.getBoundingClientRect();
        if (r.left >= b.left - 1 && r.right <= b.right + 1) {
          return { x: r.left + r.width / 2, y: r.top + 40 };
        }
      }
      return null;
    }, STRIP);

    await page.touchscreen.tap(t!.x, t!.y);
    await expect(page.locator(MODAL)).toBeVisible();
    await page.locator(MODAL_CLOSE).click();
    await expect(page.locator(MODAL)).toHaveCount(0);
    await page.waitForTimeout(300);

    const afterStrip = await stripState(page);
    expect(afterStrip!.scrollLeft, "the strip is where the reader left it").toBeCloseTo(
      beforeStrip!.scrollLeft,
      0,
    );
    expect(
      await page.evaluate(() => Math.round(window.scrollY)),
      "and the page has not moved either",
    ).toBeCloseTo(beforeY, -1);
    expect(
      await page.evaluate(() => document.body.style.overflow),
      "the body scroll lock was handed back",
    ).toBe("");
  });
});
