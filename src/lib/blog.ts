import type { Lang, Localized } from "@/hooks/useEventsBoard";
import type { Tables } from "@/integrations/supabase/types";
import { VOICES, asVoice, type VoiceName } from "@/lib/voices";
import { GREEN_WORLD_SHOP_URL } from "@/lib/ventures";

/**
 * BLOG.1 — Titi's blog posts, shared by the admin editor and the public pages.
 *
 * Every text column is jsonb in the site's Localized shape {es, en, src?,
 * pending?}: the owner types one language and Save fills the other through
 * translate-text, exactly as the Events board and the hero copy do.
 */

export type BlogPostRow = Tables<"blog_posts">;
export type BlogStatus = "draft" | "published";

/** STUDIO.VOICES.1 — the two kinds of article, named like the voices that write them. */
export type BlogCategory = VoiceName;
export const BLOG_CATEGORIES = VOICES;
/** Anything unreadable (a row from before the column existed) is personal. */
export const asCategory = asVoice;
/** The name the site gives a category in structured data (articleSection). */
export const categorySection = (c: BlogCategory): string => (c === "greenworld" ? "Green World" : "Personal");

/**
 * BLOG.GW.2 — the three kinds of Green World article. A kind means something
 * only on a greenworld post: a personal post carries none (rowToPost reads it as
 * null whatever the row says, and the editor writes NULL when a post is saved as
 * Personal). Mirrors blog_posts_gw_kind_check and GW_KINDS in
 * supabase/functions/generate-content/validate.ts.
 */
export const GW_KINDS = ["producto", "capacitacion", "negocio"] as const;
export type GwKind = (typeof GW_KINDS)[number];
/** Anything unreadable is no kind at all, never a crash. */
export const asGwKind = (v: unknown): GwKind | null =>
  typeof v === "string" && (GW_KINDS as readonly string[]).includes(v) ? (v as GwKind) : null;
/** The kind's label key: blog.kind.producto → "Producto" / "Product". */
export const gwKindLabelKey = (k: GwKind): string => `blog.kind.${k}`;

/** A product link the editor accepts: http(s) with a host, nothing else. Empty is the caller's call. */
export const isHttpUrl = (text: string): boolean => {
  const s = text.trim();
  if (!/^https?:\/\/\S+$/i.test(s)) return false;
  try {
    return !!new URL(s).hostname;
  } catch {
    return false;
  }
};

/** Where a Producto post's product card goes: its own link, else the Green World shop. */
export const gwProductHref = (post: Pick<BlogPost, "gwProductUrl">): string =>
  post.gwProductUrl && isHttpUrl(post.gwProductUrl) ? post.gwProductUrl.trim() : GREEN_WORLD_SHOP_URL;

/**
 * ADMIN.FIXES.1 — the products a Green World post names, in order: a name and
 * a link each, the link http(s) or empty (an empty link goes to the Green World
 * shop). A Producto post is about them; a Capacitación or Negocio post may list
 * the ones it mentions. Stored as blog_posts.gw_products and
 * studio_generations.gw_products (jsonb); a personal post, or a Green World post
 * with no kind, keeps []. Replaces BLOG.GW.2's single gw_product_name /
 * gw_product_url pair. Mirrors MAX_GW_PRODUCTS and the caps in
 * supabase/functions/generate-content/validate.ts.
 */
export type GwProduct = { name: string; url: string };
export const MAX_GW_PRODUCTS = 6;
export const GW_PRODUCT_NAME_MAX = 120;
export const GW_PRODUCT_URL_MAX = 500;

/**
 * A jsonb cell or an editor's rows, as they are stored: each name and link
 * trimmed, rows with neither dropped, at most MAX_GW_PRODUCTS. Anything
 * unreadable is no product, never a crash.
 */
export const asGwProducts = (v: unknown): GwProduct[] => {
  if (!Array.isArray(v)) return [];
  const out: GwProduct[] = [];
  for (const item of v) {
    if (!isObj(item)) continue;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";
    if (!name && !url) continue;
    out.push({ name, url });
    if (out.length === MAX_GW_PRODUCTS) break;
  }
  return out;
};

/** A row's link the editors refuse: something typed that is not http(s). Empty is fine — the shop. */
export const gwProductUrlInvalid = (p: Pick<GwProduct, "url">): boolean => !!p.url.trim() && !isHttpUrl(p.url);

