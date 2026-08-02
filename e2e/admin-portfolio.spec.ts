import { test, expect, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { injectAdminSession, forceLanguage, routeSupabase, type Write } from "./_admin";
import { ACTING_ACT_ENABLED } from "../src/lib/ventures";

/**
 * PORT.ACT.3 gate — the admin *portfolio* tab, round-tripped.
 *
 * Every assertion here is about the WRITE the tab sends, not about a hopeful
 * repaint: the Supabase project is routed offline by `_admin.ts`, so reads are
 * deterministic and every non-GET is captured with its payload. A UI that looks
 * right while sending the wrong PATCH is the failure this file exists to catch.
 *
 * The tab is deliberately NOT gated on ACTING_ACT_ENABLED — credits have to be
 * enterable before the act can honestly be switched on (brick 4).
 */

const TAB = '[data-qa="admin-nav-portfolio"]';
const ROW = '[data-qa="portfolio-credit"]';

const CREDITS = [
  {
    id: "c1",
    kind: "reel",
    title_es: "El Casting",
    title_en: "The Casting",
    role_es: null,
    role_en: null,
    production: null,
    year: 2025,
    url: "https://example.com/el-casting",
    video_id: null,
    order_index: 1,
    enabled: true,
  },
  {
    id: "c2",
    kind: "film",
    title_es: "Segundo",
    title_en: "Second",
    role_es: null,
    role_en: null,
    production: null,
    year: null,
    url: null,
    video_id: null,
    order_index: 2,
    enabled: false,
  },
  {
    id: "c3",
    kind: "theatre",
    title_es: "Tercero",
    title_en: "Third",
    role_es: null,
    role_en: null,
    production: null,
    year: null,
    url: null,
    video_id: null,
    order_index: 3,
    enabled: true,
  },
];

const patches = (writes: Write[]) =>
  writes.filter((w) => w.method === "PATCH" && /acting_credits/.test(w.url));

/** Open /admin, land on the portfolio tab, and return the write log. */
async function openPortfolio(
  page: Page,
  opts: { lang?: "es" | "en"; credits?: unknown[]; width?: number; height?: number } = {},
) {
  const writes: Write[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await injectAdminSession(page);
  await forceLanguage(page, opts.lang ?? "en");
  await routeSupabase(page, { actingCredits: opts.credits ?? CREDITS, writes });
  await page.setViewportSize({ width: opts.width ?? 1440, height: opts.height ?? 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await page.locator(TAB).click();
  await expect(page.locator('[data-qa="admin-portfolio"]')).toBeVisible();
  return { writes, pageErrors };
}

test.describe("PORT.ACT.3 — the admin portfolio tab", () => {
  test("lists the whole table, hidden rows included, numbered by position", async ({ page }) => {
    const { pageErrors } = await openPortfolio(page);

    await expect(page.locator(ROW)).toHaveCount(3);
    await expect(page.locator('[data-qa="portfolio-position"]')).toHaveText(["01", "02", "03"]);

    // The act publishes only enabled rows; the admin must show the hidden ones
    // too, or a disabled credit becomes invisible to the person who disabled it.
    await expect(page.locator(`${ROW}[data-id="c2"]`)).toHaveAttribute("data-enabled", "false");
    await expect(page.locator(`${ROW}[data-id="c1"] [data-qa="portfolio-title-es"]`)).toHaveValue(
      "El Casting",
    );
    await expect(page.locator(`${ROW}[data-id="c1"] [data-qa="portfolio-title-en"]`)).toHaveValue(
      "The Casting",
    );
    await expect(page.getByText("2 of 3 shown")).toBeVisible();

    // While the act is dark, the tab says so rather than letting saved credits
    // look broken. When brick 4 flips the flag, the banner goes away by itself.
    await expect(page.locator('[data-qa="portfolio-dark-notice"]')).toHaveCount(
      ACTING_ACT_ENABLED ? 0 : 1,
    );

    await page.screenshot({ path: shot("PORT.ACT.3-list.png"), fullPage: true });
    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("a text edit commits on blur, and only the edited column is sent", async ({ page }) => {
    const { writes, pageErrors } = await openPortfolio(page);

    const titleEs = page.locator(`${ROW}[data-id="c1"] [data-qa="portfolio-title-es"]`);
    await titleEs.fill("El Casting (corto)");
    await page.keyboard.press("Tab");
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(0);

    const w = patches(writes)[0];
    expect(w.url, "the write targets that row").toContain("id=eq.c1");
    expect(JSON.parse(w.body || "{}")).toEqual({ title_es: "El Casting (corto)" });
    await expect(page.locator(`${ROW}[data-id="c1"] [data-qa="portfolio-saved"]`)).toBeVisible();

    // Tabbing through an untouched field must not write anything.
    const before = patches(writes).length;
    await page.locator(`${ROW}[data-id="c1"] [data-qa="portfolio-title-en"]`).click();
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
    expect(patches(writes).length, "an unchanged field writes nothing").toBe(before);

    // An emptied nullable column is stored as NULL, never as "".
    await page.locator(`${ROW}[data-id="c1"] [data-qa="portfolio-url"]`).fill("");
    await page.keyboard.press("Tab");
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(before);
    expect(JSON.parse(patches(writes).at(-1)!.body || "{}")).toEqual({ url: null });

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("the visibility switch is the per-row enable", async ({ page }) => {
    const { writes, pageErrors } = await openPortfolio(page);

    await page.locator(`${ROW}[data-id="c3"] [data-qa="portfolio-enabled"]`).click();
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(0);
    const w = patches(writes).at(-1)!;
    expect(w.url).toContain("id=eq.c3");
    expect(JSON.parse(w.body || "{}")).toEqual({ enabled: false });
    await expect(page.locator(`${ROW}[data-id="c3"]`)).toHaveAttribute("data-enabled", "false");
    await expect(page.getByText("1 of 3 shown")).toBeVisible();

    // Turning a hidden row on is the same gesture in reverse.
    await page.locator(`${ROW}[data-id="c2"] [data-qa="portfolio-enabled"]`).click();
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(1);
    expect(JSON.parse(patches(writes).at(-1)!.body || "{}")).toEqual({ enabled: true });

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("reordering renumbers 1..N and writes only the rows that moved", async ({ page }) => {
    const { writes, pageErrors } = await openPortfolio(page);

    await page.locator(`${ROW}[data-id="c1"] [data-qa="portfolio-move-down"]`).click();
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(300);

    // c1 and c2 swapped; c3 never moved, so nothing was written for it.
    await expect(page.locator(ROW).nth(0)).toHaveAttribute("data-id", "c2");
    await expect(page.locator(ROW).nth(1)).toHaveAttribute("data-id", "c1");
    await expect(page.locator('[data-qa="portfolio-position"]')).toHaveText(["01", "02", "03"]);

    const sent = patches(writes).map((w) => ({
      id: (w.url.match(/id=eq\.(\w+)/) ?? [])[1],
      body: JSON.parse(w.body || "{}"),
    }));
    expect(sent).toHaveLength(2);
    expect(sent.find((s) => s.id === "c2")?.body).toEqual({ order_index: 1 });
    expect(sent.find((s) => s.id === "c1")?.body).toEqual({ order_index: 2 });
    expect(sent.some((s) => s.id === "c3"), "an unmoved row is not rewritten").toBe(false);

    // The first row can no longer move up — the ends are disabled, not silent.
    await expect(
      page.locator(`${ROW}[data-id="c2"] [data-qa="portfolio-move-up"]`),
    ).toBeDisabled();

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("a new credit is appended hidden, so a half-typed row never reaches the act", async ({
    page,
  }) => {
    const { writes, pageErrors } = await openPortfolio(page);

    await page.locator('[data-qa="portfolio-add"]').click();
    await expect
      .poll(
        () => writes.filter((w) => w.method === "POST" && /acting_credits/.test(w.url)).length,
        { timeout: 8000 },
      )
      .toBeGreaterThan(0);

    const post = writes.filter((w) => w.method === "POST" && /acting_credits/.test(w.url)).at(-1)!;
    const payload = JSON.parse(post.body || "{}");
    const row = Array.isArray(payload) ? payload[0] : payload;
    expect(row.enabled, "a new credit starts hidden").toBe(false);
    expect(row.order_index, "appended after the last row").toBe(4);
    expect(row.title_es).toBe("");
    expect(row.kind).toBe("reel");

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("deleting asks first, then deletes exactly that row", async ({ page }) => {
    const { writes, pageErrors } = await openPortfolio(page);

    await page.locator(`${ROW}[data-id="c3"] [data-qa="portfolio-delete"]`).click();
    const confirm = page.locator('[data-qa="portfolio-delete-confirm"]');
    await expect(confirm, "delete is behind a confirmation").toBeVisible();
    expect(
      writes.filter((w) => w.method === "DELETE").length,
      "opening the dialog deletes nothing",
    ).toBe(0);

    await confirm.click();
    await expect
      .poll(
        () => writes.filter((w) => w.method === "DELETE" && /acting_credits/.test(w.url)).length,
        { timeout: 8000 },
      )
      .toBe(1);
    const del = writes.find((w) => w.method === "DELETE")!;
    expect(del.url).toContain("id=eq.c3");
    await expect(page.locator(ROW)).toHaveCount(2);
    // c3 was last, so the survivors keep their numbers — no order write follows.
    expect(patches(writes), "deleting the last row renumbers nothing").toHaveLength(0);

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("an empty table says so instead of rendering an empty list", async ({ page }) => {
    const { pageErrors } = await openPortfolio(page, { credits: [] });
    await expect(page.locator('[data-qa="portfolio-empty"]')).toBeVisible();
    await expect(page.locator(ROW)).toHaveCount(0);
    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("the tab works on the phone, where the arrows replace the drag handle", async ({ page }) => {
    const { writes, pageErrors } = await openPortfolio(page, { width: 390, height: 844 });

    await expect(page.locator(ROW)).toHaveCount(3);
    await expect(page.locator(`${ROW}[data-id="c1"] [data-qa="portfolio-drag"]`)).toBeHidden();
    const down = page.locator(`${ROW}[data-id="c1"] [data-qa="portfolio-move-down-sm"]`);
    await expect(down).toBeVisible();
    await down.click();
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    await expect(page.locator(ROW).nth(0)).toHaveAttribute("data-id", "c2");

    await page.screenshot({ path: shot("PORT.ACT.3-phone.png"), fullPage: true });
    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("the tab label is bilingual", async ({ page }) => {
    await injectAdminSession(page);
    await forceLanguage(page, "es");
    await routeSupabase(page, { actingCredits: CREDITS });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await expect(page.locator(TAB)).toHaveText(/Portafolio/);
    await page.locator(TAB).click();
    await expect(page.getByText("2 visibles de 3")).toBeVisible();
  });
});
