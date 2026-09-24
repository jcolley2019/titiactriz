import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { stillStrip, swipe, waitForStripRest } from "./_touch";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * EVENTS.ACT.CAROUSEL.1 — the act's card carousel, and the event modal.
 *
 * The stage is behind the DEV-only `?actstage=carousel` switch, exactly as the
 * rooms are behind `?events=A|B|C`, so every law below is measured on the real
 * page, in the real flow, at the shipping state — and the LAST describe block is
 * the falsifier that the production act is untouched without the switch.
 *
 * The laws, as ruled:
 *
 *  1. THE ACT'S CONTRACTS ARE UNCHANGED. The section, its empty state, the three
 *     doors, the banner's travel and the +=120% dwell all belong to the act, not
 *     to its card field, and swapping the field may not disturb any of them.
 *     (Those live in events-act.spec.ts and are run unchanged.)
 *  2. FEWER THAN THREE CARDS IS NOT A CAROUSEL. Joey's ruling from the desktop:
 *     "the carousel should only scroll when there are more than 2 events…the
 *     full size cards fit so we really don't need the carousel on the desktop
 *     view." One or two cards render today's grid, on every screen.
 *  2b. THE MODAL ENLARGES. Opening a card must make it BIGGER than it was in the
 *     field — a lightbox that shrinks its subject is worse than no lightbox.
 *  3. REDUCED MOTION TAKES THE DRIFT, NOT THE FEATURE. No self-motion, no
 *     doubling; swipe, tap and the modal all still work.
 *  4. THE STRIP CLIPS ITSELF. The document never scrolls horizontally.
 *  5. THE MODAL RETURNS WHAT IT BORROWED. Every close path lands back on the
 *     strip position it opened from, the page position it opened from, and the
 *     card that opened it.
 */

const PATH = "/cinematic";
const STAGE = '[data-qa="events-stage"]';
const FIELD = '[data-qa="events-cards"]';
const STRIP = '[data-qa="events-cards"][data-carousel="true"]';
const CELL = '[data-qa="events-card-cell"]';
const MODAL = '[data-qa="event-lightbox"]';
const MODAL_GROUND = '[data-qa="event-lightbox-ground"]';
const MODAL_CLOSE = '[data-qa="event-lightbox-close"]';
const MODAL_NEXT = '[data-qa="event-lightbox-next"]';
const MODAL_PREV = '[data-qa="event-lightbox-prev"]';

/** The drift's own idle window (EventsCarousel IDLE_MS), plus a settle. */
const IDLE_MS = 8000;

const card = (i: number, size: "full" | "half" = "full") => ({
  id: `ev-${i}`,
  size,
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

async function settle(page: Page, ms = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Lenis owns the wheel; aim by wheeling and read OBSERVED state only. */
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

const spacerTopOf = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return Number.NaN;
    const spacer = Array.from(document.querySelectorAll<HTMLElement>(".pin-spacer")).find((sp) =>
      sp.contains(el),
    );
    const target = spacer ?? el;
    return target.getBoundingClientRect().top + window.scrollY;
  }, sel);

const topOf = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top);

/** Bring the act to the top of the frame, the way the dwell specs do. */
async function engage(page: Page, sel = STAGE) {
  let start = await spacerTopOf(page, sel);
  for (let i = 0; i < 4; i++) {
    await wheelTo(page, start + 60);
    if (Math.abs(await topOf(page, sel)) <= 2) break;
    start = await spacerTopOf(page, sel);
  }
  return start;
}

type OpenOpts = {
  cards?: number;
  width?: number;
  height?: number;
  reduced?: boolean;
  lang?: "es" | "en";
  /** Omit the stage switch entirely — the production field. */
  noStage?: boolean;
};

async function open(page: Page, opts: OpenOpts = {}) {
  const { cards = 4, width = 1280, height = 800, reduced, lang = "es", noStage } = opts;
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height });
  await forceLanguage(page, lang);
  await routeSupabase(page, { eventsBoard: board(cards) });
  await page.goto(`${PATH}?events=A${noStage ? "" : "&actstage=carousel"}`, {
    waitUntil: "domcontentloaded",
  });
  await settle(page);
  await page.waitForSelector(STAGE, { timeout: 20_000 });
  if (!reduced) await engage(page);
  else await page.locator(STAGE).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
}

/** The strip's live numbers, in one round trip. */
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
      cells: el.querySelectorAll('[data-qa="events-card-cell"]').length,
    };
  }, STRIP);

