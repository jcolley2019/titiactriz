import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";

/**
 * EVENTS.ARCHIVE.1 — the 90-day lifecycle.
 *
 * An event's day passes → it leaves every public surface at the viewer's own
 * midnight (computed on read) and the next admin visit MOVES it to the archive
 * (the sweep — the only pair of hands RLS lets write). Ninety days past its
 * event date, the sweep purges it: media files first, then the entry. The
 * archive view offers Restore (back to the board, evergreen) and Delete
 * (forever, files included).
 *
 * The laws, each falsifiable:
 *
 *  1. THE PUBLIC SHOWS ONLY CURRENT EVENTS — a passed-dated card renders
 *     nowhere on /events; future-dated and undated cards still do.
 *  2. THE SWEEP ARCHIVES THE PASSED — loading the admin over a passed event
 *     sends ONE write whose board carries the event in `archive`, stamped
 *     `archivedAt`, and out of `items`.
 *  3. RESTORE RETURNS IT EVERGREEN — the entry rejoins `items` with neither
 *     `eventDate` (which would re-archive it on the next read) nor
 *     `archivedAt`.
 *  4. THE PURGE TAKES ROW AND FILES TOGETHER — an entry 90+ days past its
 *     event date leaves the archive in the same sweep that DELETEs its image
 *     and video from storage. No orphaned files, no counting on a second pass.
 */

const CELL = '[data-qa="event-cell"]';
const STORAGE_PUB = "https://nsmstwkjbjicpdclgecq.supabase.co/storage/v1/object/public/gallery";

const ymdDaysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const card = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  size: "full",
  title: { es: title, en: title },
  badge: { es: "", en: "" },
  description: { es: "Descripción", en: "Description" },
  note: { es: "", en: "" },
  imageUrl: "",
  imagePosition: "above",
  imageAspect: "auto",
  bulletsOn: false,
  bullets: [],
  videoUrl: "",
  videoFileUrl: "",
  buttons: [],
  ...extra,
});

const board = (items: unknown[], archive: unknown[] = []) => ({
  pageVisible: true,
  homeVisible: false,
  mainBanner: {
    enabled: false,
    label: { es: "EVENTOS", en: "EVENTS" },
    text: { es: "", en: "" },
    link: "",
    pages: { home: false, greenWorld: false, titans: false },
    bold: false,
    textColor: "#C9A55C",
  },
  items,
  archive,
});

const boardWrites = (writes: Write[]) =>
  writes.filter((w) => w.url.includes("site_settings") && w.body?.includes("events_board"));

const lastBoard = (writes: Write[]) => {
  const w = boardWrites(writes).at(-1)!;
  return JSON.parse(w.body!)[0].value;
};

async function openAdmin(page: Page, mocked: unknown, writes: Write[]) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await injectAdminSession(page);
  await forceLanguage(page, "es");
  await routeSupabase(page, { eventsBoard: mocked, writes });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.locator('[data-qa="admin-nav-events"]').click();
  await expect(page.locator('[data-qa="events-view-archive"]')).toBeVisible();
}

test.describe("EVENTS.ARCHIVE.1 — the lifecycle", () => {
  test("law 1: /events hides the passed, keeps the future and the undated", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await forceLanguage(page, "es");
    await routeSupabase(page, {
      eventsBoard: board([
        card("past", "Evento pasado", { eventDate: ymdDaysFromNow(-3) }),
        card("future", "Evento futuro", { eventDate: ymdDaysFromNow(3) }),
        card("evergreen", "Evento sin fecha"),
      ]),
    });
    await page.goto("/events", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(page.locator(CELL)).toHaveCount(2);
    await expect(page.getByText("Evento futuro")).toBeVisible();
    await expect(page.getByText("Evento sin fecha")).toBeVisible();
    await expect(page.getByText("Evento pasado")).toHaveCount(0);
  });

  test("law 2: the admin sweep moves a passed event into the archive, stamped", async ({ page }) => {
    const writes: Write[] = [];
    await openAdmin(
      page,
      board([
        card("past", "Evento pasado", { eventDate: ymdDaysFromNow(-2) }),
        card("future", "Evento futuro", { eventDate: ymdDaysFromNow(30) }),
      ]),
      writes,
    );

    await expect.poll(() => boardWrites(writes).length).toBeGreaterThan(0);
    const swept = lastBoard(writes);
    expect(swept.items.map((i: { id: string }) => i.id)).toEqual(["future"]);
    expect(swept.archive.map((i: { id: string }) => i.id)).toEqual(["past"]);
    expect(typeof swept.archive[0].archivedAt).toBe("string");

    // The archive view lists it; the active list does not.
    await page.locator('[data-qa="events-view-archive"]').click();
    await expect(page.locator('[data-qa="events-archive-entry"]')).toHaveCount(1);
    await expect(
      page.locator('[data-qa="events-archive-entry"]').getByText("Evento pasado"),
    ).toBeVisible();
  });

  test("law 3: Restore returns the event to the board, evergreen", async ({ page }) => {
    const writes: Write[] = [];
    await openAdmin(
      page,
      board(
        [],
        [card("old", "Evento archivado", {
          eventDate: ymdDaysFromNow(-10),
          archivedAt: new Date().toISOString(),
        })],
      ),
      writes,
    );

    await page.locator('[data-qa="events-view-archive"]').click();
    await page.locator('[data-qa="events-archive-restore"]').click();

    await expect.poll(() => boardWrites(writes).length).toBeGreaterThan(0);
    const restored = lastBoard(writes);
    expect(restored.archive).toEqual([]);
    expect(restored.items.map((i: { id: string }) => i.id)).toEqual(["old"]);
    expect(restored.items[0].eventDate).toBeUndefined();
    expect(restored.items[0].archivedAt).toBeUndefined();

    // And the card is back on the active shelf, on screen.
    await expect(page.locator('[data-qa="events-archive-entry"]')).toHaveCount(0);
    await page.locator('[data-qa="events-view-active"]').click();
    await expect(page.locator('[data-qa="event-card-head"]')).toHaveCount(1);
  });

  test("law 4: 90 days past its date, the purge takes the row AND its files", async ({ page }) => {
    const writes: Write[] = [];
    await openAdmin(
      page,
      board(
        [],
        [
          card("doomed", "Evento condenado", {
            eventDate: ymdDaysFromNow(-100),
            archivedAt: new Date(Date.now() - 95 * 864e5).toISOString(),
            imageUrl: `${STORAGE_PUB}/events/doomed.webp`,
            videoFileUrl: `${STORAGE_PUB}/events/doomed.mp4`,
          }),
          card("staying", "Evento reciente", {
            eventDate: ymdDaysFromNow(-10),
            archivedAt: new Date().toISOString(),
          }),
        ],
      ),
      writes,
    );

    await expect.poll(() => boardWrites(writes).length).toBeGreaterThan(0);
    const swept = lastBoard(writes);
    expect(swept.archive.map((i: { id: string }) => i.id)).toEqual(["staying"]);

    // The media went in the SAME sweep — both files, by their storage paths.
    const dels = writes.filter((w) => w.method === "DELETE" && w.url.includes("/storage/"));
    expect(dels.length).toBeGreaterThan(0);
    const deletedPaths = dels.map((w) => w.body ?? "").join(" ");
    expect(deletedPaths).toContain("events/doomed.webp");
    expect(deletedPaths).toContain("events/doomed.mp4");
  });
});
