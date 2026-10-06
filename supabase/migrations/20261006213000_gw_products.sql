-- ADMIN.FIXES.1 — Green World products as a list.
--
-- ALREADY APPLIED to the live project (nsmstwkjbjicpdclgecq) by hand on
-- 2026-10-06, before this file existed. This file documents it so the repo
-- matches the database (read back from the live catalog: one jsonb column,
-- NOT NULL DEFAULT '[]', on each of blog_posts and studio_generations; no
-- constraint, no trigger, no comment). Every statement is guarded, so running
-- it against the live project (or a rebuilt one) is a no-op where the change is
-- already there. No row is written: no Green World post existed when the
-- column landed, so there was no gw_product_name / gw_product_url to carry over.

-- blog_posts.gw_products: the products a Green World post names, in order, as
-- [{ "name": text, "url": text }, …]. The app keeps it to at most 6 rows, each
-- with a name or a link; a link is http(s) or empty (empty sends the post
-- page's row to the Green World shop). A Producto post is about them; a
-- Capacitación or Negocio post may list the ones it mentions. A personal post
-- keeps [] (the admin editor writes [] when a post is saved as Personal).
--
-- It replaces the single gw_product_name / gw_product_url pair (BLOG.GW.2,
-- 20261002210000_blog_gw_kinds.sql), which the app no longer reads or writes.
-- Those two columns stay in place until they are dropped by hand.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS gw_products jsonb NOT NULL DEFAULT '[]'::jsonb;

-- studio_generations.gw_products: the products a Green World Studio press was
-- written about, so a reopened generation publishes a draft that names them.
-- [] for a personal press.
ALTER TABLE public.studio_generations
  ADD COLUMN IF NOT EXISTS gw_products jsonb NOT NULL DEFAULT '[]'::jsonb;
