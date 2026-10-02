import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import BlogEntry from "@/components/blog/BlogEntry";
import CoverPlate from "@/components/blog/CoverPlate";
import PostBody from "@/components/blog/PostBody";
import TagChips from "@/components/blog/TagChips";
import { GOLD, IVORY, LANE_GREEN, blogRoom } from "@/components/blog/tokens";
import { useBlogPost, useBlogPosts } from "@/hooks/useBlogPosts";
import { categorySection, formatPostDate, readingTimeMinutes } from "@/lib/blog";
import { SITE, breadcrumbLd, extractFaq, faqPageLd } from "@/lib/blog/schema";
import NotFound from "@/pages/NotFound";

/**
 * BLOG.1 — /blog/:slug. The same room as /blog: the cover as the reel's framed
 * plate at the top, the date and reading time as a gold label, the title at the
 * Headline step, and the body in the site's type ramp (PostBody). A draft or an
 * unknown slug is the site's ordinary 404, not a bespoke page.
 *
 * SEO per post through the site's SEO component: the post's own title and
 * description, its canonical URL, the cover as og:image, and Article JSON-LD —
 * plus (BLOG.SEO.1) FAQPage when the body has a questions section, and
 * BreadcrumbList always. STUDIO.VOICES.1 — the Article names its category as
 * articleSection ("Personal" | "Green World").
 *
 * BLOG.GW.1 — a Green World post wears its lane: "Green World" in text caps
 * above the date, the meta line and the rule under the title in the lane green,
 * and a Green World crumb (→ /blog?c=greenworld) in its BreadcrumbList. Above
 * the tags, up to three more posts from the same lane, newest first, as /blog's
 * own cards: "Más de Green World", or "Más del blog" for a personal post.
 */

/** How many other posts the "Más de…" row shows. */
const MORE_COUNT = 3;

/** The site's quietest gold grammar — the /events way out, verbatim. */
const BackLink = ({ label, qa }: { label: string; qa: string }) => (
  <Link
    to="/blog"
    data-qa={qa}
    className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] transition-colors duration-300 hover:text-gold-light"
    style={{ color: GOLD }}
  >
    <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
    {label}
  </Link>
);

const BlogPost = () => {
  const { t } = useTranslation();
  const { slug } = useParams();
  const { view, loading, notFound, lang } = useBlogPost(slug);
  const { posts } = useBlogPosts();

  if (notFound) return <NotFound />;

  if (loading || !view) {
    return (
      <main className="min-h-screen px-6" style={blogRoom}>
        <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        </div>
      </main>
    );
  }

  const { post, cover, title, excerpt, body, metaDescription } = view;
  const path = `/blog/${post.slug}`;
  const description = metaDescription.trim() || excerpt.trim() || t("blog.seoDescription");
  const published = post.published_at ?? post.created_at;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished: published,
    dateModified: post.updated_at,
    inLanguage: lang,
    articleSection: categorySection(post.category),
    mainEntityOfPage: `${SITE}${path}`,
    author: { "@type": "Person", name: "Cristyna Polentino", url: SITE },
    ...(cover ? { image: [cover.image_url] } : {}),
  };
  const faq = extractFaq(body);
  const gw = post.category === "greenworld";
  const lane = gw ? LANE_GREEN : GOLD;
  const more = posts.filter((v) => v.post.category === post.category && v.post.slug !== post.slug).slice(0, MORE_COUNT);

  return (
    <main data-qa="blog-post" className="relative min-h-screen px-6 pb-24" style={blogRoom}>
      <SEO
        path={path}
        title={`${title} | Cristyna Polentino`}
        description={description}
        type="article"
        {...(cover ? { image: cover.image_url } : {})}
      >
        <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
        {faq.length >= 2 && <script type="application/ld+json">{JSON.stringify(faqPageLd(faq))}</script>}
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd(lang, title, path, post.category))}</script>
      </SEO>

      <article className="mx-auto max-w-3xl">
        <div className="mb-8">
          <BackLink label={t("blog.back")} qa="blog-back" />
        </div>

        {cover && (
          <div className="mb-10 md:mb-14">
            <CoverPlate cover={cover} qa="blog-post-cover" eager />
          </div>
        )}

        {gw && (
          <p data-qa="blog-post-label" className="text-caps mb-3" style={{ color: LANE_GREEN }} translate="no">
            {t("blog.gwLabel")}
          </p>
        )}
        <p data-qa="blog-post-meta" className="text-caps" style={{ color: lane }}>
          {post.published_at && (
            <time dateTime={post.published_at}>{formatPostDate(post.published_at, lang)}</time>
          )}
          {post.published_at && " · "}
          {t("blog.readingTime", { n: readingTimeMinutes(body) })}
        </p>

        <h1
          data-qa="blog-post-title"
          className="mt-4"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: "clamp(1.75rem, 4vw, 3.25rem)",
            lineHeight: 1.15,
            color: IVORY,
          }}
        >
          {title}
        </h1>
        {/* The one hairline under the title: a rule, not a fill — gold, or the lane green. */}
        <span
          aria-hidden
          data-qa="blog-post-rule"
          className="mt-6 mb-4 block h-px w-16"
          style={{ backgroundColor: lane }}
        />

        <PostBody markdown={body} />

        {more.length > 0 && (
          <section data-qa="blog-more" data-lane={post.category} aria-labelledby="blog-more-title" className="mt-16">
            <h2 id="blog-more-title" data-qa="blog-more-title" className="text-caps" style={{ color: GOLD }}>
              {t(gw ? "blog.moreGreenWorld" : "blog.moreBlog")}
            </h2>
            <span aria-hidden className="mt-5 block h-px w-16" style={{ backgroundColor: GOLD }} />
            <div className="mt-10 grid gap-x-12 gap-y-16 md:grid-cols-2">
              {more.map((v) => (
                <BlogEntry
                  key={v.post.id}
                  view={v}
                  lang={lang}
                  lead={false}
                  tagsLabel={t("blog.tags")}
                  titleAs="h3"
                />
              ))}
            </div>
          </section>
        )}

        {post.tags.length > 0 && (
          <div className="mt-12">
            <TagChips tags={post.tags} qa="blog-post-tags" label={t("blog.tags")} />
          </div>
        )}

        <div className="mt-16">
          <BackLink label={t("blog.back")} qa="blog-back-end" />
        </div>
      </article>
    </main>
  );
};

export default BlogPost;
