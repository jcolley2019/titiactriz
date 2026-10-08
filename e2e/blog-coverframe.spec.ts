import { expect, test, type Page, type Route } from "@playwright/test";
import { forceLanguage, injectAdminSession, MOCK_PHOTOS, routeSupabase, type Write } from "./_admin";
import { attachDiagnostics } from "./_helpers";

/**
 * BLOG.COVERFRAME.1 — one post's cover framing (blog_posts.cover_framing,
 * { focal: { x, y } }), rendered as the cover img's object-position on every
 * surface that cover appears, and set from the admin editor.
 *
 *  CF1  Default unchanged: a portrait post with no cover_framing reads "50% 18%"
 *       on its /blog card and its post page; a landscape one "50% 50%".
 *  CF2  Framed: cover_framing { focal: { x: 0.3, y: 0.8 } } reads "30% 80%" on
 *       blog-card-cover, blog-post-cover, the cinematic home's blog-act-cover and
 *       the Green World page's strip.
 *  CF3  Garbage tolerated: { focal: { x: "a", y: 7 } } and [] render as the
 *       default rule, with no console error.
 *  CF4  The admin: Encuadrar (enabled only with a cover) opens the picker; a
 *       click at ~25%/75% of the preview + Aplicar moves the thumbnail's crop;
 *       Guardar PATCHes cover_framing.focal ≈ (0.25, 0.75); Restablecer +
 *       Aplicar + Guardar PATCHes null; a different cover photo clears it (the
 *       same one keeps it); Quitar clears it and disables Encuadrar.
 */

type Row = Record<string, unknown> & { id: string; slug: string; status: string };

const iso = (d: string) => new Date(d).toISOString();

/**
 * blog_posts, served and re-served — blog.spec's routeBlog, cut to what this
 * file needs: eq/neq filters, order and limit on GET, PATCH into `rows`.
 * Registered after routeSupabase, so it runs first (routes are LIFO).
 */
async function routeBlog(page: Page, rows: Row[], writes: Write[]) {
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
    if (method === "PATCH") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const row = rows.find((r) => r.id === id);
      if (!row) return reply({ message: "not found" }, 404);
      Object.assign(row, body ? JSON.parse(body) : {}, { updated_at: new Date().toISOString() });
      return reply(single ? row : [row]);
    }
    return route.fallback();
  });
}

