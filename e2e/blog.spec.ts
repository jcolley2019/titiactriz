import { expect, test, type Page, type Route } from "@playwright/test";
import { forceLanguage, injectAdminSession, MOCK_PHOTOS, routeSupabase, type Write } from "./_admin";
import { extractFaq } from "../src/lib/blog/schema";

/**
 * BLOG.1 — Titi writes, translates and publishes blog posts from the admin, and
 * visitors read them at /blog and /blog/:slug.
 *
 *  P1  Admin list, no posts → the empty state, and "Write by hand" is offered.
 *  P2  A post typed in Spanish: the slug follows the title ("Mi primera
 *      entrada" → mi-primera-entrada), Save calls translate-text, and the row
 *      written carries both locales and status draft.
 *  P3  A body over 2000 characters is translated in chunks: one call per chunk,
 *      none over 1900 characters, rejoined with blank lines in the stored EN.
 *  P4  The Published switch writes on the spot and stamps published_at.
 *  P5  /blog lists only published posts, newest first.
 *  P6  /blog/:slug renders the title, the body's headings, the cover's alt, and
 *      the document's title, description, canonical and Article JSON-LD.
 *  P7  A draft's slug (and an unknown one) is NotFound.
 *  P8  English (forceLanguage) shows the EN side.
 *  P9  390×844: the list and a post have no horizontal overflow, and the
 *      editor's Save bar keeps its rules (pinned, greyed while clean, lit by
 *      typing).
 *
 * BLOG.SEO.1 — structured data beside the Article JSON-LD.
 *  S1  A post whose body has a 3-question FAQ: Article, FAQPage (3 Questions,
 *      answers in plain text) and BreadcrumbList (Inicio → Blog → the post),
 *      and the FAQPage has every field schema.org's FAQPage requires.
 *  S2  A body with no FAQ: Article and BreadcrumbList only.
 *  S3  English: the first crumb is "Home".
 *  S4  extractFaq, unit: headings in code fences, lone questions and
 *      question-less H3s do not make an FAQ.
 *
 * BLOG.LINK.1 — Copiar enlace.
 *  L1  The list: a published row has the button and a draft row does not; a
 *      click puts https://www.titiactriz.com/blog/<slug> on the clipboard,
 *      reads Copiado, and is back to Copiar enlace after 2 s. Nothing written.
 *  L2  The editor: the button sits right after Ver en el sitio while the post
 *      is published, copies the same address, and leaves with the switch.
 *  L3  No Clipboard API: the hidden input + execCommand fallback copies the
 *      same address and leaves no input behind (EN: Copy link → Copied).
 *
 * STUDIO.VOICES.1 — a category (Personal / Green World) on every article.
 *  B-tabs 1  the admin list filters by category, counts in parentheses, and remembers the tab
 *  B-tabs 2  a post with no category is Personal; an empty tab shows the empty state
 *  B-tabs 3  Escribir a mano starts in the open tab's category; Categoría round-trips on save
 *            (POST, then PATCH) and the list comes back on the tab the post now belongs to
 *  B-tabs 4  an existing post opens with its own category; Discard puts a changed one back
 *  B-tabs 5/6  English labels · 390×844 fit · screenshots (_qa/studio-voices/)
 *  F1-F4   /blog?c=greenworld shows only Green World posts; the chips filter with no reload and
 *          keep the address in step; an unknown ?c= is Todo; empty category, no posts, English
 *  F5/F6   hairline chips in the room's grammar; 390×844 fit
 *  F7      Article JSON-LD carries articleSection
 */

type Row = Record<string, unknown> & { id: string; slug: string; status: string };

const iso = (d: string) => new Date(d).toISOString();

/**
 * blog_posts, served and RE-served: a write lands in `rows`, and every later
 * read answers from it, so "saved" means the next read sees it. Registered
 * AFTER routeSupabase, so it runs first (routes are LIFO) and owns this table.
 */
async function routeBlog(page: Page, rows: Row[], writes: Write[]) {
  let seq = 0;
  await page.route("**/rest/v1/blog_posts*", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const reply = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (method === "GET") {
      let out = [...rows];
      for (const [key, raw] of url.searchParams) {
        if (["select", "order", "limit", "offset"].includes(key)) continue;
        const m = raw.match(/^(eq|neq)\.(.*)$/);
        if (!m) continue;
        const [, op, val] = m;
        out = out.filter((r) => (op === "eq" ? String(r[key]) === val : String(r[key]) !== val));
      }
      const order = url.searchParams.get("order");
      if (order) {
        const [col, dir] = order.split(".");
        out.sort((a, b) => {
          const av = String(a[col] ?? "");
          const bv = String(b[col] ?? "");
          return dir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
        });
      }
      const limit = Number(url.searchParams.get("limit") ?? "0");
      if (limit) out = out.slice(0, limit);
      if (single) return out.length ? reply(out[0]) : reply({ code: "PGRST116", message: "0 rows" }, 406);
      return reply(out);
    }

    const body = req.postData();
    writes.push({ method, url: req.url(), body });
    const data = body ? JSON.parse(body) : {};
    const now = new Date().toISOString();
    if (method === "POST") {
      const row: Row = {
        id: `post-${++seq}`,
        status: "draft",
        published_at: null,
        tags: [],
        excerpt: null,
        meta_description: null,
        cover_photo_id: null,
        created_at: now,
        updated_at: now,
        ...(Array.isArray(data) ? data[0] : data),
      };
      rows.push(row);
      return reply(single ? row : [row], 201);
    }
    if (method === "PATCH") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const row = rows.find((r) => r.id === id);
      if (!row) return reply({ message: "not found" }, 404);
      Object.assign(row, data, { updated_at: now });
      return reply(single ? row : [row]);
    }
    if (method === "DELETE") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fallback();
  });
}

const translateCalls = (writes: Write[]) =>
  writes
    .filter((w) => w.url.includes("/functions/v1/translate-text"))
    .map((w) => JSON.parse(w.body ?? "{}").text as string);

const blogWrites = (writes: Write[], method: string) =>
  writes.filter((w) => w.url.includes("/rest/v1/blog_posts") && w.method === method);

