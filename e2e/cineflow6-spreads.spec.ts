import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase, svgPhoto } from "./_admin";
import { shot } from "./_helpers";

/**
 * CINE.FLOW.6 — the wide reel's editorial story spreads.
 *
 * Four laws, each falsifiable on the live render, plus the brick's evidence:
 *
 *  1. ALTERNATION — every slide is a spread: one plate + one chapter column,
 *     and the sides alternate (01 plate-left/copy-right, 02 flipped, 03 as
 *     01). The column holds the spread's split (CHAPTER_FIELD_FRACTION), the
 *     1px gold seam sits at the chapter/plate junction, and the W2 caption
 *     band and its two 18%/82% hairlines are gone.
 *  2. ES/EN, NO CROSS-LEAK — the chapters render the seeded ES copy under es
 *     and the EN mirror under en, and neither language's copy appears under
 *     the other.
 *  3. OVERRIDE WINS — a site_settings `reel.chapter<N>` document beats the
 *     in-repo seed field-by-field; absent fields keep the seed. This is the
 *     contract REEL.COPY.1's admin editor will write against.
 *  4. PHONE UNTOUCHED — at 390 the V1 phone act is byte-for-byte the
 *     CINE.FLOW.5 composition: lockup + edge veil per slide, no chapter
 *     column, no plate.
 *
 * Evidence: _qa/cineflow6-1440-{01,02,03}.png at each slide's dead-stop, and
 * _qa/cineflow6-390-phone.png for law 4.
 *
 * The chapter seeds are RESTATED below, verbatim, NOT imported (the same rule
 * every parity spec follows): a drift in the shipped seed — the copy the COPY
 * LAW ratified — must fail here rather than follow silently.
 */

const PATH = "/cinematic";

/** The spread's split, mirroring src/components/cinematic/reelWide.tsx. */
const CHAPTER_FIELD_FRACTION = 0.42;

/** The ratified seeds, mirroring src/components/cinematic/reelChapters.ts. */
const SEEDS = [
  {
    es: {
      eyebrow: "Actriz Colombiana",
      title: "Movimiento y emoción",
      body: "Dando vida a historias a través del movimiento y la emoción. Cada rol es un viaje, cada actuación una conexión.",
    },
    en: {
      eyebrow: "Colombian Actress",
      title: "Movement and emotion",
      body: "Bringing stories to life through movement and emotion. Every role is a journey, every performance a connection.",
    },
  },
  {
    es: {
      eyebrow: "Streamer de TikTok",
      title: "Conocida como Titi",
      body: "Su comunidad la conoce como Titi (TitiActriz). Cree en el poder de contar historias para crear conexión e inspirar cambios.",
    },
    en: {
      eyebrow: "TikTok Streamer",
      title: "Known as Titi",
      body: "Her community knows her as Titi (TitiActriz). She believes in the power of storytelling to create connection and inspire change.",
    },
  },
  {
    es: {
      eyebrow: "Emprendedora",
      title: "Negocios que importan",
      body: "Distribuidora oficial de Green World — bienestar natural, directo de la fuente.",
    },
    en: {
      eyebrow: "Entrepreneur",
      title: "Businesses that matter",
      body: "Official Green World distributor — natural wellness, straight from the source.",
    },
  },
] as const;

const PHOTOS = [
  svgPhoto("p1", "crimson"),
  svgPhoto("p2", "teal"),
  svgPhoto("p3", "goldenrod"),
  svgPhoto("p4", "navy"),
];

/** Timeline rest positions (of 3.0) for each slide — nothing mid-tween. */
const DEAD_STOPS = { 1: 0.5 / 3, 2: 1.75 / 3, 3: 2.8 / 3 } as const;

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/**
 * Wheel the document to `y`. Lenis owns the scroll on this route, so a direct
 * scrollTo would be fought by its RAF loop; wheeling in bounded steps converges
 * the same way a thumb does.
 */
