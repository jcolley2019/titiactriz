import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase } from "./_admin";

/**
 * BANNER.RULE.1 — the owner's switch rules each banner; a blank link follows
 * the Events page. Joey, verbatim: "I think we need a main banner and a separate
 * green world banner she won't want personal stuff on that, she will want green
 * world promos. then maybe we have a rule set or something that tells it if
 * there is an event it will automatically link to the events page if it is on.
 * If the events page is off then it just acts as a non clickable banner?"
 *
 * The rule, each clause falsifiable against what RENDERS:
 *
 *  R1. A banner's own `enabled` is the only thing that shows or hides it — the
 *      Events-page switch (`pageVisible`) never hides a banner.
 *  R2. Blank link → follows the Events page: ON clicks exactly as before
 *      (scroll to a lit act, else /events); OFF is a plain announcement — no
 *      control, no pointer, no handler — while the X still dismisses.
 *  R3. Filled link → clicks there, always; `pageVisible` is irrelevant.
 *
 *  T1  site banner on, page OFF, blank link  → shown, not clickable
 *  T2  site banner on, page ON,  blank link  → clickable, lands on /events
 *  T3  site banner on, page OFF, filled link → clickable, lands on the link
 *  T4  site banner OFF, page ON              → no banner at all
 *  T5  Green World banner on, site banner off, page OFF → shown on
 *      /green-world, not clickable
 */

const BAR = '[data-qa="events-banner"]';
const WINDOW = '[data-qa="events-banner-window"]';
const CAP = '[data-qa="events-banner-cap"]';
const DISMISS = '[data-qa="events-banner-dismiss"]';

type BannerOpts = { enabled: boolean; link?: string; pages?: Record<string, boolean> };

const banner = ({ enabled, link = "", pages }: BannerOpts) => ({
  enabled,
  label: { es: "EVENTOS", en: "EVENTS" },
  text: { es: "ESTE SÁBADO A LAS 8:00PM", en: "THIS SATURDAY AT 8:00PM" },
  link,
  pages: pages ?? { home: true, greenWorld: false, titans: false },
  bold: false,
  textColor: "#C9A55C",
  enabledAt: "2026-09-23T00:00:00.000Z",
});

const boardOf = (opts: {
  pageVisible: boolean;
  site: BannerOpts;
  greenWorld?: BannerOpts;
}) => ({
  pageVisible: opts.pageVisible,
  // The act stays dark, so a clickable blank link has no act to travel to and
  // takes its /events branch — deterministic on the cinematic home.
  homeVisible: false,
  mainBanner: banner(opts.site),
  greenWorldBanner: banner(
    opts.greenWorld ?? { enabled: false, pages: { home: false, greenWorld: true, titans: false } },
  ),
  items: [],
});

async function open(page: Page, board: unknown, path = "/") {
  await page.setViewportSize({ width: 1440, height: 900 });
  await forceLanguage(page, "es");
  await routeSupabase(page, { eventsBoard: board });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

/** Tag name and computed cursor of every hit area the bar renders. */
const hitAreas = (page: Page) =>
  page.locator(`${WINDOW}, ${CAP}`).evaluateAll((els) =>
    els.map((el) => ({
      qa: el.getAttribute("data-qa"),
      tag: el.tagName,
      cursor: getComputedStyle(el).cursor,
    })),
  );

test.describe("BANNER.RULE.1 — the switch rules, a blank link follows the Events page", () => {
  test("T1: page OFF + blank link → the banner shows as a plain announcement", async ({ page }) => {
    await open(page, boardOf({ pageVisible: false, site: { enabled: true } }));

    // R1 — the Events page being off no longer hides the banner.
    await expect(page.locator(BAR)).toBeVisible();
    await expect(page.locator(BAR)).toHaveAttribute("data-clickable", "false");

    // R2 — nothing in the bar is a control except the X.
    const areas = await hitAreas(page);
    expect(areas.length, "window + two caps at 1440").toBe(3);
    for (const a of areas) {
      expect(a.tag, `${a.qa} is not a button`).not.toBe("BUTTON");
      expect(a.cursor, `${a.qa} does not promise a click`).not.toBe("pointer");
    }
    await expect(page.locator(BAR).getByRole("button")).toHaveCount(1);
    await expect(page.locator(BAR).getByRole("button")).toHaveAttribute("data-qa", "events-banner-dismiss");

    // A click on the announcement goes nowhere.
    await page.locator(WINDOW).click();
    await page.waitForTimeout(600);
    expect(new URL(page.url()).pathname).toBe("/");

    // …and the X still dismisses it.
    await page.locator(DISMISS).click();
    await expect(page.locator(BAR)).toHaveCount(0);
  });

  test("T2: page ON + blank link → clickable, and the click lands on /events", async ({ page }) => {
    await open(page, boardOf({ pageVisible: true, site: { enabled: true } }));

    await expect(page.locator(BAR)).toBeVisible();
    await expect(page.locator(BAR)).toHaveAttribute("data-clickable", "true");
    const areas = await hitAreas(page);
    for (const a of areas) expect(a.tag, `${a.qa} is a button`).toBe("BUTTON");

    await page.locator(WINDOW).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/events");
  });

  test("T3: page OFF + filled link → clickable, and the click lands on the link", async ({ page }) => {
    await open(
      page,
      boardOf({ pageVisible: false, site: { enabled: true, link: "/green-world" } }),
    );

    await expect(page.locator(BAR)).toBeVisible();
    await expect(page.locator(BAR)).toHaveAttribute("data-clickable", "true");

    await page.locator(WINDOW).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/green-world");
  });

  test("T4: site banner OFF + page ON → no banner at all", async ({ page }) => {
    await open(page, boardOf({ pageVisible: true, site: { enabled: false } }));
    await expect(page.locator(BAR)).toHaveCount(0);
  });

  test("T5: Green World banner on /green-world with the page OFF → shown, not clickable", async ({
    page,
  }) => {
    await open(
      page,
      boardOf({
        pageVisible: false,
        site: { enabled: false },
        greenWorld: { enabled: true, pages: { home: false, greenWorld: true, titans: false } },
      }),
      "/green-world",
    );

    await expect(page.locator(BAR)).toBeVisible();
    await expect(page.locator(BAR)).toHaveAttribute("data-clickable", "false");
    const areas = await hitAreas(page);
    for (const a of areas) expect(a.tag, `${a.qa} is not a button`).not.toBe("BUTTON");
  });
});