async function openBlogAdmin(
  page: Page,
  rows: Row[],
  writes: Write[],
  opts: { lang?: "es" | "en"; width?: number; height?: number } = {},
) {
  await injectAdminSession(page);
  await forceLanguage(page, opts.lang ?? "es");
  await routeSupabase(page, { writes, photos: MOCK_PHOTOS });
  await routeBlog(page, rows, writes);
  await page.setViewportSize({ width: opts.width ?? 1280, height: opts.height ?? 800 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.locator('[data-qa="admin-nav-blog"]').click();
  await expect(page.locator('[data-qa="blog-list"]')).toBeVisible();
}

test.describe("BLOG.1 admin", () => {
  test("P1 the list's empty state offers a new post", async ({ page }) => {
    const writes: Write[] = [];
    await openBlogAdmin(page, [], writes);
    await expect(page.locator('[data-qa="blog-empty"]')).toBeVisible();
    await expect(page.locator('[data-qa="blog-row"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="blog-new"]')).toBeEnabled();
    // The section sits between Events and the Studio (BLOG.2 put Studio between
    // Blog and Settings; ADMIN.GUIDE.1 put Guide between Studio and Settings).
    const ids = await page
      .locator('[data-qa="admin-nav"] button')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-qa")));
    const at = ids.indexOf("admin-nav-blog");
    expect(ids[at - 1]).toBe("admin-nav-events");
    expect(ids[at + 1]).toBe("admin-nav-studio");
    expect(ids[at + 2]).toBe("admin-nav-guide");
    expect(ids[at + 3]).toBe("admin-nav-settings");
  });

  test("P2 a Spanish post: auto slug, translated on save, written as a draft", async ({ page }) => {
    const writes: Write[] = [];
    const rows: Row[] = [];
    await openBlogAdmin(page, rows, writes);
    await page.locator('[data-qa="blog-new"]').click();

    const save = page.locator('[data-qa="blog-save"]');
    await expect(save).toBeDisabled(); // clean: greyed (ADMIN.SAVEBAR.1c)
    await expect(page.locator('[data-qa="blog-status"]')).toBeDisabled(); // unsaved post

    await page.locator('[data-qa="blog-title"]').fill("Mi primera entrada");
    await expect(page.locator('[data-qa="blog-slug"]')).toHaveValue("mi-primera-entrada");
    await page.locator('[data-qa="blog-excerpt"]').fill("Un resumen corto.");
    await page.locator('[data-qa="blog-body"]').fill("## Hola\n\nEste es el texto.");
    await page.locator('[data-qa="blog-tags"]').fill("teatro, Medellín, teatro");
    await expect(save).toBeEnabled();
    await expect(page.locator('[data-qa="blog-unsaved"]')).toBeVisible();

    await save.click();
    await expect(page.locator('[data-qa="flash-blog-save"]')).toHaveAttribute("data-state", "saved");

    expect(translateCalls(writes).sort()).toEqual(
      ["## Hola\n\nEste es el texto.", "Mi primera entrada", "Un resumen corto."].sort(),
    );
    const posts = blogWrites(writes, "POST");
    expect(posts).toHaveLength(1);
    const written = JSON.parse(posts[0].body ?? "{}");
    expect(written.slug).toBe("mi-primera-entrada");
    expect(written.title).toEqual({ es: "Mi primera entrada", en: "EN Mi primera entrada", src: "es" });
    expect(written.excerpt).toEqual({ es: "Un resumen corto.", en: "EN Un resumen corto.", src: "es" });
    expect(written.body).toEqual({
      es: "## Hola\n\nEste es el texto.",
      en: "EN ## Hola\n\nEste es el texto.",
      src: "es",
    });
    expect(written.meta_description).toBeNull();
    expect(written.tags).toEqual(["teatro", "Medellín"]);
    expect(written.status).toBeUndefined(); // the column default: draft
    expect(rows[0].status).toBe("draft");

    // Saved: the bar is clean again, the switch is live, the list has the row.
    await expect(save).toBeDisabled();
    await expect(page.locator('[data-qa="blog-status"]')).toBeEnabled();
    await page.locator('[data-qa="blog-back"]').click();
    await expect(page.locator('[data-qa="blog-row"]')).toHaveCount(1);
    await expect(page.locator('[data-qa="blog-row-title"]')).toHaveText("Mi primera entrada");
    await expect(page.locator('[data-qa="blog-status-pill"]')).toHaveAttribute("data-status", "draft");
  });

  test("P3 a long body is translated chunk by chunk and rejoined", async ({ page }) => {
    const writes: Write[] = [];
    const rows: Row[] = [];
    await openBlogAdmin(page, rows, writes);
    await page.locator('[data-qa="blog-new"]').click();

    const paragraphs = Array.from(
      { length: 12 },
      (_, i) => `## Parte ${i + 1}\n\n` + `Frase número ${i + 1} de la entrada larga. `.repeat(7).trim(),
    );
    const body = paragraphs.join("\n\n");
    expect(body.length).toBeGreaterThan(2000);

    await page.locator('[data-qa="blog-title"]').fill("Una entrada larga");
    await page.locator('[data-qa="blog-body"]').fill(body);
    await page.locator('[data-qa="blog-save"]').click();
    await expect(page.locator('[data-qa="flash-blog-save"]')).toHaveAttribute("data-state", "saved");

    const chunks = translateCalls(writes).filter((t) => t !== "Una entrada larga");
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1900);
    // The chunks are the body, split only on blank lines, in order.
    expect(chunks.join("\n\n")).toBe(body);

    const written = JSON.parse(blogWrites(writes, "POST")[0].body ?? "{}");
    expect(written.body.es).toBe(body);
    expect(written.body.en).toBe(chunks.map((c) => `EN ${c}`).join("\n\n"));
    expect(written.body.pending).toBeUndefined();
  });

  test("P4 the Published switch writes at once and stamps published_at", async ({ page }) => {
    const writes: Write[] = [];
    const rows: Row[] = [
      {
        id: "d1",
        slug: "borrador",
        status: "draft",
        published_at: null,
        title: { es: "Borrador", en: "Draft", src: "es" },
        excerpt: null,
        body: { es: "Texto", en: "Text", src: "es" },
        meta_description: null,
        tags: [],
        cover_photo_id: null,
        created_at: iso("2026-09-01"),
        updated_at: iso("2026-09-01"),
      },
    ];
    await openBlogAdmin(page, rows, writes);
    await page.locator('[data-qa="blog-row-edit"]').click();
    await expect(page.locator('[data-qa="blog-save"]')).toBeDisabled();

    const before = Date.now();
    await page.locator('[data-qa="blog-status"]').click();
    await expect(page.locator('[data-qa="flash-blog-status"]')).toHaveAttribute("data-state", "saved");
    const patch = JSON.parse(blogWrites(writes, "PATCH")[0].body ?? "{}");
    expect(patch.status).toBe("published");
    const stamped = Date.parse(patch.published_at);
    expect(stamped).toBeGreaterThanOrEqual(before - 1000);
    expect(rows[0].status).toBe("published");
    await expect(page.locator('[data-qa="blog-published-at"]')).toBeVisible();
    // No Save was needed, and none is lit.
    await expect(page.locator('[data-qa="blog-save"]')).toBeDisabled();

    // Back to draft and published again: the first date stands.
    await page.locator('[data-qa="blog-status"]').click();
    await expect(page.locator('[data-qa="blog-status"]')).toHaveAttribute("data-state", "unchecked");
    await page.locator('[data-qa="blog-status"]').click();
    await expect(page.locator('[data-qa="blog-status"]')).toHaveAttribute("data-state", "checked");
    const patches = blogWrites(writes, "PATCH").map((w) => JSON.parse(w.body ?? "{}"));
    expect(patches[1]).toEqual({ status: "draft" });
    expect(patches[2].published_at).toBe(patch.published_at);
  });
});

/* ---------------- Public pages ---------------- */

// A real cover is a public gallery URL (https), which is what og:image and the
// JSON-LD must carry verbatim; routeSupabase answers storage offline.
const COVER_SET = {
  id: "c1",
  image_url: "https://nsmstwkjbjicpdclgecq.supabase.co/storage/v1/object/public/gallery/set.jpg",
  alt_text: "Titi en un set de rodaje",
};
const COVER_CITY = { id: "c2", image_url: MOCK_PHOTOS[0].image_url, alt_text: "Titi bailando" };

const BODY_ES =
  "Hay días en que el set empieza antes del amanecer.\n\n## Lo que aprendí\n\nLa cámara no perdona la prisa.\n\n### Detalle\n\n- Escuchar\n- Respirar";
const BODY_EN =
  "Some days the set starts before dawn.\n\n## What I learned\n\nThe camera does not forgive hurry.\n\n### Detail\n\n- Listen\n- Breathe";

/**
 * Served OUT of order on purpose: newest-first has to come from the page's own
 * `order=published_at.desc`, and published-only from its own `status` filter —
 * the mock answers exactly what it is asked.
 */
const publicRows = (): Row[] => [
  {
    id: "b2",
    slug: "bailar-en-medellin",
    status: "published",
    published_at: iso("2026-09-12T15:00:00Z"),
    created_at: iso("2026-09-10T15:00:00Z"),
    updated_at: iso("2026-09-12T15:00:00Z"),
    title: { es: "Bailar en Medellín", en: "Dancing in Medellín", src: "es" },
    // No English excerpt: an English reader falls back to the Spanish one.
    excerpt: { es: "Lo que la ciudad me enseña.", en: "", src: "es" },
    body: { es: "La ciudad baila.", en: "The city dances.", src: "es" },
    meta_description: {
      es: "Descripción propia de la entrada sobre bailar en Medellín.",
      en: "The post's own description about dancing in Medellín.",
      src: "es",
    },
    tags: ["baile"],
    cover_photo_id: "c2",
    cover: COVER_CITY,
  },
  {
    id: "b3",
    slug: "borrador-secreto",
    status: "draft",
    published_at: null,
    created_at: iso("2026-09-22T15:00:00Z"),
    updated_at: iso("2026-09-22T15:00:00Z"),
    title: { es: "Borrador secreto", en: "Secret draft", src: "es" },
    excerpt: null,
    body: { es: "Todavía no.", en: "Not yet.", src: "es" },
    meta_description: null,
    tags: [],
    cover_photo_id: null,
    cover: null,
  },
  {
    id: "b1",
    slug: "un-dia-en-el-set",
    status: "published",
    published_at: iso("2026-09-20T15:00:00Z"),
    created_at: iso("2026-09-19T15:00:00Z"),
    updated_at: iso("2026-09-21T10:00:00Z"),
    title: { es: "Un día en el set", en: "A day on set", src: "es" },
    excerpt: { es: "Café y guion subrayado.", en: "Coffee and an underlined script.", src: "es" },
    body: { es: BODY_ES, en: BODY_EN, src: "es" },
    meta_description: null,
    tags: ["actuación", "rodaje"],
    cover_photo_id: "c1",
    cover: COVER_SET,
  },
];

async function openPublic(
  page: Page,
  path: string,
  lang: "es" | "en" = "es",
  size = { width: 1280, height: 800 },
  rows: Row[] = publicRows(),
) {
  const writes: Write[] = [];
  await forceLanguage(page, lang);
  await routeSupabase(page, { writes });
  await routeBlog(page, rows, writes);
  await page.setViewportSize(size);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return writes;
}

/**
 * The helmet's tags (`data-rh`), as hero-copy.spec reads them: index.html keeps
 * its own static description for crawlers that run no JS, and it comes first.
 */
const head = (page: Page) =>
  page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"][data-rh="true"]')?.getAttribute("content") ?? null,
    canonical: document.querySelector('link[rel="canonical"][data-rh="true"]')?.getAttribute("href") ?? null,
    ogImage: document.querySelector('meta[property="og:image"][data-rh="true"]')?.getAttribute("content") ?? null,
    ogType: document.querySelector('meta[property="og:type"][data-rh="true"]')?.getAttribute("content") ?? null,
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
      try {
        return JSON.parse(s.textContent ?? "null");
      } catch {
        return null;
      }
    }),
  }));

const noHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe("BLOG.1 public", () => {
  test("P5 /blog lists only published posts, newest first", async ({ page }) => {
    await openPublic(page, "/blog");
    const cards = page.locator('[data-qa="blog-card"]');
    await expect(cards).toHaveCount(2);
    expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")))).toEqual([
      "un-dia-en-el-set",
      "bailar-en-medellin",
    ]);
    await expect(page.locator('[data-qa="blog-card-title"]').first()).toHaveText("Un día en el set");
    await expect(page.locator('[data-qa="blog-card-excerpt"]').first()).toHaveText("Café y guion subrayado.");
    await expect(page.locator('[data-qa="blog-card-cover"] img').first()).toHaveAttribute(
      "alt",
      "Titi en un set de rodaje",
    );
    await expect(page.locator('[data-qa="blog-card-tags"]').first()).toContainText("actuación");
    await expect(page.locator('[data-qa="blog-card-date"]').first()).toContainText("septiembre");
    await expect(page.getByText("Borrador secreto")).toHaveCount(0);

    await expect.poll(async () => (await head(page)).title).toBe("Blog | Cristyna Polentino");
    expect((await head(page)).canonical).toBe("https://www.titiactriz.com/blog");

    // The nav and the footer both lead here.
    await expect(page.locator('[data-qa="nav-blog"]')).toHaveAttribute("href", "/blog");
    await expect(page.locator("footer").getByRole("link", { name: "Blog", exact: true })).toHaveAttribute(
      "href",
      "/blog",
    );
  });

  test("P5b /blog with no published posts shows the empty state", async ({ page }) => {
    await openPublic(page, "/blog", "es", { width: 1280, height: 800 }, []);
    await expect(page.locator('[data-qa="blog-empty"]')).toHaveText("Pronto, las primeras entradas.");
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(0);
  });

  test("P6 /blog/:slug renders the post and its head tags", async ({ page }) => {
    await openPublic(page, "/blog/un-dia-en-el-set");
    await expect(page.locator('[data-qa="blog-post-title"]')).toHaveText("Un día en el set");
    const body = page.locator('[data-qa="blog-post-body"]');
    await expect(body.locator("h2")).toHaveText("Lo que aprendí");
    await expect(body.locator("h3")).toHaveText("Detalle");
    await expect(body.locator("li")).toHaveCount(2);
    await expect(page.locator('[data-qa="blog-post-cover"] img')).toHaveAttribute("alt", "Titi en un set de rodaje");
    await expect(page.locator('[data-qa="blog-post-meta"]')).toContainText("min de lectura");
    await expect(page.locator('[data-qa="blog-post-tags"]')).toContainText("rodaje");
    // One H1 on the page: the post's own title.
    await expect(page.locator("main h1")).toHaveCount(1);

    await expect.poll(async () => (await head(page)).title).toBe("Un día en el set | Cristyna Polentino");
    const h = await head(page);
    expect(h.description).toBe("Café y guion subrayado."); // no meta_description → the excerpt
    expect(h.canonical).toBe("https://www.titiactriz.com/blog/un-dia-en-el-set");
    expect(h.ogImage).toBe(COVER_SET.image_url);
    expect(h.ogType).toBe("article");
    const article = h.ld.find((l) => l?.["@type"] === "Article");
    expect(article).toMatchObject({
      headline: "Un día en el set",
      datePublished: iso("2026-09-20T15:00:00Z"),
      dateModified: iso("2026-09-21T10:00:00Z"),
      author: { "@type": "Person", name: "Cristyna Polentino" },
      image: [COVER_SET.image_url],
    });

    // A post with its own meta description uses it.
    await page.goto("/blog/bailar-en-medellin", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="blog-post-title"]')).toHaveText("Bailar en Medellín");
    await expect
      .poll(async () => (await head(page)).description)
      .toBe("Descripción propia de la entrada sobre bailar en Medellín.");
  });

  test("P7 a draft's slug and an unknown slug are NotFound", async ({ page }) => {
    for (const slug of ["borrador-secreto", "no-existe"]) {
      await openPublic(page, `/blog/${slug}`);
      await expect(page.getByText("404", { exact: true })).toBeVisible();
      await expect(page.locator('[data-qa="blog-post"]')).toHaveCount(0);
      await expect(page.getByText("Todavía no.")).toHaveCount(0);
    }
  });

  test("P8 English shows the English side, falling back where it is blank", async ({ page }) => {
    await openPublic(page, "/blog", "en");
    await expect(page.locator('[data-qa="blog-card-title"]')).toHaveText(["A day on set", "Dancing in Medellín"]);
    // b2 has no English excerpt: the Spanish one stands in.
    await expect(page.locator('[data-qa="blog-card-excerpt"]').nth(1)).toHaveText("Lo que la ciudad me enseña.");
    await expect(page.locator('[data-qa="blog-card-date"]').first()).toContainText("September");

    await page.goto("/blog/un-dia-en-el-set", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="blog-post-title"]')).toHaveText("A day on set");
    await expect(page.locator('[data-qa="blog-post-body"] h2')).toHaveText("What I learned");
    await expect(page.locator('[data-qa="blog-post-meta"]')).toContainText("min read");
    await expect.poll(async () => (await head(page)).title).toBe("A day on set | Cristyna Polentino");
  });

  test("P9 390×844: /blog and a post have no horizontal overflow", async ({ page }) => {
    const phone = { width: 390, height: 844 };
    await openPublic(page, "/blog", "es", phone);
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(2);
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.goto("/blog/un-dia-en-el-set", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="blog-post-body"] h2')).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});

test("P9b 390×844: the editor fits, and its Save bar is pinned, greyed while clean, lit by typing", async ({
  page,
}) => {
  const writes: Write[] = [];
  await openBlogAdmin(page, [], writes, { width: 390, height: 844 });
  await page.locator('[data-qa="blog-new"]').click();
  await expect(page.locator('[data-qa="blog-editor"]')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);

  const bar = page.locator('[data-qa="blog-save-bar"]');
  const save = page.locator('[data-qa="blog-save"]');
  await expect(save).toBeDisabled();
  // Pinned: from the TOP of a long editor, the bar sits on the viewport's floor.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(async () => {
      const box = await bar.boundingBox();
      return box ? Math.round(box.y + box.height) : -1;
    })
    .toBeGreaterThanOrEqual(842);
  const barBox = await bar.boundingBox();
  expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(846);
  // Opaque: a solid ground, never see-through.
  const alpha = await bar.evaluate((el) => {
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
    const parts = m ? m[1].split(",").map((p) => p.trim()) : [];
    return parts.length === 4 ? Number(parts[3]) : 1;
  });
  expect(alpha).toBe(1);

  await page.locator('[data-qa="blog-title"]').fill("Una entrada");
  await expect(save).toBeEnabled();
  await expect(bar).toHaveAttribute("data-dirty", "true");
  await expect(page.locator('[data-qa="blog-unsaved"]')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  // The bar wraps rather than clipping the warning off its left edge.
  const warn = await page.locator('[data-qa="blog-unsaved"]').boundingBox();
  expect(warn!.x).toBeGreaterThanOrEqual(0);

  await page.locator('[data-qa="blog-discard"]').click();
  await expect(save).toBeDisabled();
  await expect(bar).toHaveAttribute("data-dirty", "false");
});

/* ---------------- BLOG.SEO.1 — structured data ---------------- */

const FAQ_ES = [
  "Un día de rodaje empieza temprano.",
  "",
  "## Lo que aprendí",
  "",
  "La cámara no perdona la prisa.",
  "",
  "## Preguntas frecuentes",
  "",
  "Lo que más me preguntan.",
  "",
  "### ¿Cuánto dura un día de rodaje?",
  "",
  "Entre **diez y doce horas**, casi siempre desde _antes_ del amanecer.",
  "",
  "### ¿Qué llevas al set?",
  "",
  "- Agua",
  "- El [guion](https://www.titiactriz.com/blog) subrayado",
  "",
  "### Cómo te preparas para una escena difícil?",
  "",
  "Respiro, repaso el texto y `escucho` a mis compañeros.",
  "> Nunca con prisa.",
  "",
  "## Hasta pronto",
  "",
  "Gracias por leer.",
].join("\n");

const FAQ_EN = [
  "A shoot day starts early.",
  "",
  "## FAQ",
  "",
  "### How long is a shoot day?",
  "",
  "Ten to twelve hours.",
  "",
  "### What do you bring to set?",
  "",
  "Water and the script.",
].join("\n");

const faqRow = (): Row => ({
  id: "b4",
  slug: "preguntas-de-rodaje",
  status: "published",
  published_at: iso("2026-09-24T15:00:00Z"),
  created_at: iso("2026-09-23T15:00:00Z"),
  updated_at: iso("2026-09-24T15:00:00Z"),
  title: { es: "Preguntas de rodaje", en: "Shoot questions", src: "es" },
  excerpt: { es: "Lo que más me preguntan.", en: "What people ask me most.", src: "es" },
  body: { es: FAQ_ES, en: FAQ_EN, src: "es" },
  meta_description: null,
  tags: [],
  cover_photo_id: null,
  cover: null,
});

/**
 * The post's own JSON-LD: the helmet's scripts (`data-rh`). index.html's static
 * Person block, the crawler fallback, is on every page and is not the post's.
 */
const postLd = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"][data-rh="true"]')].map((s) =>
      JSON.parse(s.textContent ?? "null"),
    ),
  );

