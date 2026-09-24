import { expect, test, type Locator, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";

/**
 * HERO.EDIT.1 — the hero roles line, intro sentence and search listing are
 * editable in the admin. Joey, verbatim: "it would be really cool if you could
 * make it so that the hero statement and the subtitle and title could be edited
 * in the admin area ... and then she could change them as she sees fit." Still
 * in force from SEO.BING.1d: "we need to make sure that it keeps the subtitle
 * consistent on all 3 page layouts."
 *
 * One site_settings row, `hero.copy`, read by every layout through useHeroCopy.
 *
 *  H1  Row absent → all three layouts read today's ACTRIZ STREAMER EMPRESARIA,
 *      and the helmet title is SEO.BING.1's.
 *  H2  Row present → all three layouts render ITS roles line (classic as three
 *      words between gold "|"), the cinematic intro reads its sentence, and EN
 *      renders the en.* values.
 *  H3  Only es.title set → the title tag follows it; roles, intro and the
 *      description still fall back, field by field.
 *  H4  Admin: the editor loads the stored copy with a quiet bar, typing makes
 *      it dirty, Discard reverts, Save runs the translator and upserts hero.copy
 *      with both locales; a correction to the English is never translated over;
 *      restoring every field deletes the row. HERO.EDIT.1b: a failed translation
 *      carries the typed text into both languages (the Events board's law), and
 *      the next Save heals it.
 *
 * ADMIN.SAVEBAR.1c — Joey, verbatim: "if its an action or item that dosen't
 * autosave like a toggle, then it should remain greyed out until something is
 * entered and then be bright showing that it still needs to be saved if its not
 * greyed out".
 *
 *  G2  Save is greyed while clean, lit by typing, greyed again by Discard; and
 *      (Joey's ruling) a translation a failed save still owes keeps it lit on a
 *      clean editor, until one Save pays it.
 */

const HERO_COPY_KEY = "hero.copy";
const SEO_TITLE = "Cristyna Polentino | Actriz, Streamer y Empresaria · Medellín";
const SEO_DESCRIPTION =
  "Cristyna Polentino (Titi): actriz colombiana, streamer y empresaria en Medellín. Su portafolio de actuación, su comunidad en vivo y su proyecto con Green World.";
const INTRO_ES_DEFAULT =
  "Actriz colombiana, streamer y empresaria en Medellín. Su historia, su comunidad y sus proyectos.";

const INTRO = '[data-qa="cinematic-hero-intro"]';

/** No banner: a live one would stack above the hero and is not this spec's business. */
const BOARD_NO_BANNER = {
  pageVisible: true,
  mainBanner: { enabled: false, pages: { home: false, greenWorld: false, titans: false } },
  greenWorldBanner: { enabled: false },
  titansBanner: { enabled: false },
  items: [],
};

type Layout = "cinematic" | "editorial" | "classic";
const LAYOUTS: Layout[] = ["cinematic", "editorial", "classic"];

/** Each layout's roles element, by the markup it already has (as in seo-bing B5). */
const ROLES: Record<Layout, (page: Page) => Locator> = {
  cinematic: (page) => page.locator(INTRO).locator("xpath=preceding-sibling::p[1]"),
  editorial: (page) => page.locator("p.editorial-roles"),
  classic: (page) =>
    page.locator("p", { has: page.locator("span.text-accent", { hasText: "|" }) }),
};

const normalizeRoles = (s: string) =>
  s.toUpperCase().replace(/[·|]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Serve `hero.copy` (or its absence) IN FRONT of routeSupabase, which answers
 * every key it does not know as absent. Routes are LIFO, so this one sees the
 * request first and hands every other key back.
 */
async function routeHeroCopy(page: Page, doc: unknown | null) {
  await page.route("**/rest/v1/site_settings*", (route) => {
    const req = route.request();
    if (req.method() !== "GET" || !req.url().includes(HERO_COPY_KEY)) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: doc === null ? "null" : JSON.stringify({ value: doc }),
    });
  });
}

async function openHome(page: Page, lng: "es" | "en", layout: Layout, doc: unknown | null) {
  await forceLanguage(page, lng);
  await routeSupabase(page, { eventsBoard: BOARD_NO_BANNER, homeVariant: layout });
  await routeHeroCopy(page, doc);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const roles = ROLES[layout](page);
  await expect(roles, `the ${layout} layout renders one roles line`).toHaveCount(1, {
    timeout: 15_000,
  });
  return roles;
}

