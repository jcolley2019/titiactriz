import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { guideSections, headingId } from "@/lib/guide";
import guideEs from "@/content/guide.es.md?raw";
import guideEn from "@/content/guide.en.md?raw";

/**
 * ADMIN.GUIDE.1 — Guía: how Titi uses the admin, in her words.
 *
 * The text lives in src/content/guide.{es,en}.md and is bundled at build time
 * (Vite `?raw`), picked by the admin's current language. It renders through
 * the same react-markdown + remark-gfm pair the Studio's Generated Content
 * uses, with the admin's shadcn look (BlogManager's AdminMarkdownPreview
 * classes) on a readable ~70ch measure.
 *
 * Every H2 gets an anchor id from its text, and the table of contents at the
 * top scrolls to it. The site header is fixed, so each heading carries a
 * scroll margin that keeps it out from under the header.
 */

const textOf = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
};

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
};

const GuidePanel = () => {
  const { t, i18n } = useTranslation();
  const md = (i18n.language || "es").startsWith("en") ? guideEn : guideEs;
  const lang = md === guideEn ? "en" : "es";
  const sections = useMemo(() => guideSections(md), [md]);

  return (
    <section
      data-qa="admin-guide"
      data-lang={lang}
      className="bg-card border border-border rounded-lg overflow-clip"
    >
      <nav
        data-qa="admin-guide-toc"
        aria-label={t("admin.guide.contents")}
        className="px-6 py-4 border-b border-border"
      >
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
          {t("admin.guide.contents")}
        </p>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {sections.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                data-qa={`admin-guide-toc-${s.id}`}
                onClick={() => scrollTo(s.id)}
                className="text-accent hover:underline underline-offset-4"
              >
                <span className="text-muted-foreground tabular-nums mr-1">{i + 1}.</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <article
        data-qa="admin-guide-body"
        className={[
          "px-6 py-6 max-w-[70ch] text-sm text-foreground leading-relaxed break-words",
          "[&_h1]:font-serif [&_h1]:text-3xl [&_h1]:mb-3",
          "[&_h2]:font-serif [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:pt-6 [&_h2]:border-t [&_h2]:border-border [&_h2]:scroll-mt-28",
          "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_li]:my-1.5 [&_a]:text-accent [&_a]:underline [&_strong]:font-semibold [&_strong]:text-foreground",
          "[&>*:first-child]:mt-0",
        ].join(" ")}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ node: _node, children, ...props }) => (
              <h2 id={headingId(textOf(children))} {...props}>
                {children}
              </h2>
            ),
            a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          }}
        >
          {md}
        </ReactMarkdown>
      </article>
    </section>
  );
};

export default GuidePanel;