/** An offline cover of a given size (a data-URL SVG decodes to exactly w×h). */
const sizedCover = (id: string, w: number, h: number, color: string) => ({
  id,
  image_url: `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='${color}'/></svg>`,
  )}`,
  alt_text: id,
});

const post = (
  id: string,
  slug: string,
  category: "personal" | "greenworld",
  day: string,
  cover: ReturnType<typeof sizedCover>,
  framing?: unknown,
): Row => ({
  id,
  slug,
  category,
  status: "published",
  published_at: iso(`2026-09-${day}T15:00:00Z`),
  created_at: iso(`2026-09-${day}T12:00:00Z`),
  updated_at: iso(`2026-09-${day}T15:00:00Z`),
  title: { es: `Entrada ${slug}`, en: `Post ${slug}`, src: "es" },
  excerpt: { es: "Un resumen.", en: "A summary.", src: "es" },
  body: { es: "Un texto corto.", en: "A short text.", src: "es" },
  meta_description: null,
  tags: [],
  cover_photo_id: cover.id,
  cover,
  ...(framing === undefined ? {} : { cover_framing: framing }),
});

async function openPublic(page: Page, path: string, rows: Row[], size = { width: 1440, height: 900 }) {
  const writes: Write[] = [];
  await forceLanguage(page, "es");
  await routeSupabase(page, { writes });
  await routeBlog(page, rows, writes);
  await page.setViewportSize(size);
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

const objectPosition = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => getComputedStyle(el).objectPosition);

/** A cover img's computed object-position, polled once it is in view. */
async function expectPosition(page: Page, selector: string, want: string, what: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await expect.poll(() => objectPosition(page, selector), what).toBe(want);
}

const card = (slug: string) => `[data-qa="blog-card"][data-slug="${slug}"] [data-qa="blog-card-cover"] img`;
const POST_COVER = '[data-qa="blog-post-cover"] img';

const SIZES = [
  { width: 440, height: 792 },
  { width: 1440, height: 900 },
];

test.describe("BLOG.COVERFRAME.1 public", () => {
  for (const size of SIZES) {
    test(`CF1 ${size.width}x${size.height}: with no framing, a portrait still crops from 18% down and a landscape stays centred`, async ({
      page,
    }) => {
      const rows = [
        post("d1", "retrato", "personal", "20", sizedCover("dp", 400, 600, "seagreen")),
        post("d2", "paisaje", "personal", "18", sizedCover("dl", 600, 400, "slateblue"), null),
      ];
      await openPublic(page, "/blog", rows, size);
      await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(2);
      await expectPosition(page, card("retrato"), "50% 18%", "/blog portrait");
      await expectPosition(page, card("paisaje"), "50% 50%", "/blog landscape (cover_framing null)");

      await page.goto("/blog/retrato", { waitUntil: "domcontentloaded" });
      await expectPosition(page, POST_COVER, "50% 18%", "post page portrait");
      await page.goto("/blog/paisaje", { waitUntil: "domcontentloaded" });
      await expectPosition(page, POST_COVER, "50% 50%", "post page landscape");
    });

    test(`CF2 ${size.width}x${size.height}: a framed cover reads its own focal point on every surface`, async ({
      page,
    }) => {
      const framing = { focal: { x: 0.3, y: 0.8 } };
      const rows = [
        post("e1", "encuadrada", "greenworld", "24", sizedCover("ep", 400, 600, "seagreen"), framing),
        post("e2", "paisaje-encuadrado", "personal", "20", sizedCover("el", 600, 400, "slateblue"), framing),
        post("e3", "sin-encuadre", "greenworld", "16", sizedCover("eq", 400, 600, "goldenrod")),
      ];
      await openPublic(page, "/blog", rows, size);
      await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(3);
      await expectPosition(page, card("encuadrada"), "30% 80%", "/blog framed portrait");
      await expectPosition(page, card("paisaje-encuadrado"), "30% 80%", "/blog framed landscape");
      await expectPosition(page, card("sin-encuadre"), "50% 18%", "/blog unframed neighbour");

      await page.goto("/blog/encuadrada", { waitUntil: "domcontentloaded" });
      await expectPosition(page, POST_COVER, "30% 80%", "post page framed");

      // The Green World page's latest-posts strip: its own card, the same rule.
      await page.goto("/green-world", { waitUntil: "domcontentloaded" });
      await expectPosition(page, '[data-qa="gw-latest-card"][data-slug="encuadrada"] img', "30% 80%", "GW strip framed");
      await expectPosition(page, '[data-qa="gw-latest-card"][data-slug="sin-encuadre"] img', "50% 18%", "GW strip unframed");

      // The cinematic home's Blog act draws its cover plates on the ≥768 cards.
      if (size.width >= 768) {
        await page.goto("/cinematic", { waitUntil: "domcontentloaded" });
        const act = (slug: string) => `[data-qa="blog-act-card"][data-slug="${slug}"] [data-qa="blog-act-cover"] img`;
        await expect(page.locator('[data-qa="blog-act-card"]')).toHaveCount(3);
        await expect.poll(() => objectPosition(page, act("encuadrada")), "home act framed").toBe("30% 80%");
        await expect.poll(() => objectPosition(page, act("paisaje-encuadrado")), "home act framed").toBe("30% 80%");
      }
    });
  }

  test("CF3 an unreadable cover_framing is no framing: the default rule, and no console error", async ({ page }) => {
    // The house console gate (dev-only WebEdit connector and Vite chatter filtered).
    const diag = attachDiagnostics(page);
    const rows = [
      post("g1", "basura-objeto", "personal", "20", sizedCover("gp", 400, 600, "seagreen"), {
        focal: { x: "a", y: 7 },
      }),
      post("g2", "basura-lista", "personal", "18", sizedCover("gl", 600, 400, "slateblue"), []),
    ];
    await openPublic(page, "/blog", rows);
    await expect(page.locator('[data-qa="blog-card"]')).toHaveCount(2);
    await expectPosition(page, card("basura-objeto"), "50% 18%", "/blog {focal:{x:'a',y:7}}");
    await expectPosition(page, card("basura-lista"), "50% 50%", "/blog []");

    await page.goto("/blog/basura-objeto", { waitUntil: "domcontentloaded" });
    await expectPosition(page, POST_COVER, "50% 18%", "post page {focal:{x:'a',y:7}}");
    await page.goto("/blog/basura-lista", { waitUntil: "domcontentloaded" });
    await expectPosition(page, POST_COVER, "50% 50%", "post page []");

    expect(diag.consoleErrors).toEqual([]);
  });
});

/* ---------------- the admin editor ---------------- */

/** Radix's dialog zooms in from 95%: a box measured mid-animation misplaces the click. */
const settled = (dialog: ReturnType<Page["locator"]>) =>
  dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));

const blogPatches = (writes: Write[]) =>
  writes
    .filter((w) => w.url.includes("/rest/v1/blog_posts") && w.method === "PATCH")
    .map((w) => JSON.parse(w.body ?? "{}") as Record<string, unknown>);

test.describe("BLOG.COVERFRAME.1 admin", () => {
  test("CF4 Encuadrar sets the focal point, Guardar writes it, Restablecer writes null, a new cover clears it", async ({
    page,
  }) => {
    const writes: Write[] = [];
    // MOCK_PHOTOS are 400×500 portraits: unframed, the thumb reads 50% 18%.
    const rows: Row[] = [
      { ...post("a1", "con-portada", "personal", "20", { ...MOCK_PHOTOS[0] }), cover: undefined },
    ];
    await injectAdminSession(page);
    await forceLanguage(page, "es");
    await routeSupabase(page, { writes, photos: MOCK_PHOTOS });
    await routeBlog(page, rows, writes);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.locator('[data-qa="admin-nav-blog"]').click();
    await expect(page.locator('[data-qa="blog-list"]')).toBeVisible();
    await page.locator('[data-qa="blog-row-edit"]').click();

    const thumb = '[data-qa="blog-cover-thumb"]';
    const frame = page.locator('[data-qa="blog-cover-frame"]');
    const save = page.locator('[data-qa="blog-save"]');
    const dialog = page.locator('[data-qa="blog-cover-frame-dialog"]');
    const preview = page.locator('[data-qa="blog-cover-frame-preview"]');
    /** Guardar, and the PATCH it sent — waited for by count, not by a flash a previous save may still show. */
    const saveAndRead = async () => {
      const before = blogPatches(writes).length;
      await save.click();
      await expect.poll(() => blogPatches(writes).length, "one more PATCH").toBe(before + 1);
      await expect(save).toBeDisabled();
      return blogPatches(writes)[before];
    };

    await expect(frame).toHaveText("Encuadrar");
    await expect(frame).toBeEnabled();
    await expect(frame).toHaveAttribute("data-framed", "false");
    await expect.poll(() => objectPosition(page, thumb), "unframed thumb").toBe("50% 18%");

    // Click at ~25% / 75% of the 3:2 preview — the preview is the public plate.
    await frame.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-qa="blog-cover-frame-plate"]')).toBeVisible();
    await expect(dialog.locator('[data-qa="blog-cover-frame-reset"]')).toBeDisabled();
    await settled(dialog);
    const box = (await preview.boundingBox())!;
    expect(Math.abs(box.width / box.height - 1.5), "the preview is the 3:2 plate").toBeLessThan(0.02);
    await preview.click({ position: { x: box.width * 0.25, y: box.height * 0.75 } });
    await expect
      .poll(() => objectPosition(page, '[data-qa="blog-cover-frame-plate"] img'), "the live plate follows")
      .toBe("25% 75%");
    await dialog.locator('[data-qa="blog-cover-frame-apply"]').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => objectPosition(page, thumb), "framed thumb").toBe("25% 75%");
    await expect(frame).toHaveAttribute("data-framed", "true");

    // Aplicar writes nothing; Guardar does.
    expect(blogPatches(writes)).toHaveLength(0);
    const first = await saveAndRead();
    const focal = (first.cover_framing as { focal: { x: number; y: number } }).focal;
    expect(Object.keys(first.cover_framing as object)).toEqual(["focal"]);
    expect(Math.abs(focal.x - 0.25), `x ${focal.x}`).toBeLessThanOrEqual(0.05);
    expect(Math.abs(focal.y - 0.75), `y ${focal.y}`).toBeLessThanOrEqual(0.05);
    expect(first.cover_photo_id).toBe("p1");

    // Cancel leaves the field as it was.
    await frame.click();
    await settled(dialog);
    await preview.click({ position: { x: box.width * 0.9, y: box.height * 0.1 } });
    await dialog.locator('[data-qa="blog-cover-frame-cancel"]').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => objectPosition(page, thumb), "cancel keeps the crop").toBe("25% 75%");
    await expect(save).toBeDisabled();

    // Restablecer → Aplicar → Guardar writes null, never {} or a default object.
    await frame.click();
    await settled(dialog);
    await dialog.locator('[data-qa="blog-cover-frame-reset"]').click();
    await expect
      .poll(() => objectPosition(page, '[data-qa="blog-cover-frame-plate"] img'), "reset plate")
      .toBe("50% 18%");
    await dialog.locator('[data-qa="blog-cover-frame-apply"]').click();
    await expect.poll(() => objectPosition(page, thumb), "reset thumb").toBe("50% 18%");
    const second = await saveAndRead();
    expect("cover_framing" in second).toBe(true);
    expect(second.cover_framing).toBeNull();
    expect(rows[0].cover_framing).toBeNull();

    // Frame again, then re-pick the SAME photo: the point stays with it.
    await frame.click();
    await settled(dialog);
    await preview.click({ position: { x: box.width * 0.6, y: box.height * 0.3 } });
    await dialog.locator('[data-qa="blog-cover-frame-apply"]').click();
    await expect(frame).toHaveAttribute("data-framed", "true");
    await page.locator('[data-qa="blog-cover-pick"]').click();
    await page.locator('[data-qa="media-picker-photo"][aria-label="p1"]').click();
    await expect(frame).toHaveAttribute("data-framed", "true");
    await expect.poll(() => objectPosition(page, thumb), "same photo keeps its point").toBe("60% 30%");

    // A DIFFERENT photo: the point belonged to the old one — cleared.
    await page.locator('[data-qa="blog-cover-pick"]').click();
    await page.locator('[data-qa="media-picker-photo"][aria-label="p2"]').click();
    await expect(frame).toHaveAttribute("data-framed", "false");
    await expect.poll(() => objectPosition(page, thumb), "new photo, default crop").toBe("50% 18%");
    const third = await saveAndRead();
    expect(third.cover_photo_id).toBe("p2");
    expect(third.cover_framing).toBeNull();

    // Quitar: no cover, nothing to frame.
    await frame.click();
    await settled(dialog);
    await preview.click({ position: { x: box.width * 0.5, y: box.height * 0.9 } });
    await dialog.locator('[data-qa="blog-cover-frame-apply"]').click();
    await expect(frame).toHaveAttribute("data-framed", "true");
    await page.locator('[data-qa="blog-cover-remove"]').click();
    await expect(frame).toBeDisabled();
    await expect(frame).toHaveAttribute("data-framed", "false");
    const fourth = await saveAndRead();
    expect(fourth.cover_photo_id).toBeNull();
    expect(fourth.cover_framing).toBeNull();
  });
});
