import { chromium, expect, test, type Page, type Route } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { forceLanguage, injectAdminSession, MOCK_PHOTOS, routeSupabase, type Write } from "./_admin";
import { BUILT_SITE_THEME } from "../src/generated/siteTheme";

/**
 * SITE.THEME.1 — a public light/dark theme for the reading pages (/blog,
 * /blog/<slug>, /events, /book, and the header and footer while one is open),
 * set from Admin › Ajustes (site_settings `site_theme`: dark | light | auto).
 * Default dark; the cache `ta_site_theme` outranks the built value; no hold.
 *
 *  T1  the default build renders /blog dark — today's ground, ink and gold —
 *      and caches "dark" once the (absent) row answers
 *  T2  with the cache set to light, /blog and /blog/<slug> render the light set
 *      BEFORE the site_settings read answers; the header's type is ink (no
 *      ivory on paper), its monogram the two-tone mark, its scrolled bar paper
 *  T3  auto follows prefers-color-scheme: light, then dark, live
 *  T4  under light, the cinematic home and /green-world are unchanged: no
 *      data-site-theme, and header, footer, Blog act and body colours equal to
 *      the same page under dark (SITE.THEME.2 took the editorial and classic
 *      homes into the room — the Homes group below)
 *  T5  the admin toggle writes the setting and the cache, and /blog follows on
 *      the next in-app navigation, with no reload
 *  T6  390×844 light /blog: contrast of a title, an excerpt, a date and a Green
 *      World lane label against the paper (both ends of its gradient)
 *  T7  one half-scale screenshot pair, /blog dark vs light at 1440×900
 *  T8  SITE.THEME.1a — leaving a light /blog for /, the outgoing page fades
 *      out on paper (sampled every frame; ≈150ms is mid-fade), header and body
 *      with it, and the home arrives dark; /blog → /events is light throughout
 *
 * SITE.THEME.2 — Homes: the setting reaches `/` while it shows the editorial
 * or classic home; the cinematic home is dark-only.
 *
 *  H1  light + classic: paper ground, ink headline, the gold CTA ≥3:1, the
 *      header ink (no halo), and its scrolled bar paper
 *  H2  light + editorial: the same, plus the hero's ground is paper and no
 *      #ffffff text remains (five named text nodes, then every one)
 *  H3  light + cinematic: `/` carries no data-site-theme and renders today's
 *      dark — and a live swap from a light editorial to cinematic leaves the
 *      room with it
 *  H4  dark: classic and editorial are pixel-identical to bff1d0a at 1440×900
 *      and 390×844 (0 px, decoded and compared pixel by pixel). Its baseline
 *      is a bff1d0a server's own capture (SITE_THEME_PARITY=capture, QA_PORT
 *      at that server); with none on this machine (CI) it skips, and says so.
 *  H5  light: / (classic) → /blog → / never breaks theme mid-fade (T8's method)
 *  H6  390×844 light classic and editorial: no horizontal overflow; headline,
 *      body and CTA hold their contrast. SITE.THEME.2a — on the editorial, the
 *      contact band too: its submit is a gold line with ink letters, each ≥3:1
 *      on the band, and a failed submit's three errors (Spanish) hold ≥4.5:1
 *
 * Screenshots land in _qa/site-theme/.
 */

const SHOTS = "_qa/site-theme";

const iso = (d: string) => new Date(d).toISOString();
const COVER = { id: "c2", image_url: MOCK_PHOTOS[0].image_url, alt_text: "Titi bailando" };
const BODY =
  "Hay días en que el set empieza antes del amanecer.\n\n## Lo que aprendí\n\nLa cámara no perdona la prisa, y `el guion` se subraya.\n\n### Detalle\n\n- Escuchar\n- Respirar\n\n> Una cita del set.\n\nMás en [el blog](/blog).";

const post = (
  id: string,
  slug: string,
  category: "personal" | "greenworld",
  day: string,
  es: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  slug,
  category,
  status: "published",
  published_at: iso(`2026-09-${day}T15:00:00Z`),
  created_at: iso(`2026-09-${day}T12:00:00Z`),
  updated_at: iso(`2026-09-${day}T15:00:00Z`),
  title: { es, en: es, src: "es" },
  excerpt: { es: `Sobre ${es.toLowerCase()}.`, en: `About ${es.toLowerCase()}.`, src: "es" },
  body: { es: BODY, en: BODY, src: "es" },
  meta_description: null,
  tags: ["rutina"],
  cover_photo_id: null,
  cover: null,
  ...extra,
});

const ROWS = [
  post("g1", "te-verde-en-casa", "greenworld", "24", "Té verde en casa", {
    gw_kind: "producto",
    gw_products: [{ name: "Té verde", url: "" }],
    cover_photo_id: "c2",
    cover: COVER,
  }),
  post("p1", "un-dia-en-el-set", "personal", "20", "Un día en el set"),
  post("g2", "mi-lista-de-compras", "greenworld", "16", "Mi lista de compras", { gw_kind: "capacitacion" }),
];

/** blog_posts, read-only: eq filters, newest first, limit, single. */
async function routeBlog(page: Page) {
  await page.route("**/rest/v1/blog_posts*", async (route: Route) => {
    const url = new URL(route.request().url());
    const single = (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
    let out = [...ROWS] as Record<string, unknown>[];
    for (const [key, raw] of url.searchParams) {
      if (["select", "order", "limit", "offset"].includes(key)) continue;
      const m = raw.match(/^(eq|neq)\.(.*)$/);
      if (!m) continue;
      out = out.filter((r) => (m[1] === "eq" ? String(r[key]) === m[2] : String(r[key]) !== m[2]));
    }
    out.sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
    const limit = Number(url.searchParams.get("limit") ?? "0");
    if (limit) out = out.slice(0, limit);
    if (single && !out.length) {
      return route.fulfill({ status: 406, contentType: "application/json", body: '{"code":"PGRST116"}' });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(single ? out[0] : out) });
  });
}

/**
 * The `site_theme` row. Registered after routeSupabase, so it wins (routes are
 * LIFO). `null` → the row is absent. With `hold`, the read stays unanswered
 * until the returned release() — so a spec can prove the first paint needed no
 * network.
 */
