import { useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TurndownService from "turndown";
import { Check, Copy, Download, ExternalLink, Loader2, Pencil, Send } from "lucide-react";
import { stripThinkingText } from "@/lib/studio/narration";
import { metaFence, parseMetaFence, slugify, type BlogMeta } from "@/lib/studio/publish";
import { STUDIO_PLATFORMS, type StudioOutputs, type StudioPlatform } from "./useStudioGeneration";
import { PLATFORM_LABEL } from "./StudioOutput";

/**
 * BLOG.2 — GENERATED CONTENT (joeyc.ai GeneratedContentTabs): one tab per
 * output. The article previews as it will read and switches to an in-place
 * editor (contentEditable, converted back to markdown with turndown on Done).
 * Social packages show one card per labeled section, with Copy.
 * Every tab: Copy Markdown and a .md download. The article: Publish, which
 * makes a BLOG.1 draft — never a live post.
 */

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });

type Tab = { key: "blog" } | { key: StudioPlatform };

const Markdown = ({ md }: { md: string }) => <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>;

/** The article split into its meta fence and its narration-free body. */
export function articleParts(raw: string): { meta: BlogMeta | null; body: string } {
  return parseMetaFence(stripThinkingText(raw, "blog"));
}

/** A social package's labeled sections ("**🎬 HOOK**" at a line start). */
function socialSections(content: string): { header: string; body: string }[] {
  const re = /\*\*([^*\n]+)\*\*/g;
  const heads: { text: string; index: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const before = content.slice(0, m.index);
    if (m.index === 0 || before.endsWith("\n")) heads.push({ text: m[1].trim(), index: m.index, end: m.index + m[0].length });
  }
  if (heads.length === 0) return [{ header: "", body: content }];
  const out: { header: string; body: string }[] = [];
  const lead = content.slice(0, heads[0].index).trim();
  if (lead) out.push({ header: "", body: lead });
  heads.forEach((h, i) => {
    const body = content.slice(h.end, i + 1 < heads.length ? heads[i + 1].index : content.length).trim();
    out.push({ header: h.text, body });
  });
  return out;
}