type Ld = Record<string, unknown>;

/** What schema.org (and Google's FAQ rich result) requires of an FAQPage, checked by shape. */
function faqPageProblems(ld: Ld): string[] {
  const problems: string[] = [];
  if (ld["@context"] !== "https://schema.org") problems.push("@context");
  if (ld["@type"] !== "FAQPage") problems.push("@type");
  const main = ld.mainEntity;
  if (!Array.isArray(main) || main.length === 0) return [...problems, "mainEntity"];
  main.forEach((q: Ld, i) => {
    if (q?.["@type"] !== "Question") problems.push(`mainEntity[${i}].@type`);
    if (typeof q?.name !== "string" || !q.name.trim()) problems.push(`mainEntity[${i}].name`);
    const a = q?.acceptedAnswer as Ld | undefined;
    if (a?.["@type"] !== "Answer") problems.push(`mainEntity[${i}].acceptedAnswer.@type`);
    if (typeof a?.text !== "string" || !a.text.trim()) problems.push(`mainEntity[${i}].acceptedAnswer.text`);
  });
  return problems;
}

const crumbs = (ld: Ld) =>
  (ld.itemListElement as Ld[]).map((c) => ({ type: c["@type"], position: c.position, name: c.name, item: c.item }));

test.describe("BLOG.SEO.1 structured data", () => {
  test("S1 a post with an FAQ carries Article, FAQPage and BreadcrumbList", async ({ page }) => {
    await openPublic(page, "/blog/preguntas-de-rodaje", "es", undefined, [...publicRows(), faqRow()]);
    await expect(page.locator('[data-qa="blog-post-title"]')).toHaveText("Preguntas de rodaje");
    await expect.poll(async () => (await postLd(page)).length).toBe(3);
    const ld: Ld[] = await postLd(page);
    expect(ld.map((l) => l["@type"])).toEqual(["Article", "FAQPage", "BreadcrumbList"]);

    const faq = ld[1];
    expect(faqPageProblems(faq)).toEqual([]);
    const questions = faq.mainEntity as Ld[];
    expect(questions).toHaveLength(3);
    expect(questions.map((q) => q.name)).toEqual([
      "¿Cuánto dura un día de rodaje?",
      "¿Qué llevas al set?",
      "Cómo te preparas para una escena difícil?",
    ]);
    const answers = questions.map((q) => (q.acceptedAnswer as Ld).text as string);
    expect(answers).toEqual([
      "Entre diez y doce horas, casi siempre desde antes del amanecer.",
      "Agua\nEl guion subrayado",
      "Respiro, repaso el texto y escucho a mis compañeros. Nunca con prisa.",
    ]);
    // No markdown survives: emphasis, code, headings, quotes, links, list markers.
    for (const a of answers) expect(a).not.toMatch(/[*_`#>[\]]|\]\(|^\s*(?:[-+]|\d+[.)])\s/m);

    expect(ld[2]["@context"]).toBe("https://schema.org");
    expect(crumbs(ld[2])).toEqual([
      { type: "ListItem", position: 1, name: "Inicio", item: "https://www.titiactriz.com/" },
      { type: "ListItem", position: 2, name: "Blog", item: "https://www.titiactriz.com/blog" },
      {
        type: "ListItem",
        position: 3,
        name: "Preguntas de rodaje",
        item: "https://www.titiactriz.com/blog/preguntas-de-rodaje",
      },
    ]);
  });

  test("S2 a body with no FAQ carries Article and BreadcrumbList only", async ({ page }) => {
    await openPublic(page, "/blog/un-dia-en-el-set");
    await expect(page.locator('[data-qa="blog-post-title"]')).toHaveText("Un día en el set");
    await expect
      .poll(async () => (await postLd(page)).map((l: Ld) => l["@type"]))
      .toEqual(["Article", "BreadcrumbList"]);
  });

  test("S3 English: the breadcrumb starts at Home", async ({ page }) => {
    await openPublic(page, "/blog/preguntas-de-rodaje", "en", undefined, [...publicRows(), faqRow()]);
    await expect(page.locator('[data-qa="blog-post-title"]')).toHaveText("Shoot questions");
    await expect.poll(async () => (await postLd(page)).length).toBe(3);
    const ld: Ld[] = await postLd(page);
    const breadcrumb = ld.find((l) => l["@type"] === "BreadcrumbList")!;
    expect(crumbs(breadcrumb).map((c) => c.name)).toEqual(["Home", "Blog", "Shoot questions"]);
    const faq = ld.find((l) => l["@type"] === "FAQPage")!;
    expect((faq.mainEntity as Ld[]).map((q) => q.name)).toEqual(["How long is a shoot day?", "What do you bring to set?"]);
  });

  test("S4 extractFaq: fences, lone questions and question-less H3s are not an FAQ", () => {
    // No H2 section at all.
    expect(extractFaq("### ¿Uno?\n\nSí.\n\n### ¿Dos?\n\nNo.")).toEqual([]);
    // Question headings inside a code fence are code.
    expect(extractFaq("## FAQ\n\n```\n### ¿Uno?\nSí.\n### ¿Dos?\nNo.\n```")).toEqual([]);
    // One question is not an FAQ.
    expect(extractFaq("## FAQ\n\n### ¿Uno?\n\nSí.\n\n### Nota\n\nAlgo.")).toEqual([]);
    // An H3 with nothing under it breaks the pattern.
    expect(extractFaq("## FAQ\n\n### ¿Uno?\n\n### ¿Dos?\n\nNo.")).toEqual([]);
    // Two questions and a statement: the questions are the FAQ.
    expect(extractFaq("## FAQ\n\n### ¿Uno?\n\nSí.\n\n### Nota\n\nAlgo.\n\n### Dos?\n\nNo.")).toEqual([
      { question: "¿Uno?", answer: "Sí." },
      { question: "Dos?", answer: "No." },
    ]);
  });
});

/* ---------------- BLOG.LINK.1 — Copiar enlace ---------------- */

const POST_URL = "https://www.titiactriz.com/blog/un-dia-en-el-set";

const blogRow = (page: Page, slug: string) => page.locator(`[data-qa="blog-row"][data-slug="${slug}"]`);

const clipboardText = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test.describe("BLOG.LINK.1 Copiar enlace", () => {
  test("L1 a published row copies its www address and says Copiado; a draft row has no button", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const writes: Write[] = [];
    await openBlogAdmin(page, publicRows(), writes);
    await expect(page.locator('[data-qa="blog-row"]')).toHaveCount(3);

    await expect(blogRow(page, "borrador-secreto").locator('[data-qa="blog-copy-link"]')).toHaveCount(0);
    await expect(blogRow(page, "bailar-en-medellin").locator('[data-qa="blog-copy-link"]')).toHaveCount(1);
    const copy = blogRow(page, "un-dia-en-el-set").locator('[data-qa="blog-copy-link"]');
    await expect(copy).toHaveText("Copiar enlace");
    await expect(copy.locator("svg")).toHaveClass(/lucide-link2|lucide-link-2/);

    await copy.click();
    await expect(copy).toHaveText("Copiado");
    await expect(copy).toHaveAttribute("data-state", "copied");
    await expect(copy.locator("svg")).toHaveClass(/lucide-check/);
    expect(await clipboardText(page)).toBe(POST_URL);

    // Two seconds, then it is a Copy button again.
    await expect(copy).toHaveText("Copiar enlace", { timeout: 4_000 });
    await expect(copy).toHaveAttribute("data-state", "idle");
    expect(blogWrites(writes, "PATCH"), "copying writes nothing").toHaveLength(0);
  });

  test("L2 the editor: right after Ver en el sitio while published, gone with the switch", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const writes: Write[] = [];
    await openBlogAdmin(page, publicRows(), writes);

    // A draft's editor has neither link.
    await blogRow(page, "borrador-secreto").locator('[data-qa="blog-row-edit"]').click();
    await expect(page.locator('[data-qa="blog-editor"]')).toBeVisible();
    await expect(page.locator('[data-qa="blog-view"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="blog-copy-link"]')).toHaveCount(0);
    await page.locator('[data-qa="blog-back"]').click();

    await blogRow(page, "un-dia-en-el-set").locator('[data-qa="blog-row-edit"]').click();
    const status = page.locator('[data-qa="blog-field-status"]');
    await expect(status.locator('[data-qa="blog-view"] + [data-qa="blog-copy-link"]')).toHaveCount(1);
    const copy = status.locator('[data-qa="blog-copy-link"]');
    await copy.click();
    await expect(copy).toHaveText("Copiado");
    expect(await clipboardText(page)).toBe(POST_URL);

    // Back to draft: the address is no longer public, and neither link is offered.
    await page.locator('[data-qa="blog-status"]').click();
    await expect(page.locator('[data-qa="blog-status"]')).toHaveAttribute("data-state", "unchecked");
    await expect(page.locator('[data-qa="blog-view"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="blog-copy-link"]')).toHaveCount(0);
  });

  test("L3 without the Clipboard API, the hidden-input fallback copies the same address", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined, configurable: true });
      const w = window as unknown as { __copied: { value: string; selected: string }[] };
      w.__copied = [];
      const original = document.execCommand.bind(document);
      document.execCommand = (command: string, ...rest: [boolean?, string?]) => {
        if (command !== "copy") return original(command, ...rest);
        const el = document.activeElement as HTMLInputElement | null;
        const value = el?.value ?? "";
        w.__copied.push({ value, selected: value.slice(el?.selectionStart ?? 0, el?.selectionEnd ?? 0) });
        return true;
      };
    });
    const writes: Write[] = [];
    await openBlogAdmin(page, publicRows(), writes, { lang: "en" });
    expect(await page.evaluate(() => typeof navigator.clipboard)).toBe("undefined");

    const copy = blogRow(page, "un-dia-en-el-set").locator('[data-qa="blog-copy-link"]');
    await expect(copy).toHaveText("Copy link");
    await copy.click();
    await expect(copy).toHaveText("Copied");
    const copied = await page.evaluate(
      () => (window as unknown as { __copied: { value: string; selected: string }[] }).__copied,
    );
    expect(copied).toEqual([{ value: POST_URL, selected: POST_URL }]);
    // The helper input is gone, and focus came back to the button.
    await expect(page.locator("body > input[readonly]")).toHaveCount(0);
    await expect(copy).toBeFocused();
  });
});

