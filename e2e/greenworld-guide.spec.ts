import { expect, test, type Page, type Route } from "@playwright/test";
import {
  forceLanguage,
  injectAdminSession,
  routeSupabase,
  streamTestUrls,
  STREAM_TEST_CODE,
  type Write,
} from "./_admin";
import { attachDiagnostics } from "./_helpers";
import { GREEN_WORLD_SHOP_URL } from "../src/lib/ventures";

/**
 * GW.GUIDE.1 — "Cómo comprar" lives ON /green-world, under the hero, edited
 * from the admin's Green World section.
 *
 *  GG1  Empty config: the section renders its H2 and the CTA (→ the shop) and
 *       nothing else — no video, no steps, no HowTo — and the rest of the page
 *       is unchanged.
 *  GG2  Full config: the EN clip for an English viewer, the ES clip for a
 *       Spanish one; three steps in order, the screenshot with its alt; the CTA
 *       is the configured signup URL; the head carries a 3-step HowTo.
 *  GG3  ES-only clip: an English viewer gets the Spanish clip plus the note; a
 *       Spanish viewer gets no note.
 *  GG4  Anchor: /green-world#como-comprar lands with the section in view once
 *       the data is in; the home act's CTA points at that anchor.
 *  GG5  Admin: the section exists; a step, a signup URL and Guardar upsert the
 *       whole value, videos null.
 */

const SECTION = '[data-qa="gw-guide"]';
const VIDEO = '[data-qa="gw-guide-video"]';
const NOTE = '[data-qa="gw-guide-video-note"]';
const STEPS = '[data-qa="gw-guide-steps"]';
const STEP = '[data-qa="gw-guide-step"]';
const CTA = '[data-qa="gw-guide-cta"]';
const HOWTO = 'script[type="application/ld+json"][data-qa="gw-guide-howto"]';

