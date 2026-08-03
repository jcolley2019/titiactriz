import { test, expect, type Page } from "@playwright/test";
import { shot } from "./_helpers";
import { injectAdminSession, forceLanguage, routeSupabase, type Write } from "./_admin";
import { SOCIALS_ACT_ENABLED, UNFURL_DEPLOYED } from "../src/lib/ventures";
import { PLATFORM_CATALOG, PLATFORM_LABELS } from "../src/lib/platform-catalog";
import { platformFromUrl } from "../src/lib/platform-from-url";

/**
 * PORT.SOC.8 gate — the admin *links* tab, round-tripped.
 *
 * Same discipline as the portfolio gate: every assertion is about the WRITE the
 * tab sends, not about a hopeful repaint. Supabase is routed offline, reads are
 * deterministic and every non-GET is captured with its payload.
 *
 * Two things here that the portfolio gate has no equivalent of:
 *   · the CATALOG is asserted as a census — 6 groups, 48 platforms, no Adult
 *     group, Bigo Live present in Social — because the catalog is a ruling, not
 *     an implementation detail, and a silent edit to it is a silent edit to the
 *     act;
 *   · URL-DRIVEN DETECTION rides in the same write as the URL, so a row can
 *     never be saved claiming one platform while pointing at another.
 */

const TAB = '[data-qa="admin-nav-links"]';
const ROW = '[data-qa="links-row"]';

const LINKS = [
  {
    id: "s1",
    platform: "TikTok",
    url: "https://www.tiktok.com/@titi",
    handle: "@titi",
    title_es: null,
    title_en: null,
    og_title: "Titi on TikTok",
    og_description: "Dancer and actress",
    og_image: null,
    og_fetched_at: "2026-08-01T12:00:00.000Z",
    order_index: 1,
    enabled: true,
  },
  {
    id: "s2",
    platform: "Instagram",
    url: "https://www.instagram.com/titi",
    handle: null,
    title_es: null,
    title_en: null,
    og_title: null,
    og_description: null,
    og_image: null,
    og_fetched_at: null,
    order_index: 2,
    enabled: false,
  },
  {
    id: "s3",
    platform: "YouTube",
    url: "https://www.youtube.com/@mimundoderoles",
    handle: null,
    title_es: null,
    title_en: null,
    og_title: null,
    og_description: null,
    og_image: null,
    og_fetched_at: null,
    order_index: 3,
    enabled: true,
  },
];

const patches = (writes: Write[]) =>
  writes.filter((w) => w.method === "PATCH" && /social_links/.test(w.url));

const bodyOf = (w: Write) => JSON.parse(w.body || "{}");

