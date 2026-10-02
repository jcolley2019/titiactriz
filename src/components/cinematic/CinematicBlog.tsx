import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CoverPlate from "@/components/blog/CoverPlate";
import { BODY_TEXT, GOLD, GOLD_RULE, IVORY, LANE_GREEN, META_SEP } from "@/components/blog/tokens";
import { useBlogPosts, type BlogView } from "@/hooks/useBlogPosts";
import type { Lang } from "@/hooks/useEventsBoard";
import { formatPostDateShort, gwKindLabelKey } from "@/lib/blog";
import { FIELD_GROUND } from "./FramedVideo";

gsap.registerPlugin(ScrollTrigger);

/** Up to four posts: one row on desktop, a 2×2 on tablet, four tiles on a phone. */
const BLOG_ACT_COUNT = 4;

/** The lane's frame on a phone tile: the structure band (0.4), gold or lane green. */
const LANE_FRAME = "hsl(var(--gw-lane) / 0.4)";

/**
 * HOME.BLOGACT.1 — the Blog act, between the gallery and Green World (the slot
 * the Book act held, empty since EVENTS.2).
 *
 * The newest published posts, up to four, from the blog's own hook — the act
 * adds no fetch of its own. Two compositions, chosen in cinematic.css:
 *
 *   • ≥768 — Entry-style cards (the blog's own grammar: the cover as the reel's
 *     framed plate, then unboxed type — a text-caps date line, the title in the
 *     display face, the excerpt). One row of four at ≥1024, a 2×2 below it —
 *     but only in a frame ≥1140px tall, the 2×2's measured worst case
 *     (HOME.BLOGACT.1a). A shorter tablet frame (768×1024) takes the tiles.
 *   • <768 — COMPACT TILES in the TitiLinks link-card idiom: full-width,
 *     stacked, 68px each, a 1px frame and a left lane hairline, the category
 *     label and date on one text-caps line and the title on the next (one line,
 *     ellipsis). No cover, no excerpt — so all four, the act's title and its
 *     footer links share one phone screen.
 *
 * One filament: gold, with the Lane Green (BLOG.GW.1) as the ratified
 * exception — a greenworld post walks its lane here exactly as it does on
 * /blog: the left hairline, the date line and the label, and on a tile the
 * frame. Line and letter only.
 *
 * ## Motion — the Book act's mechanism, not the reel's
 *
 *   1. The ENTRANCE: a timeline scrubbed linearly over the act's arrival
 *      (`top 78%` → `top 22%`). The title line and the gold hairline arrive
 *      first, then the cards (desktop, left → right, rising from +60px) or the
 *      tiles (phone, top → bottom, from +24px) settle in, staggered.
 *   2. The DWELL: the story acts' price, `+=120%`. The entrance is complete at
 *      `top 22%`, before the pin engages at `top top`, so the hold always begins
 *      on a settled frame. Pinning fixes the stage's place and nothing else:
 *      every card and tile stays a live link through the hold.
 *
 * Posts arrive after first paint, i.e. after every act below has measured, so
 * the pin is `ScrollTrigger.sort()`ed into document order and refreshed — the
 * repair every late pin on this page carries. Reduced motion builds neither:
 * the act renders static, settled, unpinned, and still fills its stage.
 *
 * ## The late-mount law (CinematicEvents)
 *
 * The SECTION is in the DOM at every paint. With no published posts (or while
 * they load) it is empty — no room, no heading, no height, no trigger — so the
 * gallery hands straight to Green World. It never returns null: GSAP pins by
 * wrapping elements in `pin-spacer` divs, and a section inserted late beside
 * pinned neighbours lands against a DOM React no longer recognises.
 */