/** How far the nearest cell's centre sits from the strip's own centre. */
const centringError = (page: Page) =>
  page.evaluate((s) => {
    const el = document.querySelector<HTMLElement>(s);
    if (!el) return Number.NaN;
    const mid = el.getBoundingClientRect().left + el.clientWidth / 2;
    const errors = Array.from(el.querySelectorAll<HTMLElement>('[data-qa="events-card-cell"]')).map(
      (c) => {
        const r = c.getBoundingClientRect();
        return Math.abs(r.left + r.width / 2 - mid);
      },
    );
    return Math.min(...errors);
  }, STRIP);

const docOverflow = (page: Page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

/**
 * A pointer gesture over the strip: the seize/release pair.
 *
 * It MOVES before it lifts, and that is not decoration. A press-and-release that
 * never moves is precisely what the tap grammar defines as a tap, so a still
 * grasp opens the modal instead of exercising the strip — which is exactly what
 * the first cut of this helper did, taking three specs down with it. Past the
 * 10px slop the same gesture is a drag, which is what these laws are about.
 */
async function graspStrip(page: Page, hold = 150) {
  const box = await page.locator(STRIP).boundingBox();
  if (!box) throw new Error("no strip");
  const y = box.y + box.height * 0.5;
  const x = box.x + box.width * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(hold);
  await page.mouse.move(x - 60, y, { steps: 8 });
  await page.mouse.up();
  // The release smooth-scrolls the nearest card to centre; wait it out, or
  // every measurement after this reads a position the strip is still leaving.
  await waitForStripRest(page.locator(STRIP));
}

/* ─────────────────────────── the strip ─────────────────────────── */

test.describe("EVENTS.ACT.CAROUSEL.1 — the strip", () => {
  test("3+ cards render a doubled, drifting strip", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });

    const s = await stripState(page);
    expect(s, "the strip exists").not.toBeNull();
    expect(s!.copies, "the strip is rendered twice — that is what makes the wrap seamless").toBe(2);
    expect(s!.cells, "8 cells for 4 cards").toBe(8);
    expect(s!.drift, "the drift is running on arrival").toBe("running");
    // Snap is DISARMED while the drift owns the strip: a mandatory container
    // re-snaps against a rAF and the drift stalls. This is the whole reason the
    // TitiLinks block never had both at once.
    expect(s!.snapType, "no snap while drifting").toBe("none");
  });

  test("the drift advances the strip on its own", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });

    const a = await stripState(page);
    await page.waitForTimeout(1600);
    const b = await stripState(page);

    const oneCopy = a!.scrollWidth / 2;
    // Advanced, or advanced THROUGH the band's wrap (a -oneCopy correction).
    const raw = b!.scrollLeft - a!.scrollLeft;
    const advance = raw < 0 ? raw + oneCopy : raw;
    expect(advance, `the strip moved (${a!.scrollLeft} -> ${b!.scrollLeft})`).toBeGreaterThan(20);
  });

  test("the drift wraps and keeps going — it never stalls at the end of the strip", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });

    // THE STRUCTURAL INVARIANT. A scroller saturates at `scrollWidth -
    // clientWidth`, so a wrap point beyond that can never be reached and the
    // drift simply climbs to the end and dies. This is the cheap falsifier for
    // that whole class of bug — and it is here because a draft did exactly
    // that, stalling at maximum scroll while every behavioural spec passed,
    // since they all measure a second or two after arrival.
    const s = await stripState(page);
    const oneCopy = s!.scrollWidth / 2;
    const maxScroll = s!.scrollWidth - s!.clientWidth;
    expect(oneCopy, `the wrap point (${oneCopy}) is reachable (max ${maxScroll})`).toBeLessThanOrEqual(
      maxScroll,
    );

    // …and the behaviour itself: parked just short of the wrap, the strip must
    // come out the other side still moving, not pile up against the end.
    await page.locator(STRIP).evaluate((el) => {
      el.scrollLeft = el.scrollWidth / 2 - 30;
    });
    await page.waitForTimeout(1500);
    const after = await stripState(page);
    expect(after!.scrollLeft, "it wrapped back to the strip's head").toBeLessThan(oneCopy / 2);
    expect(after!.scrollLeft, "…and is still under way").toBeGreaterThan(0);
    expect(after!.scrollLeft, "…nowhere near pinned at the end").toBeLessThan(maxScroll - 10);
  });

  test("a seizure pauses the drift, and the strip holds still", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });

    const box = await page.locator(STRIP).boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);

    const held = await stripState(page);
    expect(held!.drift, "the drift yielded to the finger").toBe("paused");
    // Snap stays OFF for the duration of the gesture: arming it here would
    // re-snap the container and jerk the strip out from under the pointer.
    expect(held!.snapType, "no re-snap under the finger").toBe("none");

    const a = await stripState(page);
    await page.waitForTimeout(1200);
    const b = await stripState(page);
    expect(b!.scrollLeft, "the strip did not move while held").toBeCloseTo(a!.scrollLeft, 0);

    await page.mouse.up();
  });

  test("the gesture ends snapped, and a card rests centred", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });

    // Still it FIRST, then park it deliberately off-centre, then hand it a
    // gesture. Parking a drifting strip is pointless — the next tick overwrites
    // the position — and the park is kept well away from either end, because the
    // outermost card genuinely cannot be centred there (the scroller would have
    // to go past 0 or past maximum) and that is not what this law is about.
    await stillStrip(page.locator(STRIP));
    await page.locator(STRIP).evaluate((el) => {
      el.scrollLeft = el.scrollWidth / 4 + 61;
    });
    await graspStrip(page);

    const s = await stripState(page);
    expect(s!.snap, "snap armed at lift-off").toBe("on");
    expect(s!.snapType, "…and the container really is mandatory").toBe("x mandatory");

    const err = await centringError(page);
    expect(err, `a card rests centred in the strip (off by ${Math.round(err)}px)`).toBeLessThanOrEqual(2);
    await page.screenshot({ path: shot("events-carousel-1280-snapped.png") });
  });

  test("the drift returns after the idle window, silently", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });
    await graspStrip(page);
    expect((await stripState(page))!.drift, "paused right after the gesture").toBe("paused");

    // The whole idle window, plus a breath.
    await page.waitForTimeout(IDLE_MS + 1200);
    const back = await stripState(page);
    expect(back!.drift, "the drift took the strip back").toBe("running");
    // Disarmed BEFORE the hand-back — turning snap off never scrolls, which is
    // what makes the resume silent.
    expect(back!.snapType, "snap disarmed for the drift").toBe("none");
  });

  test("every card on the board is reachable in the strip", async ({ page }) => {
    test.setTimeout(180_000);
    // FOUR is the whole board: useEventsBoard caps `items` at 4 (:332), so a
    // fuller strip than this cannot exist no matter what the admin saves.
    const N = 4;
    await open(page, { cards: N });

    for (let i = 0; i < N; i++) {
      const visible = await page.evaluate(
        ({ s, idx }) => {
          const el = document.querySelector<HTMLElement>(s)!;
          const cell = el.querySelector<HTMLElement>(`[data-index="${idx}"]`)!;
          // Measured off the rendered rects, never `offsetLeft`: the strip is
          // statically positioned, so a cell's offsetParent is some ancestor
          // further up and its offsetLeft is not in the strip's scroll space.
          const b0 = el.getBoundingClientRect();
          const r0 = cell.getBoundingClientRect();
          el.scrollLeft += r0.left + r0.width / 2 - (b0.left + el.clientWidth / 2);
          const r = cell.getBoundingClientRect();
          const b = el.getBoundingClientRect();
          return r.left >= b.left - 1 && r.right <= b.right + 1 && r.width > 0;
        },
        { s: STRIP, idx: i },
      );
      expect(visible, `card ${i} can be brought fully into the strip`).toBe(true);
    }
  });

  test("the strip clips itself — the document never scrolls sideways", async ({ page }) => {
    test.setTimeout(180_000);
    for (const vp of [
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
    ]) {
      await open(page, { cards: 4, ...vp });
      const s = await stripState(page);
      expect(s!.scrollWidth, "the STRIP genuinely overflows — it is a scroller").toBeGreaterThan(
        s!.clientWidth,
      );
      const doc = await docOverflow(page);
      expect(doc.scrollWidth, `no horizontal document overflow at ${vp.width}`).toBe(
        doc.clientWidth,
      );
      await page.screenshot({ path: shot(`events-carousel-${vp.width}-strip.png`) });
    }
  });
});

