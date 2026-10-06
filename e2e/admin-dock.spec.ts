import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, markCoachSeen, MOCK_PHOTOS, routeSupabase } from "./_admin";
import { TOUR_IDS } from "../src/components/admin/coach/tours";

/**
 * ADMIN.FIXES.1 — the Galería's live-preview dock.
 *
 *  D1  a fresh device opens it COLLAPSED (the bar alone, no marquee); the bar
 *      opens and closes it, and the choice is remembered on this device
 *      (localStorage admin.livePreview.open) across reloads
 *  D2  light and dark: the bar reads as a control — one <button> across the bar
 *      (aria-expanded), a 1px hairline on top in the theme's gold, and the eye
 *      and "VISTA PREVIA EN VIVO" in the theme's gold ink, ≥4.5:1 on the dock
 *  D3  the first time the Galería mounts in a visit, the bar pulses soft gold
 *      twice and is then still; back on the tab later in the visit, no pulse;
 *      a reload is a new visit
 *  D4  under reduced motion there is no pulse at all
 *  D5  a coaching tip open over the Galería holds the pulse; it plays once the
 *      tip closes
 *
 * Screenshots (collapsed and open, light and dark, 390×844 and 1440×900) land
 * in _qa/admin-fixes/.
 */

const SHOTS = "_qa/admin-fixes";
const OPEN_KEY = "admin.livePreview.open";

/** MOCK_PHOTOS as the admin reads them: published, live, in order. */
const PUBLISHED = MOCK_PHOTOS.map((p, i) => ({
  ...p,
  is_published: true,
  is_archived: false,
  sort_order: i + 1,
  created_at: "2026-09-01T00:00:00Z",
  content_hash: null,
  master_url: null,
  master_width: null,
  master_height: null,
}));

const dock = (page: Page) => page.locator('[data-qa="live-preview-dock"]');
const bar = (page: Page) => page.locator('[data-qa="live-preview-toggle"]');
const tiles = (page: Page) => page.locator('[data-qa="live-preview-dock"] [data-qa="gallery-photo"]');
const pulse = (page: Page) => page.locator('[data-qa="live-preview-pulse"]');
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), OPEN_KEY);

type Size = { width: number; height: number };

async function openGallery(
  page: Page,
  opts: { theme?: "light" | "dark"; size?: Size; coachSeen?: boolean } = {},
) {
  if (opts.theme) await page.addInitScript((t) => localStorage.setItem("admin.theme", t), opts.theme);
  await forceLanguage(page, "es");
  await injectAdminSession(page, { coachSeen: opts.coachSeen });
  await routeSupabase(page, { photos: PUBLISHED });
  await page.setViewportSize(opts.size ?? { width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-qa="admin-section-gallery"]')).toBeVisible();
  await expect(dock(page)).toBeVisible();
}

/* ---------------- colour arithmetic ---------------- */

const channels = (css: string) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const luminance = (css: string) => {
  const [r, g, b] = channels(css).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The theme's gold (rules) and gold ink (text), resolved inside the dock itself. */
const themeGold = (page: Page) =>
  dock(page).evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "hsl(var(--accent))";
    probe.style.backgroundColor = "hsl(var(--accent-ink, var(--accent)))";
    el.appendChild(probe);
    const s = getComputedStyle(probe);
    const out = { accent: s.color, ink: s.backgroundColor };
    probe.remove();
    return out;
  });

test("D1 a fresh device opens the dock collapsed; the bar toggles it and the choice is remembered", async ({ page }) => {
  await openGallery(page);
  await expect(dock(page)).toHaveAttribute("data-open", "false");
  await expect(bar(page)).toHaveAttribute("aria-expanded", "false");
  await expect(bar(page)).toContainText("Expandir");
  await expect(tiles(page)).toHaveCount(0);
  expect(await stored(page)).toBeNull();
  // The bar alone: a strip, not a shelf.
  expect((await dock(page).boundingBox())!.height).toBeLessThan(60);

  await bar(page).click();
  await expect(dock(page)).toHaveAttribute("data-open", "true");
  await expect(bar(page)).toHaveAttribute("aria-expanded", "true");
  await expect(bar(page)).toContainText("Colapsar");
  await expect(tiles(page).first()).toBeVisible();
  expect(await stored(page)).toBe("true");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(dock(page)).toHaveAttribute("data-open", "true");
  await expect(tiles(page).first()).toBeVisible();

  await bar(page).click();
  await expect(dock(page)).toHaveAttribute("data-open", "false");
  await expect(tiles(page)).toHaveCount(0);
  expect(await stored(page)).toBe("false");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(dock(page)).toHaveAttribute("data-open", "false");
  await expect(tiles(page)).toHaveCount(0);
});