const CinematicBlog = ({ reduced }: { reduced: boolean }) => {
  const { t } = useTranslation();
  const { posts, loading, lang } = useBlogPosts();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const shown = posts.slice(0, BLOG_ACT_COUNT);
  const lit = !loading && shown.length > 0;
  const anyGreenWorld = shown.some((v) => v.post.category === "greenworld");

  useLayoutEffect(() => {
    if (reduced || !lit) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const ctx = gsap.context(() => {
      const q = (sel: string) => Array.from(section.querySelectorAll<HTMLElement>(sel));

      // The entrance, scrubbed and linear (`ease: "none"`): travel maps to the
      // scrollbar exactly, and it is complete at `top 22%`.
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: section, start: "top 78%", end: "top 22%", scrub: true },
      });

      // First: the title line, with the gold hairline drawn across it.
      q("[data-blog-act-head]").forEach((el, i) =>
        tl.fromTo(el, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 }, i * 0.06),
      );
      q("[data-blog-act-rule]").forEach((el) =>
        tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 0.3 }, 0.06),
      );

      // Then the posts, in reading order. Only one of the two compositions is
      // displayed at a time; the other's tweens run on boxes nobody sees.
      q("[data-blog-act-card]").forEach((el, i) =>
        tl.fromTo(el, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.3 + i * 0.12),
      );
      q("[data-blog-act-tile]").forEach((el, i) =>
        tl.fromTo(el, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.3 + i * 0.12),
      );
      q("[data-blog-act-foot]").forEach((el) =>
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.76),
      );

      // The uniform dwell law: the story acts' one price, +=120%.
      ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: "+=120%",
        pin: true,
        anticipatePin: 1,
      });
    }, section);

    // Born after the acts below measured: sort into document order, then
    // refresh, or every later act is staled by this pin's own distance.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();

    return () => ctx.revert();
  }, [reduced, lit, shown.length]);

  if (!lit) {
    return <section ref={sectionRef} data-qa="cinematic-blog" data-empty="true" aria-hidden />;
  }

  return (
    <section ref={sectionRef} data-qa="cinematic-blog" className="relative w-full">
      <div
        ref={stageRef}
        data-qa="blog-act-stage"
        data-posts={shown.length}
        className="cine-act-vh relative flex w-full flex-col items-center px-6 pb-16 pt-24"
        // `safe center`: if a stage is ever shorter than its content, the
        // overflow falls off the bottom, never the heading off the top.
        style={{ backgroundColor: FIELD_GROUND, justifyContent: "safe center" }}
      >
        <div className="flex flex-col items-center text-center">
          <p data-blog-act-head data-qa="blog-act-eyebrow" className="text-caps" style={{ color: GOLD }}>
            {t("home.blogAct.eyebrow")}
          </p>
          {/* The one gold hairline: a rule, not a fill. */}
          <span
            aria-hidden
            data-blog-act-rule
            data-qa="blog-act-rule"
            className="mt-4 block h-px w-16"
            style={{ backgroundColor: GOLD }}
          />
          <h2
            data-blog-act-head
            data-qa="section-heading"
            className="mt-4 md:mt-6"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              color: IVORY,
              // DESIGN.md Headline, exactly.
              fontSize: "clamp(1.75rem, 4vw, 3.25rem)",
              lineHeight: 1.15,
            }}
          >
            {t("home.blogAct.title")}
          </h2>
        </div>

        {/* ≥768: Entry-style cards. A short row centres rather than hugging the
            left. Which list shows is cinematic.css's call (.blog-act-cards /
            .blog-act-tiles): a tablet frame too short for the 2×2 takes tiles. */}
        <ul
          data-qa="blog-act-cards"
          className="blog-act-cards mt-10 w-full max-w-xl flex-wrap justify-center gap-8 lg:mt-12 lg:max-w-6xl"
        >
          {shown.map((v) => (
            <li
              key={v.post.id}
              data-blog-act-card
              className="w-full md:w-[calc(50%-1rem)] lg:w-[calc(25%-1.5rem)]"
            >
              <ActCard view={v} lang={lang} />
            </li>
          ))}
        </ul>

        {/* <768 (and short tablet frames): compact tiles, the TitiLinks link-card idiom. */}
        <ul data-qa="blog-act-tiles" className="blog-act-tiles mt-8 w-full max-w-lg flex-col gap-2.5">
          {shown.map((v) => (
            <li key={v.post.id} data-blog-act-tile>
              <ActTile view={v} lang={lang} />
            </li>
          ))}
        </ul>

        <div
          data-blog-act-foot
          data-qa="blog-act-footer"
          className="mt-6 flex flex-wrap items-center justify-center gap-x-10 md:mt-10"
        >
          <Link
            to="/blog"
            data-qa="blog-act-all"
            className="text-caps inline-flex items-center gap-2 py-2 transition-colors duration-300 hover:text-gold-light"
            style={{ color: GOLD }}
          >
            {t("home.blogAct.all")}
            <span aria-hidden>→</span>
          </Link>
          {anyGreenWorld && (
            <Link
              to="/blog?c=greenworld"
              data-qa="blog-act-gw"
              className="text-caps inline-flex items-center gap-2 py-2"
              style={{ color: LANE_GREEN }}
            >
              <span translate="no">{t("home.blogAct.greenWorld")}</span>
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

/**
 * The category label and the short date, as one text-caps run. BLOG.GW.2 — a
 * greenworld post with a kind names it after the label: "Green World · Producto".
 * BLOG.GW.2a — `kindLeads` (the phone tile, whose green frame already carries
 * Green World) drops the label for the kind: "Capacitación · 16 sept 2026".
 */
const MetaLine = ({
  view,
  lang,
  label,
  kindLeads = false,
}: {
  view: BlogView;
  lang: Lang;
  label: boolean;
  kindLeads?: boolean;
}) => {
  const { t } = useTranslation();
  const gw = view.post.category === "greenworld";
  const kind = gw && label ? view.post.gwKind : null;
  const named = label && !(kindLeads && kind);
  const published = view.post.published_at;
  const name = gw ? t("home.blogAct.labelGreenWorld") : t("home.blogAct.labelPersonal");
  return (
    <>
      {named && <span translate={gw ? "no" : undefined}>{name}</span>}
      {kind && (
        <>
          {named && META_SEP}
          <span data-qa="blog-act-kind" data-kind={kind}>
            {t(gwKindLabelKey(kind))}
          </span>
        </>
      )}
      {label && published && META_SEP}
      {published && (
        <time dateTime={published} className="whitespace-nowrap">
          {formatPostDateShort(published, lang)}
        </time>
      )}
    </>
  );
};

/**
 * One post as the blog's Entry, sized for a row of four: cover plate, date line
 * (a greenworld post leads it with its label, in the lane green, and walks the
 * lane's 1px left hairline), title, excerpt. Unboxed: no fill, no shadow, no
 * radius.
 *
 * The lane hairline stands in the GUTTER, half the row's gap to the card's
 * left, rather than padding the card as /blog does: in a row of four, a padded
 * card's plate came out 20px narrower and shorter than its neighbours', and the
 * row stopped reading as one line of plates.
 */
const ActCard = ({ view, lang }: { view: BlogView; lang: Lang }) => {
  const lane = view.post.category;
  const gw = lane === "greenworld";
  return (
    <article
      data-qa="blog-act-card"
      data-slug={view.post.slug}
      data-lane={lane}
      className="group relative h-full"
    >
      {gw && (
        <span
          aria-hidden
          data-qa="blog-act-card-rule"
          className="absolute inset-y-0 -left-4 w-px"
          style={{ backgroundColor: LANE_GREEN }}
        />
      )}
      <Link to={`/blog/${view.post.slug}`} className="block text-left">
        {view.cover && <CoverPlate cover={view.cover} qa="blog-act-cover" />}
        <div className={view.cover ? "mt-5" : undefined}>
          {(view.post.published_at || gw) && (
            <p data-qa="blog-act-card-date" className="text-caps" style={{ color: gw ? LANE_GREEN : GOLD }}>
              <MetaLine view={view} lang={lang} label={gw} />
            </p>
          )}
          <h3
            data-qa="blog-act-card-title"
            className="mt-3 line-clamp-2 leading-tight transition-colors duration-300 group-hover:text-gold-light"
            style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "1.75rem", color: IVORY }}
          >
            {view.title}
          </h3>
          {view.excerpt.trim() && (
            <p data-qa="blog-act-card-excerpt" className="mt-3 line-clamp-2" style={BODY_TEXT}>
              {view.excerpt}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
};

/**
 * One post as a link-in-bio row: 68px, sharp-cornered, a 1px frame at the
 * structure band and a solid lane hairline down its left edge — gold for a
 * personal post, the lane green for a greenworld one. The frame is an overlay,
 * not the link's own outline, so keyboard focus keeps its native ring.
 */
const ActTile = ({ view, lang }: { view: BlogView; lang: Lang }) => {
  const lane = view.post.category;
  const gw = lane === "greenworld";
  const ink = gw ? LANE_GREEN : GOLD;
  return (
    <Link
      to={`/blog/${view.post.slug}`}
      data-qa="blog-act-tile"
      data-slug={view.post.slug}
      data-lane={lane}
      className="group relative flex h-[68px] flex-col justify-center px-4 text-left"
    >
      <span
        aria-hidden
        data-qa="blog-act-tile-frame"
        className="pointer-events-none absolute inset-0 border"
        style={{ borderColor: gw ? LANE_FRAME : GOLD_RULE }}
      />
      <span
        aria-hidden
        data-qa="blog-act-tile-rule"
        className="pointer-events-none absolute inset-y-0 left-0 w-px"
        style={{ backgroundColor: ink }}
      />
      <span data-qa="blog-act-tile-meta" className="text-caps block truncate" style={{ color: ink }}>
        <MetaLine view={view} lang={lang} label kindLeads />
      </span>
      <span
        data-qa="blog-act-tile-title"
        className="mt-1.5 block truncate transition-colors duration-300 group-hover:text-gold-light"
        style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", lineHeight: 1.4, color: IVORY }}
      >
        {view.title}
      </span>
    </Link>
  );
};

export default CinematicBlog;