async function routeTheme(page: Page, value: string | null, opts: { hold?: boolean } = {}) {
  let release: () => void = () => {};
  const gate = opts.hold ? new Promise<void>((r) => (release = r)) : Promise.resolve();
  await page.route("**/rest/v1/site_settings*", async (route: Route) => {
    if (route.request().method() !== "GET" || !route.request().url().includes("site_theme")) return route.fallback();
    await gate;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: value === null ? "null" : JSON.stringify({ value }),
    });
  });
  return () => release();
}

const seedCache = (page: Page, theme: string) =>
  page.addInitScript((t) => {
    try {
      localStorage.setItem("ta_site_theme", t);
    } catch {
      /* noop */
    }
  }, theme);

async function open(
  page: Page,
  path: string,
  opts: { size?: { width: number; height: number }; homeVariant?: string; theme?: string | null; hold?: boolean } = {},
) {
  await forceLanguage(page, "es");
  await routeSupabase(page, { homeVariant: opts.homeVariant ?? "cinematic" });
  await routeBlog(page);
  const release = await routeTheme(page, opts.theme === undefined ? null : opts.theme, { hold: opts.hold });
  await page.setViewportSize(opts.size ?? { width: 1440, height: 900 });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return release;
}

/* ---------------- colour arithmetic ---------------- */

type RGBA = [number, number, number, number];
const parse = (css: string): RGBA => {
  // A color-mix() computes to `color(srgb r g b / a)`, channels 0–1.
  const srgb = css.match(/color\(srgb ([^)]+)\)/);
  if (srgb) {
    const [r, g, b, a = "1"] = srgb[1].split(/[\s/]+/).filter(Boolean);
    return [Number(r) * 255, Number(g) * 255, Number(b) * 255, Number(a)];
  }
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`not an rgb colour: ${css}`);
  const [r, g, b, a = "1"] = m[1].split(/[\s,/]+/).filter(Boolean);
  return [Number(r), Number(g), Number(b), Number(a)];
};
const over = ([r, g, b, a]: RGBA, [R, G, B]: number[]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
const lum = (c: number[]) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (fg: string, bg: number[]) => {
  const a = lum(over(parse(fg), bg));
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/* The two sets, as the browser computes them. */
const DARK = {
  ground: "rgb(11, 10, 8)",
  ink: "rgb(244, 236, 219)",
  inkDim: "rgb(240, 233, 218)",
  gold: "rgb(201, 165, 92)",
  lane: "rgb(18, 160, 59)",
  body: "rgb(18, 18, 18)",
};
const LIGHT = {
  ground: "rgb(250, 246, 240)",
  ink: "rgb(29, 26, 22)",
  inkDim: "rgb(46, 42, 37)",
  gold: "rgb(131, 95, 7)",
  lane: "rgb(11, 93, 42)",
};
const PAPER = [250, 246, 240];
/** The bottom of the light room's gradient: rgba(61,43,31,0.06) over the paper. */
const PAPER_LOW = over([61, 43, 31, 0.06], PAPER);

const css = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

const frame = (page: Page) => page.locator("[data-site-theme]");

/** What a reader sees of the room: wrapper, ground, a title, the eyebrow, a date, a lane label. */
async function blogRoom(page: Page) {
  await expect(page.locator('[data-qa="blog-card"]').first()).toBeVisible();
  return {
    attr: await frame(page).getAttribute("data-site-theme"),
    ground: await css(page, '[data-qa="blog-page"]', "background-color"),
    gradient: await css(page, '[data-qa="blog-page"]', "background-image"),
    title: await css(page, '[data-qa="blog-card-title"]', "color"),
    eyebrow: await css(page, '[data-qa="blog-eyebrow"]', "color"),
    excerpt: await css(page, '[data-qa="blog-card-excerpt"]', "color"),
    personalDate: await css(page, '[data-blog-card-lane="personal"] [data-qa="blog-card-date"]', "color"),
    laneLabel: await css(page, '[data-qa="blog-card-label"]', "color"),
    body: await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  };
}

/**
 * Every visible header element that carries its own text, with its colour —
 * the "no ivory on paper" sample.
 */
const headerInk = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("header *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
        return ownText && r.width > 0 && r.height > 0 && s.visibility !== "hidden" && Number(s.opacity) > 0;
      })
      .map((el) => ({ text: el.textContent!.trim().slice(0, 24), color: getComputedStyle(el).color })),
  );

/** Colours of the chrome and the home's Blog act — what T4 compares across themes. */
const chrome = (page: Page) =>
  page.evaluate(() => {
    const pick = (el: Element) => {
      const s = getComputedStyle(el);
      return [el.tagName, s.color, s.backgroundColor, s.borderTopColor, s.borderLeftColor, (el as HTMLImageElement).src ?? ""].join("|");
    };
    const all = (sel: string) => [...document.querySelectorAll(sel)].map(pick);
    return {
      attr: document.querySelector("[data-site-theme]")?.getAttribute("data-site-theme") ?? null,
      body: pick(document.body),
      header: all("header, header *"),
      footer: all("footer, footer *"),
      blogAct: all('[data-qa^="blog-act"], [data-qa^="blog-act"] *'),
      main: all("main > * > *:first-child, main h1, main h2").slice(0, 40),
    };
  });

/** One animation frame of a route change, as the reader sees it. */
type Frame = {
  t: number;
  /**
   * The outgoing / incoming page: its effective opacity (PageTransition's
   * fade), its ground and its ink (its colour — H5 watches the classic home's
   * hero, which has no ground of its own and stands on the body's).
   */
  from: { opacity: number; ground: string; ink: string } | null;
  to: { opacity: number; ground: string; ink: string } | null;
  attr: string | null;
  body: string;
  twoTone: boolean;
  footer: string;
};

/**
 * SITE.THEME.1a — leave a page in-app, by clicking `click` or by pushing `push`
 * the way the router hears a back/forward (popstate), and record every frame
 * until the outgoing `from` has gone and `to` (when given) has stood 400ms.
 * In-page, so the sampling owes nothing to Playwright's round trips.
 */
