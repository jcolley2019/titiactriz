import { expect, test, type Page, type Route } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";
import { studioDraft, uniqueSlug, firstParagraph } from "../src/lib/studio/publish";

/**
 * BLOG.2 step 3 — the Content Studio, end to end, with generate-content and
 * youtube-transcript mocked (no model is ever called from this suite).
 *
 *   S1 brain dump → Generate (blog + TikTok + Instagram) → three tabs
 *   S2 YouTube link → transcript preview → Generate
 *   S3 narration leaked into the stream → the article shows without it
 *   S4 Publish → a blog_posts DRAFT, Blog tab open on it, other language pending
 *   S5 History lists a generation and reopens it
 *   S6 theme toggle flips the wrapper's tokens and survives a reload
 *   S7 1024×768 two columns · 820×1180 stacked · 390×844 no sideways scroll
 *   S8 the rest of the admin's background is untouched by the Studio's theme
 *
 * Screenshots (light and dark, 1440×900 and 820×1180) land in _qa/blog-2/.
 */

const SHOTS = "_qa/blog-2";

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
    return route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/rest/v1/blog_posts*", (route) => {
    const req = route.request();
    const method = req.method();
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
    expect(mock.genCalls).toHaveLength(3);
    expect(mock.genCalls[0]).toMatchObject({ output_format: "blog", input_kind: "brain_dump", language: "es" });
    for (const call of mock.genCalls.slice(1)) {
      expect(call).toMatchObject({ output_format: "social", language: "es", cascade_source: ARTICLE });
    }

    // One history row for the press.
    const [row] = inserts(mock, "studio_generations");
    expect(row).toMatchObject({ input_kind: "brain_dump", language: "es", formats: ["blog", "social"], platforms: ["tiktok", "instagram"] });
    expect(row.outputs.blog).toBe(ARTICLE);
    expect(Object.keys(row.outputs.social).sort()).toEqual(["instagram", "tiktok"]);
  });

  test("S2 YouTube link → transcript preview → Generate uses the transcript", async ({ page }) => {
    const mock = await setup(page);
    await openStudio(page);
    await page.locator('[data-qa="studio-input-youtube"]').click();
    await page.locator('[data-qa="studio-yt-url"]').fill("https://www.youtube.com/watch?v=abcdefghijk");
    await page.locator('[data-qa="studio-yt-fetch"]').click();
    await expect(page.locator('[data-qa="studio-transcript"]')).toHaveText(TRANSCRIPT);
    expect(mock.ytCalls).toEqual([{ url: "https://www.youtube.com/watch?v=abcdefghijk" }]);

    await page.locator('[data-qa="studio-generate"]').click();
    await expect(page.locator('[data-qa="studio-social"]')).toContainText("Hook de tiktok");
    expect(mock.genCalls).toEqual([
      expect.objectContaining({ input_kind: "youtube", input_text: TRANSCRIPT, output_format: "social", platform: "tiktok" }),
    ]);
    const [row] = inserts(mock, "studio_generations");
    expect(row).toMatchObject({ input_kind: "youtube", source_url: "https://www.youtube.com/watch?v=abcdefghijk", input_text: TRANSCRIPT });
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

  test("S6 the theme toggle flips the wrapper's tokens and survives a reload", async ({ page }) => {
    await setup(page);
    await openStudio(page);
    const studio = page.locator('[data-qa="studio"]');
    const bg = () => studio.evaluate((el) => getComputedStyle(el).backgroundColor);
    const gold = () => studio.evaluate((el) => getComputedStyle(el).getPropertyValue("--st-gold").trim());
    await expect(studio).toHaveAttribute("data-theme", "light");
    expect(await bg()).toBe("rgb(250, 246, 240)");
    expect(await gold()).toBe("#b8860b");

    await page.locator('[data-qa="studio-theme-toggle"]').click();
    await expect(studio).toHaveAttribute("data-theme", "dark");
    expect(await bg()).toBe("rgb(11, 10, 8)");
    expect(await gold()).toBe("#c9a55c");
    expect(await page.evaluate(() => localStorage.getItem("studio.theme"))).toBe("dark");

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

  test("S8 the rest of the admin keeps its own background with the Studio in light", async ({ page }) => {
    await setup(page);
    await page.goto("/admin");
    await page.locator('[data-qa="admin-nav-blog"]').click();
    const surfaces = () =>
      page.evaluate(() => {
        const shell = document.querySelector('[data-qa="admin-shell"]')!;
        const pick = (el: Element) => getComputedStyle(el).backgroundColor;
        return {
          body: pick(document.body),
          page: pick(shell.parentElement!),
          shell: pick(shell),
          nav: pick(document.querySelector('[data-qa="admin-nav"]')!),
          rootBackground: getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
        };
      });
    const before = await surfaces();
    await page.locator('[data-qa="admin-nav-studio"]').click();
    await expect(page.locator('[data-qa="studio"]')).toHaveAttribute("data-theme", "light");
    expect(await surfaces()).toEqual(before);
    await page.locator('[data-qa="studio-theme-toggle"]').click();
    expect(await surfaces()).toEqual(before);
  });

  test("screenshots: light and dark at 1440×900 and 820×1180", async ({ page }) => {
    await setup(page);
    for (const [w, h] of [
      [1440, 900],
      [820, 1180],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.addInitScript(() => localStorage.removeItem("studio.theme"));
      await openStudio(page);
      await page.locator('[data-qa="studio-brain-dump"]').fill(
        "Esta semana grabé un en vivo desde Medellín y mi comunidad me pidió que contara cómo preparo un personaje antes de una escena.",
      );
      await choose(page, ["blog", "social"], ["tiktok", "instagram", "pinterest", "youtube"]);
      await page.locator('[data-qa="studio-generate"]').click();
      await expect(page.locator('[data-qa="studio-usage"]')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/studio-light-${w}x${h}.png`, fullPage: true });
      await page.locator('[data-qa="studio-theme-toggle"]').click();
      await page.screenshot({ path: `${SHOTS}/studio-dark-${w}x${h}.png`, fullPage: true });
    }
  });
});