/** The helmet's own description tag (index.html keeps a static one beside it). */
const helmetDescription = (page: Page) =>
  page.locator('meta[name="description"][data-rh="true"]').getAttribute("content");

test.describe("HERO.EDIT.1 — public layouts", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const layout of LAYOUTS) {
    test(`H1 — row absent: ${layout} reads today's line and title`, async ({ page }) => {
      const roles = await openHome(page, "es", layout, null);
      await expect
        .poll(async () => normalizeRoles((await roles.textContent()) ?? ""))
        .toBe("ACTRIZ STREAMER EMPRESARIA");
      await expect(page).toHaveTitle(SEO_TITLE);
    });
  }

  const DOC = {
    es: { roles: "ACTRIZ · CREADORA · EMPRESARIA", intro: "Frase de prueba." },
    en: { roles: "ACTRESS · CREATOR · ENTREPRENEUR", intro: "Test sentence." },
    meta: { src: { roles: "es", intro: "es" } },
  };

  for (const layout of LAYOUTS) {
    for (const lng of ["es", "en"] as const) {
      test(`H2 — row present: ${layout} (${lng.toUpperCase()}) renders the stored copy`, async ({
        page,
      }) => {
        const roles = await openHome(page, lng, layout, DOC);
        const expected = lng === "es" ? "ACTRIZ CREADORA EMPRESARIA" : "ACTRESS CREATOR ENTREPRENEUR";
        await expect
          .poll(async () => normalizeRoles((await roles.textContent()) ?? ""))
          .toBe(expected);

        if (layout === "classic") {
          // Three words between two gold separators — the classic grammar kept.
          await expect(roles.locator("span.text-accent")).toHaveCount(2);
          await expect(roles.locator("span.inline-flex > span:not(.text-accent)")).toHaveCount(3);
        }
        if (layout === "cinematic") {
          await expect(page.locator(INTRO)).toHaveText(
            lng === "es" ? "Frase de prueba." : "Test sentence.",
          );
        }
      });
    }
  }

  test("H3 — only es.title set: the title follows it, everything else falls back", async ({
    page,
  }) => {
    const title = "Titi — título de prueba";
    const roles = await openHome(page, "es", "cinematic", { es: { title }, en: {} });
    await expect(page).toHaveTitle(title);
    await expect
      .poll(async () => normalizeRoles((await roles.textContent()) ?? ""))
      .toBe("ACTRIZ STREAMER EMPRESARIA");
    await expect(page.locator(INTRO)).toHaveText(INTRO_ES_DEFAULT);
    await expect.poll(() => helmetDescription(page)).toBe(SEO_DESCRIPTION);
  });
});

/* ════════════════════════════════ H4 — the admin ════════════════════════════════ */

const BAR = '[data-qa="hero-copy-save-bar"]';
const UNSAVED = '[data-qa="hero-copy-unsaved"]';
const SAVE = '[data-qa="hero-copy-save"]';
const DISCARD = '[data-qa="hero-copy-discard"]';

const STORED = {
  es: { roles: "ACTRIZ · CREADORA · EMPRESARIA" },
  en: { roles: "ACTRESS · CREATOR · ENTREPRENEUR" },
  meta: { src: { roles: "es" } },
};

/**
 * Watch the bar from the first frame: record whether the unsaved warning or a
 * dirty bar EVER appears while the editor loads. A quiet end state proves
 * nothing about the frames before it.
 */
async function watchBarFlash(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __barFlashed?: boolean };
    w.__barFlashed = false;
    const check = () => {
      if (
        document.querySelector('[data-qa="hero-copy-unsaved"]') ||
        document.querySelector('[data-qa="hero-copy-save-bar"][data-dirty="true"]')
      ) {
        w.__barFlashed = true;
      }
    };
    new MutationObserver(check).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-dirty"],
    });
  });
}

type Translate = NonNullable<Parameters<typeof routeSupabase>[1]>["translate"];