/* ---------------- STUDIO.VOICES.1 — a category on every article ---------------- */

const VOICE_SHOTS = "_qa/studio-voices";

/** publicRows(), categorised: Bailar (published) is Green World; the other two are Personal. */
const catRows = (): Row[] =>
  publicRows().map((r) => ({ ...r, category: r.id === "b2" ? "greenworld" : "personal" }));

const tab = (page: Page, c: string) => page.locator(`[data-qa="blog-tab-${c}"]`);
const slugsOf = (page: Page, qa: string) =>
  page.locator(`[data-qa="${qa}"]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")));

test.describe("STUDIO.VOICES.1 Blog admin tabs", () => {
  test("B-tabs 1: the list filters by category, counts in parentheses, and remembers the tab", async ({ page }) => {
    const writes: Write[] = [];
    await openBlogAdmin(page, catRows(), writes);

    await expect(page.locator('[data-qa="blog-tab-personal"], [data-qa="blog-tab-greenworld"]')).toHaveCount(2);
    await expect(tab(page, "personal")).toHaveText("Personal (2)");
    await expect(tab(page, "greenworld")).toHaveText("Green World (1)");
    // Personal is the first visit's tab.
    await expect(tab(page, "personal")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "greenworld")).toHaveAttribute("aria-selected", "false");
    expect(await slugsOf(page, "blog-row")).toEqual(["borrador-secreto", "un-dia-en-el-set"]);
    // The row keeps its status chip and gains no category chip.
    await expect(blogRow(page, "un-dia-en-el-set").locator('[data-qa="blog-status-pill"]')).toHaveCount(1);
    await expect(blogRow(page, "un-dia-en-el-set")).not.toContainText("Green World");

    await tab(page, "greenworld").click();
    await expect(tab(page, "greenworld")).toHaveAttribute("aria-selected", "true");
    expect(await slugsOf(page, "blog-row")).toEqual(["bailar-en-medellin"]);
    expect(await page.evaluate(() => localStorage.getItem("admin.blog.tab"))).toBe("greenworld");

    // A reload comes back on the same tab.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('[data-qa="admin-nav-blog"]').click();
    await expect(page.locator('[data-qa="blog-list"]')).toBeVisible();
    await expect(tab(page, "greenworld")).toHaveAttribute("aria-selected", "true");
    expect(await slugsOf(page, "blog-row")).toEqual(["bailar-en-medellin"]);
    expect(blogWrites(writes, "POST").concat(blogWrites(writes, "PATCH"))).toHaveLength(0);
  });

  test("B-tabs 2: a post with no category is Personal; an empty tab says so", async ({ page }) => {
    const writes: Write[] = [];
    // publicRows() carries no category at all: the three of them are Personal.
    await openBlogAdmin(page, publicRows(), writes);
    await expect(tab(page, "personal")).toHaveText("Personal (3)");
    await expect(tab(page, "greenworld")).toHaveText("Green World (0)");
    await expect(page.locator('[data-qa="blog-row"]')).toHaveCount(3);
    await tab(page, "greenworld").click();
    await expect(page.locator('[data-qa="blog-row"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="blog-empty"]')).toBeVisible();
    await expect(page.locator('[data-qa="blog-new"]')).toBeEnabled();
  });

  test("B-tabs 3: Escribir a mano starts in the open tab's category, and Categoría round-trips on save", async ({ page }) => {
    const writes: Write[] = [];
    const rows: Row[] = [];
    await openBlogAdmin(page, rows, writes);
    await tab(page, "greenworld").click();
    await page.locator('[data-qa="blog-new"]').click();

    const gw = page.locator('[data-qa="blog-category-greenworld"]');
    const personal = page.locator('[data-qa="blog-category-personal"]');
    await expect(page.locator('[data-qa="blog-field-category"]')).toContainText("Categoría");
    await expect(gw).toHaveAttribute("aria-checked", "true");
    await expect(personal).toHaveAttribute("aria-checked", "false");
    await expect(personal).toHaveText("Personal");
    await expect(gw).toHaveText("Green World");
    // Beside Estado, on one row.
    const status = (await page.locator('[data-qa="blog-field-status"]').boundingBox())!;
    const category = (await page.locator('[data-qa="blog-field-category"]').boundingBox())!;
    expect(Math.abs(status.y - category.y)).toBeLessThan(4);
    expect(category.x).toBeGreaterThan(status.x + 100);

    await page.locator('[data-qa="blog-title"]').fill("Cómo pido mis productos");
    await page.locator('[data-qa="blog-body"]').fill("## Paso a paso\n\nPrimero entro a mi cuenta.");
    await page.locator('[data-qa="blog-save"]').click();
    await expect(page.locator('[data-qa="flash-blog-save"]')).toHaveAttribute("data-state", "saved");
    const posts = blogWrites(writes, "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0].body ?? "{}").category).toBe("greenworld");

    // Change it: Save lights, the PATCH carries the new category.
    await expect(page.locator('[data-qa="blog-save"]')).toBeDisabled();
    await personal.click();
    await expect(personal).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[data-qa="blog-save-bar"]')).toHaveAttribute("data-dirty", "true");
    await page.locator('[data-qa="blog-save"]').click();
    // The first save's flash may still be on screen: the bar going clean is the second save landing.
    await expect(page.locator('[data-qa="blog-save-bar"]')).toHaveAttribute("data-dirty", "false");
    await expect(page.locator('[data-qa="flash-blog-save"]')).toHaveAttribute("data-state", "saved");
    const patches = blogWrites(writes, "PATCH");
    expect(patches).toHaveLength(1);
    expect(JSON.parse(patches[0].body ?? "{}").category).toBe("personal");
    expect(rows[0].category).toBe("personal");

    // Back in the list the post is under the tab it now belongs to.
    await page.locator('[data-qa="blog-back"]').click();
    await expect(tab(page, "personal")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "personal")).toHaveText("Personal (1)");
    await expect(tab(page, "greenworld")).toHaveText("Green World (0)");
    await expect(page.locator('[data-qa="blog-row"]')).toHaveCount(1);
  });

  test("B-tabs 4: an existing post opens with its own category; Discard puts a changed one back", async ({ page }) => {
    const writes: Write[] = [];
    await openBlogAdmin(page, catRows(), writes);
    await tab(page, "greenworld").click();
    await blogRow(page, "bailar-en-medellin").locator('[data-qa="blog-row-edit"]').click();
    await expect(page.locator('[data-qa="blog-category-greenworld"]')).toHaveAttribute("aria-checked", "true");
    await page.locator('[data-qa="blog-category-personal"]').click();
    await expect(page.locator('[data-qa="blog-save-bar"]')).toHaveAttribute("data-dirty", "true");
    await page.locator('[data-qa="blog-discard"]').click();
    await expect(page.locator('[data-qa="blog-category-greenworld"]')).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[data-qa="blog-save-bar"]')).toHaveAttribute("data-dirty", "false");
    expect(blogWrites(writes, "PATCH")).toHaveLength(0);
  });

  test("B-tabs 5: the English admin reads Category / Personal / Green World", async ({ page }) => {
    const writes: Write[] = [];
    await openBlogAdmin(page, catRows(), writes, { lang: "en" });
    await expect(tab(page, "personal")).toHaveText("Personal (2)");
    await expect(tab(page, "greenworld")).toHaveText("Green World (1)");
    await expect(page.locator('[data-qa="blog-list"] [role="tablist"]')).toHaveAttribute("aria-label", "Categories");
    await page.locator('[data-qa="blog-new"]').click();
    await expect(page.locator('[data-qa="blog-field-category"]')).toContainText("Category");
  });

  test("B-tabs 6: 390×844, the tabs and the Categoría field fit", async ({ page }) => {
    const writes: Write[] = [];
    await openBlogAdmin(page, catRows(), writes, { width: 390, height: 844 });
    await expect(tab(page, "greenworld")).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
    const box = (await tab(page, "greenworld").boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await page.locator('[data-qa="blog-new"]').click();
    await expect(page.locator('[data-qa="blog-field-category"]')).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
    const cat = (await page.locator('[data-qa="blog-category-greenworld"]').boundingBox())!;
    expect(cat.x + cat.width).toBeLessThanOrEqual(390);
  });

  test("screenshots: the Blog tabs and the editor's Categoría, light, 1440×900", async ({ page }) => {
    const writes: Write[] = [];
    await page.addInitScript(() => localStorage.removeItem("admin.theme"));
    await openBlogAdmin(page, catRows(), writes, { width: 1440, height: 900 });
    for (const c of ["personal", "greenworld"] as const) {
      await tab(page, c).click();
      await expect(tab(page, c)).toHaveAttribute("aria-selected", "true");
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${VOICE_SHOTS}/blog-tabs-${c}-light-1440x900.png` });
    }
    await blogRow(page, "bailar-en-medellin").locator('[data-qa="blog-row-edit"]').click();
    await expect(page.locator('[data-qa="blog-category-greenworld"]')).toHaveAttribute("aria-checked", "true");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${VOICE_SHOTS}/blog-editor-categoria-light-1440x900.png` });
  });
});

test.describe("STUDIO.VOICES.1 /blog filter", () => {
  const chip = (page: Page, f: string) => page.locator(`[data-qa="blog-filter-${f}"]`);
  const pressed = async (page: Page) =>
    page.locator('[data-qa^="blog-filter-"]').evaluateAll((els) =>
      els.filter((e) => e.getAttribute("aria-pressed") === "true").map((e) => e.getAttribute("data-qa")),
    );

  test("F1 /blog?c=greenworld shows only Green World posts; the chips read Todo | Personal | Green World", async ({ page }) => {
    await openPublic(page, "/blog?c=greenworld", "es", undefined, catRows());
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(1);
    expect(await slugsOf(page, "blog-card")).toEqual(["bailar-en-medellin"]);
    await expect(page.locator('[data-qa="blog-filter"] button')).toHaveText(["Todo", "Personal", "Green World"]);
    expect(await pressed(page)).toEqual(["blog-filter-greenworld"]);
    // BLOG.GW.1 — the Green World lane is its own search result (G2 has the rest of its head).
    await expect
      .poll(async () => (await head(page)).canonical)
      .toBe("https://www.titiactriz.com/blog?c=greenworld");
  });

  test("F2 the chips filter with no reload and keep the address in step; Todo clears it", async ({ page }) => {
    await openPublic(page, "/blog", "es", undefined, catRows());
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(2);
    expect(await pressed(page)).toEqual(["blog-filter-all"]);
    await page.evaluate(() => ((window as unknown as { __alive: number }).__alive = 1));

    await chip(page, "personal").click();
    await expect(page).toHaveURL(/\/blog\?c=personal$/);
    expect(await slugsOf(page, "blog-card")).toEqual(["un-dia-en-el-set"]);
    expect(await pressed(page)).toEqual(["blog-filter-personal"]);

    await chip(page, "greenworld").click();
    await expect(page).toHaveURL(/\/blog\?c=greenworld$/);
    expect(await slugsOf(page, "blog-card")).toEqual(["bailar-en-medellin"]);

    await chip(page, "all").click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(2);
    expect(await pressed(page)).toEqual(["blog-filter-all"]);
    // None of it was a page load.
    expect(await page.evaluate(() => (window as unknown as { __alive?: number }).__alive)).toBe(1);
  });

  test("F3 an unknown ?c= is Todo; a category with no published post says so; no posts, no chips", async ({ page }) => {
    await openPublic(page, "/blog?c=nope", "es", undefined, catRows());
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(2);
    expect(await pressed(page)).toEqual(["blog-filter-all"]);

    // Only Personal posts are published: Green World is an empty room, chips still offered.
    const personalOnly = catRows().map((r) => ({ ...r, category: "personal" }));
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openPublic(page, "/blog?c=greenworld", "es", undefined, personalOnly);
    await expect(page.locator('[data-qa="blog-filter-empty"]')).toHaveText("Pronto, la primera entrada de esta categoría.");
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(0);
    await expect(chip(page, "all")).toBeVisible();
    await chip(page, "all").click();
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(2);

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openPublic(page, "/blog", "es", undefined, []);
    await expect(page.locator('[data-qa="blog-empty"]')).toBeVisible();
    await expect(page.locator('[data-qa="blog-filter"]')).toHaveCount(0);
  });

  test("F4 English: All | Personal | Green World, and the group is named", async ({ page }) => {
    await openPublic(page, "/blog?c=personal", "en", undefined, catRows());
    await expect(page.locator('[data-qa="blog-filter"] button')).toHaveText(["All", "Personal", "Green World"]);
    await expect(page.locator('[data-qa="blog-filter"]')).toHaveAttribute("aria-label", "Filter by category");
    expect(await slugsOf(page, "blog-card")).toEqual(["un-dia-en-el-set"]);
  });

  test("F5 the filter row is hairline chips in the room's grammar: gold edge, hard corners, no fill at rest", async ({ page }) => {
    await openPublic(page, "/blog", "es", undefined, catRows());
    const style = (f: string) =>
      chip(page, f).evaluate((el) => {
        const s = getComputedStyle(el);
        return { border: s.borderTopColor, width: s.borderTopWidth, radius: s.borderTopLeftRadius, bg: s.backgroundColor, h: el.getBoundingClientRect().height };
      });
    const rest = await style("personal");
    expect(rest.border).toBe("rgba(201, 165, 92, 0.4)");
    expect(rest.width).toBe("1px");
    expect(rest.radius).toBe("0px");
    expect(rest.bg).toBe("rgba(0, 0, 0, 0)");
    expect(rest.h).toBeGreaterThanOrEqual(44); // a thumb-sized target
    const on = await style("all");
    expect(on.border).toBe("rgb(201, 165, 92)");
    expect(on.bg).toBe("rgba(201, 165, 92, 0.08)");
  });

  test("F6 390×844: the chips fit on the phone and the page does not scroll sideways", async ({ page }) => {
    await openPublic(page, "/blog", "es", { width: 390, height: 844 }, catRows());
    await expect(chip(page, "greenworld")).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
    for (const f of ["all", "personal", "greenworld"]) {
      const box = (await chip(page, f).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  });

  test("F7 Article JSON-LD carries articleSection: Green World / Personal", async ({ page }) => {
    await openPublic(page, "/blog/bailar-en-medellin", "es", undefined, catRows());
    await expect(page.locator('[data-qa="blog-post-title"]')).toHaveText("Bailar en Medellín");
    await expect.poll(async () => (await head(page)).ld.some((l) => l?.["@type"] === "Article")).toBe(true);
    const article = (await head(page)).ld.find((l) => l?.["@type"] === "Article");
    expect(article.articleSection).toBe("Green World");

    await page.goto("/blog/un-dia-en-el-set", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-qa="blog-post-title"]')).toHaveText("Un día en el set");
    await expect
      .poll(async () => (await head(page)).ld.find((l) => l?.["@type"] === "Article")?.articleSection)
      .toBe("Personal");
  });

  test("screenshots: the /blog filter row, 1440×900 and 390×844", async ({ page }) => {
    await openPublic(page, "/blog?c=greenworld", "es", { width: 1440, height: 900 }, catRows());
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(1);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${VOICE_SHOTS}/blog-public-greenworld-1440x900.png` });
    await chip(page, "all").click();
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(2);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${VOICE_SHOTS}/blog-public-todo-1440x900.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${VOICE_SHOTS}/blog-public-todo-390x844.png` });
  });
});
