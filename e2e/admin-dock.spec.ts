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
 * ADMIN.FIXES.1 item 2 — a thumbnail in the dock opens the public gallery's
 * lightbox (PhotoLightbox), full screen. It used to open inside the dock's strip:
 * the dock's backdrop-filter is the containing block of a fixed descendant.
 *  L1  1440×900: a tap opens it at that photo's index over the whole viewport,
 *      above the site header and the dock; arrows wrap, Esc closes, the ground
 *      closes, the body's scroll lock arms and releases
 *  L2  390×844 touch: swipes advance and retreat, a swipe down closes; the
 *      arrows stay desktop-only
 *  L3  with the dock open and its lightbox used, dragging a row by its grip
 *      still reorders the list and writes the new order
 *
 * Screenshots (collapsed and open, light and dark, 390×844 and 1440×900; the
 * lightbox from the dock at both sizes) land in _qa/admin-fixes/.
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

/* ---------------- item 2: the lightbox ---------------- */

const box = (page: Page) => page.locator('[data-qa="lightbox"]');
const counter = (page: Page) => page.locator('[data-qa="lightbox-counter"]');
const bodyOverflow = (page: Page) => page.evaluate(() => document.body.style.overflow);

/** Open the dock and tap its Nth ORIGINAL tile (dispatchEvent: the marquee drifts under a real click). */
async function openFromDock(page: Page, index: number) {
  if ((await bar(page).getAttribute("aria-expanded")) !== "true") await bar(page).click();
  await expect(tiles(page).first()).toBeVisible();
  await tiles(page).nth(index).dispatchEvent("click");
  await expect(box(page)).toBeVisible();
}

