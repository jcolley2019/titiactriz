import { expect, test, type Page } from "@playwright/test";
import { routeSupabase } from "./_admin";
import { EVENTS_ACT_ENABLED } from "../src/lib/ventures";

/**
 * EVENTS.1 — the Events act, dark, in the Book act's slot.
 *
 * The act is SCAFFOLD: it holds slot 5 (after the gallery, immediately before
 * Green World), reads the live `events_board` row, and paints nothing. Its
 * composition arrives with the EVENTS.2 bake-off, and so does its dwell — a dark
 * act has no stage to pin, so the uniform dwell law is not this file's business
 * yet. What IS asserted here is the contract that lets the flag be flipped at
 * all, and it is asserted at the SHIPPING state, not at a hoped-for one.
 *
 * Laws, each falsifiable on the live render:
 *
 *  1. THE SECTION IS ALWAYS THERE — flag off, the act still renders a section,
 *     in the right place in document order, never null. This is the late-mount
 *     law: GSAP pins by wrapping an element in a `pin-spacer`, so a section that
 *     arrives after a later act has pinned is inserted against a DOM React no
 *     longer recognises — `NotFoundError: Failed to execute 'insertBefore'`,
 *     measured on the first build of the Socials act. DOM order must not depend
 *     on what this act knows.
 *  2. DARK MEANS INVISIBLE — the empty section paints nothing and takes no
 *     height, so the gallery hands straight to Green World and the reader cannot
 *     tell the slot is occupied.
 *  3. HONEST EMPTINESS — lit with ZERO cards, the act still paints nothing. The
 *     flag opens the door; the `events_board` row decides whether anyone walks
 *     through it. This is the law that stops a flip from shipping an empty room
 *     with a heading in it.
 *
 * Law 3 runs only while the flag is on, the same shape acting-act.spec.ts uses:
 * a compile-time constant cannot be toggled from a test, and a gate that lies
 * about which state it measured is worse than one that says it skipped.
 */

const PATH = "/cinematic";

const SECTION = '[data-qa="cinematic-events"]';
const GALLERY = '[data-qa="cinematic-gallery"]';
const GREENWORLD = '[data-qa="cinematic-greenworld-seq"]';

async function settle(page: Page, ms = 900) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Open the cinematic home. `board` overrides the events_board value. */
async function openHome(page: Page, board?: unknown) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await routeSupabase(page, board === undefined ? {} : { eventsBoard: board });
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await settle(page);
}

/** Document-order index of a selector's first match, or -1 if it is absent. */
const orderOf = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return -1;
    let i = 0;
    for (const node of Array.from(document.querySelectorAll("*"))) {
      if (node === el) return i;
      i++;
    }
    return -1;
  }, sel);

/* ─────────────── law 1 + 2 — the dark act, at the shipping state ─────────────── */

test.describe("EVENTS.1 — the act ships dark", () => {
  test.skip(EVENTS_ACT_ENABLED, "EVENTS_ACT_ENABLED is on — the dark gate has no subject");

  test("the section is present, in slot 5, with the flag off", async ({ page }) => {
    test.setTimeout(90_000);
    await openHome(page);

    // Present — not null, not conditionally mounted.
    await expect(page.locator(SECTION)).toHaveCount(1);
    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");

    const [gallery, events, greenworld] = await Promise.all([
      orderOf(page, GALLERY),
      orderOf(page, SECTION),
      orderOf(page, GREENWORLD),
    ]);

    expect(gallery, "the gallery is in the flow").toBeGreaterThan(-1);
    expect(greenworld, "Green World is in the flow").toBeGreaterThan(-1);
    // Slot 5: after the gallery, immediately before Green World — the Book
    // act's exact position, which is the whole point of the swap.
    expect(events, "the Events act sits after the gallery").toBeGreaterThan(gallery);
    expect(events, "the Events act sits before Green World").toBeLessThan(greenworld);
  });

  test("the dark act paints nothing and takes no height", async ({ page }) => {
    test.setTimeout(90_000);
    await openHome(page);

    const box = await page.locator(SECTION).boundingBox();
    // An empty section has no box at all, or a zero-height one. Either is
    // honest; a section with height would be a room the reader pays for.
    expect(box?.height ?? 0, "the dark act's rendered height").toBeLessThanOrEqual(1);

    // Nothing designed leaked out from behind the flag.
    await expect(page.locator('[data-qa="events-stage"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="events-heading"]')).toHaveCount(0);

    // The Book act it replaced is gone from the flow, not merely hidden.
    await expect(page.locator('[data-qa="cinematic-book"]')).toHaveCount(0);
  });
});

/* ──────────────── law 3 — honest emptiness, once the flag is on ──────────────── */

test.describe("EVENTS.1 — lit, with zero cards", () => {
  test.skip(!EVENTS_ACT_ENABLED, "EVENTS_ACT_ENABLED is false — the act is dark by design");

  test("an empty board still paints nothing", async ({ page }) => {
    test.setTimeout(90_000);
    // A board that EXISTS and is genuinely card-less — not an absent row, which
    // the parser would fill with its seeded default.
    await openHome(page, { pageVisible: true, items: [] });

    await expect(page.locator(SECTION)).toHaveCount(1);
    await expect(page.locator(SECTION)).toHaveAttribute("data-empty", "true");
    await expect(page.locator('[data-qa="events-stage"]')).toHaveCount(0);

    const box = await page.locator(SECTION).boundingBox();
    expect(box?.height ?? 0, "a lit act with no cards has no height").toBeLessThanOrEqual(1);
  });

  test("a board with cards lights the slot", async ({ page }) => {
    test.setTimeout(90_000);
    await openHome(page, {
      pageVisible: true,
      items: [
        {
          id: "e1",
          size: "full",
          title: { es: "Un evento", en: "An event" },
          badge: { es: "", en: "" },
          description: { es: "", en: "" },
          note: { es: "", en: "" },
          buttons: [],
        },
      ],
    });

    await expect(page.locator('[data-qa="events-stage"]')).toHaveCount(1);
    await expect(page.locator('[data-qa="events-stage"]')).toHaveAttribute("data-cards", "1");
  });
});
