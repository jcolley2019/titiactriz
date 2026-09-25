/**
 * BLOG.2 — turning a Studio article into a BLOG.1 draft.
 *
 * deriveTitleAndSlug, slugify and parseMetaFence are ported from joeyc.ai's
 * src/lib/publish.ts (title from the first "# " heading, slug from the title,
 * the ```meta fence split off the article). What is new is the BLOG.1 side:
 * every text field becomes the site's Localized shape with the output language
 * as its source and the other side PENDING, so BLOG.1's Save translates it,
 * exactly as if Titi had typed the post herself.
 *
 * Pure: no React, no Supabase, so the Playwright runner can unit-test it.
 */
import type { Lang, Localized } from "@/hooks/useEventsBoard";

export const TITLE_MAX_CHARS = 120;
export const FALLBACK_TITLE_MAX_CHARS = 80;
export const SLUG_MAX_WORDS = 8;
export const EXCERPT_MAX_CHARS = 300;

export interface DerivedPost {
  title: string;
  slug: string;
  body: string;
}

export type DeriveResult = { ok: true; post: DerivedPost } | { ok: false; error: "empty" | "noTitle" | "noSlug" };

const isBlank = (line: string) => line.trim() === "";
const isThematicBreak = (line: string) => /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
const isH1 = (line: string) => /^#\s+\S/.test(line);

/** Strip inline markdown so a title or excerpt reads as plain text. */
export const plainText = (line: string) =>
  line
    .replace(/^#{1,6}\s+/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max).trimEnd() : s);

/** joeyc.ai's slug: accents dropped, first eight words, hyphenated. */
export function slugify(title: string, maxWords = SLUG_MAX_WORDS): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join("-");
}

/**
 * Skip leading blank lines and thematic breaks, then take the first `# ` heading
 * as the title and drop it from the body. Without an H1, the first non-empty
 * line becomes the title (max 80 chars) and stays in the body.
 */
export function deriveTitleAndSlug(content: string): DeriveResult {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");

  let start = 0;
  while (start < lines.length && (isBlank(lines[start]) || isThematicBreak(lines[start]))) start += 1;
  const rest = lines.slice(start);
  if (rest.length === 0 || rest.every(isBlank)) return { ok: false, error: "empty" };

  let title: string;
  let bodyLines: string[];
  if (isH1(rest[0])) {
    title = plainText(rest[0]);
    bodyLines = rest.slice(1);
  } else {
    const firstText = rest.find((l) => !isBlank(l))!;
    title = truncate(plainText(firstText), FALLBACK_TITLE_MAX_CHARS);
    bodyLines = rest;
  }

  title = truncate(title, TITLE_MAX_CHARS);
  if (!title) return { ok: false, error: "noTitle" };
  const slug = slugify(title);
  if (!slug) return { ok: false, error: "noSlug" };
  return { ok: true, post: { title, slug, body: bodyLines.join("\n").trim() } };
}

export interface BlogMeta {
  primaryKeyword: string | null;
  metaDescription: string | null;
}

const META_FENCE_RE = /```meta[ \t]*\r?\n([\s\S]*?)\r?\n?```[ \t]*(?:\r?\n|$)/;

/** Split the ```meta fence (Primary Keyword / Meta Description) off the article. */
export function parseMetaFence(markdown: string): { meta: BlogMeta | null; body: string } {
  const match = META_FENCE_RE.exec(markdown);
  if (!match) return { meta: null, body: markdown };
  const lines = match[1].split(/\r?\n/).map((l) =>
    l
      .replace(/[*`]/g, "")
      .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, "")
      .replace(/^\s*[-•]\s*/, "")
      .trim(),
  );
  const field = (name: string) => {
    const line = lines.find((l) => l.toLowerCase().startsWith(name.toLowerCase() + ":"));
    const value = line ? line.slice(name.length + 1).trim() : "";
    return value || null;
  };
  const meta = { primaryKeyword: field("Primary Keyword"), metaDescription: field("Meta Description") };
  const body = markdown.slice(0, match.index) + markdown.slice(match.index + match[0].length);
  return { meta: meta.primaryKeyword || meta.metaDescription ? meta : null, body };
}

/**
 * The first paragraph of the article body as plain text: headings, rules,
 * lists and quotes are skipped (the italic subtitle under the title counts —
 * it is the article's one-line promise).
 */
export function firstParagraph(body: string): string {
  const blocks = body.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const block of blocks) {
    const text = block.trim();
    if (!text) continue;
    if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|!\[|\|)/.test(text)) continue;
    if (isThematicBreak(text)) continue;
    const plain = plainText(text);
    if (plain) return truncate(plain, EXCERPT_MAX_CHARS);
  }
  return "";
}

/** A field written in `lang`, the other side owed: BLOG.1's Save translates it. */
export const pendingLocalized = (text: string, lang: Lang): Localized =>
  text.trim() ? { es: text, en: text, src: lang, pending: true } : { es: "", en: "" };

export interface StudioDraft {
  slug: string;
  title: Localized;
  excerpt: Localized | null;
  body: Localized;
  meta_description: Localized | null;
  tags: string[];
  status: "draft";
}

/**
 * The blog_posts row a Publish writes: always a DRAFT (the Studio never
 * publishes live), language side = the output language, other side pending.
 */
export function studioDraft(article: string, lang: Lang): { ok: true; draft: StudioDraft } | { ok: false; error: string } {
  const { meta, body: withoutMeta } = parseMetaFence(article);
  const derived = deriveTitleAndSlug(withoutMeta);
  if (!derived.ok) return { ok: false, error: derived.error };
  const { title, slug, body } = derived.post;
  const excerpt = firstParagraph(body);
  const metaDescription = meta?.metaDescription ?? "";
  return {
    ok: true,
    draft: {
      slug,
      title: pendingLocalized(title, lang),
      excerpt: excerpt ? pendingLocalized(excerpt, lang) : null,
      body: pendingLocalized(body, lang),
      meta_description: metaDescription ? pendingLocalized(metaDescription, lang) : null,
      tags: [],
      status: "draft",
    },
  };
}

/** `base`, else `base-2`, `base-3`… — the first slug not in `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Inverse of parseMetaFence: the fence rebuilt above an edited article. */
export function metaFence(meta: BlogMeta): string {
  const lines = ["```meta"];
  if (meta.primaryKeyword) lines.push(`Primary Keyword: ${meta.primaryKeyword}`);
  if (meta.metaDescription) lines.push(`Meta Description: ${meta.metaDescription}`);
  lines.push("```");
  return lines.join("\n");
}