/** A one-finger swipe as real TouchEvents on the lightbox (gallery-lightbox.spec's anatomy). */
async function swipe(page: Page, dx: number, dy: number) {
  await page.evaluate(
    ([mx, my]) => {
      const el = document.querySelector('[data-qa="lightbox"]') as HTMLElement;
      const touch = (x: number, y: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      const fire = (type: string, x: number, y: number) => {
        const live = type === "touchend" ? [] : [touch(x, y)];
        el.dispatchEvent(
          new TouchEvent(type, { bubbles: true, cancelable: true, touches: live, targetTouches: live, changedTouches: [touch(x, y)] }),
        );
      };
      fire("touchstart", 200, 400);
      fire("touchmove", 200 + mx, 400 + my);
      fire("touchend", 200 + mx, 400 + my);
    },
    [dx, dy],
  );
}

test("L1 1440×900: a dock thumbnail opens the gallery's lightbox full screen at its index", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openGallery(page, { theme: "dark" });
  await openFromDock(page, 2);

  // The whole viewport, above everything: no ancestor confines it any more.
  const vp = page.viewportSize()!;
  expect(await box(page).boundingBox()).toEqual({ x: 0, y: 0, width: vp.width, height: vp.height });
  expect(await box(page).evaluate((el) => el.parentElement === document.body)).toBe(true);
  const onTop = await page.evaluate(() =>
    [
      [8, 8],
      [window.innerWidth / 2, window.innerHeight - 8],
    ].every(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-qa="lightbox"]')),
  );
  expect(onTop, "the lightbox covers the header and the dock").toBe(true);

  // The public lightbox's own chrome, at the tapped photo.
  await expect(counter(page)).toHaveText("3 / 4");
  await expect(page.locator('[data-qa="lightbox-img"]')).toHaveAttribute("src", PUBLISHED[2].image_url);
  await expect(page.locator('[data-qa="lightbox-close"]')).toBeVisible();
  await expect(page.locator('[data-qa="lightbox-prev"]')).toBeVisible();
  await expect(page.locator('[data-qa="lightbox-next"]')).toBeVisible();
  expect(await bodyOverflow(page)).toBe("hidden");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400); // the plate's 220ms fade-in
  await page.screenshot({ path: `${SHOTS}/dock-lightbox-dark-1440x900.png` });

  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("4 / 4");
  await page.keyboard.press("ArrowRight");
  await expect(counter(page), "next from the last photo wraps").toHaveText("1 / 4");
  await page.locator('[data-qa="lightbox-prev"]').click();
  await expect(counter(page)).toHaveText("4 / 4");
  await page.keyboard.press("Escape");
  await expect(box(page)).toHaveCount(0);
  expect(await bodyOverflow(page)).toBe("");

  // The ground closes it too.
  await openFromDock(page, 0);
  await expect(counter(page)).toHaveText("1 / 4");
  await page.locator('[data-qa="lightbox-ground"]').click({ position: { x: 10, y: 450 } });
  await expect(box(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("L2 390×844: swipes advance and retreat, a swipe down closes; the arrows are desktop-only", async ({ page }) => {
    await openGallery(page, { size: { width: 390, height: 844 } });
    await openFromDock(page, 1);
    expect(await box(page).boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    await expect(counter(page)).toHaveText("2 / 4");
    await expect(page.locator('[data-qa="lightbox-prev"]')).toBeHidden();
    await expect(page.locator('[data-qa="lightbox-next"]')).toBeHidden();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/dock-lightbox-light-390x844.png` });

    await swipe(page, -120, 0);
    await expect(counter(page), "swipe left advances").toHaveText("3 / 4");
    await swipe(page, 120, 0);
    await expect(counter(page), "swipe right retreats").toHaveText("2 / 4");
    await swipe(page, -20, 0);
    await expect(counter(page), "a nudge does nothing").toHaveText("2 / 4");
    await swipe(page, 0, 160);
    await expect(box(page), "swipe down closes").toHaveCount(0);
    expect(await bodyOverflow(page)).toBe("");
  });
});

test("L3 with the dock open and its lightbox used, a row dragged by its grip still reorders and saves", async ({ page }) => {
  const writes: { method: string; url: string; body: string | null }[] = [];
  await forceLanguage(page, "es");
  await injectAdminSession(page);
  await routeSupabase(page, { photos: PUBLISHED, writes });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(dock(page)).toBeVisible();
  await openFromDock(page, 0);
  await page.keyboard.press("Escape");
  await expect(box(page)).toHaveCount(0);

  const rows = page.locator('[data-qa="admin-section-gallery"] ul.list-none > li');
  await expect(rows).toHaveCount(4);
  const grip = rows.nth(0).getByRole("button", { name: "Arrastra para reordenar" });
  // Rows 1 and 2 mid-screen, clear of the open dock along the bottom (instant:
  // the page scrolls smoothly by default).
  await rows.nth(0).evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  const dockTop = (await dock(page).boundingBox())!.y;
  await expect
    .poll(async () => {
      const r = (await rows.nth(1).boundingBox())!;
      return r.y + r.height;
    }, { message: "row 2 sits above the open dock" })
    .toBeLessThan(dockTop);
  const from = (await grip.boundingBox())!;
  const target = (await rows.nth(1).boundingBox())!;
  expect(
    await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest('button[aria-label="Arrastra para reordenar"]'),
      [from.x + from.width / 2, from.y + from.height / 2],
    ),
    "the grip is what the pointer lands on",
  ).toBe(true);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Past the sensor's 8px activation distance, then to just below row 2's middle.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
  await page.mouse.move(from.x + from.width / 2, target.y + target.height * 0.75, { steps: 12 });
  await page.mouse.up();

  await expect(rows.nth(0).locator("img")).toHaveAttribute("alt", "p2");
  await expect(rows.nth(1).locator("img")).toHaveAttribute("alt", "p1");
  await expect
    .poll(() => writes.filter((w) => w.method === "PATCH" && w.url.includes("gallery_photos")).length)
    .toBe(4);
  const order = Object.fromEntries(
    writes
      .filter((w) => w.method === "PATCH" && w.url.includes("gallery_photos"))
      .map((w) => [new URL(w.url).searchParams.get("id")!.replace(/^eq\./, ""), JSON.parse(w.body ?? "{}").sort_order]),
  );
  expect(order).toEqual({ p2: 1, p1: 2, p3: 3, p4: 4 });
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