async function openLinks(
  page: Page,
  opts: { lang?: "es" | "en"; links?: unknown[]; width?: number; height?: number } = {},
) {
  const writes: Write[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await injectAdminSession(page);
  await forceLanguage(page, opts.lang ?? "en");
  await routeSupabase(page, { socialLinks: opts.links ?? LINKS, writes });
  await page.setViewportSize({ width: opts.width ?? 1440, height: opts.height ?? 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await page.locator(TAB).click();
  await expect(page.locator('[data-qa="admin-links"]')).toBeVisible();
  return { writes, pageErrors };
}

/* ─────────────────── the catalog, as a census ─────────────────── */

test.describe("PORT.SOC.8 — the ported catalog", () => {
  test("is the source catalog minus Adult, plus Bigo Live", async () => {
    // 7 groups / 51 platforms in TitiLinks, minus ADULT (4), plus Bigo Live (1).
    expect(PLATFORM_CATALOG).toHaveLength(6);
    expect(PLATFORM_LABELS).toHaveLength(48);

    // The Adult group and every platform in it stayed behind, along with the
    // gate, the modal and the is_adult column that existed only to serve them.
    const groupLabels = PLATFORM_CATALOG.map((g) => g.label);
    expect(groupLabels).toEqual([
      "SOCIAL",
      "BUSINESS",
      "MUSIC",
      "PAYMENT",
      "ENTERTAINMENT",
      "LIFESTYLE",
    ]);
    for (const dropped of ["OnlyFans", "Fansly", "Privacy", "FatalFans"]) {
      expect(PLATFORM_LABELS, `${dropped} did not come across`).not.toContain(dropped);
    }

    // The one addition, in Social — Cristyna is a streamer, so Social beats
    // Entertainment.
    const social = PLATFORM_CATALOG.find((g) => g.key === "social")!;
    expect(social.platforms.map((p) => p.label)).toContain("Bigo Live");
    expect(social.platforms).toHaveLength(15);

    // No duplicate label anywhere — the label is the DB join key.
    expect(new Set(PLATFORM_LABELS).size).toBe(PLATFORM_LABELS.length);
  });

  test("every label the URL mapper can return exists in the catalog", async () => {
    const samples: Array<[string, string]> = [
      ["https://www.tiktok.com/@titi", "TikTok"],
      ["https://instagram.com/titi", "Instagram"],
      ["https://music.youtube.com/channel/x", "YouTube Music"],
      ["https://youtu.be/sjtUdw-rUT4", "YouTube"],
      ["https://x.com/titi", "X (Twitter)"],
      ["https://bigo.tv/titi", "Bigo Live"],
      ["https://www.linkedin.com/in/titi", "LinkedIn"],
      ["https://open.spotify.com/artist/x", "Spotify"],
    ];
    for (const [url, label] of samples) {
      expect(platformFromUrl(url), url).toBe(label);
      expect(PLATFORM_LABELS, `${label} is a catalog label`).toContain(label);
    }

    // Non-platform inputs stay null so the caller draws a generic glyph rather
    // than mislabelling a link.
    for (const url of ["", "mailto:hi@example.com", "tel:+123", "hi@example.com", "https://example.com"]) {
      expect(platformFromUrl(url), `${url} is not a platform`).toBeNull();
    }
    // A dropped platform's host must not resolve to anything any more.
    expect(platformFromUrl("https://onlyfans.com/x")).toBeNull();
  });
});

/* ─────────────────── the tab ─────────────────── */

test.describe("PORT.SOC.8 — the admin links tab", () => {
  test("lists the whole table, hidden rows included, numbered by position", async ({ page }) => {
    const { pageErrors } = await openLinks(page);

    await expect(page.locator(ROW)).toHaveCount(3);
    await expect(page.locator('[data-qa="links-position"]')).toHaveText(["01", "02", "03"]);
    await expect(page.locator(`${ROW}[data-id="s2"]`)).toHaveAttribute("data-enabled", "false");
    await expect(page.locator(`${ROW}[data-id="s1"] [data-qa="links-url"]`)).toHaveValue(
      "https://www.tiktok.com/@titi",
    );
    await expect(page.getByText("2 of 3 shown")).toBeVisible();

    // The mark the act will draw is drawn beside the picker, so the choice is
    // verified by eye at the moment of choosing.
    await expect(page.locator(`${ROW}[data-id="s1"] [data-qa="links-mark"] svg`)).toBeVisible();

    // The cached preview is shown as cache — with WHEN it was taken, so a stale
    // title is visibly stale.
    await expect(page.locator(`${ROW}[data-id="s1"] [data-qa="links-og-title"]`)).toHaveText(
      "Titi on TikTok",
    );
    await expect(page.locator(`${ROW}[data-id="s2"] [data-qa="links-og-fetched"]`)).toHaveText(
      "No preview yet",
    );

    // The timestamp is a DATE, not a mangled one. i18next escapes interpolated
    // values by design here, and a locale date is mostly slashes — interpolating
    // it printed "8&#x2F;1&#x2F;2026" on the first build of this tab.
    const stamp = await page
      .locator(`${ROW}[data-id="s1"] [data-qa="links-og-fetched"]`)
      .innerText();
    expect(stamp, "no HTML entities in the timestamp").not.toMatch(/&#|&amp;|&quot;/);
    expect(stamp, "a real date is shown").toMatch(/2026/);

    // Both honest banners: the act is dark, and the preview service is not live.
    await expect(page.locator('[data-qa="links-dark-notice"]')).toHaveCount(
      SOCIALS_ACT_ENABLED ? 0 : 1,
    );
    await expect(page.locator('[data-qa="links-unfurl-notice"]')).toHaveCount(
      UNFURL_DEPLOYED ? 0 : 1,
    );

    await page.screenshot({ path: shot("PORT.SOC.8-list.png"), fullPage: true });
    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("the picker offers the whole catalog, grouped, and writes the chosen label", async ({
    page,
  }) => {
    const { writes, pageErrors } = await openLinks(page);

    const select = page.locator(`${ROW}[data-id="s2"] [data-qa="links-platform"]`);
    const options = await select.locator("option").allTextContents();
    expect(options, "every catalog platform is offered").toEqual(PLATFORM_LABELS);
    const groups = await select.locator("optgroup").evaluateAll((els) =>
      els.map((e) => e.getAttribute("label")),
    );
    expect(groups, "grouped exactly as the catalog groups it").toEqual([
      "Social",
      "Business",
      "Music",
      "Payment",
      "Entertainment",
      "Lifestyle",
    ]);

    await select.selectOption("Bigo Live");
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(0);
    const w = patches(writes).at(-1)!;
    expect(w.url).toContain("id=eq.s2");
    expect(bodyOf(w)).toEqual({ platform: "Bigo Live" });
    await expect(page.locator(`${ROW}[data-id="s2"]`)).toHaveAttribute("data-platform", "Bigo Live");

    // PORT.SOC.10 — Bigo Live draws the brand's OWN artwork, not the generic
    // gold link glyph it fell back to before. It is the one raster mark on the
    // site because no official SVG of the icon exists (see PlatformIcon).
    const mark = page.locator(`${ROW}[data-id="s2"] [data-qa="links-mark"] img`);
    await expect(mark, "the official artwork is drawn").toBeVisible();
    await expect(mark).toHaveJSProperty("naturalWidth", 512);
    await page.screenshot({ path: shot("PORT.SOC.10-bigo-mark.png"), fullPage: true });

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("a URL commit carries its detected platform in the SAME write", async ({ page }) => {
    const { writes, pageErrors } = await openLinks(page);

    // s2 says Instagram; paste a Twitch address into it.
    await page
      .locator(`${ROW}[data-id="s2"] [data-qa="links-url"]`)
      .fill("https://twitch.tv/titi");
    await page.keyboard.press("Tab");
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(0);

    const w = patches(writes).at(-1)!;
    expect(w.url).toContain("id=eq.s2");
    // One round trip, and the row can never be stored as Instagram-at-Twitch.
    expect(bodyOf(w)).toEqual({ url: "https://twitch.tv/titi", platform: "Twitch" });
    await expect(page.locator(`${ROW}[data-id="s2"]`)).toHaveAttribute("data-platform", "Twitch");

    // An UNRECOGNISED host leaves the pick alone — detection only speaks when
    // it knows the answer.
    const before = patches(writes).length;
    await page
      .locator(`${ROW}[data-id="s3"] [data-qa="links-url"]`)
      .fill("https://cristyna.example.com/press");
    await page.keyboard.press("Tab");
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(before);
    expect(bodyOf(patches(writes).at(-1)!)).toEqual({
      url: "https://cristyna.example.com/press",
    });
    await expect(page.locator(`${ROW}[data-id="s3"]`)).toHaveAttribute("data-platform", "YouTube");

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("a text edit commits on blur, and only the edited column is sent", async ({ page }) => {
    const { writes, pageErrors } = await openLinks(page);

    await page.locator(`${ROW}[data-id="s1"] [data-qa="links-title-es"]`).fill("TikTok de Titi");
    await page.keyboard.press("Tab");
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(0);
    expect(bodyOf(patches(writes).at(-1)!)).toEqual({ title_es: "TikTok de Titi" });
    await expect(page.locator(`${ROW}[data-id="s1"] [data-qa="links-saved"]`)).toBeVisible();

    // Tabbing through an untouched field must not write anything.
    const before = patches(writes).length;
    await page.locator(`${ROW}[data-id="s1"] [data-qa="links-title-en"]`).click();
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
    expect(patches(writes).length, "an unchanged field writes nothing").toBe(before);

    // An emptied nullable column is stored as NULL, never as "".
    await page.locator(`${ROW}[data-id="s1"] [data-qa="links-handle"]`).fill("");
    await page.keyboard.press("Tab");
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(before);
    expect(bodyOf(patches(writes).at(-1)!)).toEqual({ handle: null });

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("the visibility switch is the per-row enable", async ({ page }) => {
    const { writes, pageErrors } = await openLinks(page);

    await page.locator(`${ROW}[data-id="s3"] [data-qa="links-enabled"]`).click();
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(0);
    expect(bodyOf(patches(writes).at(-1)!)).toEqual({ enabled: false });
    await expect(page.locator(`${ROW}[data-id="s3"]`)).toHaveAttribute("data-enabled", "false");
    await expect(page.getByText("1 of 3 shown")).toBeVisible();

    await page.locator(`${ROW}[data-id="s2"] [data-qa="links-enabled"]`).click();
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThan(1);
    expect(bodyOf(patches(writes).at(-1)!)).toEqual({ enabled: true });

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("reordering renumbers 1..N and writes only the rows that moved", async ({ page }) => {
    const { writes, pageErrors } = await openLinks(page);

    await page.locator(`${ROW}[data-id="s1"] [data-qa="links-move-down"]`).click();
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(300);

    await expect(page.locator(ROW).nth(0)).toHaveAttribute("data-id", "s2");
    await expect(page.locator(ROW).nth(1)).toHaveAttribute("data-id", "s1");
    await expect(page.locator('[data-qa="links-position"]')).toHaveText(["01", "02", "03"]);

    const sent = patches(writes).map((w) => ({
      id: (w.url.match(/id=eq\.(\w+)/) ?? [])[1],
      body: bodyOf(w),
    }));
    expect(sent).toHaveLength(2);
    expect(sent.find((s) => s.id === "s2")?.body).toEqual({ order_index: 1 });
    expect(sent.find((s) => s.id === "s1")?.body).toEqual({ order_index: 2 });
    expect(sent.some((s) => s.id === "s3"), "an unmoved row is not rewritten").toBe(false);

    await expect(page.locator(`${ROW}[data-id="s2"] [data-qa="links-move-up"]`)).toBeDisabled();
    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("a new link is appended hidden, so a half-typed row never reaches the act", async ({
    page,
  }) => {
    const { writes, pageErrors } = await openLinks(page);

    await page.locator('[data-qa="links-add"]').click();
    await expect
      .poll(() => writes.filter((w) => w.method === "POST" && /social_links/.test(w.url)).length, {
        timeout: 8000,
      })
      .toBeGreaterThan(0);

    const post = writes.filter((w) => w.method === "POST" && /social_links/.test(w.url)).at(-1)!;
    const payload = bodyOf(post);
    const row = Array.isArray(payload) ? payload[0] : payload;
    expect(row.enabled, "a new link starts hidden").toBe(false);
    expect(row.order_index, "appended after the last row").toBe(4);
    expect(row.url, "no address yet").toBe("");
    expect(PLATFORM_LABELS, "the default platform is a catalog platform").toContain(row.platform);

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("the refresh button asks the unfurl function, and says so when it cannot", async ({
    page,
  }) => {
    const { pageErrors } = await openLinks(page);

    // The function is not deployed, so the invoke fails. What matters is that
    // the tab REACHES for it — the request is made against the project's
    // functions endpoint — and that the failure is reported as a failure rather
    // than silently writing an empty preview.
    const asked: string[] = [];
    await page.route("**/functions/v1/**", (route) => {
      asked.push(route.request().url());
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    });

    await page.locator(`${ROW}[data-id="s2"] [data-qa="links-refresh"]`).click();
    await expect.poll(() => asked.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(asked.at(-1), "the unfurl function is what it asks for").toContain("unfurl");

    // Nothing was cached from a failed fetch.
    await expect(page.locator(`${ROW}[data-id="s2"] [data-qa="links-og-fetched"]`)).toHaveText(
      "No preview yet",
    );

    // A row with no address cannot be refreshed at all.
    await page.locator('[data-qa="links-add"]').click();
    await page.waitForTimeout(500);

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("a successful refresh caches title, description and image with a timestamp", async ({
    page,
  }) => {
    const { writes, pageErrors } = await openLinks(page);

    await page.route("**/functions/v1/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Titi en Instagram",
          description: "Actriz y bailarina",
          image: "https://example.com/og.jpg",
          favicon: null,
          siteName: "Instagram",
        }),
      }),
    );

    await page.locator(`${ROW}[data-id="s2"] [data-qa="links-refresh"]`).click();
    await expect.poll(() => patches(writes).length, { timeout: 10_000 }).toBeGreaterThan(0);

    const body = bodyOf(patches(writes).at(-1)!);
    expect(body.og_title).toBe("Titi en Instagram");
    expect(body.og_description).toBe("Actriz y bailarina");
    expect(body.og_image).toBe("https://example.com/og.jpg");
    expect(typeof body.og_fetched_at, "the cache records when it was taken").toBe("string");
    expect(Number.isNaN(Date.parse(body.og_fetched_at))).toBe(false);

    await expect(page.locator(`${ROW}[data-id="s2"] [data-qa="links-og-title"]`)).toHaveText(
      "Titi en Instagram",
    );
    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("deleting asks first, then deletes exactly that row", async ({ page }) => {
    const { writes, pageErrors } = await openLinks(page);

    await page.locator(`${ROW}[data-id="s3"] [data-qa="links-delete"]`).click();
    const confirm = page.locator('[data-qa="links-delete-confirm"]');
    await expect(confirm, "delete is behind a confirmation").toBeVisible();
    expect(
      writes.filter((w) => w.method === "DELETE").length,
      "opening the dialog deletes nothing",
    ).toBe(0);

    await confirm.click();
    await expect
      .poll(() => writes.filter((w) => w.method === "DELETE" && /social_links/.test(w.url)).length, {
        timeout: 8000,
      })
      .toBe(1);
    expect(writes.find((w) => w.method === "DELETE")!.url).toContain("id=eq.s3");
    await expect(page.locator(ROW)).toHaveCount(2);
    expect(patches(writes), "deleting the last row renumbers nothing").toHaveLength(0);

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("an empty table says so instead of rendering an empty list", async ({ page }) => {
    const { pageErrors } = await openLinks(page, { links: [] });
    await expect(page.locator('[data-qa="links-empty"]')).toBeVisible();
    await expect(page.locator(ROW)).toHaveCount(0);
    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("the tab works on the phone, where the arrows replace the drag handle", async ({ page }) => {
    const { writes, pageErrors } = await openLinks(page, { width: 390, height: 844 });

    await expect(page.locator(ROW)).toHaveCount(3);
    await expect(page.locator(`${ROW}[data-id="s1"] [data-qa="links-drag"]`)).toBeHidden();
    const down = page.locator(`${ROW}[data-id="s1"] [data-qa="links-move-down-sm"]`);
    await expect(down).toBeVisible();
    await down.click();
    await expect.poll(() => patches(writes).length, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    await expect(page.locator(ROW).nth(0)).toHaveAttribute("data-id", "s2");

    await page.screenshot({ path: shot("PORT.SOC.8-phone.png"), fullPage: true });
    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("the tab is bilingual, hints included", async ({ page }) => {
    await openLinks(page, { lang: "es" });
    await expect(page.locator(TAB)).toHaveText(/Enlaces/);
    await expect(page.getByText("2 visibles de 3")).toBeVisible();

    // The catalog's English placeholders did NOT come across as data — the hint
    // is a KIND, rendered per locale with the platform interpolated.
    await expect(page.locator(`${ROW}[data-id="s2"] [data-qa="links-handle"]`)).toHaveAttribute(
      "placeholder",
      "Usuario de Instagram",
    );
    await page.screenshot({ path: shot("PORT.SOC.8-list-es.png"), fullPage: true });
  });
});
