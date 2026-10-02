-- BLOG.GW.2 — Green World post kinds: Producto, Capacitación, Negocio.
--
-- ALREADY APPLIED to the live project (nsmstwkjbjicpdclgecq) by hand on
-- 2026-10-02, before this file existed. This file documents it so the repo
-- matches the database (read back from the live catalog: three nullable text
-- columns on blog_posts with one CHECK, one nullable text column on
-- studio_generations with none). Every statement is guarded, so running it
-- against the live project (or a rebuilt one) is a no-op where the change is
-- already there. No row is written.

-- blog_posts.gw_kind: which kind of Green World article this is. Meaningful
-- only when category = 'greenworld'; a personal post keeps NULL (the admin
-- editor writes NULL to all three columns when a post is saved as Personal).
-- gw_product_name / gw_product_url: the one product a Producto article is
-- about. An empty URL is NULL, and the post page then links to the Green World
-- shop instead.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS gw_kind text,
  ADD COLUMN IF NOT EXISTS gw_product_name text,
  ADD COLUMN IF NOT EXISTS gw_product_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'blog_posts_gw_kind_check'
      AND conrelid = 'public.blog_posts'::regclass
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_gw_kind_check
      CHECK (gw_kind IS NULL OR gw_kind IN ('producto', 'capacitacion', 'negocio'));
  END IF;
END
$$;

-- studio_generations.gw_kind: the kind a Green World Studio press was written
-- as, so a reopened generation publishes a draft of the same kind. NULL for a
-- personal press.
ALTER TABLE public.studio_generations
  ADD COLUMN IF NOT EXISTS gw_kind text;
