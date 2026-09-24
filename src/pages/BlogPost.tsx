import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import CoverPlate from "@/components/blog/CoverPlate";
import PostBody from "@/components/blog/PostBody";
import TagChips from "@/components/blog/TagChips";
import { GOLD, IVORY, blogRoom } from "@/components/blog/tokens";
import { useBlogPost } from "@/hooks/useBlogPosts";
import { formatPostDate, readingTimeMinutes } from "@/lib/blog";
import NotFound from "@/pages/NotFound";

/**
 * BLOG.1 — /blog/:slug. The same room as /blog: the cover as the reel's framed
 * plate at the top, the date and reading time as a gold label, the title at the
 * Headline step, and the body in the site's type ramp (PostBody). A draft or an
 * unknown slug is the site's ordinary 404, not a bespoke page.
 *
 * SEO per post through the site's SEO component: the post's own title and
 * description, its canonical URL, the cover as og:image, and Article JSON-LD.
 */

const SITE = "https://titiactriz.com";

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
    mainEntityOfPage: `${SITE}${path}`,
    author: { "@type": "Person", name: "Cristyna Polentino", url: SITE },
    ...(cover ? { image: [cover.image_url] } : {}),
  };

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

        <p data-qa="blog-post-meta" className="text-caps" style={{ color: GOLD }}>
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
        {/* The one gold hairline under the title: a rule, not a fill. */}
        <span aria-hidden className="mt-6 mb-4 block h-px w-16" style={{ backgroundColor: GOLD }} />

        <PostBody markdown={body} />

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
