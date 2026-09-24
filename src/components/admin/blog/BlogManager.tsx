import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, ArrowLeft, Check, ExternalLink, ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  localizedSource,
  localizedText,
  setLocalizedText,
  type Lang,
  type Localized,
} from "@/hooks/useEventsBoard";
import { syncLocalizedLong, syncLocalizedRecord } from "@/lib/translate-copy";
import {
  EMPTY_LOCALIZED,
  SLUG_PATTERN,
  formatPostDate,
  localizedIsEmpty,
  parseTags,
  pickLocalized,
  rowToPost,
  slugify,
  type BlogPost,
} from "@/lib/blog";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";
import ImagePicker from "@/components/admin/media/ImagePicker";

/**
 * BLOG.1 — Titi writes, translates and publishes blog posts.
 *
 * Two views in one section: the list of posts, and the editor for one. The
 * editor is the hero copy editor's grammar (HERO.EDIT.1): each text field is ONE
 * Localized field — type in either language, Save fills the other through
 * translate-text, and an "English" / "Spanish" disclosure opens the translation
 * for correction. The body is a document, so it translates in chunks
 * (syncLocalizedLong) and the Save button counts them.
 *
 * Text waits for ONE Save on the pinned, opaque bar (ADMIN.SAVEBAR.1c: lit only
 * while there is unsaved text or a translation still owed). The Published switch
 * is the one instant control, like the Events switches: it writes on the spot.
 *
 * The cover is picked from the gallery and only from the gallery — face law: the
 * picker's upload tile is switched off here.
 */

const FLASH_MS = 1800;
const META_MIN = 150;
const META_MAX = 160;

type FlashState = "saved" | "failed" | undefined;

type Draft = {
  title: Localized;
  excerpt: Localized;
  body: Localized;
  meta_description: Localized;
  slug: string;
  tags: string;
  cover_photo_id: string | null;
};

const EMPTY_DRAFT: Draft = {
  title: EMPTY_LOCALIZED,
  excerpt: EMPTY_LOCALIZED,
  body: EMPTY_LOCALIZED,
  meta_description: EMPTY_LOCALIZED,
  slug: "",
  tags: "",
  cover_photo_id: null,
};

const postToDraft = (p: BlogPost): Draft => ({
  title: p.title,
  excerpt: p.excerpt,
  body: p.body,
  meta_description: p.meta_description,
  slug: p.slug,
  tags: p.tags.join(", "),
  cover_photo_id: p.cover_photo_id,
});

const LOCALIZED_KEYS = ["title", "excerpt", "body", "meta_description"] as const;

/** Characters as a reader counts them. */
const chars = (s: string) => [...s].length;

const uiLang = (language: string | undefined): Lang => ((language || "es").startsWith("en") ? "en" : "es");

/* ---------------- Small parts ---------------- */

const SaveFlash = ({ state, qa }: { state: FlashState; qa: string }) => {
  const { t } = useTranslation();
  if (!state) return null;
  const failed = state === "failed";
  return (
    <span
      data-qa={`flash-${qa}`}
      data-state={state}
      role="status"
      className={`inline-flex items-center gap-1 text-[0.7rem] ${failed ? "text-destructive" : "text-accent"}`}
    >
      {failed ? <AlertTriangle className="w-3 h-3" aria-hidden /> : <Check className="w-3 h-3" aria-hidden />}
      {failed ? t("admin.blog.flashFailed") : t("admin.blog.flashSaved")}
    </span>
  );
};