const watchRouteChange = (page: Page, opts: { click?: string; push?: string; from: string; to?: string }) =>
  page.evaluate(
    ({ click, push, from, to }) =>
      new Promise<Frame[]>((resolve) => {
        const look = (sel: string) => {
          const el = document.querySelector<HTMLElement>(sel);
          if (!el) return null;
          let opacity = 1;
          for (let n: HTMLElement | null = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
          const s = getComputedStyle(el);
          return { opacity, ground: s.backgroundColor, ink: s.color };
        };
        const frames: Frame[] = [];
        const t0 = performance.now();
        let arrivedAt = 0;
        const tick = () => {
          const t = performance.now() - t0;
          const footer = document.querySelector("footer");
          const f: Frame = {
            t,
            from: look(from),
            to: to ? look(to) : null,
            attr: document.querySelector("[data-site-theme]")?.getAttribute("data-site-theme") ?? null,
            body: getComputedStyle(document.body).backgroundColor,
            twoTone: /twotone/.test(document.querySelector<HTMLImageElement>('header img[alt*="monogram"]')?.src ?? ""),
            footer: footer ? getComputedStyle(footer).backgroundColor : "",
          };
          frames.push(f);
          if (!arrivedAt && !f.from && (!to || f.to)) arrivedAt = t;
          if ((arrivedAt && t - arrivedAt > 400) || t > 8000) resolve(frames);
          else requestAnimationFrame(tick);
        };
        if (click) document.querySelector<HTMLElement>(click)!.click();
        else {
          history.pushState(null, "", push);
          dispatchEvent(new PopStateEvent("popstate"));
        }
        requestAnimationFrame(tick);
      }),
    opts,
  );

const FOOTER_PAPER = "rgba(250, 246, 240, 0.8)";

/* ---------------- specs ---------------- */

test.describe("SITE.THEME.1", () => {
  test("T1 the default build renders /blog dark, as today", async ({ page }) => {
    expect(BUILT_SITE_THEME).toBe("dark");
    await open(page, "/blog");
    const room = await blogRoom(page);
    expect(room.attr).toBe("dark");
    expect(room.ground).toBe(DARK.ground);
    expect(room.gradient).toContain("rgba(244, 236, 219, 0.05)");
    expect(room.title).toBe(DARK.ink);
    expect(room.eyebrow).toBe(DARK.gold);
    expect(room.excerpt).toBe(DARK.inkDim);
    expect(room.personalDate).toBe(DARK.gold);
    expect(room.laneLabel).toBe(DARK.lane);
    expect(room.body).toBe(DARK.body);
    // The absent row answered: the default is what this browser now caches.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("ta_site_theme"))).toBe("dark");
  });

  test("T2 the cache's light paints /blog and a post before the setting answers; the header is ink", async ({ page }) => {
    await seedCache(page, "light");
    const release = await open(page, "/blog", { theme: "light", hold: true });

    const room = await blogRoom(page);
    expect(room.attr).toBe("light");
    expect(room.ground).toBe(LIGHT.ground);
    expect(room.title).toBe(LIGHT.ink);
    expect(room.eyebrow).toBe(LIGHT.gold);
    expect(room.excerpt).toBe(LIGHT.inkDim);
    expect(room.personalDate).toBe(LIGHT.gold);
    expect(room.laneLabel).toBe(LIGHT.lane);
    expect(room.body).toBe(LIGHT.ground);

    // The header over paper: every glyph dark enough to read, none ivory.
    const ink = await headerInk(page);
    expect(ink.length).toBeGreaterThan(4);
    for (const { text, color } of ink) {
      expect(color, text).not.toBe(DARK.ink);
      expect(color, text).not.toBe(DARK.inkDim);
      expect(contrast(color, PAPER), `${text} ${color}`).toBeGreaterThanOrEqual(4.5);
    }
    await expect(page.locator('header img[alt*="monogram"]').first()).toHaveAttribute("src", /twotone/);
    // Still unanswered: all of the above came from the cache.
    release();

    // Scrolled, the bar is paper, not the dark's charcoal.
    await page.mouse.wheel(0, 700);
    await expect
      .poll(() => css(page, "header[data-site-header]", "background-color"))
      .toBe("rgba(250, 246, 240, 0.95)");
    expect(await css(page, "footer", "background-color")).toBe("rgba(250, 246, 240, 0.8)");

    // In-app to the post: the same light room.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('[data-qa="blog-card"][data-slug="te-verde-en-casa"] a').first().click();
    await expect(page.locator('[data-qa="blog-post-title"]')).toBeVisible();
    expect(await frame(page).getAttribute("data-site-theme")).toBe("light");
    expect(await css(page, '[data-qa="blog-post"]', "background-color")).toBe(LIGHT.ground);
    expect(await css(page, '[data-qa="blog-post-title"]', "color")).toBe(LIGHT.ink);
    expect(await css(page, '[data-qa="blog-post-meta"]', "color")).toBe(LIGHT.lane);
    expect(await css(page, '[data-qa="blog-post-body"] p', "color")).toBe(LIGHT.inkDim);
    for (const { text, color } of await headerInk(page)) {
      expect(contrast(color, PAPER), `${text} ${color}`).toBeGreaterThanOrEqual(4.5);
    }
    // A direct load of the post is light too.
    await page.goto("/blog/te-verde-en-casa", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="blog-post-title"]')).toBeVisible();
    expect(await css(page, '[data-qa="blog-post"]', "background-color")).toBe(LIGHT.ground);
    expect(await css(page, '[data-qa="blog-post-title"]', "color")).toBe(LIGHT.ink);
  });

  test("T3 auto follows the device: light, then dark, live", async ({ page }) => {
    await seedCache(page, "auto");
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "/blog", { theme: "auto" });
    let room = await blogRoom(page);
    expect(room.attr).toBe("light");
    expect(room.ground).toBe(LIGHT.ground);
    expect(room.title).toBe(LIGHT.ink);

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(frame(page)).toHaveAttribute("data-site-theme", "dark");
    // A card title eases its colour (transition-colors, 300ms): poll to the end of it.
    await expect.poll(async () => (await blogRoom(page)).title).toBe(DARK.ink);
    room = await blogRoom(page);
    expect(room.ground).toBe(DARK.ground);

    // And from a cold load under dark.
    await page.reload({ waitUntil: "domcontentloaded" });
    room = await blogRoom(page);
    expect(room.attr).toBe("dark");
    expect(room.ground).toBe(DARK.ground);
  });

  test("T4 the cinematic home and /green-world are unchanged under light", async ({ browser }) => {
    test.setTimeout(240_000);
    // SITE.THEME.2 — the editorial and classic homes left this list: under light
    // they wear the room now (H1, H2). What stays dark-only is checked here.
    const capture = async (theme: "dark" | "light", path: string, homeVariant = "cinematic") => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await seedCache(page, theme);
      await open(page, path, { homeVariant, theme });
      await page.waitForTimeout(3000);
      const out = await chrome(page);
      await context.close();
      return out;
    };
    for (const [path, variant] of [
      ["/", "cinematic"],
      ["/green-world", "cinematic"],
    ] as const) {
      const dark = await capture("dark", path, variant);
      const light = await capture("light", path, variant);
      const what = `${path} (${variant})`;
      expect(light.attr, what).toBeNull();
      expect(dark.attr, what).toBeNull();
      expect(light.header.length, what).toBeGreaterThan(10);
      expect(light.body, `${what} body`).toEqual(dark.body);
      expect(light.header, `${what} header`).toEqual(dark.header);
      expect(light.footer, `${what} footer`).toEqual(dark.footer);
      expect(light.blogAct, `${what} Blog act`).toEqual(dark.blogAct);
      expect(light.main, `${what} page`).toEqual(dark.main);
      if (path === "/" && variant === "cinematic") expect(light.blogAct.length).toBeGreaterThan(10);
    }
  });

  test("T5 the admin toggle writes the setting and the cache; /blog follows in-app, no reload", async ({ page }) => {
    const writes: Write[] = [];
    await injectAdminSession(page);
    await forceLanguage(page, "es");
    await routeSupabase(page, { writes });
    await routeBlog(page);
    await routeTheme(page, null);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.locator('[data-qa="admin-nav-settings"]').click();
    const toggle = page.locator('[data-qa="site-theme-toggle"]');
    await expect(toggle).toBeVisible();
    // Beside the home variant, before the hero copy.
    const order = await page
      .locator('[data-qa="admin-section-settings"] section')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-qa")));
    expect(order.indexOf("site-theme-toggle")).toBe(1);
    await expect(toggle.getByRole("button")).toHaveText(["Oscuro", "Claro", "Automático"]);
    // SITE.THEME.2 — and it says which homes it reaches.
    await expect(page.locator('[data-qa="site-theme-homes"]')).toHaveText(
      "También las portadas Editorial y Clásica; la portada Cinemática es siempre oscura.",
    );
    await expect(page.locator('[data-qa="site-theme-dark"]')).toHaveAttribute("aria-pressed", "true");
    mkdirSync(SHOTS, { recursive: true });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.screenshot({ path: `${SHOTS}/admin-toggle-dark-selected.png` });

    await page.locator('[data-qa="site-theme-light"]').click();
    await expect(page.locator('[data-qa="site-theme-light"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-qa="site-theme-hint"]')).toHaveText("Papel cálido, tinta carbón y dorado.");
    const upserts = writes.filter((w) => w.method === "POST" && w.url.includes("/rest/v1/site_settings"));
    expect(upserts).toHaveLength(1);
    const sent = JSON.parse(upserts[0].body ?? "{}");
    expect(Array.isArray(sent) ? sent[0] : sent).toMatchObject({ key: "site_theme", value: "light" });
    expect(await page.evaluate(() => localStorage.getItem("ta_site_theme"))).toBe("light");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400); // the segments ease their colours
    await toggle.screenshot({ path: `${SHOTS}/admin-toggle-light-selected.png` });

    // The next navigation, in-app: the marker survives only if nothing reloaded.
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    await page.locator('header [data-qa="nav-blog"]').click();
    await expect(page).toHaveURL(/\/blog$/);
    const room = await blogRoom(page);
    expect(room.attr).toBe("light");
    expect(room.ground).toBe(LIGHT.ground);
    expect(room.title).toBe(LIGHT.ink);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  });

  test("T6 390×844 light /blog: title, body, date and a lane label hold their contrast", async ({ page }) => {
    await seedCache(page, "light");
    await open(page, "/blog", { size: { width: 390, height: 844 }, theme: "light" });
    const room = await blogRoom(page);
    expect(room.attr).toBe("light");
    const checks = [
      { what: "title", color: room.title, min: 4.5 },
      { what: "body", color: room.excerpt, min: 4.5 },
      { what: "date (gold)", color: room.personalDate, min: 3 },
      { what: "Green World lane label", color: room.laneLabel, min: 4.5 },
    ];
    const report: string[] = [];
    for (const { what, color, min } of checks) {
      const worst = Math.min(contrast(color, PAPER), contrast(color, PAPER_LOW));
      report.push(`${what} ${color} ${worst.toFixed(2)}:1`);
      expect(worst, `${what} ${color}`).toBeGreaterThanOrEqual(min);
    }
    test.info().annotations.push({ type: "contrast", description: report.join(" · ") });
    // And nothing sideways at the phone width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("T7 screenshot: /blog dark vs light, half scale, 1440×900", async ({ browser }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const theme of ["dark", "light"] as const) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.5 });
      const page = await context.newPage();
      await seedCache(page, theme);
      await open(page, "/blog", { theme, size: { width: 1440, height: 900 } });
      await blogRoom(page);
      await page.waitForTimeout(1200);
      const png = await page.screenshot({ path: `${SHOTS}/blog-${theme}-1440x900-half.png` });
      // Half scale: 720×450 pixels for the 1440×900 viewport.
      expect(png.readUInt32BE(16)).toBe(720);
      expect(png.readUInt32BE(20)).toBe(450);
      await context.close();
    }
  });

  test("T8 leaving a light /blog, the page fades out on paper; /blog → /events stays light", async ({ page }) => {
    await seedCache(page, "light");
    await open(page, "/blog", { theme: "light" });
    expect((await blogRoom(page)).attr).toBe("light");
    // Let the arrival fade finish, so the only motion sampled is the exit.
    await page.waitForTimeout(600);

    // /blog → / by the header's own link.
    const home = await watchRouteChange(page, { click: 'header a[href="/"]', from: '[data-qa="blog-page"]' });
    const leaving = home.filter((f) => f.from);
    expect(leaving.length, "frames with /blog still on screen").toBeGreaterThan(3);
    // Mid-fade (≈150ms of the 300ms exit): the page is half gone, and still on paper.
    const mid = leaving.reduce((a, b) => (Math.abs(b.t - 150) < Math.abs(a.t - 150) ? b : a));
    const at = `${mid.t.toFixed(0)}ms`;
    expect(Math.abs(mid.t - 150), `nearest frame to 150ms is ${at}`).toBeLessThan(50);
    expect(mid.from!.opacity, `opacity at ${at}`).toBeGreaterThan(0.05);
    expect(mid.from!.opacity, `opacity at ${at}`).toBeLessThan(0.95);
    expect(mid.from!.ground, `ground at ${at}`).toBe(LIGHT.ground);
    // Every frame of the exit, header, body and footer included.
    for (const f of leaving) {
      const when = `${f.t.toFixed(0)}ms, opacity ${f.from!.opacity.toFixed(2)}`;
      expect(f.from!.ground, `ground ${when}`).toBe(LIGHT.ground);
      expect(f.attr, `data-site-theme ${when}`).toBe("light");
      expect(f.body, `body ${when}`).toBe(LIGHT.ground);
      expect(f.twoTone, `two-tone monogram ${when}`).toBe(true);
      expect(f.footer, `footer ${when}`).toBe(FOOTER_PAPER);
    }
    // Then the home arrives in the dark, as ever.
    const last = home[home.length - 1];
    expect(last.from).toBeNull();
    expect(last.attr).toBeNull();
    expect(last.body).toBe(DARK.body);
    expect(last.twoTone).toBe(false);
    test.info().annotations.push({
      type: "exit",
      description: `${leaving.length} frames on paper over ${leaving[leaving.length - 1].t.toFixed(0)}ms; at ${at} opacity ${mid.from!.opacity.toFixed(2)}`,
    });

    // /blog → /events: room to room, light from the first frame to the last.
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    expect((await blogRoom(page)).attr).toBe("light");
    await page.waitForTimeout(600);
    const events = await watchRouteChange(page, {
      push: "/events",
      from: '[data-qa="blog-page"]',
      to: '[data-qa="events-page"]',
    });
    expect(events.filter((f) => f.from).length, "frames with /blog still on screen").toBeGreaterThan(3);
    for (const f of events) {
      const when = `${f.t.toFixed(0)}ms`;
      expect(f.attr, `data-site-theme ${when}`).toBe("light");
      expect(f.body, `body ${when}`).toBe(LIGHT.ground);
      expect(f.twoTone, `two-tone monogram ${when}`).toBe(true);
      expect(f.footer, `footer ${when}`).toBe(FOOTER_PAPER);
      if (f.from) expect(f.from.ground, `/blog ground ${when}`).toBe(LIGHT.ground);
      if (f.to) expect(f.to.ground, `/events ground ${when}`).toBe(LIGHT.ground);
    }
    const arrived = events[events.length - 1];
    expect(arrived.to, "/events on screen").not.toBeNull();
    expect(arrived.to!.opacity).toBeGreaterThan(0.99);
  });
});