export const BLOG_LOCALIZED_FIELDS = ["title", "excerpt", "body", "meta_description"] as const;
export type BlogLocalizedField = (typeof BLOG_LOCALIZED_FIELDS)[number];

export type BlogPost = {
  id: string;
  slug: string;
  title: Localized;
  excerpt: Localized;
  body: Localized;
  meta_description: Localized;
  tags: string[];
  category: BlogCategory;
  /** BLOG.GW.2 — a greenworld post's kind; null on every personal post. */
  gwKind: GwKind | null;
  /** ADMIN.FIXES.1 — the products a Green World post with a kind names; [] otherwise. */
  gwProducts: GwProduct[];
  /** BLOG.GW.2's single product, read only by the post page's card until it becomes the list (ADMIN.FIXES.1). */
  gwProductName: string | null;
  gwProductUrl: string | null;
  cover_photo_id: string | null;
  status: BlogStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export const EMPTY_LOCALIZED: Localized = { es: "", en: "" };

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** A jsonb cell, coerced. Anything unreadable is an empty field, never a crash. */
export const toLocalized = (v: unknown): Localized => {
  if (!isObj(v)) return { ...EMPTY_LOCALIZED };
  const out: Localized = {
    es: typeof v.es === "string" ? v.es : "",
    en: typeof v.en === "string" ? v.en : "",
  };
  if (v.src === "es" || v.src === "en") out.src = v.src;
  if (v.pending === true) out.pending = true;
  return out;
};

/** A text cell, trimmed; blank is null. */
const textOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export const rowToPost = (row: BlogPostRow): BlogPost => {
  const category = asCategory(row.category);
  const gw = category === "greenworld";
  const gwKind = gw ? asGwKind(row.gw_kind) : null;
  return {
    id: row.id,
    slug: row.slug,
    title: toLocalized(row.title),
    excerpt: toLocalized(row.excerpt),
    body: toLocalized(row.body),
    meta_description: toLocalized(row.meta_description),
    tags: Array.isArray(row.tags) ? row.tags : [],
    category,
    gwKind,
    gwProducts: gwKind ? asGwProducts(row.gw_products) : [],
    gwProductName: gw ? textOrNull(row.gw_product_name) : null,
    gwProductUrl: gw ? textOrNull(row.gw_product_url) : null,
    cover_photo_id: row.cover_photo_id,
    status: row.status === "published" ? "published" : "draft",
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

/** A field that says nothing in either language is stored as NULL. */
export const localizedIsEmpty = (v: Localized): boolean => !v.es.trim() && !v.en.trim();

/** The side the reader asked for, else the other side — the site never shows a blank. */
export const pickLocalized = (v: Localized, lang: Lang): string => {
  const other: Lang = lang === "es" ? "en" : "es";
  return v[lang].trim() ? v[lang] : v[other];
};

/**
 * URL slug from a title: accents stripped ("Qué" → "que", "ñ" → "n"),
 * lowercase, anything else collapses to single hyphens.
 */
export const slugify = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

/** What a stored slug must look like — what slugify produces. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "a, b ,, c" → ["a", "b", "c"]: trimmed, blanks dropped, duplicates dropped. */
export const parseTags = (input: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
};

/** Minutes at ~200 words a minute, never less than one. */
export const readingTimeMinutes = (markdown: string): number =>
  Math.max(1, Math.ceil(markdown.trim().split(/\s+/).filter(Boolean).length / 200));

/** A date in the reader's locale: "24 de septiembre de 2026" / "September 24, 2026". */
export const formatPostDate = (iso: string | null | undefined, lang: Lang): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
};

/**
 * HOME.BLOGACT.1 — the same date, short enough to share one text-caps line with
 * a category label on a phone tile: "24 sept 2026" / "Sep 24, 2026". Spanish
 * drops the "de" joins its short form carries ("24 de sept de 2026").
 */
export const formatPostDateShort = (iso: string | null | undefined, lang: Lang): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (lang === "en") return fmt.format(d);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    fmt.formatToParts(d).find((p) => p.type === type)?.value ?? "";
  return `${part("day")} ${part("month").replace(/\.$/, "")} ${part("year")}`;
};
