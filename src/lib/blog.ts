import type { Lang, Localized } from "@/hooks/useEventsBoard";
import type { Tables } from "@/integrations/supabase/types";

/**
 * BLOG.1 — Titi's blog posts, shared by the admin editor and the public pages.
 *
 * Every text column is jsonb in the site's Localized shape {es, en, src?,
 * pending?}: the owner types one language and Save fills the other through
 * translate-text, exactly as the Events board and the hero copy do.
 */

export type BlogPostRow = Tables<"blog_posts">;
export type BlogStatus = "draft" | "published";

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

export const rowToPost = (row: BlogPostRow): BlogPost => ({
  id: row.id,
  slug: row.slug,
  title: toLocalized(row.title),
  excerpt: toLocalized(row.excerpt),
  body: toLocalized(row.body),
  meta_description: toLocalized(row.meta_description),
  tags: Array.isArray(row.tags) ? row.tags : [],
  cover_photo_id: row.cover_photo_id,
  status: row.status === "published" ? "published" : "draft",
  published_at: row.published_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

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