const StatusPill = ({ status }: { status: BlogPost["status"] }) => {
  const { t } = useTranslation();
  const published = status === "published";
  return (
    <span
      data-qa="blog-status-pill"
      data-status={status}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${
        published ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted-foreground"
      }`}
    >
      {published ? t("admin.blog.statusPublished") : t("admin.blog.statusDraft")}
    </span>
  );
};

/** The admin's markdown preview: shadcn look, NO raw HTML (no rehype-raw). */
export const AdminMarkdownPreview = ({ markdown }: { markdown: string }) => (
  <div
    className={[
      "text-sm text-foreground leading-relaxed break-words",
      "[&_h1]:font-serif [&_h1]:text-2xl [&_h1]:mt-6 [&_h1]:mb-3",
      "[&_h2]:font-serif [&_h2]:text-xl [&_h2]:mt-6 [&_h2]:mb-2",
      "[&_h3]:font-serif [&_h3]:text-lg [&_h3]:mt-5 [&_h3]:mb-2",
      "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
      "[&_li]:my-1 [&_a]:text-accent [&_a]:underline [&_strong]:font-semibold",
      "[&_blockquote]:border-l-2 [&_blockquote]:border-accent/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
      "[&_hr]:my-6 [&_hr]:border-border [&_code]:rounded [&_code]:bg-muted [&_code]:px-1",
      "[&_table]:w-full [&_table]:text-left [&_th]:border-b [&_th]:border-border [&_th]:py-1 [&_td]:py-1",
      "[&_img]:max-w-full [&>*:first-child]:mt-0",
    ].join(" ")}
  >
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
      }}
    >
      {markdown}
    </ReactMarkdown>
  </div>
);

type ControlRender = (qa: string, text: string, set: (t: string) => void) => ReactNode;

/**
 * One Localized field, HeroCopyEditor's FieldEditor without the site defaults:
 * the typed side is the main control; the other language sits in a disclosure.
 */
const LocalizedField = ({
  name,
  label,
  help,
  value,
  error,
  onChange,
  control,
  hint,
}: {
  name: string;
  label: string;
  help?: string;
  value: Localized;
  error?: string | null;
  onChange: (next: Localized) => void;
  control: ControlRender;
  hint?: (text: string, qa: string) => ReactNode;
}) => {
  const { t } = useTranslation();
  const src = localizedSource(value);
  const other: Lang = src === "es" ? "en" : "es";
  const main = localizedText(value);
  // While pending, the other slot is a verbatim copy of what was typed, not a
  // translation — the disclosure does not present it as one (HERO.EDIT.1b).
  const otherText = value.pending ? "" : (value[other] ?? "");
  const id = `blog-${name}`;

  const setMain = (text: string) => onChange(setLocalizedText(value, text));
  // A correction is the owner's own words: no longer pending, never re-translated.
  const setOther = (text: string) => onChange({ ...value, [src]: main, [other]: text, src, pending: false });

  return (
    <div className="space-y-1.5" data-qa={`blog-field-${name}`}>
      <Label htmlFor={id} className="text-foreground text-sm">
        {label}
      </Label>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {control(id, main, setMain)}
      {error && (
        <p data-qa={`blog-error-${name}`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {hint?.(main, `blog-count-${name}`)}
      <details data-qa={`blog-other-${name}`} className="text-xs">
        <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
          {other === "en" ? t("admin.blog.english") : t("admin.blog.spanish")}
          {value.pending && main.trim() && <span className="text-accent"> · {t("admin.blog.translatedOnSave")}</span>}
        </summary>
        <div className="mt-2 space-y-1">
          {control(`${id}-${other}`, otherText, setOther)}
          {hint?.(otherText, `blog-count-${name}-${other}`)}
        </div>
      </details>
    </div>
  );
};

const ConfirmDialog = ({
  open,
  title,
  body,
  confirm,
  qa,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirm: string;
  qa: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent data-qa={qa}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-qa={`${qa}-cancel`}>{t("admin.blog.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            data-qa={`${qa}-confirm`}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/* ---------------- List ---------------- */

const BlogList = ({
  posts,
  loading,
  loadFailed,
  onNew,
  onEdit,
}: {
  posts: BlogPost[];
  loading: boolean;
  loadFailed: boolean;
  onNew: () => void;
  onEdit: (post: BlogPost) => void;
}) => {
  const { t, i18n } = useTranslation();
  const lang = uiLang(i18n.language);

  return (
    <section data-qa="blog-list" className="bg-card border border-border rounded-lg overflow-clip">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div>
          <h2 className="font-serif text-base text-foreground leading-tight">{t("admin.blog.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("admin.blog.subtitle")}</p>
        </div>
        <Button
          type="button"
          size="sm"
          data-qa="blog-new"
          onClick={onNew}
          disabled={loading || loadFailed}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus className="w-4 h-4 mr-1" aria-hidden />
          {t("admin.blog.newPost")}
        </Button>
      </div>

      <div className="border-t border-border">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
          </div>
        ) : loadFailed ? (
          <p data-qa="blog-load-failed" role="alert" className="px-6 py-6 text-sm text-destructive">
            {t("admin.blog.loadError")}
          </p>
        ) : posts.length === 0 ? (
          <div data-qa="blog-empty" className="px-6 py-10 text-center">
            <p className="text-sm text-foreground">{t("admin.blog.empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("admin.blog.emptyHelp")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((post) => {
              const title = pickLocalized(post.title, "es").trim();
              return (
                <li key={post.id} data-qa="blog-row" data-slug={post.slug} className="flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p data-qa="blog-row-title" className="truncate text-sm font-medium text-foreground">
                      {title || t("admin.blog.untitled")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusPill status={post.status} />
                      <span data-qa="blog-row-date">
                        {post.published_at ? formatPostDate(post.published_at, lang) : t("admin.blog.notPublished")}
                      </span>
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" data-qa="blog-row-edit" onClick={() => onEdit(post)}>
                    {t("admin.blog.edit")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

/* ---------------- Editor ---------------- */

const BlogEditor = ({
  post,
  photos,
  onBack,
  onSaved,
  onDeleted,
}: {
  post: BlogPost | null;
  photos: CinematicPhoto[];
  onBack: () => void;
  onSaved: (post: BlogPost) => void;
  onDeleted: (id: string) => void;
}) => {
  const { t, i18n } = useTranslation();
  const lang = uiLang(i18n.language);
  const initial = post ? postToDraft(post) : EMPTY_DRAFT;

  const [postId, setPostId] = useState<string | null>(post?.id ?? null);
  const [fields, setFields] = useState<Draft>(initial);
  /** The draft as the database has it: Discard's target and dirty's baseline. */
  const [committed, setCommitted] = useState<Draft>(initial);
  const [status, setStatus] = useState<BlogPost["status"]>(post?.status ?? "draft");
  const [publishedAt, setPublishedAt] = useState<string | null>(post?.published_at ?? null);
  /** A new post's slug follows the Spanish title until the owner types one. */
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [attempted, setAttempted] = useState(false);
  const [slugError, setSlugError] = useState<"invalid" | "taken" | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ n: number; m: number } | null>(null);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [flash, setFlash] = useState<FlashState>(undefined);
  const [statusFlash, setStatusFlash] = useState<FlashState>(undefined);
  const [statusBusy, setStatusBusy] = useState(false);
  const [bodyTab, setBodyTab] = useState<"write" | "preview">("write");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<CinematicPhoto | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "leave" | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const statusTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(flashTimer.current);
      window.clearTimeout(statusTimer.current);
    },
    [],
  );

  // The cover's thumbnail: from the picker's list, or read by id (an archived
  // photo is still the cover until the owner changes it).
  useEffect(() => {
    const id = fields.cover_photo_id;
    if (!id) {
      setCoverPhoto(null);
      return;
    }
    const known = photos.find((p) => p.id === id);
    if (known) {
      setCoverPhoto(known);
      return;
    }
    let cancelled = false;
    supabase
      .from("gallery_photos")
      .select("id, image_url, alt_text")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCoverPhoto((data as CinematicPhoto | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [fields.cover_photo_id, photos]);

  const dirty = JSON.stringify(fields) !== JSON.stringify(committed);
  const owesTranslation = LOCALIZED_KEYS.some((k) => fields[k].pending && localizedText(fields[k]).trim());
  const canSave = dirty || owesTranslation;

  // Reload, tab close or a typed URL with unsaved text asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const titleMissing = !localizedText(fields.title).trim();
  const bodyMissing = !localizedText(fields.body).trim();

  const showFlash = (state: Exclude<FlashState, undefined>) => {
    setFlash(state);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(undefined), FLASH_MS);
  };

  const showStatusFlash = (state: Exclude<FlashState, undefined>) => {
    setStatusFlash(state);
    window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatusFlash(undefined), FLASH_MS);
  };

  const setTitle = (title: Localized) =>
    setFields((prev) => ({
      ...prev,
      title,
      ...(!postId && !slugTouched ? { slug: slugify(title.es) } : {}),
    }));

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const discard = () => {
    setFields(committed);
    setAttempted(false);
    setSlugError(null);
    if (!postId) setSlugTouched(false);
  };

  const onSave = async () => {
    setAttempted(true);
    setSlugError(null);
    if (titleMissing || bodyMissing) return;
    if (slugTouched && !SLUG_PATTERN.test(fields.slug.trim())) {
      setSlugError("invalid");
      return;
    }
    setSaving(true);
    try {
      const short = await syncLocalizedRecord({
        title: fields.title,
        excerpt: fields.excerpt,
        meta_description: fields.meta_description,
      });
      const body = await syncLocalizedLong(fields.body, (n, m) => setProgress({ n, m }));
      setProgress(null);

      // Auto mode names the post from its Spanish title AFTER translation: a
      // title typed in English gets a Spanish address, like the site.
      const slug =
        !postId && !slugTouched
          ? slugify(short.fields.title.es) || slugify(localizedText(short.fields.title))
          : fields.slug.trim();
      const translated: Draft = { ...fields, ...short.fields, body: body.value, slug };
      // The translations are kept even when the address is refused below.
      setFields(translated);

      if (!SLUG_PATTERN.test(slug)) {
        setSlugError("invalid");
        showFlash("failed");
        return;
      }
      let clash = supabase.from("blog_posts").select("id").eq("slug", slug).limit(1);
      if (postId) clash = clash.neq("id", postId);
      const { data: clashRows, error: clashErr } = await clash;
      if (clashErr) throw clashErr;
      if (clashRows && clashRows.length > 0) {
        setSlugError("taken");
        showFlash("failed");
        return;
      }

      const row = {
        slug,
        title: translated.title,
        excerpt: localizedIsEmpty(translated.excerpt) ? null : translated.excerpt,
        body: translated.body,
        meta_description: localizedIsEmpty(translated.meta_description) ? null : translated.meta_description,
        tags: parseTags(translated.tags),
        cover_photo_id: translated.cover_photo_id,
      };
      const res = postId
        ? await supabase.from("blog_posts").update(row as never).eq("id", postId).select("*").single()
        : await supabase.from("blog_posts").insert(row as never).select("*").single();
      if (res.error) {
        if (res.error.code === "23505") {
          setSlugError("taken");
          showFlash("failed");
          return;
        }
        throw res.error;
      }
      const saved = rowToPost(res.data);
      const stored = postToDraft(saved);
      setPostId(saved.id);
      setSlugTouched(true);
      setFields(stored);
      setCommitted(stored);
      setStatus(saved.status);
      setPublishedAt(saved.published_at);
      setAttempted(false);
      onSaved(saved);
      const failed = short.failed + body.failed;
      setTranslationFailed(failed > 0);
      showFlash("saved");
      if (failed > 0) toast({ title: t("admin.blog.translationFailed"), variant: "destructive" });
    } catch (e) {
      showFlash("failed");
      toast({
        title: t("admin.blog.saveError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setProgress(null);
      setSaving(false);
    }
  };

  /** ADMIN.QOL.1 — instant, like the Events switches. Publishing stamps the date once. */
  const onStatus = async (publish: boolean) => {
    if (!postId) return;
    const patch = publish
      ? { status: "published", published_at: publishedAt ?? new Date().toISOString() }
      : { status: "draft" };
    setStatusBusy(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .update(patch as never)
      .eq("id", postId)
      .select("*")
      .single();
    setStatusBusy(false);
    if (error || !data) {
      showStatusFlash("failed");
      return;
    }
    const saved = rowToPost(data);
    setStatus(saved.status);
    setPublishedAt(saved.published_at);
    showStatusFlash("saved");
    // The list shows the stored row; the editor's unsaved text stays as it is.
    onSaved(saved);
  };

  const onDelete = async () => {
    setConfirm(null);
    if (!postId) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", postId);
    if (error) {
      toast({ title: t("admin.blog.deleteError"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("admin.blog.deleted") });
    onDeleted(postId);
  };

  const back = () => (dirty ? setConfirm("leave") : onBack());

  const busy = saving;
  const metaHint = (text: string, qa: string) => {
    const typed = text.trim();
    if (!typed) return null;
    const n = chars(typed);
    const warning = n < META_MIN ? t("admin.blog.metaShort") : n > META_MAX ? t("admin.blog.metaLong") : null;
    return (
      <p data-qa={qa} data-warn={warning ? "true" : "false"} className="text-xs text-muted-foreground">
        {t("admin.blog.chars", { n })}
        {warning && <span className="text-destructive"> · {warning}</span>}
      </p>
    );
  };

  const input =
    (maxLength: number): ControlRender =>
    (qa, text, set) => (
      <Input
        id={qa}
        data-qa={qa}
        maxLength={maxLength}
        value={text}
        onChange={(e) => set(e.target.value)}
        disabled={busy}
      />
    );

  const textarea =
    (rows: number, maxLength?: number): ControlRender =>
    (qa, text, set) => (
      <Textarea
        id={qa}
        data-qa={qa}
        rows={rows}
        maxLength={maxLength}
        value={text}
        onChange={(e) => set(e.target.value)}
        disabled={busy}
      />
    );

  // The body: write and preview side by side from 1024px, tabs below it.
  const bodyControl: ControlRender = (qa, text, set) => {
    const isMain = qa === "blog-body";
    if (!isMain) return textarea(12)(qa, text, set);
    return (
      <div className="space-y-2">
        <div role="tablist" className="inline-flex rounded-md bg-muted p-1 text-sm lg:hidden">
          {(["write", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={bodyTab === tab}
              data-qa={`blog-body-tab-${tab}`}
              onClick={() => setBodyTab(tab)}
              className={`rounded-sm px-3 py-1 transition-colors ${
                bodyTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab === "write" ? t("admin.blog.write") : t("admin.blog.preview")}
            </button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Textarea
            id={qa}
            data-qa={qa}
            rows={18}
            value={text}
            onChange={(e) => set(e.target.value)}
            disabled={busy}
            className={`min-h-[24rem] font-mono text-[0.8rem] leading-relaxed ${bodyTab === "write" ? "" : "hidden lg:flex"}`}
          />
          <div
            data-qa="blog-body-preview"
            aria-label={t("admin.blog.preview")}
            className={`min-h-[24rem] max-h-[40rem] overflow-y-auto rounded-md border border-border bg-background px-4 py-3 ${
              bodyTab === "preview" ? "" : "hidden lg:block"
            }`}
          >
            {text.trim() ? (
              <AdminMarkdownPreview markdown={text} />
            ) : (
              <p className="text-xs text-muted-foreground italic">{t("admin.blog.previewEmpty")}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const saveLabel = progress
    ? t("admin.blog.translating", { n: progress.n, m: progress.m })
    : saving
      ? t("admin.blog.saving")
      : t("admin.blog.save");

  const published = status === "published";

  return (
    <section
      data-qa="blog-editor"
      data-post-id={postId ?? ""}
      // `overflow-clip`, not `hidden`: a scroll container would cancel the bar's
      // stickiness (ADMIN.QOL.1).
      className="bg-card border border-border rounded-lg overflow-clip"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button type="button" size="sm" variant="ghost" data-qa="blog-back" onClick={back} disabled={busy}>
            <ArrowLeft className="w-4 h-4 mr-1" aria-hidden />
            {t("admin.blog.back")}
          </Button>
          <h2 className="font-serif text-base text-foreground leading-tight truncate">
            {postId ? t("admin.blog.editPost") : t("admin.blog.newPost")}
          </h2>
        </div>
        {postId && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-qa="blog-delete"
            onClick={() => setConfirm("delete")}
            disabled={busy}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-1" aria-hidden />
            {t("admin.blog.delete")}
          </Button>
        )}
      </div>

      <div className="px-6 py-4 space-y-6 border-t border-border">
        {/* Status — the one instant control. */}
        <div className="space-y-1" data-qa="blog-field-status">
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id="blog-status"
              checked={published}
              onCheckedChange={onStatus}
              disabled={!postId || statusBusy || busy}
              data-qa="blog-status"
            />
            <Label htmlFor="blog-status" className="text-foreground text-sm font-medium">
              {t("admin.blog.fieldStatus")}
            </Label>
            <SaveFlash state={statusFlash} qa="blog-status" />
            {published && committed.slug && (
              <a
                href={`/blog/${committed.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                data-qa="blog-view"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                {t("admin.blog.viewPost")}
                <ExternalLink className="w-3 h-3" aria-hidden />
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground" data-qa="blog-status-help">
            {!postId
              ? t("admin.blog.statusNeedsSave")
              : published
                ? t("admin.blog.statusHelpPublished")
                : t("admin.blog.statusHelpDraft")}
            {publishedAt && (
              <span data-qa="blog-published-at">
                {" · "}
                {t("admin.blog.publishedOn", { date: formatPostDate(publishedAt, lang) })}
              </span>
            )}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">{t("admin.blog.autoTranslateHelp")}</p>

        {translationFailed && (
          <p data-qa="blog-translation-failed" role="alert" className="text-xs text-destructive">
            {t("admin.blog.translationFailedHelp")}
          </p>
        )}

        <LocalizedField
          name="title"
          label={t("admin.blog.fieldTitle")}
          value={fields.title}
          error={attempted && titleMissing ? t("admin.blog.titleRequired") : null}
          onChange={setTitle}
          control={input(140)}
        />

        {/* Slug */}
        <div className="space-y-1.5" data-qa="blog-field-slug">
          <Label htmlFor="blog-slug" className="text-foreground text-sm">
            {t("admin.blog.fieldSlug")}
          </Label>
          <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <span className="shrink-0 pl-3 text-xs text-muted-foreground">/blog/</span>
            <input
              id="blog-slug"
              data-qa="blog-slug"
              value={fields.slug}
              maxLength={80}
              onChange={(e) => {
                setSlugTouched(true);
                setSlugError(null);
                setField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
              disabled={busy}
              className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none disabled:opacity-50"
            />
          </div>
          {!postId && !slugTouched && <p className="text-xs text-muted-foreground">{t("admin.blog.slugAuto")}</p>}
          {slugError && (
            <p data-qa="blog-error-slug" data-kind={slugError} role="alert" className="text-xs text-destructive">
              {slugError === "taken" ? t("admin.blog.slugTaken") : t("admin.blog.slugInvalid")}
            </p>
          )}
        </div>

        {/* Cover — from the gallery only (face law). */}
        <div className="space-y-1.5" data-qa="blog-field-cover">
          <Label className="text-foreground text-sm">{t("admin.blog.fieldCover")}</Label>
          <p className="text-xs text-muted-foreground">{t("admin.blog.coverHelp")}</p>
          <div className="flex flex-wrap items-center gap-3">
            {coverPhoto ? (
              <img
                data-qa="blog-cover-thumb"
                src={coverPhoto.image_url}
                alt={coverPhoto.alt_text ?? ""}
                className="h-24 w-36 rounded-md border border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-36 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                <ImageIcon className="w-5 h-5" aria-hidden />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-qa="blog-cover-pick"
                onClick={() => setPickerOpen(true)}
                disabled={busy}
              >
                {fields.cover_photo_id ? t("admin.blog.coverChange") : t("admin.blog.coverPick")}
              </Button>
              {fields.cover_photo_id && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  data-qa="blog-cover-remove"
                  onClick={() => setField("cover_photo_id", null)}
                  disabled={busy}
                >
                  {t("admin.blog.coverRemove")}
                </Button>
              )}
            </div>
          </div>
        </div>

        <LocalizedField
          name="excerpt"
          label={t("admin.blog.fieldExcerpt")}
          help={t("admin.blog.excerptHelp")}
          value={fields.excerpt}
          onChange={(v) => setField("excerpt", v)}
          control={textarea(2, 300)}
        />

        <LocalizedField
          name="body"
          label={t("admin.blog.fieldBody")}
          help={t("admin.blog.bodyHelp")}
          value={fields.body}
          error={attempted && bodyMissing ? t("admin.blog.bodyRequired") : null}
          onChange={(v) => setField("body", v)}
          control={bodyControl}
        />

        {/* Tags */}
        <div className="space-y-1.5" data-qa="blog-field-tags">
          <Label htmlFor="blog-tags" className="text-foreground text-sm">
            {t("admin.blog.fieldTags")}
          </Label>
          <p className="text-xs text-muted-foreground">{t("admin.blog.tagsHelp")}</p>
          <Input
            id="blog-tags"
            data-qa="blog-tags"
            value={fields.tags}
            maxLength={300}
            onChange={(e) => setField("tags", e.target.value)}
            disabled={busy}
          />
        </div>

        <LocalizedField
          name="meta"
          label={t("admin.blog.fieldMeta")}
          help={t("admin.blog.metaHelp")}
          value={fields.meta_description}
          onChange={(v) => setField("meta_description", v)}
          control={textarea(3, 300)}
          hint={metaHint}
        />

        {/* The Events board's bar (ADMIN.SAVEBAR.1c): pinned, opaque, lit only
            while it has work to do. It WRAPS so the warning never clips at
            phone width. */}
        <div
          data-qa="blog-save-bar"
          data-dirty={dirty ? "true" : "false"}
          className="sticky bottom-0 z-40 -mx-6 px-6 py-3 border-t border-border bg-card flex flex-wrap items-center justify-end gap-x-3 gap-y-2"
        >
          {dirty && (
            <span data-qa="blog-unsaved" className="mr-auto inline-flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
              {t("admin.blog.unsaved")}
            </span>
          )}
          {dirty && (
            <Button type="button" size="sm" variant="ghost" data-qa="blog-discard" onClick={discard} disabled={saving}>
              {t("admin.blog.discard")}
            </Button>
          )}
          <SaveFlash state={flash} qa="blog-save" />
          <Button
            type="button"
            onClick={onSave}
            disabled={saving || !canSave}
            data-qa="blog-save"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />}
            {saveLabel}
          </Button>
        </div>
      </div>

      {pickerOpen && (
        <ImagePicker
          open={pickerOpen}
          slotLabel={t("admin.blog.fieldCover")}
          photos={photos}
          currentPhotoId={fields.cover_photo_id}
          allowUpload={false}
          onSelect={(photo) => {
            setField("cover_photo_id", photo.id);
            setCoverPhoto(photo);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <ConfirmDialog
        open={confirm === "delete"}
        qa="blog-delete-dialog"
        title={t("admin.blog.deleteTitle")}
        body={t("admin.blog.deleteBody")}
        confirm={t("admin.blog.deleteConfirm")}
        onConfirm={onDelete}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "leave"}
        qa="blog-leave-dialog"
        title={t("admin.blog.leaveTitle")}
        body={t("admin.blog.leaveBody")}
        confirm={t("admin.blog.leaveConfirm")}
        onConfirm={() => {
          setConfirm(null);
          onBack();
        }}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
};

/* ---------------- Section ---------------- */

const BlogManager = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [photos, setPhotos] = useState<CinematicPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  /** undefined = the list; null = a new post; a post = editing it. */
  const [editing, setEditing] = useState<BlogPost | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [postsRes, photosRes] = await Promise.all([
        supabase.from("blog_posts").select("*").order("created_at", { ascending: false }),
        supabase
          .from("gallery_photos")
          .select("id, image_url, alt_text")
          .eq("is_published", true)
          .eq("is_archived", false)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (postsRes.error) setLoadFailed(true);
      else setPosts((postsRes.data ?? []).map(rowToPost));
      if (photosRes.data) setPhotos(photosRes.data as CinematicPhoto[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSaved = useCallback((saved: BlogPost) => {
    setPosts((prev) =>
      prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev],
    );
  }, []);

  if (editing !== undefined) {
    return (
      <BlogEditor
        key={editing?.id ?? "new"}
        post={editing}
        photos={photos}
        onBack={() => setEditing(undefined)}
        onSaved={onSaved}
        onDeleted={(id) => {
          setPosts((prev) => prev.filter((p) => p.id !== id));
          setEditing(undefined);
        }}
      />
    );
  }

  return (
    <BlogList
      posts={posts}
      loading={loading}
      loadFailed={loadFailed}
      onNew={() => setEditing(null)}
      onEdit={(post) => setEditing(post)}
    />
  );
};

export default BlogManager;
