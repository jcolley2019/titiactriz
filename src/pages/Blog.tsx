import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import CoverPlate from "@/components/blog/CoverPlate";
import TagChips from "@/components/blog/TagChips";
import { BODY_TEXT, GOLD, GOLD_AIR, GOLD_RULE, IVORY, IVORY_DIM, LANE_GREEN, blogRoom } from "@/components/blog/tokens";
import { useBlogPosts, type BlogView } from "@/hooks/useBlogPosts";
import { BLOG_CATEGORIES, formatPostDate, type BlogCategory } from "@/lib/blog";
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
 *
 * STUDIO.VOICES.1 — a filter row under the eyebrow: Todo | Personal | Green
 * World, three quiet hairline chips (the tags' own grammar). The pick lives in
 * the address (?c=personal|greenworld), so a filtered list can be shared, and it
 * changes with no reload; anything else in ?c= is Todo.
 */

type Filter = "all" | BlogCategory;

const readFilter = (c: string | null): Filter => (c === "personal" || c === "greenworld" ? c : "all");

const FILTERS: Filter[] = ["all", ...BLOG_CATEGORIES];

const FILTER_LABEL: Record<Filter, string> = {
  all: "blog.filterAll",
  personal: "blog.filterPersonal",
  greenworld: "blog.filterGreenWorld",
};

/** Quiet at rest: a 0.4 gold hairline, no fill. The chosen one takes the filament and the wash. */
const FilterChips = ({
  active,
  onPick,
  label,
}: {
  active: Filter;
  onPick: (f: Filter) => void;
  label: string;
}) => {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={label} data-qa="blog-filter" className="mt-8 flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const on = f === active;
        return (
          <button
            key={f}
            type="button"
            data-qa={`blog-filter-${f}`}
            aria-pressed={on}
            onClick={() => onPick(f)}
            className="text-caps min-h-11 px-4 py-2 transition-opacity duration-300 hover:opacity-70"
            style={{
              color: on ? IVORY : IVORY_DIM,
              border: `1px solid ${on ? GOLD : GOLD_RULE}`,
              backgroundColor: on ? GOLD_AIR : "transparent",
            }}
          >
            {t(FILTER_LABEL[f])}
          </button>
        );
      })}
    </div>
  );
};

/**
 * BLOG.GW.1 — a Green World post walks its own lane: a 1px hairline down the
 * card's left edge (the gold-hairline grammar, in the lane green), the date line
 * in the lane green, and "Green World" in text caps before the date. A personal
 * card is exactly what it was.
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
}) => {
  const { t } = useTranslation();
  const lane = view.post.category;
  const gw = lane === "greenworld";
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
              {gw && published && " · "}
              {published && <time dateTime={published}>{formatPostDate(published, lang)}</time>}
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
};

const Blog = () => {
  const { t } = useTranslation();
  const { posts, loading, failed, lang } = useBlogPosts();
  const [params, setParams] = useSearchParams();
  const filter = readFilter(params.get("c"));
  const shown = filter === "all" ? posts : posts.filter((v) => v.post.category === filter);
  const [lead, ...rest] = shown;

  const pick = (f: Filter) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (f === "all") next.delete("c");
        else next.set("c", f);
        return next;
      },
      { replace: true },
    );

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
          {!loading && !failed && posts.length > 0 && (
            <FilterChips active={filter} onPick={pick} label={t("blog.filterLabel")} />
          )}
        </header>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          </div>
        ) : failed ? (
          <p data-qa="blog-load-failed" role="alert" style={BODY_TEXT}>
            {t("blog.loadError")}
          </p>
        ) : posts.length === 0 ? (
          <p
            data-qa="blog-empty"
            className="min-h-[30vh]"
            style={BODY_TEXT}
          >
            {t("blog.empty")}
          </p>
        ) : !lead ? (
          <p data-qa="blog-filter-empty" className="min-h-[30vh]" style={BODY_TEXT}>
            {t("blog.filterEmpty")}
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
