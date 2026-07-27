import { expect, test, type Page } from "@playwright/test";
import { shot } from "./_helpers";

/**
 * CINE.FLOW.4B STEP 2 — evidence for the unveiled W2 plate.
 *
 * W2 lost its focal radial veil (the lockup sits below the plate and never
 * crosses the photograph, so the veil only darkened the picture). This pass
 * captures the selected composition alone, at every wide frame in both
 * languages, so the unveiled plate can be judged against the 4A record.
 *
 * Capture conditions are identical to the 4A evidence pass: viewport larger
 * than the frame, review zoom pinned to 1 (true CSS pixels), slide 0 at its
 * advertised dead-stop, every plate and backdrop image decoded. Files are
 * named cineflow4b-w2-<width>-<lang>.png and never collide with the 4A set.
 *
 * The safety laws themselves are NOT re-asserted here — geometry did not move,
 * so cineflow4a-wide.spec.ts remains their single home and still runs green.
 */

const PATH = "/qa/reel-bakeoff";

const WIDE_FRAMES = [
  { id: "834x1112", w: 834, h: 1112 },
  { id: "1024x768", w: 1024, h: 768 },
  { id: "1440x900", w: 1440, h: 900 },
  { id: "1600x900", w: 1600, h: 900 },
  { id: "2560x1080", w: 2560, h: 1080 },
] as const;

const LANGS = ["es", "en"] as const;

/** Drive the harness scrub (a controlled React range input) to progress p. */
async function setScrub(page: Page, p: number) {
  await page.evaluate((val) => {
    const el = document.querySelector<HTMLInputElement>('[data-qa="bakeoff-scrub"]');
    if (!el) throw new Error("scrub input not mounted");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, String(Math.round(val * 1000)));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, p);
  await page.waitForTimeout(150);
}

async function ensureLang(page: Page, lang: "es" | "en") {
  const readout = page.locator('[data-qa="bakeoff-lang"]');
  const current = (await readout.textContent())?.trim().toLowerCase();
  if (current === lang) return;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("l");
  await expect(readout).toHaveText(lang.toUpperCase());
  await page.waitForTimeout(150);
}

test.describe("CINE.FLOW.4B — W2 unveiled: evidence", () => {
  for (const frame of WIDE_FRAMES) {
    test(`W2 at ${frame.id} (ES + EN)`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: frame.w + 64, height: frame.h + 260 });
      await page.goto(PATH, { waitUntil: "domcontentloaded" });

      const frameSelect = page.locator('[data-qa="bakeoff-frame"]');
      await frameSelect.waitFor({ state: "visible", timeout: 20_000 });
      await frameSelect.selectOption(frame.id);
      await page.locator('[data-qa="bakeoff-zoom"]').selectOption("1");
      await page.locator('[data-qa="bakeoff-wide-variant"]').selectOption("w2");
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const frameEl = page.locator('[data-qa="bakeoff-wide-frame"]');
      await expect(frameEl).toBeVisible();

      const root = page.locator('[data-qa="wide-variant"][data-variant="w2"]');
      await root.waitFor({ state: "attached", timeout: 20_000 });

      // The veil is gone — assert it, so a regression that reinstates it fails
      // here rather than being noticed by eye in the screenshots.
      await expect(root.locator('[data-qa="wide-veil"]')).toHaveCount(0);

      for (const lang of LANGS) {
        await ensureLang(page, lang);

        await page.waitForFunction(
          () => {
            const plates = [
              ...document.querySelectorAll<HTMLImageElement>(
                '[data-qa="wide-plate"] img[data-qa="bakeoff-reel-img"]',
              ),
            ];
            const backdrops = [
              ...document.querySelectorAll<HTMLImageElement>('img[data-qa="wide-backdrop"]'),
            ];
            const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;
            return (
              plates.length >= 3 &&
              plates.every(
                (i) =>
                  ready(i) && !(i.getAttribute("data-hero-framing") ?? "").includes("pending"),
              ) &&
              backdrops.length >= 3 &&
              backdrops.every(ready)
            );
          },
          { timeout: 30_000 },
        );

        const deadStops = (await root.getAttribute("data-deadstops"))?.split(",").map(Number);
        expect(deadStops, `w2@${frame.id}: dead-stops advertised`).toBeTruthy();
        await setScrub(page, deadStops![0]);

        const frameRect = await frameEl.boundingBox();
        expect(Math.round(frameRect!.width), "frame at true CSS px").toBe(frame.w);
        expect(Math.round(frameRect!.height)).toBe(frame.h);

        await frameEl.screenshot({ path: shot(`cineflow4b-w2-${frame.w}-${lang}.png`) });
      }
    });
  }
});
