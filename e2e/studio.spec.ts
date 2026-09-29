import { expect, test, type Page, type Route } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";
import { studioDraft, uniqueSlug, firstParagraph } from "../src/lib/studio/publish";
import { YOUTUBE_INPUT_ENABLED } from "../src/lib/ventures";

/**
 * BLOG.2 step 3 — the Content Studio, end to end, with generate-content and
 * youtube-transcript mocked (no model is ever called from this suite).
 *
 *   S1 brain dump → Generate (blog + TikTok + Instagram) → three tabs
 *   S2 YouTube shows "Próximamente" (BLOG.2b: the deployed function gets 403)
 *   S3 narration leaked into the stream → the article shows without it
 *   S4 Publish → a blog_posts DRAFT, Blog tab open on it, other language pending
 *   S5 History lists a generation and reopens it
 *   S6 the admin header's theme toggle flips the Studio's tokens and survives a
 *      reload (ADMIN.THEME.1 — the Studio no longer has a toggle of its own)
 *   S7 1024×768 two columns · 820×1180 stacked · 390×844 no sideways scroll
 *   S8 the whole admin follows the theme (ADMIN.THEME.1 retired the old "the
 *      rest of the admin stays dark" assertion on purpose)
 *
 * STUDIO.SPEED.2 — the web-research switch (off on every mount, no persistence):
 *   W1 default press: web_search:false on the blog, cascade_source and no web_search on TikTok
 *   W2 switch on: web_search:true on the blog; social-only, web_search:true on each platform
 *   W3 a reload turns it off again
 *   W4 disabled while generating; English copy
 *   screenshots off/on × light/dark at 1440×900 land in _qa/studio-speed/
 *
 * STUDIO.HISTORY.1 — Borrar a generation from Historial (inline confirm, no window.confirm):
 *   H1 expand → Borrar → No leaves the row; collapsing cancels the confirm
 *   H2 Borrar → Sí sends one DELETE with id=eq.<row id>, the row leaves the list, blog_posts untouched
 *   H3 reopen a row, then delete it → Contenido generado shows the empty state
 *   H4 the select returns no row (RLS refusal) → "No se pudo borrar", the row stays
 *   screenshot of the confirm state, light, 1440×900, in _qa/studio-history/
 *
 * Screenshots (light and dark, 1440×900 and 820×1180) land in _qa/blog-2/.
 */

const SHOTS = "_qa/blog-2";
const SPEED_SHOTS = "_qa/studio-speed";
const HISTORY_SHOTS = "_qa/studio-history";

const ARTICLE = [
  "```meta",
  "Primary Keyword: preparar un personaje",
  "Meta Description: Cómo preparo un personaje antes de una escena, contado paso a paso desde Medellín para mi comunidad de TikTok.",
  "```",
  "",
  "# Cómo preparo un personaje antes de una escena",
  "",
  "*Lo que hago antes de que alguien diga acción.*",
  "",
  "Esta semana grabé un en vivo desde Medellín y mi comunidad me pidió esto.",
  "",
  "## Primero, escucho",
  "",
  "Leo la escena en voz alta tres veces. **La primera** es solo para oír.",
  "",
  "- Respiro",
  "- Leo",
  "- Repito",
  "",
  "> 💡 **Tip:** grábate leyendo.",
  "",
  "---",
  "",
  "*Cristyna Polentino — Titi (TitiActriz). Actriz · Streamer · Empresaria. [titiactriz.com](https://www.titiactriz.com)*",
].join("\n");

const SCREENSHOT_NARRATION =
  "I'll research prompt caching with the Claude API to get accurate technical details and current pricing data." +
  "I notice some odd model names appearing (\"Claude Fable 5.1\", \"Claude Mythos 5.1\") which look like search index artifacts or possibly hallucinated/mixed-up names not matching real Anthropic model names. Let me dig deeper into official docs and verify real model names and numbers." +
  "Hitting a rate limit on server tool use. Let me wait and try one at a time." +
  "Let me try using the web_search tool directly instead of through code_execution, since that might be a separate quota.";

const social = (p: string) =>
  [`**🎬 HOOK**`, `Hook de ${p}: nadie te cuenta esto.`, "", `**💬 CAPTION**`, `Caption de ${p} #titiactriz #actriz`].join("\n");

const TRANSCRIPT = "Hola a todos, hoy les cuento cómo me preparo para una escena difícil y qué hago cuando me pongo nerviosa.";

type GenCall = Record<string, unknown>;

type Mock = {
  writes: Write[];
  genCalls: GenCall[];
  ytCalls: GenCall[];
  generations: Record<string, unknown>[];
  posts: Record<string, unknown>[];
  blogStream: string;
  /** Every request that reached /rest/v1/blog_posts, reads included. */
  blogPostsRequests: number;
  /** What a DELETE on studio_generations answers: the deleted row (default) or nothing (RLS refusal). */
  deleteReturnsRow: boolean;
};