/* ---------------- SITE.THEME.2 — Homes ---------------- */

type Variant = "classic" | "editorial" | "cinematic";

const CLASSIC = '[data-qa="home-classic"]';
const EDITORIAL = '[data-qa="home-editorial"]';
const CINEMATIC = '[data-qa="home-cinematic"]';
const rootOf = (v: Variant) => (v === "classic" ? CLASSIC : v === "editorial" ? EDITORIAL : CINEMATIC);

/** The cached variant is `/`'s first render (it outranks the built one), so nothing swaps in. */
const seedVariant = (page: Page, variant: Variant) =>
  page.addInitScript((v) => {
    try {
      localStorage.setItem("ta_home_variant", v);
    } catch {
      /* noop */
    }
  }, variant);

/** `/` on a variant and a theme, each cached AND served, so neither moves after first paint. */
async function openHome(page: Page, variant: Variant, theme: "dark" | "light", size = { width: 1440, height: 900 }) {
  await seedCache(page, theme);
  await seedVariant(page, variant);
  await open(page, "/", { homeVariant: variant, theme, size });
  await expect(page.locator(rootOf(variant))).toBeVisible();
}

/** Each home's headline, its gold half, a line of body type and its gold CTA. */
const PARTS = {
  classic: {
    headline: `${CLASSIC} h1`,
    gold: `${CLASSIC} h1 span.italic`,
    body: `${CLASSIC} p.text-muted-foreground`,
    cta: `${CLASSIC} a[href*="world-food"]`,
  },
  editorial: {
    headline: `${EDITORIAL} h1 span`,
    gold: `${EDITORIAL} h1 span:nth-child(2)`,
    body: `${EDITORIAL} .editorial-subtitle p`,
    cta: `${EDITORIAL} .editorial-cta a`,
  },
} as const;