/* ─────────────────────────── the modal ─────────────────────────── */

test.describe("EVENTS.ACT.CAROUSEL.1 — the event modal", () => {
  test("tapping a card opens the modal at THAT card", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });
    await stillStrip(page.locator(STRIP));

    await page.locator(`${STRIP} ${CELL}[data-index="2"]`).first().click({ position: { x: 40, y: 40 } });
    await expect(page.locator(MODAL)).toBeVisible();
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "2");
    await expect(page.locator(`${MODAL} article`)).toContainText("Evento 3");
    await page.screenshot({ path: shot("events-carousel-1280-modal.png") });
  });

  test("the modal shows the ratified card, whole and framed", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });
    await stillStrip(page.locator(STRIP));
    await page.locator(`${STRIP} ${CELL}`).first().click({ position: { x: 40, y: 40 } });
    await expect(page.locator(MODAL)).toBeVisible();

    const card = page.locator(`${MODAL} article`);
    await expect(card).toHaveCount(1);
    // The gold frame is the card's own, unchanged by being in a modal.
    const border = await card.evaluate((el) => getComputedStyle(el).borderColor);
    expect(border, "the card keeps its gold frame").toBe("rgb(201, 165, 92)");
    // A Full card carries the corner ornaments.
    expect(await card.locator("img[aria-hidden='true']").count()).toBe(4);
  });

  test("the modal is the viewport, not a box inside the pinned act", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });
    await stillStrip(page.locator(STRIP));
    await page.locator(`${STRIP} ${CELL}`).first().click({ position: { x: 40, y: 40 } });
    await expect(page.locator(MODAL)).toBeVisible();

    // The falsifier for a fixed dialog trapped by a transformed ancestor: the
    // act is GSAP-pinned, and a transform on any ancestor would make this box
    // the ancestor's, not the screen's.
    const geo = await page.evaluate((s) => {
      const r = document.querySelector(s)!.getBoundingClientRect();
      return {
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        vp: [window.innerWidth, window.innerHeight],
      };
    }, MODAL);
    expect(geo.box, "the dialog covers the whole screen").toEqual([0, 0, geo.vp[0], geo.vp[1]]);
  });

  test("the card is contained, never cropped and never off the stage", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4, width: 390, height: 844 });
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
          fitsV: c.top >= s.top - 1 && c.bottom <= s.bottom + 1,
          fitsH: c.left >= s.left - 1 && c.right <= s.right + 1,
        };
      },
      { m: MODAL, st: '[data-qa="event-lightbox-stage"]' },
    );

    expect(fit.scale, "never shrunk past the floor").toBeGreaterThanOrEqual(0.65);
    expect(fit.scale, "…and never blown up").toBeLessThanOrEqual(1);
    expect(fit.fitsH, "the card is inside the stage horizontally").toBe(true);
    expect(fit.fitsV, "the card is inside the stage vertically").toBe(true);
    await page.screenshot({ path: shot("events-carousel-390-modal.png") });
  });

  test("opening a card ENLARGES its MEDIUM — the modal is never a downgrade", async ({ page }) => {
    test.setTimeout(180_000);
    // A real portrait poster, inline so the law is measured offline and
    // deterministically. Without a medium this spec would be vacuous — the
    // thing poster-first is about is exactly the thing a text-only fixture
    // does not have.
    const POSTER =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1000"><rect width="600" height="1000" fill="#241c12"/></svg>',
      );
    await page.setViewportSize({ width: 1880, height: 1000 });
    await forceLanguage(page, "es");
    await routeSupabase(page, {
      eventsBoard: {
        pageVisible: true,
        homeVisible: true,
        items: [1, 2, 3].map((i) => ({
          ...card(i),
          imageUrl: POSTER,
          imagePosition: "above",
          imageAspect: "auto",
        })),
      },
    });
    await page.goto(`${PATH}?events=A&actstage=carousel`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.waitForSelector(STAGE, { timeout: 20_000 });
    await engage(page);
    await stillStrip(page.locator(STRIP));

    // What the card measures in the strip, before it is opened.
    const inStrip = await page.evaluate((s) => {
      const cell = document.querySelector<HTMLElement>(`${s} [data-qa="events-card-cell"]`)!;
      const art = cell.querySelector("article")!;
      const med = art.querySelector('[data-qa="event-card-image"], video');
      const r = art.getBoundingClientRect();
      const m = med?.getBoundingClientRect();
      return { card: r.width * r.height, media: m ? m.width * m.height : 0 };
    }, STRIP);

    const box = (await page.locator(STRIP).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + 60);
    await expect(page.locator(MODAL)).toBeVisible();
    await page.waitForTimeout(900);

    const inModal = await page.evaluate((m) => {
      const modal = document.querySelector<HTMLElement>(m)!;
      const art = modal.querySelector("article")!;
      const med = art.querySelector('[data-qa="event-card-image"], video');
      const r = art.getBoundingClientRect();
      const mm = med?.getBoundingClientRect();
      return {
        scale: Number(modal.dataset.scale),
        card: r.width * r.height,
        media: mm ? mm.width * mm.height : 0,
      };
    }, MODAL);

    // The defect this exists to stop: the first cut capped the contain at 1, so
    // a card opened at exactly the size it already was — same poster, wider
    // frame, more empty ground. Joey caught it on the desktop.
    //
    // The law is about the MEDIUM, not the scale factor. Under poster-first the
    // card is deliberately scaled DOWN (the medium asks for more height than the
    // act would ever give it, and contain fits the result back into the stage),
    // so a `scale > 1` assertion would now be measuring the opposite of success.
    expect(inStrip.media, "the fixture really does carry a medium").toBeGreaterThan(0);
    expect(inModal.media, "the medium is bigger than it was in the strip").toBeGreaterThan(
      inStrip.media * 1.15,
    );
    expect(inModal.card, "and the card itself is bigger too").toBeGreaterThan(inStrip.card);
  });

  test("an enlarged card never widens the stage into a scrollbar", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4, width: 1880, height: 1000 });
    await stillStrip(page.locator(STRIP));
    const box = (await page.locator(STRIP).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + 60);
    await expect(page.locator(MODAL)).toBeVisible();
    await page.waitForTimeout(900);

    const st = await page.locator('[data-qa="event-lightbox-stage"]').evaluate((el) => ({
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));
    expect(st.scrollW, "the scaled card does not overflow the stage sideways").toBe(st.clientW);
  });

  test("a horizontal swipe advances between cards, and a swipe down closes", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4, width: 390, height: 844 });
    await stillStrip(page.locator(STRIP));
    await page.locator(`${STRIP} ${CELL}[data-index="1"]`).first().click({ position: { x: 30, y: 30 } });
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "1");

    // Past the 48px horizontal commit, dominant axis — TitiLinks' grammar.
    await swipe(page.locator(MODAL), { x: 300, y: 400 }, { x: 180, y: 410 });
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "2");

    await swipe(page.locator(MODAL), { x: 120, y: 400 }, { x: 260, y: 408 });
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "1");

    // Under the commit: nothing moves.
    await swipe(page.locator(MODAL), { x: 200, y: 400 }, { x: 170, y: 402 });
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "1");

    // Down past 72px closes.
    await swipe(page.locator(MODAL), { x: 200, y: 300 }, { x: 204, y: 460 });
    await expect(page.locator(MODAL)).toHaveCount(0);
  });

  test("arrows and the desktop chevrons advance too, and wrap", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 3 });
    await stillStrip(page.locator(STRIP));
    await page.locator(`${STRIP} ${CELL}[data-index="2"]`).first().click({ position: { x: 40, y: 40 } });
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "2");

    await page.locator(MODAL_NEXT).click();
    await expect(page.locator(MODAL), "wraps past the last card").toHaveAttribute("data-index", "0");
    await page.locator(MODAL_PREV).click();
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "2");

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "0");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "2");
  });

  test("the drift is held for as long as the modal is up", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });

    // This one deliberately does NOT still the strip first — the whole claim is
    // that a RUNNING drift is stopped by the modal. So the tap goes in at raw
    // coordinates, which skips the actionability wait that a moving element can
    // never satisfy.
    const box = (await page.locator(STRIP).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + 40);
    await expect(page.locator(MODAL)).toBeVisible();

    const a = await stripState(page);
    await page.waitForTimeout(1600);
    const b = await stripState(page);
    expect(b!.drift, "the drift yielded to the modal").toBe("paused");
    expect(b!.scrollLeft, "the strip did not drift away behind the overlay").toBeCloseTo(
      a!.scrollLeft,
      0,
    );
  });

  test("every close path returns the strip position, the page position and the focus", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await open(page, { cards: 4 });

    const closers: [string, (p: Page) => Promise<void>][] = [
      ["Escape", async (p) => p.keyboard.press("Escape")],
      ["the ground", async (p) => p.locator(MODAL_GROUND).click({ position: { x: 5, y: 5 } })],
      ["the close glyph", async (p) => p.locator(MODAL_CLOSE).click()],
    ];

    for (const [name, close] of closers) {
      // Park the strip somewhere specific and let it settle there.
      await graspStrip(page);

      // Open by clicking a cell that is PARTIALLY CLIPPED at the strip's left
      // edge, at real page coordinates. Two reasons, both deliberate:
      //
      //  - `locator.click()` scrolls its target into view first, which would
      //    move the strip before the modal ever opened and make "the strip is
      //    where it was" a measurement of the harness rather than the app;
      //  - a clipped opener is the only honest falsifier for the focus restore.
      //    A default `focus()` scrolls its element into view, so restoring focus
      //    to this cell would pull the strip sideways on close. It is exactly
      //    the defect `preventScroll` exists to stop, and a fully-visible opener
      //    could never catch it.
      const target = await page.evaluate((s) => {
        const el = document.querySelector<HTMLElement>(s)!;
        const b = el.getBoundingClientRect();
        for (const cell of Array.from(
          el.querySelectorAll<HTMLElement>('[data-qa="events-card-cell"]'),
        )) {
          const r = cell.getBoundingClientRect();
          if (r.left < b.left - 4 && r.right > b.left + 60) {
            return { index: cell.dataset.index!, x: b.left + 30, y: r.top + 60 };
          }
        }
        return null;
      }, STRIP);
      expect(target, "a clipped cell exists at the strip's edge").not.toBeNull();

      const before = await stripState(page);
      const pageYBefore = await page.evaluate(() => Math.round(window.scrollY));

      await page.mouse.click(target!.x, target!.y);
      await expect(page.locator(MODAL)).toBeVisible();
      await expect(page.locator(MODAL)).toHaveAttribute("data-index", target!.index);

      await close(page);
      await expect(page.locator(MODAL), `${name} closes the modal`).toHaveCount(0);
      await page.waitForTimeout(300);

      const after = await stripState(page);
      expect(after!.scrollLeft, `${name} — the strip is where it was`).toBeCloseTo(
        before!.scrollLeft,
        0,
      );
      expect(
        await page.evaluate(() => Math.round(window.scrollY)),
        `${name} — the page is where it was`,
      ).toBeCloseTo(pageYBefore, -1);

      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute("data-qa") === "events-card-cell" ? el.dataset.index : null;
      });
      expect(focused, `${name} — focus returned to the card that opened it`).toBe(target!.index);
    }
  });

  test("the body scroll lock is returned on close", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4 });
    await stillStrip(page.locator(STRIP));
    const before = await page.evaluate(() => document.body.style.overflow);

    await page.locator(`${STRIP} ${CELL}`).first().click({ position: { x: 40, y: 40 } });
    await expect(page.locator(MODAL)).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow), "locked while open").toBe(
      "hidden",
    );

    await page.keyboard.press("Escape");
    await expect(page.locator(MODAL)).toHaveCount(0);
    expect(
      await page.evaluate(() => document.body.style.overflow),
      "the lock is handed back exactly as it was found",
    ).toBe(before);
  });

  test("a CTA inside a card follows its link instead of opening the modal", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await forceLanguage(page, "es");
    await routeSupabase(page, {
      eventsBoard: {
        pageVisible: true,
        homeVisible: true,
        items: [
          { ...card(1), buttons: [{ label: { es: "Entradas", en: "Tickets" }, url: "/book", icon: "website" }] },
          card(2),
          // THREE, because two no longer make a strip (Joey's gate).
          card(3),
        ],
      },
    });
    await page.goto(`${PATH}?events=A&actstage=carousel`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await engage(page);
    await stillStrip(page.locator(STRIP));

    // A card's CTAs are external by construction — `target="_blank"` — so the
    // proof that the link won is a NEW page, not a navigation of this one.
    const [popup] = await Promise.all([
      page.context().waitForEvent("page", { timeout: 15_000 }),
      page.locator(`${STRIP} ${CELL} a`).first().click(),
    ]);
    expect(new URL(popup.url()).pathname, "the CTA opened its own destination").toBe("/book");
    await popup.close();

    // …and the modal never opened over it.
    await expect(page.locator(MODAL)).toHaveCount(0);
  });
});