const USAGE = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, web_search_requests: 0, cost_usd: 0.0075, model: "claude-sonnet-5" };

async function setup(page: Page, opts: { lang?: "es" | "en"; generations?: Record<string, unknown>[]; blogStream?: string } = {}): Promise<Mock> {
  const mock: Mock = {
    writes: [],
    genCalls: [],
    ytCalls: [],
    generations: opts.generations ?? [],
    posts: [],
    blogStream: opts.blogStream ?? ARTICLE,
    blogPostsRequests: 0,
    deleteReturnsRow: true,
  };
  await injectAdminSession(page);
  await forceLanguage(page, opts.lang ?? "es");
  await routeSupabase(page, { writes: mock.writes });

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");

  await page.route("**/rest/v1/studio_generations*", (route) => {
    const req = route.request();
    const method = req.method();
    if (method === "GET") return json(route, mock.generations);
    const body = req.postData();
    mock.writes.push({ method, url: req.url(), body });
    if (method === "POST") {
      const row = {
        id: `gen-${mock.generations.length + 1}`,
        created_at: new Date().toISOString(),
        blog_post_id: null,
        source_url: null,
        usage: null,
        ...JSON.parse(body ?? "{}"),
      };
      mock.generations = [row, ...mock.generations];
      return json(route, wantsObject(route) ? { id: row.id } : [{ id: row.id }], 201);
    }
    if (method === "PATCH") {
      const id = new URL(req.url()).searchParams.get("id")?.replace(/^eq\./, "");
      const patch = JSON.parse(body ?? "{}");
      mock.generations = mock.generations.map((g) => (g.id === id ? { ...g, ...patch } : g));
      return route.fulfill({ status: 204, body: "" });
    }
    if (method === "DELETE") {
      // STUDIO.HISTORY.1 — .delete().eq("id", …).select("id"): PostgREST answers
      // the deleted rows; under an RLS refusal that is [] with status 200.
      const id = new URL(req.url()).searchParams.get("id")?.replace(/^eq\./, "");
      const hit = mock.generations.find((g) => g.id === id);
      if (!mock.deleteReturnsRow || !hit) return json(route, []);
      mock.generations = mock.generations.filter((g) => g.id !== id);
      return json(route, [{ id }]);
    }
    return route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/rest/v1/blog_posts*", (route) => {
    const req = route.request();
    const method = req.method();
    mock.blogPostsRequests += 1;
    if (method === "GET") {
      if (req.url().includes("slug=like")) return json(route, mock.posts.map((p) => ({ slug: p.slug })));
      return json(route, mock.posts);
    }
    const body = req.postData();
    mock.writes.push({ method, url: req.url(), body });
    if (method === "POST") {
      const now = new Date().toISOString();
      const row = {
        id: `post-${mock.posts.length + 1}`,
        cover_photo_id: null,
        published_at: null,
        created_at: now,
        updated_at: now,
        ...JSON.parse(body ?? "{}"),
      };
      mock.posts = [row, ...mock.posts];
      return json(route, wantsObject(route) ? { id: row.id } : [{ id: row.id }], 201);
    }
    return route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/functions/v1/generate-content", (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    mock.genCalls.push(body);
    if (body.output_format === "blog") {
      const half = Math.floor(mock.blogStream.length / 2);
      const frames = [mock.blogStream.slice(0, half), mock.blogStream.slice(half)]
        .map((text) => `event: content_block_delta\ndata: ${JSON.stringify({ text })}\n\n`)
        .join("");
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        body: `${frames}event: done\ndata: ${JSON.stringify({ usage: USAGE, web_search_used: false })}\n\n`,
      });
    }
    return json(route, { content: social(body.platform), usage: { ...USAGE, model: "claude-haiku-4-5-20251001" }, web_search_used: false });
  });

  await page.route("**/functions/v1/youtube-transcript", (route) => {
    mock.ytCalls.push(JSON.parse(route.request().postData() ?? "{}"));
    return json(route, { transcript: TRANSCRIPT });
  });

  return mock;
}

async function openStudio(page: Page) {
  await page.goto("/admin");
  await page.locator('[data-qa="admin-nav-studio"]').click();
  await expect(page.locator('[data-qa="studio"]')).toBeVisible();
}

