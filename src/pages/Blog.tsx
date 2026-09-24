import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import CoverPlate from "@/components/blog/CoverPlate";
import TagChips from "@/components/blog/TagChips";
import { BODY_TEXT, GOLD, blogRoom } from "@/components/blog/tokens";
import { useBlogPosts, type BlogView } from "@/hooks/useBlogPosts";
import { formatPostDate } from "@/lib/blog";
import type { Lang } from "@/hooks/useEventsBoard";

/**
 * BLOG.1 — /blog, a tonal room in the cinematic grammar.
 *
 * One continuous field (the ground under the HERO.WIDE.1 luminance gradient),
 * the gold eyebrow, and the posts newest first. DESIGN.md has no cards on a
 * cinematic surface, so a "card" here is unboxed: the cover as the reel's framed
 * plate, then type standing on the room's own wall — the date as a gold label,
 * the title in the display face, the excerpt in Jost, the tags as hairline chips.
 * No fill, no shadow, no radius. The newest post leads as a spread from md up.
 *
 * No pin and no dwell: this is an ordinary page, and it scrolls like one.
 */

const Entry = ({
  view,
  lang,
  lead,
  tagsLabel,
}: {
  view: BlogView;
  lang: Lang;
  lead: boolean;
  tagsLabel: string;
}) => (
  <article data-qa="blog-card" data-slug={view.post.slug} className="group">
    <Link
      to={`/blog/${view.post.slug}`}
      className={lead ? "grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-center md:gap-12" : "block"}
    >
      {view.cover && <CoverPlate cover={view.cover} qa="blog-card-cover" eager={lead} />}
      <div className={view.cover && !lead ? "mt-6" : undefined}>
        {view.post.published_at && (
          <p data-qa="blog-card-date" className="text-caps" style={{ color: GOLD }}>
            <time dateTime={view.post.published_at}>{formatPostDate(view.post.published_at, lang)}</time>
          </p>
        )}
        <h2
          data-qa="blog-card-title"
          className="mt-3 leading-tight transition-colors duration-300 group-hover:text-gold-light"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: lead ? "clamp(1.75rem, 4vw, 3.25rem)" : "1.75rem",
          }}
        >
          {view.title}
        </h2>
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

const Blog = () => {
  const { t } = useTranslation();
  const { posts, loading, failed, lang } = useBlogPosts();
  const [lead, ...rest] = posts;

  return (
    <main data-qa="blog-page" className="relative min-h-screen px-6 pb-24" style={blogRoom}>
      <SEO path="/blog" title={t("blog.seoTitle")} description={t("blog.seoDescription")} />

      <div className="mx-auto max-w-6xl">
        <header className="mb-12 md:mb-16">
          <h1 data-qa="blog-eyebrow" className="text-caps" style={{ color: GOLD }}>
            {t("blog.eyebrow")}
          </h1>
          {/* The one gold hairline the room allows: a rule, not a fill. */}
          <span aria-hidden className="mt-5 block h-px w-16" style={{ backgroundColor: GOLD }} />
        </header>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          </div>
        ) : failed ? (
          <p data-qa="blog-load-failed" role="alert" style={BODY_TEXT}>
            {t("blog.loadError")}
          </p>
        ) : !lead ? (
          <p
            data-qa="blog-empty"
            className="min-h-[30vh]"
            style={BODY_TEXT}
          >
            {t("blog.empty")}
          </p>
        ) : (
          <>
            <Entry view={lead} lang={lang} lead tagsLabel={t("blog.tags")} />
            {rest.length > 0 && (
              <div className="mt-20 grid gap-x-12 gap-y-16 md:grid-cols-2">
                {rest.map((view) => (
                  <Entry key={view.post.id} view={view} lang={lang} lead={false} tagsLabel={t("blog.tags")} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default Blog;
