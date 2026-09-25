import { expect, test, type Page, type Route } from "@playwright/test";
import { forceLanguage, injectAdminSession, MOCK_PHOTOS, routeSupabase, type Write } from "./_admin";

/**
 * BLOG.1 — Titi writes, translates and publishes blog posts from the admin, and
 * visitors read them at /blog and /blog/:slug.
 *
 *  P1  Admin list, no posts → the empty state, and "New post" is offered.
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
    // The section sits between Events and the Studio (BLOG.2 put Studio between Blog and Settings).
    const ids = await page
      .locator('[data-qa="admin-nav"] button')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-qa")));
    const at = ids.indexOf("admin-nav-blog");
    expect(ids[at - 1]).toBe("admin-nav-events");
    expect(ids[at + 1]).toBe("admin-nav-studio");
    expect(ids[at + 2]).toBe("admin-nav-settings");
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
    expect((await head(page)).canonical).toBe("https://titiactriz.com/blog");

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
    expect(h.canonical).toBe("https://titiactriz.com/blog/un-dia-en-el-set");
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