/** What a caption field wants: no markdown marks. */
const plainSocial = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2")
    .replace(/^#+\s*/gm, "")
    .replace(/^[-*]\s/gm, "• ");

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Props = {
  outputs: StudioOutputs;
  streaming: boolean;
  onBlogEdited: (raw: string) => void;
  onPublish: () => void;
  publishing: boolean;
  blogPostId: string | null;
  onOpenDraft: () => void;
};

const GeneratedContent = ({ outputs, streaming, onBlogEdited, onPublish, publishing, blogPostId, onOpenDraft }: Props) => {
  const { t } = useTranslation();
  const tabs: Tab[] = useMemo(() => {
    const list: Tab[] = [];
    if (outputs.blog !== undefined) list.push({ key: "blog" });
    for (const p of STUDIO_PLATFORMS) if (outputs.social?.[p] !== undefined) list.push({ key: p });
    return list;
  }, [outputs]);
  const [active, setActive] = useState<Tab["key"] | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState<"text" | "md" | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const current = tabs.find((x) => x.key === active) ?? tabs[0];
  if (!current) return null;

  const isBlog = current.key === "blog";
  const raw = isBlog ? outputs.blog ?? "" : outputs.social?.[current.key as StudioPlatform] ?? "";
  const blog = isBlog ? articleParts(raw) : null;
  const shown = isBlog ? blog!.body : stripThinkingText(raw, "social");
  const title = isBlog ? (/^#\s+(.+)$/m.exec(shown)?.[1] ?? "articulo") : PLATFORM_LABEL[current.key as StudioPlatform];

  const flashCopied = (which: "text" | "md") => {
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1800);
  };
  const copy = async (which: "text" | "md") => {
    await navigator.clipboard.writeText(which === "md" ? shown : plainSocial(shown));
    flashCopied(which);
  };

  const finishEditing = () => {
    if (editorRef.current && blog) {
      const md = turndown.turndown(editorRef.current.innerHTML).trim();
      onBlogEdited(blog.meta ? `${metaFence(blog.meta)}\n\n${md}` : md);
    }
    setEditing(false);
  };

  const pick = (key: Tab["key"]) => {
    if (editing) finishEditing();
    setActive(key);
  };

  return (
    <div data-qa="studio-generated">
      <div className="st-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            className="st-tab"
            data-qa={`studio-tab-${tab.key}`}
            aria-selected={tab.key === current.key}
            onClick={() => pick(tab.key)}
          >
            {tab.key === "blog" ? t("admin.studio.tabArticle") : PLATFORM_LABEL[tab.key]}
          </button>
        ))}
      </div>

      <div className="st-panel" role="tabpanel" data-qa={`studio-panel-${current.key}`}>
        {isBlog && blog?.meta && (
          <div className="mb-4" data-qa="studio-blog-meta">
            {blog.meta.primaryKeyword && <p className="st-caption">SEO · {blog.meta.primaryKeyword}</p>}
            {blog.meta.metaDescription && <p className="st-caption">{blog.meta.metaDescription}</p>}
          </div>
        )}
        {isBlog ? (
          editing ? (
            <div
              ref={editorRef}
              className="st-prose st-editor"
              data-qa="studio-blog-editor"
              contentEditable
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Markdown md={shown} />) }}
            />
          ) : (
            <div className="st-prose" data-qa="studio-blog-preview">
              {shown ? <Markdown md={shown} /> : streaming && <Loader2 className="w-5 h-5 animate-spin" aria-hidden />}
            </div>
          )
        ) : shown ? (
          <div data-qa="studio-social">
            {socialSections(shown).map((s, i) => (
              <div key={i} className="st-social-block">
                {s.header && <div className="st-social-head">{s.header}</div>}
                <div className="st-social-body">{plainSocial(s.body)}</div>
              </div>
            ))}
          </div>
        ) : (
          streaming && <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
        )}
      </div>

      <div className="st-actions">
        {isBlog && (
          <button
            type="button"
            className="st-btn"
            data-qa="studio-edit"
            aria-pressed={editing}
            onClick={() => (editing ? finishEditing() : setEditing(true))}
            disabled={streaming || !shown}
          >
            {editing ? <Check className="w-4 h-4" aria-hidden /> : <Pencil className="w-4 h-4" aria-hidden />}
            {editing ? t("admin.studio.doneEditing") : t("admin.studio.edit")}
          </button>
        )}
        {isBlog &&
          (blogPostId ? (
            <button type="button" className="st-btn st-btn-primary" data-qa="studio-open-draft" onClick={onOpenDraft}>
              <ExternalLink className="w-4 h-4" aria-hidden />
              {t("admin.studio.openDraft")}
            </button>
          ) : (
            <button
              type="button"
              className="st-btn st-btn-primary"
              data-qa="studio-publish"
              onClick={() => {
                if (editing) finishEditing();
                onPublish();
              }}
              disabled={streaming || publishing || !shown}
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
              {publishing ? t("admin.studio.publishing") : t("admin.studio.publish")}
            </button>
          ))}
        {!isBlog && (
          <button type="button" className="st-btn" data-qa="studio-copy" onClick={() => copy("text")} disabled={!shown}>
            {copied === "text" ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />}
            {copied === "text" ? t("admin.studio.copied") : t("admin.studio.copy")}
          </button>
        )}
        <button type="button" className="st-btn" data-qa="studio-copy-md" onClick={() => copy("md")} disabled={!shown || editing}>
          {copied === "md" ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />}
          {copied === "md" ? t("admin.studio.copied") : t("admin.studio.copyMarkdown")}
        </button>
        <button
          type="button"
          className="st-btn"
          data-qa="studio-download"
          onClick={() => download(shown, `${slugify(title) || current.key}.md`)}
          disabled={!shown || editing}
        >
          <Download className="w-4 h-4" aria-hidden />
          {t("admin.studio.download")}
        </button>
      </div>
    </div>
  );
};

export default GeneratedContent;