/** The editorial's contact submit (SITE.THEME.2a). */
const SUBMIT = `${EDITORIAL} section#contact button[type="submit"]`;

/** The classic hero's wash at its darkest: secondary/20 over the paper (bottom right). */
const PAPER_WASH = over([239, 230, 214, 0.2], PAPER);

/** An element's ink against what it stands on — its own fill (a wash, or nothing) over `ground` — and its edge. */
async function inkOn(page: Page, selector: string, ground: number[]) {
  const [color, fill, border] = await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor, s.borderTopColor];
    });
  return { color, fill, border, text: contrast(color, over(parse(fill), ground)), edge: contrast(border, ground) };
}

/** The header over a light home: every glyph ink, none ivory, no cinematic halo, the two-tone mark. */
async function expectHeaderInk(page: Page) {
  const ink = await headerInk(page);
  expect(ink.length).toBeGreaterThan(4);
  for (const { text, color } of ink) {
    expect(color, text).not.toBe(DARK.ink);
    expect(color, text).not.toBe(DARK.inkDim);
    expect(contrast(color, PAPER), `${text} ${color}`).toBeGreaterThanOrEqual(4.5);
  }
  const halos = await page.evaluate(() =>
    [...document.querySelectorAll("header a, header button")]
      .map((el) => getComputedStyle(el).textShadow)
      .filter((s) => s !== "none"),
  );
  expect(halos, "no dark halo under ink glyphs").toEqual([]);
  await expect(page.locator('header img[alt*="monogram"]').first()).toHaveAttribute("src", /twotone/);
}

/** Scrolled past the hero the bar is the reading pages' paper — not the cinematic home's charcoal. */
async function expectPaperBar(page: Page) {
  await page.mouse.wheel(0, 1200);
  await expect
    .poll(() => css(page, "header[data-site-header]", "background-color"))
    .toBe("rgba(250, 246, 240, 0.95)");
}

/** Every Math.random draw from one seed, so CosmicBackground's stars land where they landed before. */
const seedRandom = (page: Page) =>
  page.addInitScript(() => {
    let s = 0x2f6b9d1;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });

/**
 * Every CSS animation and transition runs to its end at once, from the first
 * frame. A running one is composited, and the cosmic layer's composited 2px
 * stars rasterised ±1 a channel from one capture to the next — measured,
 * bff1d0a against itself: 80 px. At rest from document start nothing is
 * composited for motion. Both sides of H4 are captured this way, so it hides
 * nothing either side has.
 */