/* ─────────────── the single-card law, and reduced motion ─────────────── */

test.describe("EVENTS.ACT.CAROUSEL.1 — fewer than three cards is not a carousel", () => {
  for (const n of [1, 2] as const) {
    test(`a board of ${n} renders today's grid, with no strip and no chrome`, async ({ page }) => {
      test.setTimeout(180_000);
      await open(page, { cards: n });

      await expect(page.locator(FIELD), "the field is still there").toHaveCount(1);
      await expect(page.locator(STRIP), "…but it is NOT a carousel").toHaveCount(0);
      await expect(page.locator(CELL), `${n} cell(s), no second copy`).toHaveCount(n);

      // It is the grid the act has always drawn.
      const display = await page.locator(FIELD).evaluate((el) => getComputedStyle(el).display);
      expect(display, "the field is the grid").toBe("grid");

      // And the tap still opens the modal — law 2's other half.
      await page.locator(CELL).first().click({ position: { x: 40, y: 40 } });
      await expect(page.locator(MODAL)).toBeVisible();
      await expect(page.locator(MODAL)).toHaveAttribute("data-index", "0");

      // A board of one has nothing to step to; a board of two does.
      await expect(page.locator('[data-qa="event-lightbox-counter"]')).toHaveCount(n === 1 ? 0 : 1);
      await expect(page.locator(MODAL_NEXT)).toHaveCount(n === 1 ? 0 : 1);
      await page.screenshot({ path: shot(`events-carousel-${n}-card-board.png`) });
    });
  }

  test("the third card is what turns the field into a strip", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 2 });
    await expect(page.locator(STRIP), "two — still the grid").toHaveCount(0);

    await open(page, { cards: 3 });
    await expect(page.locator(STRIP), "three — now a strip").toHaveCount(1);
    await expect(page.locator(CELL), "…doubled, so six cells").toHaveCount(6);
  });
});