/** Select exactly these formats and platforms (the defaults are Social + TikTok). */
async function choose(page: Page, formats: string[], platforms: string[]) {
  for (const f of ["blog", "social"]) {
    const btn = page.locator(`[data-qa="studio-format-${f}"]`);
    const on = (await btn.getAttribute("aria-pressed")) === "true";
    if (on !== formats.includes(f)) {
      // Selecting before deselecting keeps "at least one format" satisfied.
      await btn.click();
    }
  }
  for (const f of ["blog", "social"]) {
    const btn = page.locator(`[data-qa="studio-format-${f}"]`);
    if ((await btn.getAttribute("aria-pressed")) === "true" && !formats.includes(f)) await btn.click();
  }
  if (!formats.includes("social")) return;
  for (const p of platforms) {
    const btn = page.locator(`[data-qa="studio-platform-${p}"]`);
    if ((await btn.getAttribute("aria-pressed")) !== "true") await btn.click();
  }
  for (const p of ["tiktok", "instagram", "pinterest", "youtube"]) {
    const btn = page.locator(`[data-qa="studio-platform-${p}"]`);
    if ((await btn.getAttribute("aria-pressed")) === "true" && !platforms.includes(p)) await btn.click();
  }
}

const inserts = (mock: Mock, table: string) =>
  mock.writes.filter((w) => w.method === "POST" && w.url.includes(`/rest/v1/${table}`)).map((w) => JSON.parse(w.body ?? "{}"));

test.describe("BLOG.2 publish helpers", () => {
  test("studioDraft: a DRAFT, the title from the H1, the body without it, the other language pending", () => {
    const res = studioDraft(ARTICLE, "es");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const d = res.draft;
    expect(d.status).toBe("draft");
    expect(d.slug).toBe("como-preparo-un-personaje-antes-de-una-escena");
    expect(d.title).toEqual({
      es: "Cómo preparo un personaje antes de una escena",
      en: "Cómo preparo un personaje antes de una escena",
      src: "es",
      pending: true,
    });
    expect(d.body.es.startsWith("*Lo que hago")).toBe(true);
    expect(d.body.es).not.toContain("# Cómo preparo");
    expect(d.body.es).not.toContain("```meta");
    expect(d.excerpt?.es).toBe("Lo que hago antes de que alguien diga acción.");
    expect(d.meta_description?.es).toContain("Cómo preparo un personaje");
    expect(studioDraft(ARTICLE, "en").ok && (studioDraft(ARTICLE, "en") as { draft: { body: { src: string } } }).draft.body.src).toBe("en");
    expect(studioDraft("   \n\n", "es").ok).toBe(false);
  });

  test("uniqueSlug and firstParagraph", () => {
    expect(uniqueSlug("a-b", [])).toBe("a-b");
    expect(uniqueSlug("a-b", ["a-b", "a-b-2"])).toBe("a-b-3");
    expect(firstParagraph("## H\n\n- list\n\n> quote\n\nThe **first** [real](x) one.\n\nSecond.")).toBe("The first real one.");
  });
});