const atRest = (page: Page) =>
  page.addInitScript(() => {
    const css =
      "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important;" +
      " animation-iteration-count: 1 !important; transition-duration: 0s !important; transition-delay: 0s !important; }";
    const add = () => {
      const style = document.createElement("style");
      style.textContent = css;
      (document.head ?? document.documentElement).appendChild(style);
    };
    // Before the app's module script either way: 'interactive' precedes deferred scripts.
    if (document.documentElement) add();
    else document.addEventListener("readystatechange", add, { once: true });
  });

/**
 * Paint the whole page afresh: hidden for two frames, then shown. The classic
 * phone hero's parallax photo re-rasters only its own clip as it settles, and
 * where that clip cuts the gold offset frame's rounded corners their
 * antialiasing came out ±1 in green about every other capture — 2 px, bff1d0a
 * against itself, GPU or not. Painted whole, 8 captures in 8 are identical.
 */
const fullRepaint = (page: Page) =>
  page.evaluate(async () => {
    const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    document.documentElement.style.visibility = "hidden";
    await twoFrames();
    document.documentElement.style.visibility = "";
    await twoFrames();
  });

/**
 * H4's two frames of a dark home: the hero, and the page scrolled to Featured
 * (its plate) with the contact band below. Deterministic by construction: the
 * stars are seeded, every CSS animation is at rest from the first frame
 * (atRest), the gallery's moving strip is out of both frames, and each frame
 * is painted whole just before it is taken (fullRepaint). Each take is its own
 * browser process, so no earlier test's state can lean on it.
 */
async function parityShots(variant: "classic" | "editorial", size: { width: number; height: number }) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  await seedRandom(page);
  await atRest(page);
  await seedCache(page, "dark");
  await seedVariant(page, variant);
  await open(page, "/", { homeVariant: variant, theme: "dark", size });
  // The hero's h1, not the classic's marker: the baseline run is bff1d0a, which predates it.
  await expect(page.locator("main h1").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.images].filter((i) => i.loading !== "lazy").every((i) => i.complete && i.naturalWidth > 0),
  );
  await page.waitForTimeout(3000);
  await fullRepaint(page);
  const top = await page.screenshot({ animations: "disabled", caret: "hide" });
  await page.evaluate(() => {
    const el = document.getElementById("featured")!;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
  });
  await page.waitForTimeout(2500);
  await fullRepaint(page);
  const featured = await page.screenshot({ animations: "disabled", caret: "hide" });
  await browser.close();
  return { top, featured };
}

/**
 * A screenshot's pixels. Chromium's PNG bytes are NOT stable — two captures of
 * identical pixels can differ by a byte — so parity is judged on pixels. Only
 * what Chromium writes is read: 8-bit RGB or RGBA, not interlaced.
 */