test.describe("EVENTS.ACT.CAROUSEL.1 — reduced motion takes the drift, not the feature", () => {
  test("no self-motion and no doubling, but swipe, tap and the modal all live", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4, width: 390, height: 844, reduced: true });

    const s = await stripState(page);
    expect(s!.copies, "no second copy — there is nothing to loop").toBe(1);
    expect(s!.cells, "4 cells for 4 cards").toBe(4);
    // Nothing to fight, so the strip simply snaps from its first frame.
    expect(s!.snapType, "a plain snapping scroller").toBe("x mandatory");

    const a = await stripState(page);
    await page.waitForTimeout(1600);
    const b = await stripState(page);
    expect(b!.scrollLeft, "the strip does not move on its own").toBeCloseTo(a!.scrollLeft, 0);

    // The reader is not deprived of anything.
    await page.locator(`${STRIP} ${CELL}[data-index="1"]`).first().click({ position: { x: 30, y: 30 } });
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "1");
    await swipe(page.locator(MODAL), { x: 300, y: 400 }, { x: 180, y: 405 });
    await expect(page.locator(MODAL)).toHaveAttribute("data-index", "2");
    await page.keyboard.press("Escape");
    await expect(page.locator(MODAL)).toHaveCount(0);

    const doc = await docOverflow(page);
    expect(doc.scrollWidth, "still no horizontal document overflow").toBe(doc.clientWidth);
  });
});

/* ────────── the falsifier: production is untouched without the switch ────────── */

test.describe("EVENTS.ACT.CAROUSEL.1 — no switch, no carousel", () => {
  test("the query-less act is the grid it has always been", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, { cards: 4, noStage: true });

    await expect(page.locator(FIELD)).toHaveCount(1);
    await expect(page.locator(STRIP), "no strip").toHaveCount(0);
    await expect(page.locator(CELL), "4 cells, not 8 — nothing is doubled").toHaveCount(4);

    const field = await page.locator(FIELD).evaluate((el) => ({
      display: getComputedStyle(el).display,
      overflowX: getComputedStyle(el).overflowX,
      carousel: el.getAttribute("data-carousel"),
    }));
    expect(field.display, "still the grid").toBe("grid");
    expect(field.overflowX, "not a scroll container").toBe("visible");
    expect(field.carousel, "no carousel marker").toBeNull();

    // No tap affordance was added to the production field, and no dialog exists.
    const roles = await page.locator(CELL).evaluateAll((els) => els.map((e) => e.getAttribute("role")));
    expect(roles.every((r) => r === null), "the production cells are not controls").toBe(true);
    await expect(page.locator(MODAL)).toHaveCount(0);
  });
});