async function wheelTo(page: Page, y: number) {
  await page.mouse.move(200, 300);
  for (let i = 0; i < 80; i++) {
    const at = await page.evaluate(() => window.scrollY);
    const delta = y - at;
    if (Math.abs(delta) < 8) break;
    await page.mouse.wheel(0, Math.max(-600, Math.min(600, Math.round(delta))));
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(500);
}

/** Absolute document Y at which the reel's pin engages (its top hits 0). */
async function pinStartY(page: Page) {
  return page.evaluate(() => {
    const img = document.querySelector('[data-qa="cinematic-reel-img"]');
    const pin = img?.closest('[data-qa="cinematic-section"]')?.firstElementChild;
    if (!pin) throw new Error("reel pin container not found");
    return pin.getBoundingClientRect().top + window.scrollY;
  });
}

const opacities = (page: Page) =>
  page
    .locator('[data-qa="reel-slide"]')
    .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).opacity)));

async function openWide(page: Page, lang: "es" | "en", reelChapters?: Record<string, string>) {
  await forceLanguage(page, lang);
  await routeSupabase(page, { photos: PHOTOS, reelChapters });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await settle(page, 900);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

const slideSel = (i: number) => `[data-qa="reel-slide"][data-slide="${i}"]`;

test.describe("CINE.FLOW.6 — editorial spreads (wide)", () => {
  test("1440 — every slide is a spread and the sides alternate", async ({ page }) => {
    await openWide(page, "es");

    await expect(page.locator('[data-qa="wide-plate"]')).toHaveCount(3);
    await expect(page.locator('[data-qa="wide-chapter"]')).toHaveCount(3);
    await expect(page.locator('[data-qa="wide-chapter-seam"]')).toHaveCount(3);

    // The W2 caption band and its two symmetric hairlines are superseded.
    await expect(page.locator('[data-qa="wide-lockup"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="wide-lockup-rule"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="wide-rule"]')).toHaveCount(0);

    for (const i of [0, 1, 2]) {
      const copyLeft = i % 2 === 1;
      const chapter = page.locator(`${slideSel(i)} [data-qa="wide-chapter"]`);
      await expect(chapter, `slide ${i + 1} has one chapter column`).toHaveCount(1);
      await expect(chapter).toHaveAttribute("data-side", copyLeft ? "left" : "right");

      const cBox = (await chapter.boundingBox())!;
      const pBox = (await page.locator(`${slideSel(i)} [data-qa="wide-plate"]`).boundingBox())!;

      // The column holds the declared split of the frame...
      expect(cBox.width, `slide ${i + 1} column width`).toBeCloseTo(
        1440 * CHAPTER_FIELD_FRACTION,
        0,
      );
      // ...and sits on the declared side of the plate.
      if (copyLeft) {
        expect(cBox.x, `slide ${i + 1}: copy page left of the plate`).toBeLessThan(pBox.x);
        expect(cBox.x).toBe(0);
      } else {
        expect(cBox.x, `slide ${i + 1}: copy page right of the plate`).toBeGreaterThan(
          pBox.x + pBox.width - 1,
        );
        expect(cBox.x + cBox.width, `slide ${i + 1}: column reaches the frame edge`).toBeCloseTo(
          1440,
          0,
        );
      }

      // The seam is at the chapter/plate junction — the column's inner edge.
      const sBox = (await page
        .locator(`${slideSel(i)} [data-qa="wide-chapter-seam"]`)
        .boundingBox())!;
      const junction = copyLeft ? cBox.x + cBox.width : cBox.x;
      expect(Math.abs(sBox.x + (copyLeft ? sBox.width : 0) - junction), `slide ${i + 1} seam`)
        .toBeLessThanOrEqual(1.5);

      // The chapter carries eyebrow (numeral + label), headline, body.
      await expect(page.locator(`${slideSel(i)} [data-qa="wide-numeral"]`)).toHaveText(
        `0${i + 1}`,
      );
      await expect(page.locator(`${slideSel(i)} [data-qa="chapter-eyebrow-label"]`)).toHaveText(
        SEEDS[i].es.eyebrow,
      );
      await expect(page.locator(`${slideSel(i)} [data-qa="section-heading"]`)).toHaveText(
        SEEDS[i].es.title,
      );
      await expect(page.locator(`${slideSel(i)} [data-qa="chapter-body"]`)).toHaveText(
        SEEDS[i].es.body,
      );
    }
  });

  for (const lang of ["es", "en"] as const) {
    const other = lang === "es" ? "en" : "es";
    test(`1440 ${lang.toUpperCase()} — chapters in ${lang}, no ${other.toUpperCase()} leak`, async ({
      page,
    }) => {
      await openWide(page, lang);

      const reel = page
        .locator('[data-qa="cinematic-section"]')
        .filter({ has: page.locator('[data-qa="cinematic-reel-img"]') })
        .first();

      for (const i of [0, 1, 2]) {
        await expect(reel.locator(`${slideSel(i)} [data-qa="chapter-body"]`)).toHaveText(
          SEEDS[i][lang].body,
        );
      }
      const sectionText = (await reel.innerText()).toLowerCase();
      for (const chapter of SEEDS) {
        expect(
          sectionText,
          `no ${other.toUpperCase()} title cross-leak under ${lang}`,
        ).not.toContain(chapter[other].title.toLowerCase());
      }
    });
  }

  test("1440 — a site_settings chapter document beats the seed, field by field", async ({
    page,
  }) => {
    await openWide(page, "es", {
      "1": JSON.stringify({
        es: { title: "Titular Propio", body: "Cuerpo propio de la administración." },
        en: { title: "Own Headline", body: "Own admin body." },
      }),
    });

    // Overridden fields win...
    await expect(page.locator(`${slideSel(0)} [data-qa="section-heading"]`)).toHaveText(
      "Titular Propio",
    );
    await expect(page.locator(`${slideSel(0)} [data-qa="chapter-body"]`)).toHaveText(
      "Cuerpo propio de la administración.",
    );
    // ...absent fields keep the seed...
    await expect(page.locator(`${slideSel(0)} [data-qa="chapter-eyebrow-label"]`)).toHaveText(
      SEEDS[0].es.eyebrow,
    );
    // ...and untouched chapters keep their seeds whole.
    await expect(page.locator(`${slideSel(1)} [data-qa="section-heading"]`)).toHaveText(
      SEEDS[1].es.title,
    );
    await expect(page.locator(`${slideSel(2)} [data-qa="chapter-body"]`)).toHaveText(
      SEEDS[2].es.body,
    );
  });

  test("phone 390 — the V1 act is untouched: no spread anywhere", async ({ page }) => {
    await forceLanguage(page, "es");
    await routeSupabase(page, { photos: PHOTOS });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page, 900);

    await expect(page.locator('[data-qa="reel-lockup"]')).toHaveCount(3);
    await expect(page.locator('[data-qa="reel-veil"]')).toHaveCount(3);
    await expect(page.locator('[data-qa="wide-chapter"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="wide-chapter-seam"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="wide-plate"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="chapter-body"]')).toHaveCount(0);

    // Photograph the ACT, not the page top: slide 1 at its dead-stop, exactly
    // the CINE.FLOW.5 phone frame.
    const y0 = await pinStartY(page);
    await wheelTo(page, y0 + DEAD_STOPS[1] * 3 * 844);
    const op = await opacities(page);
    expect(op[0], "slide 1 opaque at its dead-stop").toBeGreaterThan(0.99);
    await page.screenshot({ path: shot("cineflow6-390-phone.png") });
  });

  test("1440 ES — dead-stop evidence: the three spreads", async ({ page }) => {
    test.setTimeout(180_000);
    await openWide(page, "es");
    const y0 = await pinStartY(page);

    for (const slide of [1, 2, 3] as const) {
      await wheelTo(page, y0 + DEAD_STOPS[slide] * 3 * 900);
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('[data-qa="cinematic-reel-img"]')].every(
            (i) =>
              (i as HTMLImageElement).complete &&
              (i as HTMLImageElement).naturalWidth > 0 &&
              !(i.getAttribute("data-hero-framing") ?? "").includes("pending"),
          ) &&
          [...document.querySelectorAll('[data-qa="wide-backdrop"]')].every(
            (i) =>
              (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
          ),
        { timeout: 30_000 },
      );

      const op = await opacities(page);
      expect(op.length, "three slides").toBe(3);
      expect(op[slide - 1], `slide ${slide} opaque at its dead-stop`).toBeGreaterThan(0.99);
      op.forEach((v, idx) => {
        if (idx !== slide - 1) {
          expect(v, `slide ${idx + 1} out at slide ${slide}'s dead-stop`).toBeLessThan(0.01);
        }
      });

      await page.screenshot({ path: shot(`cineflow6-1440-0${slide}.png`) });
    }
  });
});