function decodePng(buf: Buffer) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colorType, , , interlace] = data.subarray(8, 13);
      if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`unsupported PNG: depth ${depth}, colour type ${colorType}, interlace ${interlace}`);
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = y * (stride + 1) + 1;
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[out + x - channels] : 0;
      const b = y > 0 ? pixels[out - stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[out - stride + x - channels] : 0;
      let v = raw[line + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`bad PNG filter ${filter}`);
      pixels[out + x] = v & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

/** How many pixels differ between two screenshots (any channel), or -1 when their sizes do. */
function pixelDiff(a: Buffer, b: Buffer): number {
  const A = decodePng(a);
  const B = decodePng(b);
  if (A.width !== B.width || A.height !== B.height || A.channels !== B.channels) return -1;
  let n = 0;
  for (let i = 0; i < A.pixels.length; i += A.channels) {
    for (let k = 0; k < A.channels; k++) {
      if (A.pixels[i + k] !== B.pixels[i + k]) {
        n++;
        break;
      }
    }
  }
  return n;
}

const PARITY_BASE = process.env.SITE_THEME_PARITY_BASE ?? "_qa/site-theme/parity-bff1d0a";
const PARITY_HEAD = "_qa/site-theme/parity-head";
const CAPTURE = process.env.SITE_THEME_PARITY === "capture";

test.describe("SITE.THEME.2 — Homes", () => {
  test("H1 light + classic: paper ground, ink headline, gold CTA ≥3:1, the header ink", async ({ page }) => {
    await openHome(page, "classic", "light");
    expect(await frame(page).getAttribute("data-site-theme")).toBe("light");
    // The paper behind the hero, and the hero's own wash starting from it.
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(LIGHT.ground);
    expect(await css(page, `${CLASSIC} > div:first-child`, "background-image")).toContain(LIGHT.ground);
    // The headline in ink, its gold half in the room's gold.
    expect(await css(page, PARTS.classic.headline, "color")).toBe(LIGHT.ink);
    expect(await css(page, PARTS.classic.gold, "color")).toBe(LIGHT.gold);
    // The gold CTA: gold letters on their own gold wash over the paper.
    const cta = await inkOn(page, PARTS.classic.cta, PAPER);
    expect(cta.color).toBe(LIGHT.gold);
    expect(cta.text, `CTA ${cta.color} on ${cta.fill}`).toBeGreaterThanOrEqual(3);
    test.info().annotations.push({ type: "CTA", description: `${cta.color} on ${cta.fill}: ${cta.text.toFixed(2)}:1` });
    await expectHeaderInk(page);
    await expectPaperBar(page);
  });

  test("H2 light + editorial: the same, its hero ground paper, and no #ffffff text left", async ({ page }) => {
    await openHome(page, "editorial", "light");
    expect(await frame(page).getAttribute("data-site-theme")).toBe("light");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(LIGHT.ground);
    // The hero's ground — the Adjacent Ground on the dark — is the paper.
    expect(await css(page, `${EDITORIAL} section`, "background-color")).toBe(LIGHT.ground);
    expect(await css(page, PARTS.editorial.headline, "color")).toBe(LIGHT.ink);
    expect(await css(page, PARTS.editorial.gold, "color")).toBe(LIGHT.gold);
    // The CTA: ink letters inside a gold line, on the paper.
    const cta = await inkOn(page, PARTS.editorial.cta, PAPER);
    expect(cta.color).toBe(LIGHT.ink);
    expect(cta.border).toBe(LIGHT.gold);
    expect(cta.edge, `CTA line ${cta.border}`).toBeGreaterThanOrEqual(3);
    expect(cta.text, `CTA ${cta.color}`).toBeGreaterThanOrEqual(4.5);

    // No #ffffff text: five named nodes first, then every node of the home that carries text.
    const WHITE = "rgb(255, 255, 255)";
    const named = [
      `${EDITORIAL} h1 span`,
      `${EDITORIAL} .editorial-roles`,
      `${EDITORIAL} .editorial-subtitle p`,
      `${EDITORIAL} .editorial-subtitle p:nth-child(2)`,
      PARTS.editorial.cta,
    ];
    for (const sel of named) {
      const color = await css(page, sel, "color");
      expect(color, sel).not.toBe(WHITE);
      expect(contrast(color, PAPER), `${sel} ${color}`).toBeGreaterThanOrEqual(4.5);
    }
    const whites = await page.evaluate(
      ([root, white]) =>
        [...document.querySelectorAll(`${root} *`)]
          .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
          .filter((el) => getComputedStyle(el).color === white)
          .map((el) => el.textContent!.trim().slice(0, 30)),
      [EDITORIAL, WHITE],
    );
    expect(whites, "white text left on the paper").toEqual([]);
    // Its monogram is the two-tone mark: the white C would vanish into the paper.
    await expect(page.locator(`${EDITORIAL} img.editorial-monogram`)).toHaveAttribute("src", /twotone/);
    await expectHeaderInk(page);
    await expectPaperBar(page);
  });

  test("H3 light + cinematic: / carries no data-site-theme and renders today's dark", async ({ page, browser }) => {
    await openHome(page, "cinematic", "light");
    await page.waitForTimeout(1500);
    await expect(page.locator("[data-site-theme]")).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(DARK.body);
    // The header is the cinematic chrome: ivory type with its halo, the ivory-and-gold mark.
    expect(await css(page, 'header [data-qa="nav-blog"]', "color")).toBe(DARK.inkDim);
    expect(await css(page, 'header [data-qa="nav-blog"]', "text-shadow")).not.toBe("none");
    await expect(page.locator('header img[alt*="monogram"]').first()).not.toHaveAttribute("src", /twotone/);

    // An admin flip after the build: a light editorial is cached, the setting answers
    // cinematic. The room must leave in the render the cinematic home arrives in.
    const context = await browser.newContext();
    const swap = await context.newPage();
    await swap.addInitScript(() => {
      const w = window as unknown as { __roomWithCinematic: number };
      w.__roomWithCinematic = 0;
      new MutationObserver(() => {
        const lit = document.querySelector('[data-site-theme="light"]');
        const cinematic = document.querySelector('[data-qa="home-cinematic"], [data-qa="home-hold"]');
        if (lit && cinematic) w.__roomWithCinematic++;
      }).observe(document, { childList: true, subtree: true, attributes: true });
    });
    await seedCache(swap, "light");
    await seedVariant(swap, "editorial");
    await forceLanguage(swap, "es");
    await routeSupabase(swap, { homeVariant: "cinematic" });
    await routeTheme(swap, "light");
    // The setting answers late, so the light editorial is surely up first.
    await swap.route("**/site_settings*home_variant*", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      return route.fallback();
    });
    await swap.setViewportSize({ width: 1440, height: 900 });
    await swap.goto("/", { waitUntil: "domcontentloaded" });
    await expect(swap.locator(EDITORIAL)).toBeVisible();
    expect(await frame(swap).getAttribute("data-site-theme")).toBe("light");
    await expect(swap.locator(CINEMATIC)).toBeVisible({ timeout: 15_000 });
    await expect(swap.locator("[data-site-theme]")).toHaveCount(0);
    expect(await swap.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(DARK.body);
    expect(
      await swap.evaluate(() => (window as unknown as { __roomWithCinematic: number }).__roomWithCinematic),
      "mutations that saw the light room and the cinematic home together",
    ).toBe(0);
    await context.close();
  });

  test("H4 dark: classic and editorial are pixel-identical to bff1d0a (1440×900, 390×844)", async () => {
    test.setTimeout(300_000);
    test.skip(
      !CAPTURE && !existsSync(PARITY_BASE),
      `no bff1d0a baseline at ${PARITY_BASE}: capture one with SITE_THEME_PARITY=capture against a bff1d0a server (QA_PORT)`,
    );
    const dir = CAPTURE ? PARITY_BASE : PARITY_HEAD;
    mkdirSync(dir, { recursive: true });
    /**
     * Insurance on top of fullRepaint: the baseline keeps the screen two of
     * three captures agree on, and a compare that misses is captured again, up
     * to twice. It passes only on an exact 0 px match, so a real change — which
     * misses every time — cannot pass; only a one-off raster flicker can retry.
     */
    const ATTEMPTS = 3;
    const report: string[] = [];
    const differing: string[] = [];
    for (const variant of ["classic", "editorial"] as const) {
      for (const size of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
      ]) {
        const name = (stop: string) => `${variant}-${size.width}x${size.height}-${stop}.png`;
        if (CAPTURE) {
          const takes: { top: Buffer; featured: Buffer }[] = [];
          for (let i = 0; i < ATTEMPTS; i++) takes.push(await parityShots(variant, size));
          for (const stop of ["top", "featured"] as const) {
            const agreed = takes.find((a, i) => takes.some((b, j) => i !== j && pixelDiff(a[stop], b[stop]) === 0));
            expect(agreed, `${name(stop)}: no two of ${ATTEMPTS} captures agree`).toBeTruthy();
            writeFileSync(`${dir}/${name(stop)}`, agreed![stop]);
          }
          continue;
        }
        const pending = new Map<string, number>([
          ["top", -1],
          ["featured", -1],
        ]);
        let attempt = 0;
        while (pending.size && attempt < ATTEMPTS) {
          attempt++;
          const shots = await parityShots(variant, size);
          for (const stop of [...pending.keys()]) {
            const png = shots[stop as "top" | "featured"];
            writeFileSync(`${dir}/${name(stop)}`, png);
            const px = pixelDiff(readFileSync(`${PARITY_BASE}/${name(stop)}`), png);
            if (px === 0) {
              pending.delete(stop);
              report.push(`${name(stop)} 0 px${attempt > 1 ? ` (capture ${attempt})` : ""}`);
            } else pending.set(stop, px);
          }
        }
        for (const [stop, px] of pending) {
          differing.push(`${name(stop)} (${px < 0 ? "size differs" : `${px} px`}, ${ATTEMPTS} captures)`);
        }
      }
    }
    test.info().annotations.push({ type: "parity", description: CAPTURE ? `captured to ${dir}` : report.join(" · ") });
    expect(differing, `screens that differ from ${PARITY_BASE} (this run's are in ${PARITY_HEAD})`).toEqual([]);
  });

  test("H5 light: / (classic) → /blog → / never breaks theme mid-fade", async ({ page }) => {
    await openHome(page, "classic", "light");
    // Let the arrival fade finish, so the only motion sampled is the change.
    await page.waitForTimeout(1200);

    const legs = [
      { what: "/ → /blog", click: 'header [data-qa="nav-blog"]', from: CLASSIC, to: '[data-qa="blog-page"]' },
      { what: "/blog → /", click: 'header a[href="/"]', from: '[data-qa="blog-page"]', to: CLASSIC },
    ];
    const notes: string[] = [];
    for (const leg of legs) {
      const frames = await watchRouteChange(page, leg);
      const leaving = frames.filter((f) => f.from);
      expect(leaving.length, `${leg.what}: frames with the old page on screen`).toBeGreaterThan(3);
      // Mid-fade (≈150ms of the 300ms exit): half gone, and still in the room.
      const mid = leaving.reduce((a, b) => (Math.abs(b.t - 150) < Math.abs(a.t - 150) ? b : a));
      expect(Math.abs(mid.t - 150), `${leg.what}: nearest frame to 150ms is ${mid.t.toFixed(0)}ms`).toBeLessThan(50);
      expect(mid.from!.opacity).toBeGreaterThan(0.05);
      expect(mid.from!.opacity).toBeLessThan(0.95);
      for (const f of frames) {
        const when = `${leg.what} ${f.t.toFixed(0)}ms`;
        expect(f.attr, `data-site-theme ${when}`).toBe("light");
        expect(f.body, `body ${when}`).toBe(LIGHT.ground);
        expect(f.twoTone, `two-tone monogram ${when}`).toBe(true);
        expect(f.footer, `footer ${when}`).toBe(FOOTER_PAPER);
        for (const side of [f.from, f.to]) {
          if (!side) continue;
          // The blog's field is the paper; the classic home stands on the body's paper in ink.
          if (side.ground !== "rgba(0, 0, 0, 0)") expect(side.ground, `ground ${when}`).toBe(LIGHT.ground);
          else expect(side.ink, `ink ${when}`).toBe(LIGHT.ink);
        }
      }
      const arrived = frames[frames.length - 1];
      expect(arrived.from, `${leg.what}: the old page is gone`).toBeNull();
      expect(arrived.to, `${leg.what}: the new page is on screen`).not.toBeNull();
      notes.push(`${leg.what}: ${frames.length} frames, all light; at ${mid.t.toFixed(0)}ms opacity ${mid.from!.opacity.toFixed(2)}`);
    }
    test.info().annotations.push({ type: "walk", description: notes.join(" · ") });
  });

  for (const variant of ["classic", "editorial"] as const) {
    test(`H6 390×844 light ${variant}: no horizontal overflow; headline, body and CTA hold their contrast`, async ({
      page,
    }) => {
      await openHome(page, variant, "light", { width: 390, height: 844 });
      await page.waitForTimeout(1000);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      // The body clips sideways, so scrollWidth cannot see a cut-off button: measure the CTA's own box.
      const box = (await page.locator(PARTS[variant].cta).first().boundingBox())!;
      expect(box.x, "CTA left edge").toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, "CTA right edge").toBeLessThanOrEqual(390);

      // Against the paper and, on the classic, the darkest point of its hero wash.
      const grounds = variant === "classic" ? [PAPER, PAPER_WASH] : [PAPER];
      const worst = async (selector: string) => {
        const color = await css(page, selector, "color");
        return Math.min(...grounds.map((g) => contrast(color, g)));
      };
      const report: string[] = [];
      for (const [what, selector, min] of [
        ["headline", PARTS[variant].headline, 4.5],
        ["headline's gold half", PARTS[variant].gold, 3],
        ["body", PARTS[variant].body, 4.5],
      ] as const) {
        const ratio = await worst(selector);
        report.push(`${what} ${ratio.toFixed(2)}:1`);
        expect(ratio, what).toBeGreaterThanOrEqual(min);
      }
      const cta = Math.min(...(await Promise.all(grounds.map((g) => inkOn(page, PARTS[variant].cta, g)))).map((c) => c.text));
      report.push(`CTA ${cta.toFixed(2)}:1`);
      expect(cta, "CTA").toBeGreaterThanOrEqual(4.5);
      if (variant === "editorial") {
        const edge = (await inkOn(page, PARTS.editorial.cta, PAPER)).edge;
        report.push(`CTA line ${edge.toFixed(2)}:1`);
        expect(edge, "CTA line").toBeGreaterThanOrEqual(3);

        // SITE.THEME.2a — the contact band (bg-muted/50 over the paper). The submit
        // reads against it: a gold line round ink letters on its wash, each ≥3:1.
        const band = over(parse(await css(page, "section#contact", "background-color")), PAPER);
        const submit = await inkOn(page, SUBMIT, band);
        expect(submit.color, "submit letters").toBe(LIGHT.ink);
        expect(submit.border, "submit line").toBe(LIGHT.gold);
        expect(parseFloat(await css(page, SUBMIT, "border-top-width")), "submit line width").toBeGreaterThanOrEqual(1);
        report.push(`submit line ${submit.edge.toFixed(2)}:1, letters ${submit.text.toFixed(2)}:1`);
        expect(submit.edge, "submit line on the band").toBeGreaterThanOrEqual(3);
        expect(submit.text, "submit letters on the band").toBeGreaterThanOrEqual(3);

        // A failed submit, every field empty: the three errors render, in Spanish,
        // and each holds 4.5:1 on the band.
        await page.locator(SUBMIT).click();
        const errors = page.locator(`${EDITORIAL} section#contact form p.text-destructive`);
        await expect(errors).toHaveCount(3);
        await expect(errors.first()).toHaveText("El nombre debe tener al menos 2 caracteres");
        const colors = await errors.evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
        const error = Math.min(...colors.map((c) => contrast(c, band)));
        report.push(`errors ${colors[0]} ${error.toFixed(2)}:1`);
        expect(error, "error text on the band").toBeGreaterThanOrEqual(4.5);
      }
      test.info().annotations.push({ type: "contrast", description: report.join(" · ") });
    });
  }
});
