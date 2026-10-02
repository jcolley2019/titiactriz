import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import BlogEntry from "@/components/blog/BlogEntry";
import { BODY_TEXT, GOLD, GOLD_AIR, GOLD_RULE, IVORY, IVORY_DIM, blogRoom } from "@/components/blog/tokens";
import { useBlogPosts } from "@/hooks/useBlogPosts";
import { BLOG_CATEGORIES, GW_KINDS, asGwKind, gwKindLabelKey, type BlogCategory, type GwKind } from "@/lib/blog";

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
 *
 * BLOG.GW.1 — one blog, two lanes. A Green World card wears the lane green
 * (BlogEntry), and ?c=greenworld is its own search result: its own canonical,
 * title, description and intro line. Todo and Personal keep the room's head.
 *
 * BLOG.GW.2 — under Green World, a second, smaller row of the same hairline
 * chips: Todos | Producto | Capacitación | Negocio, in ?k=. ?k= means something
 * only beside ?c=greenworld (anywhere else it is ignored), and a category chip
 * drops it from the address. A kind is its own sitemap entry, so its canonical
 * names it: /blog?c=greenworld&k=<kind>.
 */

type Filter = "all" | BlogCategory;
type KindFilter = "all" | GwKind;

const readFilter = (c: string | null): Filter => (c === "personal" || c === "greenworld" ? c : "all");
const readKind = (k: string | null): KindFilter => asGwKind(k) ?? "all";
const KIND_FILTERS: KindFilter[] = ["all", ...GW_KINDS];

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
 * BLOG.GW.2 — the Green World kinds: the same chips, one size down (a 36px box,
 * the CTA tracking), so the row reads as subordinate to the categories above it.
 */
const KindChips = ({
  active,
  onPick,
  label,
}: {
  active: KindFilter;
  onPick: (k: KindFilter) => void;
  label: string;
}) => {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={label} data-qa="blog-kind-filter" className="mt-3 flex flex-wrap gap-2">
      {KIND_FILTERS.map((k) => {
        const on = k === active;
        return (
          <button
            key={k}
            type="button"
            data-qa={`blog-kind-filter-${k}`}
            aria-pressed={on}
            onClick={() => onPick(k)}
            className="text-caps min-h-9 px-3 py-1.5 tracking-[0.2em] transition-opacity duration-300 hover:opacity-70"
            style={{
              color: on ? IVORY : IVORY_DIM,
              border: `1px solid ${on ? GOLD : GOLD_RULE}`,
              backgroundColor: on ? GOLD_AIR : "transparent",
            }}
          >
            {t(k === "all" ? "blog.kindAll" : gwKindLabelKey(k))}
          </button>
        );
      })}
    </div>
  );
};

const Blog = () => {
  const { t } = useTranslation();
  const { posts, loading, failed, lang } = useBlogPosts();
  const [params, setParams] = useSearchParams();
  const filter = readFilter(params.get("c"));
  // BLOG.GW.1 — the Green World lane is its own search result, with its own head.
  // Todo and Personal keep the room's.
  const gwLane = filter === "greenworld";
  // BLOG.GW.2 — ?k= only counts inside the lane.
  const kind: KindFilter = gwLane ? readKind(params.get("k")) : "all";
  const shown = (filter === "all" ? posts : posts.filter((v) => v.post.category === filter)).filter(
    (v) => kind === "all" || v.post.gwKind === kind,
  );
  const [lead, ...rest] = shown;

  // A category chip starts its lane over: whatever kind was picked leaves the address.
  const pick = (f: Filter) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (f === "all") next.delete("c");
        else next.set("c", f);
        next.delete("k");
        return next;
      },
      { replace: true },
    );

  const pickKind = (k: KindFilter) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (k === "all") next.delete("k");
        else next.set("k", k);
        return next;
      },
      { replace: true },
    );

  return (
    <main data-qa="blog-page" className="relative min-h-screen px-6 pb-24" style={blogRoom}>
      <SEO
        path={gwLane ? `/blog?c=greenworld${kind === "all" ? "" : `&k=${kind}`}` : "/blog"}
        title={t(gwLane ? "blog.gwSeoTitle" : "blog.seoTitle")}
        description={t(gwLane ? "blog.gwSeoDescription" : "blog.seoDescription")}
      />

      <div className="mx-auto max-w-6xl">
        <header className="mb-12 md:mb-16">
          <h1 data-qa="blog-eyebrow" className="text-caps" style={{ color: GOLD }}>
            {t("blog.eyebrow")}
          </h1>
          {/* The one gold hairline the room allows: a rule, not a fill. */}
          <span aria-hidden className="mt-5 block h-px w-16" style={{ backgroundColor: GOLD }} />
          {gwLane && (
            <p data-qa="blog-intro" className="mt-6 max-w-xl" style={BODY_TEXT}>
              {t("blog.gwIntro")}
            </p>
          )}
          {!loading && !failed && posts.length > 0 && (
            <FilterChips active={filter} onPick={pick} label={t("blog.filterLabel")} />
          )}
          {!loading && !failed && posts.length > 0 && gwLane && (
            <KindChips active={kind} onPick={pickKind} label={t("blog.kindFilterLabel")} />
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
            <BlogEntry view={lead} lang={lang} lead tagsLabel={t("blog.tags")} />
            {rest.length > 0 && (
              <div className="mt-20 grid gap-x-12 gap-y-16 md:grid-cols-2">
                {rest.map((view) => (
                  <BlogEntry key={view.post.id} view={view} lang={lang} lead={false} tagsLabel={t("blog.tags")} />
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