const ES_UID = "a".repeat(32);
const EN_UID = "b".repeat(32);
const SIGNUP = "https://example.com/registro";
const SHOT = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#2b7a4b"/></svg>',
).toString("base64")}`;

const fullGuide = {
  video: { es: `cfstream:${ES_UID}`, en: `cfstream:${EN_UID}` },
  signupUrl: SIGNUP,
  steps: [
    { id: "s1", title: { es: "Abre la tienda", en: "Open the shop" }, body: { es: "Entra con mi enlace.", en: "Use my link." }, image: null },
    {
      id: "s2",
      title: { es: "Crea tu cuenta", en: "Create your account" },
      body: { es: "Llena el formulario.", en: "Fill in the form." },
      image: { url: SHOT, alt: "Formulario de registro" },
    },
    { id: "s3", title: { es: "Haz tu pedido", en: "Place your order" }, body: { es: "", en: "" }, image: null },
  ],
};

/**
 * `greenworld_guide`, served after routeSupabase (LIFO → first). Every other
 * site_settings read and every write falls through to the house mock, which
 * captures the upsert.
 */
async function routeGuide(page: Page, value: unknown) {
  await page.route("**/rest/v1/site_settings*", (route: Route) => {
    const req = route.request();
    if (req.method() !== "GET" || !req.url().includes("greenworld_guide")) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: value === undefined ? "null" : JSON.stringify({ value }),
    });
  });
}

async function openGuide(page: Page, guide: unknown, lang: "es" | "en", hash = "") {
  const diag = attachDiagnostics(page);
  await forceLanguage(page, lang);
  await routeSupabase(page, { streamCustomerCode: STREAM_TEST_CODE, eventsBoard: { items: [] } });
  await routeGuide(page, guide);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/green-world${hash}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(SECTION)).toBeVisible();
  await expect(page.locator(SECTION)).not.toHaveAttribute("data-loading", "true");
  return diag;
}

test.describe("GW.GUIDE.1 public", () => {
  test("GG1 empty config: heading and CTA only, the page otherwise unchanged", async ({ page }) => {
    const diag = await openGuide(page, undefined, "es");
    const section = page.locator(SECTION);
    await expect(section.locator("h2")).toHaveText("Cómo comprar");
    await expect(page.locator(CTA)).toHaveAttribute("href", GREEN_WORLD_SHOP_URL);
    await expect(page.locator(CTA)).toHaveAttribute("target", "_blank");
    expect((await page.locator(CTA).getAttribute("rel")) ?? "").toContain("noopener");
    await expect(page.locator(VIDEO)).toHaveCount(0);
    await expect(page.locator(NOTE)).toHaveCount(0);
    await expect(page.locator(STEPS)).toHaveCount(0);
    await expect(page.locator(HOWTO)).toHaveCount(0);

    // The section sits directly under the hero, and the rest of the page is still there.
    await expect(page.locator("h1")).toContainText("Green World");
    const order = await page.evaluate(() =>
      [...document.querySelectorAll("main section")].map((s) => s.getAttribute("data-qa") ?? s.tagName.toLowerCase()),
    );
    expect(order.indexOf("gw-guide"), "guide is the page's second section (after the hero)").toBe(1);
    await expect(page.getByRole("heading", { name: /Bienestar Premium en Todo el Mundo/i })).toBeVisible();
    await expect(page.getByText(/Disclaimer:/)).toBeVisible();
    await expect(page.locator('[data-qa="gw-latest"]')).toHaveCount(0);

    expect(diag.consoleErrors, "no console errors").toEqual([]);
  });

  test("GG2 full config: the viewer's clip, three steps, the screenshot, the signup CTA, the HowTo", async ({ page }) => {
    const diag = await openGuide(page, fullGuide, "en");
    await expect(page.locator(VIDEO)).toHaveAttribute("data-stream-src", streamTestUrls(EN_UID).manifest);
    await expect(page.locator(VIDEO)).toHaveAttribute("poster", streamTestUrls(EN_UID).poster);
    await expect(page.locator(VIDEO)).toHaveAttribute("controls", "");
    expect(await page.locator(VIDEO).getAttribute("autoplay"), "no autoplay").toBeNull();
    await expect(page.locator(NOTE)).toHaveCount(0);

    const steps = page.locator(STEP);
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0).locator("h3")).toHaveText("Open the shop");
    await expect(steps.nth(1).locator("h3")).toHaveText("Create your account");
    await expect(steps.nth(2).locator("h3")).toHaveText("Place your order");
    const img = steps.nth(1).locator("img");
    await expect(img).toHaveAttribute("src", SHOT);
    await expect(img).toHaveAttribute("alt", "Formulario de registro");
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(steps.nth(0).locator("img")).toHaveCount(0);

    await expect(page.locator(CTA)).toHaveAttribute("href", SIGNUP);

    const howTo = JSON.parse((await page.locator(HOWTO).textContent()) ?? "{}");
    expect(howTo["@type"]).toBe("HowTo");
    expect(howTo.name).toBe("How to order");
    expect(howTo.step).toHaveLength(3);
    expect(howTo.step.map((s: { name: string }) => s.name)).toEqual(["Open the shop", "Create your account", "Place your order"]);
    expect(howTo.step[1].image).toBe(SHOT);
    expect(howTo.step[0].image).toBeUndefined();
    expect(diag.consoleErrors, "no console errors").toEqual([]);

    // The Spanish viewer gets the Spanish clip and the Spanish steps.
    await page.close();
  });

  test("GG2b full config, Spanish viewer: the ES clip", async ({ page }) => {
    await openGuide(page, fullGuide, "es");
    await expect(page.locator(VIDEO)).toHaveAttribute("data-stream-src", streamTestUrls(ES_UID).manifest);
    await expect(page.locator(NOTE)).toHaveCount(0);
    await expect(page.locator(STEP).nth(0).locator("h3")).toHaveText("Abre la tienda");
    const howTo = JSON.parse((await page.locator(HOWTO).textContent()) ?? "{}");
    expect(howTo.name).toBe("Cómo comprar");
    expect(howTo.step[0].name).toBe("Abre la tienda");
  });

  test("GG3 ES-only clip: the English viewer sees the Spanish clip and the note; the Spanish viewer no note", async ({ page }) => {
    const esOnly = { ...fullGuide, video: { es: `cfstream:${ES_UID}`, en: null } };
    await openGuide(page, esOnly, "en");
    await expect(page.locator(VIDEO)).toHaveAttribute("data-stream-src", streamTestUrls(ES_UID).manifest);
    await expect(page.locator(NOTE)).toBeVisible();
    await expect(page.locator(NOTE)).toHaveText("Video in Spanish");

    await page.close();
  });

  test("GG3b ES-only clip, Spanish viewer: no note", async ({ page }) => {
    const esOnly = { ...fullGuide, video: { es: `cfstream:${ES_UID}`, en: null } };
    await openGuide(page, esOnly, "es");
    await expect(page.locator(VIDEO)).toHaveAttribute("data-stream-src", streamTestUrls(ES_UID).manifest);
    await expect(page.locator(NOTE)).toHaveCount(0);
  });

  test("GG3c EN-only clip never stands in for the Spanish one", async ({ page }) => {
    const enOnly = { ...fullGuide, video: { es: null, en: `cfstream:${EN_UID}` } };
    await openGuide(page, enOnly, "es");
    await expect(page.locator(VIDEO)).toHaveCount(0);
    await expect(page.locator(NOTE)).toHaveCount(0);
  });

  test("GG4 anchor: /green-world#como-comprar lands on the section; the home act's CTA points there", async ({ page }) => {
    await openGuide(page, fullGuide, "es", "#como-comprar");
    // The re-aim waits for the data and the route's entrance, and the page
    // scrolls smoothly (index.css), so the landing is polled, not sampled.
    const sectionTop = () => page.locator(SECTION).evaluate((el) => Math.round(el.getBoundingClientRect().top));
    await expect
      .poll(async () => (await sectionTop()) < 800, { timeout: 10_000, message: "the guide scrolls into the viewport" })
      .toBe(true);
    await expect
      .poll(sectionTop, { timeout: 5_000, message: "the guide comes to rest below the fixed header" })
      .toBeGreaterThanOrEqual(0);
    // At rest: the section's top is under the header, not hidden behind it.
    const headerBottom = await page.locator("header").first().evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
    const top = await sectionTop();
    expect(top, "the guide's top is within the viewport").toBeLessThan(800);
    expect(top, "the guide's top clears the fixed header").toBeGreaterThanOrEqual(headerBottom - 1);
    expect(await page.evaluate(() => window.scrollY), "the page actually scrolled").toBeGreaterThan(100);

    await page.goto("/cinematic", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="gw-seq-cta"]')).toHaveAttribute("href", "/green-world#como-comprar");
  });
});

test.describe("GW.GUIDE.1 admin", () => {
  test("GG5 the Green World section writes the whole guide on Guardar", async ({ page }) => {
    const writes: Write[] = [];
    await injectAdminSession(page);
    await forceLanguage(page, "es");
    await routeSupabase(page, { writes });
    await routeGuide(page, undefined);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    const nav = page.locator('[data-qa="admin-nav-greenworld"]');
    await expect(nav).toHaveText(/Green World/);
    await nav.click();
    const section = page.locator('[data-qa="admin-greenworld"]');
    await expect(section).toBeVisible();
    await expect(section.locator('[data-qa="gwg-steps-empty"]')).toBeVisible();
    await expect(section.locator('[data-qa="gwg-view"]')).toHaveAttribute("href", "/green-world#como-comprar");

    const save = section.locator('[data-qa="gwg-save"]');
    await expect(save).toBeDisabled();

    await section.locator('[data-qa="gwg-step-add"]').click();
    const step = section.locator('[data-qa="gwg-step"]');
    await expect(step).toHaveCount(1);
    await step.locator('[data-qa="gwg-step-title-es"]').fill("Abre la tienda");
    await step.locator('[data-qa="gwg-step-body-es"]').fill("Entra con mi enlace.");

    const url = section.locator('[data-qa="gwg-signup-url"]');
    await url.fill("not a url");
    await expect(section.locator('[data-qa="gwg-signup-url-invalid"]')).toBeVisible();
    await expect(save).toBeDisabled();
    await url.fill(SIGNUP);
    await expect(section.locator('[data-qa="gwg-signup-url-invalid"]')).toHaveCount(0);
    await expect(save).toBeEnabled();
    await expect(section.locator('[data-qa="gwg-unsaved"]')).toBeVisible();

    await save.click();
    await expect(section.locator('[data-qa="flash-gwg-save"]')).toHaveAttribute("data-state", "saved");

    const upsert = writes.find((w) => w.url.includes("/rest/v1/site_settings") && w.method === "POST");
    expect(upsert, "one site_settings upsert").toBeTruthy();
    const raw = JSON.parse(upsert!.body ?? "{}");
    const row = Array.isArray(raw) ? raw[0] : raw;
    expect(row.key).toBe("greenworld_guide");
    expect(row.value.steps[0].title.es).toBe("Abre la tienda");
    expect(row.value.steps[0].body.es).toBe("Entra con mi enlace.");
    expect(row.value.signupUrl).toBe(SIGNUP);
    expect(row.value.video).toEqual({ es: null, en: null });

    await expect(section.locator('[data-qa="gwg-unsaved"]')).toHaveCount(0);
    await expect(save).toBeDisabled();
  });
});