test.describe("BLOG.2 Content Studio", () => {
  test("S1 brain dump → Generate blog + TikTok + Instagram → three tabs with the outputs", async ({ page }) => {
    const mock = await setup(page);
    await openStudio(page);
    await page.locator('[data-qa="studio-brain-dump"]').fill("Quiero contar cómo preparo un personaje.");
    await choose(page, ["blog", "social"], ["tiktok", "instagram"]);
    await page.locator('[data-qa="studio-generate"]').click();

    await expect(page.locator('[data-qa="studio-usage"]')).toBeVisible();
    await expect(page.locator('[data-qa^="studio-tab-"]')).toHaveCount(3);
    await expect(page.locator('[data-qa="studio-tab-blog"]')).toHaveText("Artículo");
    await expect(page.locator('[data-qa="studio-tab-tiktok"]')).toHaveText("TikTok");
    await expect(page.locator('[data-qa="studio-tab-instagram"]')).toHaveText("Instagram");

    const preview = page.locator('[data-qa="studio-blog-preview"]');
    await expect(preview.locator("h1")).toHaveText("Cómo preparo un personaje antes de una escena");
    await expect(page.locator('[data-qa="studio-blog-meta"]')).toContainText("preparar un personaje");
    await expect(preview).not.toContainText("Primary Keyword");

    await page.locator('[data-qa="studio-tab-tiktok"]').click();
    await expect(page.locator('[data-qa="studio-social"]')).toContainText("Hook de tiktok");
    await page.locator('[data-qa="studio-tab-instagram"]').click();
    await expect(page.locator('[data-qa="studio-social"]')).toContainText("Caption de instagram");
    await expect(page.locator('[data-qa="studio-social"]')).not.toContainText("**");

    // The cascade: the blog first-hand, each platform distilled from it, all in Spanish.
    // STUDIO.SPEED.2: the switch is off, so the blog says web_search:false explicitly
    // (the function treats a missing field as true); derivatives say nothing.
    expect(mock.genCalls).toHaveLength(3);
    expect(mock.genCalls[0]).toMatchObject({ output_format: "blog", input_kind: "brain_dump", language: "es", web_search: false });
    for (const call of mock.genCalls.slice(1)) {
      expect(call).toMatchObject({ output_format: "social", language: "es", cascade_source: ARTICLE });
      expect(call).not.toHaveProperty("web_search");
    }

    // One history row for the press.
    const [row] = inserts(mock, "studio_generations");
    expect(row).toMatchObject({ input_kind: "brain_dump", language: "es", formats: ["blog", "social"], platforms: ["tiktok", "instagram"] });
    expect(row.outputs.blog).toBe(ARTICLE);
    expect(Object.keys(row.outputs.social).sort()).toEqual(["instagram", "tiktok"]);
  });

  test.describe("STUDIO.SPEED.2 web-research switch", () => {
    const sw = (page: Page) => page.locator('[data-qa="studio-web-search"]');

    test("W1 default press, Artículo + TikTok: web_search:false on the blog, cascade_source and no web_search on TikTok", async ({ page }) => {
      const mock = await setup(page);
      await openStudio(page);
      await expect(sw(page)).toHaveAttribute("role", "switch");
      await expect(sw(page)).toHaveAttribute("aria-checked", "false");
      await expect(sw(page)).toContainText("Investigar en la web");
      await expect(sw(page)).toContainText("Más lento, con datos de hoy");
      await page.locator('[data-qa="studio-brain-dump"]').fill("Una noticia sobre mis primeros lives.");
      await choose(page, ["blog", "social"], ["tiktok"]);
      await page.locator('[data-qa="studio-generate"]').click();
      await expect(page.locator('[data-qa="studio-usage"]')).toBeVisible();

      expect(mock.genCalls).toHaveLength(2);
      expect(mock.genCalls[0]).toMatchObject({ output_format: "blog", web_search: false });
      expect(mock.genCalls[1]).toMatchObject({ output_format: "social", platform: "tiktok", cascade_source: ARTICLE });
      expect(mock.genCalls[1]).not.toHaveProperty("web_search");
    });

    test("W2 switch on: web_search:true on the blog call; social-only press: web_search:true on each platform call", async ({ page }) => {
      const mock = await setup(page);
      await openStudio(page);
      await sw(page).click();
      await expect(sw(page)).toHaveAttribute("aria-checked", "true");
      await page.locator('[data-qa="studio-brain-dump"]').fill("Una noticia sobre mis primeros lives.");
      await choose(page, ["blog"], []);
      await page.locator('[data-qa="studio-generate"]').click();
      await expect(page.locator('[data-qa="studio-usage"]')).toBeVisible();
      expect(mock.genCalls).toEqual([expect.objectContaining({ output_format: "blog", web_search: true })]);
      // The switch is disabled only while generating; it keeps its state after the press.
      await expect(sw(page)).toBeEnabled();
      await expect(sw(page)).toHaveAttribute("aria-checked", "true");

      mock.genCalls.length = 0;
      await choose(page, ["social"], ["tiktok", "instagram", "pinterest", "youtube"]);
      await page.locator('[data-qa="studio-generate"]').click();
      await expect(page.locator('[data-qa^="studio-tab-"]')).toHaveCount(4);
      expect(mock.genCalls).toHaveLength(4);
      for (const call of mock.genCalls) {
        expect(call).toMatchObject({ output_format: "social", web_search: true });
        expect(call).not.toHaveProperty("cascade_source");
      }
      expect(mock.genCalls.map((c) => c.platform).sort()).toEqual(["instagram", "pinterest", "tiktok", "youtube"]);
    });

    test("W3 after a reload the switch is off", async ({ page }) => {
      await setup(page);
      await openStudio(page);
      await sw(page).click();
      await expect(sw(page)).toHaveAttribute("aria-checked", "true");
      await page.reload();
      await page.locator('[data-qa="admin-nav-studio"]').click();
      await expect(sw(page)).toHaveAttribute("aria-checked", "false");
      // Nothing is remembered anywhere.
      const stored = await page.evaluate(() =>
        Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter((k) => /search|research/i.test(k)),
      );
      expect(stored).toEqual([]);
    });

    test("W4 the switch is disabled while generating, and in English reads 'Research on the web'", async ({ page }) => {
      await setup(page, { lang: "en" });
      await openStudio(page);
      await expect(sw(page)).toContainText("Research on the web");
      await expect(sw(page)).toContainText("Slower, with today's facts");
      // Hold the blog stream open so the generating state can be observed.
      let release: (() => void) | null = null;
      await page.route("**/functions/v1/generate-content", async (route) => {
        await new Promise<void>((r) => (release = r));
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
          body: `event: content_block_delta\ndata: ${JSON.stringify({ text: ARTICLE })}\n\nevent: done\ndata: ${JSON.stringify({ usage: USAGE, web_search_used: false })}\n\n`,
        });
      });
      await page.locator('[data-qa="studio-brain-dump"]').fill("A note about my first lives.");
      await choose(page, ["blog"], []);
      await page.locator('[data-qa="studio-generate"]').click();
      await expect(sw(page)).toBeDisabled();
      await expect.poll(() => release !== null).toBe(true);
      release!();
      await expect(page.locator('[data-qa="studio-usage"]')).toBeVisible();
      await expect(sw(page)).toBeEnabled();
    });

    test("screenshots: the switch off and on, light and dark, 1440×900", async ({ page }) => {
      await setup(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(() => localStorage.removeItem("admin.theme"));
      await openStudio(page);
      await page.locator('[data-qa="studio-brain-dump"]').fill("Les tengo una noticia: muy pronto empiezo a transmitir en vivo.");
      const output = page.locator('[data-qa="studio-output"]');
      for (const theme of ["light", "dark"] as const) {
        if (theme === "dark") await page.locator('[data-qa="admin-theme-toggle"]').click();
        await expect(page.locator('[data-qa="studio"]')).toHaveAttribute("data-theme", theme);
        for (const state of ["off", "on"] as const) {
          const want = state === "on";
          if (((await sw(page).getAttribute("aria-checked")) === "true") !== want) await sw(page).click();
          await expect(sw(page)).toHaveAttribute("aria-checked", String(want));
          await page.mouse.move(0, 0);
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${SPEED_SHOTS}/switch-${state}-${theme}-1440x900.png`, fullPage: true });
          await output.screenshot({ path: `${SPEED_SHOTS}/switch-${state}-${theme}-output.png` });
        }
      }
    });
  });

  test("S2 YouTube is 'Próximamente' while YOUTUBE_INPUT_ENABLED is false: no tab, no transcript call", async ({ page }) => {
    // BLOG.2b — the deployed youtube-transcript gets 403 from YouTube, so the
    // Studio offers only the Brain Dump. Flip the constant in src/lib/ventures.ts
    // only once the DEPLOYED function returns captions, and restore the
    // link → transcript → Generate path here in the same commit.
    expect(YOUTUBE_INPUT_ENABLED).toBe(false);
    const mock = await setup(page);
    await openStudio(page);
    const soon = page.locator('[data-qa="studio-input-youtube-soon"]');
    await expect(soon).toHaveText("YouTube · Próximamente");
    await expect(soon).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator('[data-qa="studio-input-youtube"]')).toHaveCount(0);
    await soon.click();
    await expect(page.locator('[data-qa="studio-yt-url"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="studio-brain-dump"]')).toBeVisible();

    await page.locator('[data-qa="studio-brain-dump"]').fill("Una idea para TikTok.");
    await page.locator('[data-qa="studio-generate"]').click();
    await expect(page.locator('[data-qa="studio-social"]')).toContainText("Hook de tiktok");
    expect(mock.ytCalls).toEqual([]);
    expect(mock.genCalls).toEqual([expect.objectContaining({ input_kind: "brain_dump", input_text: "Una idea para TikTok." })]);
  });

  test("S2 in English the note reads 'Coming soon'", async ({ page }) => {
    await setup(page, { lang: "en" });
    await openStudio(page);
    await expect(page.locator('[data-qa="studio-input-youtube-soon"]')).toHaveText("YouTube · Coming soon");
  });

  test("S3 narration glued in front of the article never reaches the preview", async ({ page }) => {
    const leaked = SCREENSHOT_NARRATION + ARTICLE.replace(/^```meta[\s\S]*?```\n\n/, "");
    await setup(page, { blogStream: leaked });
    await openStudio(page);
    await page.locator('[data-qa="studio-brain-dump"]').fill("Prompt caching.");
    await choose(page, ["blog"], []);
    await page.locator('[data-qa="studio-generate"]').click();
    const preview = page.locator('[data-qa="studio-blog-preview"]');
    await expect(preview.locator("h1")).toHaveText("Cómo preparo un personaje antes de una escena");
    await expect(page.locator('[data-qa="studio-usage"]')).toBeVisible();
    for (const phrase of ["I'll research", "I notice", "Hitting a rate limit", "Let me try"]) {
      await expect(preview).not.toContainText(phrase);
    }
  });

  test("S4 Publish → a blog_posts draft, the Blog tab open on it, the English side pending", async ({ page }) => {
    const mock = await setup(page);
    await openStudio(page);
    await page.locator('[data-qa="studio-brain-dump"]').fill("Quiero contar cómo preparo un personaje.");
    await choose(page, ["blog"], []);
    await page.locator('[data-qa="studio-generate"]').click();
    await expect(page.locator('[data-qa="studio-usage"]')).toBeVisible();
    await page.locator('[data-qa="studio-publish"]').click();

    // Lands on Blog with the draft open.
    await expect(page.locator('[data-qa="admin-nav-blog"]')).toHaveAttribute("aria-current", "page");
    const title = page.locator('[data-qa="blog-field-title"]');
    await expect(title.locator("input, textarea").first()).toHaveValue("Cómo preparo un personaje antes de una escena");
    await expect(title).toContainText("se traduce al guardar");
    await expect(page.locator('[data-qa="blog-status"]')).toHaveAttribute("aria-checked", "false");
    await expect(page.locator('[data-qa="blog-save"]')).toBeEnabled();

    const [post] = inserts(mock, "blog_posts");
    expect(post.status).toBe("draft");
    expect(post.slug).toBe("como-preparo-un-personaje-antes-de-una-escena");
    expect(post.title).toMatchObject({ src: "es", pending: true });
    expect(post.body.es).not.toContain("# Cómo preparo");
    expect(post).not.toHaveProperty("published_at");
    const link = mock.writes.find((w) => w.method === "PATCH" && w.url.includes("studio_generations"));
    expect(JSON.parse(link?.body ?? "{}")).toEqual({ blog_post_id: "post-1" });
  });

  test("S5 History lists a generation and Reopen puts its outputs back", async ({ page }) => {
    await setup(page, {
      generations: [
        {
          id: "old-1",
          created_at: "2026-09-20T15:00:00Z",
          input_kind: "brain_dump",
          input_text: "Una idea vieja sobre bailar salsa",
          source_url: null,
          language: "es",
          formats: ["blog", "social"],
          platforms: ["pinterest"],
          outputs: { blog: ARTICLE, social: { pinterest: social("pinterest") } },
          usage: null,
          blog_post_id: null,
        },
      ],
    });
    await openStudio(page);
    const item = page.locator('[data-qa="studio-history-item"]');
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("Una idea vieja sobre bailar salsa");
    await expect(page.locator('[data-qa="studio-generated"]')).toHaveCount(0);
    await item.locator("button").first().click();
    await expect(item).toHaveAttribute("data-open", "true");
    await page.locator('[data-qa="studio-history-reopen"]').click();
    await expect(page.locator('[data-qa^="studio-tab-"]')).toHaveCount(2);
    await expect(page.locator('[data-qa="studio-blog-preview"] h1')).toHaveText("Cómo preparo un personaje antes de una escena");
    await page.locator('[data-qa="studio-tab-pinterest"]').click();
    await expect(page.locator('[data-qa="studio-social"]')).toContainText("Hook de pinterest");
  });

  test.describe("STUDIO.HISTORY.1 Borrar", () => {
    const row = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      created_at: "2026-09-20T15:00:00Z",
      input_kind: "brain_dump",
      input_text: `Idea ${id} sobre bailar salsa`,
      source_url: null,
      language: "es",
      formats: ["blog", "social"],
      platforms: ["pinterest"],
      outputs: { blog: ARTICLE, social: { pinterest: social("pinterest") } },
      usage: null,
      blog_post_id: null,
      ...extra,
    });
    const items = (page: Page) => page.locator('[data-qa="studio-history-item"]');
    const deletes = (mock: Mock) => mock.writes.filter((w) => w.method === "DELETE");

    test("H1 expand → Borrar → No leaves the row; collapsing cancels the confirm", async ({ page }) => {
      const mock = await setup(page, { generations: [row("old-1")] });
      await openStudio(page);
      const item = items(page).first();
      await item.locator("button").first().click();
      await expect(item).toHaveAttribute("data-open", "true");
      await expect(page.locator('[data-qa="studio-history-reopen"]')).toBeVisible();

      const del = page.locator('[data-qa="studio-history-delete"]');
      await expect(del).toHaveText("Borrar");
      await del.click();
      const confirm = page.locator('[data-qa="studio-history-confirm"]');
      await expect(confirm).toContainText("¿Borrar esta generación?");
      await expect(confirm).not.toContainText("El borrador en Blog no se borra.");
      await expect(page.locator('[data-qa="studio-history-delete-yes"]')).toHaveText("Sí, borrar");
      // The actions row is replaced, not stacked.
      await expect(page.locator('[data-qa="studio-history-reopen"]')).toHaveCount(0);
      await expect(del).toHaveCount(0);

      await page.locator('[data-qa="studio-history-delete-no"]').click();
      await expect(confirm).toHaveCount(0);
      await expect(page.locator('[data-qa="studio-history-reopen"]')).toBeVisible();
      await expect(items(page)).toHaveCount(1);

      // Collapsing cancels a pending confirm.
      await del.click();
      await expect(confirm).toBeVisible();
      await item.locator("button").first().click();
      await expect(item).toHaveAttribute("data-open", "false");
      await item.locator("button").first().click();
      await expect(confirm).toHaveCount(0);
      await expect(page.locator('[data-qa="studio-history-reopen"]')).toBeVisible();

      expect(deletes(mock)).toEqual([]);
      expect(mock.generations).toHaveLength(1);
    });

    test("H2 Borrar → Sí sends one DELETE with id=eq.<row id>; the row leaves the list; blog_posts is never touched", async ({ page }) => {
      const mock = await setup(page, { generations: [row("old-2", { blog_post_id: "post-9" }), row("old-1")] });
      await openStudio(page);
      await expect(items(page)).toHaveCount(2);
      const item = items(page).first();
      await expect(item).toContainText("Idea old-2");
      await item.locator("button").first().click();
      await expect(item).toContainText("Tiene borrador en Blog");
      await page.locator('[data-qa="studio-history-delete"]').click();
      const confirm = page.locator('[data-qa="studio-history-confirm"]');
      await expect(confirm).toContainText("¿Borrar esta generación?");
      await expect(confirm).toContainText("El borrador en Blog no se borra.");

      const before = mock.blogPostsRequests;
      await page.locator('[data-qa="studio-history-delete-yes"]').click();
      await expect(items(page)).toHaveCount(1);
      await expect(items(page).first()).toContainText("Idea old-1");
      await expect(page.locator('[data-qa="studio-history-delete-error"]')).toHaveCount(0);

      const sent = deletes(mock);
      expect(sent).toHaveLength(1);
      expect(sent[0].url).toContain("/rest/v1/studio_generations");
      expect(new URL(sent[0].url).searchParams.get("id")).toBe("eq.old-2");
      expect(mock.generations.map((g) => g.id)).toEqual(["old-1"]);
      expect(mock.blogPostsRequests).toBe(before);
      expect(mock.writes.filter((w) => w.url.includes("blog_posts"))).toEqual([]);
    });

    test("H3 reopen a row, then delete it → Contenido generado shows the empty state", async ({ page }) => {
      await setup(page, { generations: [row("old-1")] });
      await openStudio(page);
      const item = items(page).first();
      await item.locator("button").first().click();
      await page.locator('[data-qa="studio-history-reopen"]').click();
      await expect(page.locator('[data-qa^="studio-tab-"]')).toHaveCount(2);
      await expect(item).toHaveAttribute("data-current", "true");

      await page.locator('[data-qa="studio-history-delete"]').click();
      await page.locator('[data-qa="studio-history-delete-yes"]').click();
      await expect(items(page)).toHaveCount(0);
      await expect(page.locator('[data-qa="studio-generated"]')).toHaveCount(0);
      await expect(page.locator('[data-qa^="studio-tab-"]')).toHaveCount(0);
      await expect(page.locator('[data-qa="studio"] .st-empty').first()).toHaveText("Aún no hay contenido. Genera tu primera pieza arriba.");
      await expect(page.locator('[data-qa="studio-history"]')).toHaveCount(0);
    });

    test("H4 the select returns no row (RLS refusal) → 'No se pudo borrar' and the row stays", async ({ page }) => {
      const mock = await setup(page, { generations: [row("old-1")] });
      mock.deleteReturnsRow = false;
      await openStudio(page);
      const item = items(page).first();
      await item.locator("button").first().click();
      await page.locator('[data-qa="studio-history-delete"]').click();
      await page.locator('[data-qa="studio-history-delete-yes"]').click();
      await expect(page.locator('[data-qa="studio-history-delete-error"]')).toHaveText("No se pudo borrar");
      await expect(items(page)).toHaveCount(1);
      await expect(page.locator('[data-qa="studio-history-confirm"]')).toBeVisible();
      await expect(page.locator('[data-qa="studio-history-delete-yes"]')).toBeEnabled();
      expect(deletes(mock)).toHaveLength(1);
    });

    test("screenshot: the confirm state, light, 1440×900", async ({ page }) => {
      await setup(page, { generations: [row("old-2", { blog_post_id: "post-9" }), row("old-1")] });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(() => localStorage.removeItem("admin.theme"));
      await openStudio(page);
      await expect(page.locator('[data-qa="studio"]')).toHaveAttribute("data-theme", "light");
      const item = items(page).first();
      await item.locator("button").first().click();
      await page.locator('[data-qa="studio-history-delete"]').click();
      await expect(page.locator('[data-qa="studio-history-confirm"]')).toBeVisible();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      await item.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${HISTORY_SHOTS}/confirm-light-1440x900.png`, fullPage: true });
      await item.screenshot({ path: `${HISTORY_SHOTS}/confirm-light-item.png` });
    });
  });

  test("S6 the header's theme toggle flips the Studio's tokens and survives a reload", async ({ page }) => {
    await setup(page);
    await openStudio(page);
    const studio = page.locator('[data-qa="studio"]');
    const bg = () => studio.evaluate((el) => getComputedStyle(el).backgroundColor);
    const gold = () => studio.evaluate((el) => getComputedStyle(el).getPropertyValue("--st-gold").trim());
    await expect(studio).toHaveAttribute("data-theme", "light");
    expect(await bg()).toBe("rgb(250, 246, 240)");
    expect(await gold()).toBe("#b8860b");

    await page.locator('[data-qa="admin-theme-toggle"]').click();
    await expect(studio).toHaveAttribute("data-theme", "dark");
    expect(await bg()).toBe("rgb(11, 10, 8)");
    expect(await gold()).toBe("#c9a55c");
    expect(await page.evaluate(() => localStorage.getItem("admin.theme"))).toBe("dark");

    await page.reload();
    await page.locator('[data-qa="admin-nav-studio"]').click();
    await expect(page.locator('[data-qa="studio"]')).toHaveAttribute("data-theme", "dark");
  });

  test("S7 1024×768 two columns, 820×1180 stacked full width, 390×844 no sideways scroll", async ({ page }) => {
    await setup(page);
    const boxes = async () => {
      const input = await page.locator('[data-qa="studio-input"]').boundingBox();
      const output = await page.locator('[data-qa="studio-output"]').boundingBox();
      const cols = await page.locator('[data-qa="studio-columns"]').boundingBox();
      return { input: input!, output: output!, cols: cols! };
    };

    await page.setViewportSize({ width: 1024, height: 768 });
    await openStudio(page);
    let b = await boxes();
    expect(Math.abs(b.input.y - b.output.y)).toBeLessThan(2);
    expect(b.output.x).toBeGreaterThan(b.input.x + b.input.width);

    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForTimeout(100);
    b = await boxes();
    expect(b.output.y).toBeGreaterThanOrEqual(b.input.y + b.input.height);
    expect(Math.abs(b.input.width - b.cols.width)).toBeLessThan(2);
    expect(Math.abs(b.output.width - b.cols.width)).toBeLessThan(2);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("S8 the whole admin follows the theme, the Studio with it", async ({ page }) => {
    await setup(page);
    await page.goto("/admin");
    await page.locator('[data-qa="admin-nav-studio"]').click();
    const surfaces = () =>
      page.evaluate(() => {
        const shell = document.querySelector('[data-qa="admin-shell"]')!;
        const pick = (el: Element) => getComputedStyle(el).backgroundColor;
        return {
          page: pick(shell.parentElement!),
          studio: pick(document.querySelector('[data-qa="studio"]')!),
          studioTheme: document.querySelector('[data-qa="studio"]')!.getAttribute("data-theme"),
          adminTheme: shell.parentElement!.getAttribute("data-admin-theme"),
        };
      });
    expect(await surfaces()).toEqual({
      page: "rgb(250, 246, 240)",
      studio: "rgb(250, 246, 240)",
      studioTheme: "light",
      adminTheme: "light",
    });
    await page.locator('[data-qa="admin-theme-toggle"]').click();
    expect(await surfaces()).toEqual({
      page: "rgb(18, 18, 18)",
      studio: "rgb(11, 10, 8)",
      studioTheme: "dark",
      adminTheme: "dark",
    });
  });

  test("screenshots: light and dark at 1440×900 and 820×1180", async ({ page }) => {
    await setup(page);
    for (const [w, h] of [
      [1440, 900],
      [820, 1180],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.addInitScript(() => localStorage.removeItem("admin.theme"));
      await openStudio(page);
      await page.locator('[data-qa="studio-brain-dump"]').fill(
        "Esta semana grabé un en vivo desde Medellín y mi comunidad me pidió que contara cómo preparo un personaje antes de una escena.",
      );
      await choose(page, ["blog", "social"], ["tiktok", "instagram", "pinterest", "youtube"]);
      await page.locator('[data-qa="studio-generate"]').click();
      await expect(page.locator('[data-qa="studio-usage"]')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/studio-light-${w}x${h}.png`, fullPage: true });
      await page.locator('[data-qa="admin-theme-toggle"]').click();
      await page.screenshot({ path: `${SHOTS}/studio-dark-${w}x${h}.png`, fullPage: true });
    }
  });
});