async function openHeroCopyAdmin(
  page: Page,
  writes: Write[],
  stored: unknown | null,
  translate?: Translate,
) {
  await injectAdminSession(page);
  await forceLanguage(page, "es");
  await routeSupabase(page, { writes, translate });
  await routeHeroCopy(page, stored);
  await watchBarFlash(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.locator('[data-qa="admin-nav-settings"]').click();
  await expect(page.locator('[data-qa="hero-copy-editor"]')).toBeVisible();
  await expect(page.locator(BAR)).toBeVisible();
}

/** The hero.copy upserts that reached the database, parsed. */
const heroCopyUpserts = (writes: Write[]) =>
  writes
    .filter((w) => w.method === "POST" && w.url.includes("site_settings") && (w.body ?? "").includes(HERO_COPY_KEY))
    .map((w) => {
      const parsed = JSON.parse(w.body ?? "{}");
      return (Array.isArray(parsed) ? parsed[0] : parsed) as { key: string; value: Record<string, unknown> };
    });

const translateCalls = (writes: Write[]) =>
  writes
    .filter((w) => w.url.includes("functions/v1/translate-text"))
    .map((w) => JSON.parse(w.body ?? "{}").text as string);

test.describe("HERO.EDIT.1 — H4 the admin editor", () => {
  test("loads quietly, dirties on typing, Discard reverts, Save translates and upserts", async ({
    page,
  }) => {
    const writes: Write[] = [];
    await openHeroCopyAdmin(page, writes, STORED);

    // Loads the stored values; the bar is pinned, opaque, and was never dirty.
    await expect(page.locator('[data-qa="hero-copy-roles"]')).toHaveValue(STORED.es.roles);
    await expect(page.locator(BAR)).toHaveAttribute("data-dirty", "false");
    await expect(page.locator(UNSAVED)).toHaveCount(0);
    const barStyle = await page.locator(BAR).evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, bottom: cs.bottom, bg: cs.backgroundColor };
    });
    expect(barStyle.position, "the bar is pinned").toBe("sticky");
    expect(barStyle.bottom).toBe("0px");
    expect(barStyle.bg, "the bar is opaque").toMatch(/^rgb\(/);
    await page.waitForTimeout(600);
    expect(
      await page.evaluate(() => (window as unknown as { __barFlashed?: boolean }).__barFlashed),
      "the bar never flashed dirty while loading",
    ).toBe(false);

    // Typing marks it dirty; nothing is written yet.
    const intro = page.locator('[data-qa="hero-copy-intro"]');
    await intro.fill("Nueva frase de prueba.");
    await expect(page.locator(BAR)).toHaveAttribute("data-dirty", "true");
    await expect(page.locator(UNSAVED)).toBeVisible();
    expect(heroCopyUpserts(writes), "typing writes nothing").toHaveLength(0);

    // Discard puts the stored copy back.
    await page.locator(DISCARD).click();
    await expect(intro).toHaveValue("");
    await expect(page.locator(BAR)).toHaveAttribute("data-dirty", "false");

    // Save: the translator runs on what was typed, and ONE upsert carries both
    // locales — the untouched roles line included, exactly as stored.
    await intro.fill("Nueva frase de prueba.");
    await page.locator(SAVE).click();
    await expect(page.locator('[data-qa="flash-hero-copy"]')).toHaveAttribute("data-state", "saved");
    await expect(page.locator(BAR)).toHaveAttribute("data-dirty", "false");

    expect(translateCalls(writes)).toEqual(["Nueva frase de prueba."]);
    const upserts = heroCopyUpserts(writes);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].key).toBe(HERO_COPY_KEY);
    expect(upserts[0].value).toEqual({
      es: { roles: STORED.es.roles, intro: "Nueva frase de prueba." },
      en: { roles: STORED.en.roles, intro: "EN Nueva frase de prueba." },
      meta: { src: { roles: "es", intro: "es" } },
    });
  });

  test("an English correction is kept, and restoring every field deletes the row", async ({
    page,
  }) => {
    const writes: Write[] = [];
    await openHeroCopyAdmin(page, writes, STORED);

    // Correct the English of the roles line by hand: Save must not translate
    // over the owner's own words.
    await page.locator('[data-qa="hero-copy-other-roles"] summary').click();
    const en = page.locator('[data-qa="hero-copy-roles-en"]');
    await expect(en).toHaveValue(STORED.en.roles);
    await en.fill("ACTRESS · CREATOR · FOUNDER");
    await page.locator(SAVE).click();
    await expect(page.locator(BAR)).toHaveAttribute("data-dirty", "false");
    expect(translateCalls(writes), "a correction is never re-translated").toEqual([]);
    expect(heroCopyUpserts(writes).at(-1)?.value).toMatchObject({
      es: { roles: STORED.es.roles },
      en: { roles: "ACTRESS · CREATOR · FOUNDER" },
    });

    // Restore default on the only field with copy → an empty document → the row
    // is deleted, never written as blanks.
    await page.locator('[data-qa="hero-copy-restore-roles"]').click();
    await expect(page.locator('[data-qa="hero-copy-roles"]')).toHaveValue("");
    await expect(page.locator('[data-qa="hero-copy-default-roles"]')).toBeVisible();
    await page.locator(SAVE).click();
    await expect(page.locator(BAR)).toHaveAttribute("data-dirty", "false");
    const deletes = writes.filter(
      (w) => w.method === "DELETE" && w.url.includes("site_settings") && w.url.includes(HERO_COPY_KEY),
    );
    expect(deletes, "restoring everything deletes hero.copy").toHaveLength(1);
    expect(heroCopyUpserts(writes), "no blank document was upserted").toHaveLength(1);
  });

  test("HERO.EDIT.1b: a failed translation carries the typed text to both languages, and the next Save heals it", async ({
    page,
  }) => {
    const writes: Write[] = [];
    let translatorUp = false;
    await openHeroCopyAdmin(page, writes, STORED, (text) =>
      translatorUp ? { source: "es", translation: `EN ${text}` } : null,
    );

    const typed = "Frase sin traducir.";
    await page.locator('[data-qa="hero-copy-intro"]').fill(typed);
    await page.locator(SAVE).click();

    // The save is NOT blocked, and neither language is left stale or blank:
    // both carry exactly what was typed, still owed a translation.
    await expect(page.locator('[data-qa="hero-copy-translation-failed"]')).toBeVisible();
    await expect(page.locator(BAR)).toHaveAttribute("data-dirty", "false");
    expect(heroCopyUpserts(writes).at(-1)?.value).toMatchObject({
      es: { roles: STORED.es.roles, intro: typed },
      en: { roles: STORED.en.roles, intro: typed },
      meta: { pending: { intro: true } },
    });

    // Owed a retry, so Save stays lit (ADMIN.SAVEBAR.1c); with the translator
    // back, one click — no edit — finishes the job.
    await expect(page.locator(SAVE)).toBeEnabled();
    translatorUp = true;
    await page.locator(SAVE).click();
    await expect(page.locator('[data-qa="hero-copy-translation-failed"]')).toHaveCount(0);
    expect(heroCopyUpserts(writes).at(-1)?.value).toEqual({
      es: { roles: STORED.es.roles, intro: typed },
      en: { roles: STORED.en.roles, intro: `EN ${typed}` },
      meta: { src: { roles: "es", intro: "es" } },
    });
    await expect(page.locator(SAVE), "paid: nothing left to save").toBeDisabled();
  });
});

