import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
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
 *  T4  under light, the three homes and /green-world are unchanged: no
 *      data-site-theme, and header, footer, Blog act and body colours equal to
 *      the same page under dark
 *  T5  the admin toggle writes the setting and the cache, and /blog follows on
 *      the next in-app navigation, with no reload
 *  T6  390×844 light /blog: contrast of a title, an excerpt, a date and a Green
 *      World lane label against the paper (both ends of its gradient)
 *  T7  one half-scale screenshot pair, /blog dark vs light at 1440×900
 *  T8  SITE.THEME.1a — leaving a light /blog for /, the outgoing page fades
 *      out on paper (sampled every frame; ≈150ms is mid-fade), header and body
 *      with it, and the home arrives dark; /blog → /events is light throughout
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
    gw_product_name: "Té verde",
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
  /** The outgoing / incoming page: its effective opacity (PageTransition's fade) and its ground. */
  from: { opacity: number; ground: string } | null;
  to: { opacity: number; ground: string } | null;
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
          return { opacity, ground: getComputedStyle(el).backgroundColor };
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

  test("T4 the three homes and /green-world are unchanged under light", async ({ browser }) => {
    test.setTimeout(240_000);
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
      ["/", "editorial"],
      ["/", "classic"],
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
