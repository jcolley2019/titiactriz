import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import CoverPlate from "@/components/blog/CoverPlate";
import TagChips from "@/components/blog/TagChips";
import { BODY_TEXT, GOLD, LANE_GREEN, META_SEP } from "@/components/blog/tokens";
import type { BlogView } from "@/hooks/useBlogPosts";
import type { Lang } from "@/hooks/useEventsBoard";
import { formatPostDate, gwKindLabelKey } from "@/lib/blog";

/**
 * BLOG.1 — one post on the blog, unboxed: the cover as the reel's framed plate,
 * then type standing on the room's own wall — the date as a gold label, the
 * title in the display face, the excerpt in Jost, the tags as hairline chips.
 * No fill, no shadow, no radius. `lead` makes it the spread that opens /blog.
 *
 * BLOG.GW.1 — a Green World post walks its own lane: a 1px hairline down the
 * card's left edge (the gold-hairline grammar, in the lane green), the date line
 * in the lane green, and "Green World" in text caps before the date. A personal
 * card is exactly what it was. Shared by /blog and the post page's "Más de…"
 * row, where the titles sit under that row's own heading (`titleAs="h3"`).
 *
 * BLOG.GW.2 — a greenworld post with a kind names it after the label, on the
 * same line: "Green World · Producto · 12 de septiembre de 2026".
 */
const BlogEntry = ({
  view,
  lang,
  lead,
  tagsLabel,
  titleAs: Title = "h2",
}: {
  view: BlogView;
  lang: Lang;
  lead: boolean;
  tagsLabel: string;
  titleAs?: "h2" | "h3";
}) => {
  const { t } = useTranslation();
  const lane = view.post.category;
  const gw = lane === "greenworld";
  const kind = gw ? view.post.gwKind : null;
  const published = view.post.published_at;
  return (
    <article
      data-qa="blog-card"
      data-slug={view.post.slug}
      data-blog-card-lane={lane}
      className={gw ? "group relative pl-5" : "group"}
    >
      {gw && (
        <span
          aria-hidden
          data-qa="blog-card-lane-rule"
          className="absolute inset-y-0 left-0 w-px"
          style={{ backgroundColor: LANE_GREEN }}
        />
      )}
      <Link
        to={`/blog/${view.post.slug}`}
        className={lead ? "grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-center md:gap-12" : "block"}
      >
        {view.cover && <CoverPlate cover={view.cover} qa="blog-card-cover" eager={lead} />}
        <div className={view.cover && !lead ? "mt-6" : undefined}>
          {(published || gw) && (
            <p data-qa="blog-card-date" className="text-caps" style={{ color: gw ? LANE_GREEN : GOLD }}>
              {gw && (
                <span data-qa="blog-card-label" translate="no">
                  {t("blog.gwLabel")}
                </span>
              )}
              {kind && (
                <>
                  {META_SEP}
                  <span data-qa="blog-card-kind" data-kind={kind}>
                    {t(gwKindLabelKey(kind))}
                  </span>
                </>
              )}
              {gw && published && META_SEP}
              {published && (
                <time dateTime={published} className="whitespace-nowrap">
                  {formatPostDate(published, lang)}
                </time>
              )}
            </p>
          )}
          <Title
            data-qa="blog-card-title"
            className="mt-3 leading-tight transition-colors duration-300 group-hover:text-gold-light"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: lead ? "clamp(1.75rem, 4vw, 3.25rem)" : "1.75rem",
            }}
          >
            {view.title}
          </Title>
          {view.excerpt.trim() && (
            <p data-qa="blog-card-excerpt" className="mt-3" style={BODY_TEXT}>
              {view.excerpt}
            </p>
          )}
          {view.post.tags.length > 0 && (
            <div className="mt-5">
              <TagChips tags={view.post.tags} qa="blog-card-tags" label={tagsLabel} />
            </div>
          )}
        </div>
      </Link>
    </article>
  );
};

export default BlogEntry;
