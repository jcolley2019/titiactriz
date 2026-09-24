import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/hooks/useEventsBoard";
import { pickLocalized, rowToPost, type BlogPost, type BlogPostRow } from "@/lib/blog";

/**
 * BLOG.1 — the public side of the blog. Published posts only (RLS says the same
 * thing; the filter keeps a signed-in admin's preview of /blog honest too),
 * newest first, each with its gallery cover joined in.
 *
 * The active i18n language picks each field's side, falling back to the other
 * side when that one is blank — the site never shows an empty title.
 */

export type BlogCover = { id: string; image_url: string; alt_text: string | null };

type Joined = BlogPostRow & { cover: BlogCover | null };

/** One post as a reader sees it: every text field already in their language. */
export type BlogView = {
  post: BlogPost;
  cover: BlogCover | null;
  title: string;
  excerpt: string;
  body: string;
  metaDescription: string;
};

const SELECT = "*, cover:gallery_photos(id, image_url, alt_text)";

export const toView = (row: Joined, lang: Lang): BlogView => {
  const post = rowToPost(row);
  return {
    post,
    cover: row.cover && row.cover.image_url ? row.cover : null,
    title: pickLocalized(post.title, lang),
    excerpt: pickLocalized(post.excerpt, lang),
    body: pickLocalized(post.body, lang),
    metaDescription: pickLocalized(post.meta_description, lang),
  };
};

const useLang = (): Lang => {
  const { i18n } = useTranslation();
  return (i18n.language || "es").startsWith("en") ? "en" : "es";
};

/** Every published post, newest first. */
export const useBlogPosts = () => {
  const lang = useLang();
  const [rows, setRows] = useState<Joined[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("blog_posts")
      .select(SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(true);
        else setRows((data ?? []) as unknown as Joined[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { posts: rows.map((r) => toView(r, lang)), loading, failed, lang };
};

/** One published post by slug; `notFound` for a draft or an unknown slug. */
export const useBlogPost = (slug: string | undefined) => {
  const lang = useLang();
  const [row, setRow] = useState<Joined | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setRow(null);
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    supabase
      .from("blog_posts")
      .select(SELECT)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setNotFound(true);
        else setRow(data as unknown as Joined);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { view: row ? toView(row, lang) : null, loading, notFound, lang };
};