/* ════════════════ ADMIN.SAVEBAR.1c — G2 the hero editor's Save ════════════════ */

test.describe("ADMIN.SAVEBAR.1c — G2 Save is greyed out until text changes", () => {
  test("greyed while clean, lit by typing, greyed again by Discard", async ({ page }) => {
    const writes: Write[] = [];
    await openHeroCopyAdmin(page, writes, STORED);

    await expect(page.locator(SAVE), "a clean editor has nothing to save").toBeDisabled();
    await page.locator('[data-qa="hero-copy-intro"]').fill("Una frase nueva.");
    await expect(page.locator(SAVE), "typed text lights Save").toBeEnabled();
    await page.locator(DISCARD).click();
    await expect(page.locator(SAVE), "Discard greys it again").toBeDisabled();
    expect(heroCopyUpserts(writes), "nothing was written").toHaveLength(0);
  });

  test("a translation still owed keeps Save lit on a clean editor, and one Save pays it", async ({
    page,
  }) => {
    const writes: Write[] = [];
    // What a failed save leaves behind: committed, but still owed a translation.
    const OWED = {
      es: { roles: "ACTRIZ · CREADORA · EMPRESARIA" },
      en: { roles: "ACTRIZ · CREADORA · EMPRESARIA" },
      meta: { src: { roles: "es" }, pending: { roles: true } },
    };
    await openHeroCopyAdmin(page, writes, OWED);

    await expect(page.locator(BAR), "nothing typed, so not dirty").toHaveAttribute("data-dirty", "false");
    await expect(page.locator(SAVE), "…but a retry is owed, so Save is lit").toBeEnabled();

    await page.locator(SAVE).click();
    await expect(page.locator('[data-qa="flash-hero-copy"]')).toHaveAttribute("data-state", "saved");
    expect(translateCalls(writes)).toEqual([OWED.es.roles]);
    expect(heroCopyUpserts(writes).at(-1)?.value).toEqual({
      es: { roles: OWED.es.roles },
      en: { roles: `EN ${OWED.es.roles}` },
      meta: { src: { roles: "es" } },
    });
    await expect(page.locator(SAVE), "paid: nothing left to save").toBeDisabled();
  });
});