for (const theme of ["light", "dark"] as const) {
  test(`D2 ${theme}: the bar reads as a control — one button, a gold hairline, the eye and the label in gold`, async ({
    page,
  }) => {
    await openGallery(page, { theme });
    await expect(page.locator(`[data-admin-theme="${theme}"]`)).toHaveCount(1);
    const gold = await themeGold(page);

    // One button across the whole bar: the label and the Expandir affordance are both inside it.
    expect(await bar(page).evaluate((el) => el.tagName)).toBe("BUTTON");
    const b = (await bar(page).boundingBox())!;
    for (const part of ['[data-qa="live-preview-label"]', '[data-qa="live-preview-eye"]']) {
      const p = (await page.locator(part).boundingBox())!;
      expect(p.x).toBeGreaterThanOrEqual(b.x);
      expect(p.x + p.width).toBeLessThanOrEqual(b.x + b.width);
    }
    const chevronText = (await bar(page).getByText("Expandir").boundingBox())!;
    expect(chevronText.x + chevronText.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
    expect(chevronText.x).toBeGreaterThan(b.x + b.width / 2);

    // The hairline on top: 1px, the theme's gold.
    const edge = await dock(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.borderTopColor, width: s.borderTopWidth, ground: s.backgroundColor };
    });
    expect(edge.color).toBe(gold.accent);
    expect(edge.width).toBe("1px");

    // The eye and the label: the theme's gold ink, the label in caps.
    const label = page.locator('[data-qa="live-preview-label"]');
    await expect(label).toHaveText("Vista previa en vivo");
    await expect(label).toHaveCSS("text-transform", "uppercase");
    await expect(label).toHaveCSS("color", gold.ink);
    await expect(page.locator('[data-qa="live-preview-eye"]')).toHaveCSS("color", gold.ink);
    await expect(page.locator('[data-qa="live-preview-eye"]')).toHaveCSS("stroke", gold.ink);
    // Readable on the dock's own ground (the page's background, nearly opaque).
    const ground = await page.evaluate(() => getComputedStyle(document.querySelector("[data-admin-theme]")!).backgroundColor);
    const ratio = contrast(gold.ink, ground);
    test.info().annotations.push({ type: "contrast", description: `${theme} label ${gold.ink} on ${ground}: ${ratio.toFixed(2)}:1` });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}

test("D3 the first Galería of a visit pulses the bar twice, then it is still; later in the visit, no pulse", async ({
  page,
}) => {
  await openGallery(page);
  await expect(pulse(page)).toHaveCount(1);
  const anim = await pulse(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return { name: s.animationName, count: s.animationIterationCount, duration: s.animationDuration };
  });
  expect(anim).toEqual({ name: "live-preview-pulse", count: "2", duration: "1.4s" });
  // Two cycles of 1.4s, then still.
  await expect(pulse(page)).toHaveCount(0, { timeout: 6000 });

  // Another tab and back in the same visit: the bar does not pulse again.
  await page.locator('[data-qa="admin-nav-media"]').click();
  await expect(page.locator('[data-qa="admin-section-media"]')).toBeVisible();
  await page.locator('[data-qa="admin-nav-gallery"]').click();
  await expect(dock(page)).toBeVisible();
  for (const wait of [100, 600, 600]) {
    await page.waitForTimeout(wait);
    await expect(pulse(page)).toHaveCount(0);
  }

  // A reload is a new visit.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(pulse(page)).toHaveCount(1);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("D4 under reduced motion the bar never pulses", async ({ page }) => {
    await openGallery(page);
    for (const wait of [0, 400, 800]) {
      await page.waitForTimeout(wait);
      await expect(pulse(page)).toHaveCount(0);
    }
  });
});

test("D5 a coaching tip open over the Galería holds the pulse; it plays once the tip closes", async ({ page }) => {
  await markCoachSeen(page, TOUR_IDS.filter((id) => id !== "gallery"));
  await openGallery(page, { coachSeen: false });
  const overlay = page.locator('[data-qa="coach-overlay"]');
  await expect(overlay).toHaveAttribute("data-tour", "gallery");
  await expect(pulse(page)).toHaveCount(0);
  await page.waitForTimeout(500);
  await expect(pulse(page)).toHaveCount(0);

  await page.locator('[data-qa="coach-skip"]').click();
  await expect(overlay).toHaveCount(0);
  await expect(pulse(page)).toHaveCount(1);
  await expect(pulse(page)).toHaveCount(0, { timeout: 6000 });
});

test("screenshots: the dock collapsed, pulsing and open, light and dark, 390×844 and 1440×900", async ({ page }) => {
  test.setTimeout(180_000);
  for (const theme of ["light", "dark"] as const) {
    for (const size of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.evaluate((k) => localStorage.removeItem(k), OPEN_KEY).catch(() => {});
      await openGallery(page, { theme, size });
      const name = `dock-${theme}-${size.width}x${size.height}`;
      // Mid-pulse: the first cycle's peak is 0.7s in.
      await expect(pulse(page)).toHaveCount(1);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SHOTS}/${name}-pulse.png` });
      await expect(pulse(page)).toHaveCount(0, { timeout: 6000 });
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${SHOTS}/${name}-collapsed.png` });
      await bar(page).click();
      await expect(tiles(page).first()).toBeVisible();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/${name}-open.png` });
      await bar(page).click();
    }
  }
});
