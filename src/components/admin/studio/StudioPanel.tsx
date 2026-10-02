import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import type { Lang } from "@/hooks/useEventsBoard";
import { useAdminNav } from "@/components/admin/AdminShell";
import { useAdminTheme } from "@/components/admin/adminTheme";
import { useCoachHold } from "@/components/admin/coach/CoachProvider";
import { studioDraft, uniqueSlug } from "@/lib/studio/publish";
import { DEFAULT_VOICE, VOICE_PICK_KEY, asVoice, type VoiceName } from "@/lib/voices";
import { asGwKind, isHttpUrl, type GwKind } from "@/lib/blog";
import { stripThinkingText } from "@/lib/studio/narration";
import StudioInput from "./StudioInput";
import StudioOutput from "./StudioOutput";
import GeneratedContent from "./GeneratedContent";
import StudioHistory, { rowOutputs, type GenerationRow } from "./StudioHistory";
import VoiceDrawer from "./VoiceDrawer";
import { useStudioGeneration, type InputKind, type StudioFormat, type StudioPlatform } from "./useStudioGeneration";
import "@/styles/studio.css";

/**
 * BLOG.2 — Titi's Content Studio (Admin › Estudio), ported from the joeyc.ai
 * Command Center. INPUT (brain dump / YouTube) · OUTPUT (formats, platforms,
 * language, Generate) · GENERATED CONTENT (tabs) · HISTORY.
 *
 * Publish never publishes: it writes a BLOG.1 DRAFT in the output language,
 * the other language pending, and lands on the Blog tab with it open.
 *
 * STUDIO.VOICES.1 — Voz (Personal / Green World) is picked above Idioma and
 * remembered per device. The press is written in it, and the draft a Publish
 * writes lands in the blog category of the same name.
 *
 * BLOG.GW.2 — a Green World press is also written as a kind (Tipo, Producto by
 * default on every mount) and, for Producto, about a product (name and link,
 * both optional). Every call names them, the row keeps the kind, and Publicar
 * writes kind and product to the draft. A reopened row brings its kind back;
 * the product is not stored on the row, so it is filled in on the draft.
 *
 * ADMIN.THEME.1 — the Studio's wrapper wears the admin's theme (the header's
 * Sun/Moon), so studio.css keeps drawing both palettes from .studio[data-theme].
 */

const StudioPanel = () => {
  const { t, i18n } = useTranslation();
  const nav = useAdminNav();
  const { theme } = useAdminTheme();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const closeVoice = useCallback(() => setVoiceOpen(false), []);

  const [kind, setKind] = useState<InputKind>("brain_dump");
  const [brainDump, setBrainDump] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [transcript, setTranscript] = useState("");

  const [formats, setFormats] = useState<StudioFormat[]>(["social"]);
  const [platforms, setPlatforms] = useState<StudioPlatform[]>(["tiktok"]);
  const [language, setLanguage] = useState<Lang>((i18n.language || "es").startsWith("en") ? "en" : "es");
  const [voice, setVoice] = useState<VoiceName>(() => {
    try {
      return asVoice(localStorage.getItem(VOICE_PICK_KEY));
    } catch {
      return DEFAULT_VOICE; // storage blocked
    }
  });
  const pickVoice = (v: VoiceName) => {
    setVoice(v);
    try {
      localStorage.setItem(VOICE_PICK_KEY, v);
    } catch {
      /* storage blocked: the pick lasts until the page reloads */
    }
  };
  // BLOG.GW.2 — the Green World kind and its product; Producto on every mount.
  const [gwKind, setGwKind] = useState<GwKind>("producto");
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const productUrlInvalid =
    voice === "greenworld" && gwKind === "producto" && !!productUrl.trim() && !isHttpUrl(productUrl);
  // STUDIO.SPEED.2 — false on every mount, never persisted.
  const [webSearch, setWebSearch] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const generatedRef = useRef<HTMLElement>(null);

  const g = useStudioGeneration();
  // ADMIN.COACH.1 — no tip ever sits over a running generation.
  useCoachHold(g.generating);
  const inputText = kind === "youtube" ? transcript : brainDump;

  const onGenerate = () =>
    g.generate({
      inputKind: kind,
      inputText,
      sourceUrl: kind === "youtube" ? ytUrl.trim() || null : null,
      formats,
      platforms,
      language,
      voice,
      webSearch,
      gw: voice === "greenworld" ? { kind: gwKind, productName, productUrl } : null,
    });

  const saveOutputs = useCallback(
    async (id: string | null, outputs: unknown) => {
      if (!id) return;
      await supabase.from("studio_generations").update({ outputs: outputs as Json }).eq("id", id);
    },
    [],
  );

  const onBlogEdited = (raw: string) => {
    const gen = g.generation;
    if (!gen) return;
    const outputs = { ...gen.outputs, blog: raw };
    g.setGeneration({ ...gen, outputs });
    void saveOutputs(gen.id, outputs);
  };

  const onPublish = async () => {
    const gen = g.generation;
    if (!gen?.outputs.blog) return;
    const res = studioDraft(stripThinkingText(gen.outputs.blog, "blog"), gen.language, gen.voice, gen.gw);
    if (!res.ok) {
      toast({ title: t("admin.studio.publishEmpty"), variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      const { data: taken, error: takenErr } = await supabase
        .from("blog_posts")
        .select("slug")
        .like("slug", `${res.draft.slug}%`);
      if (takenErr) throw takenErr;
      const slug = uniqueSlug(res.draft.slug, (taken ?? []).map((r) => r.slug));
      const { data, error } = await supabase
        .from("blog_posts")
        .insert({ ...res.draft, slug } as never)
        .select("id")
        .single();
      if (error) throw error;
      const postId = (data as { id: string }).id;
      if (gen.id) await supabase.from("studio_generations").update({ blog_post_id: postId }).eq("id", gen.id);
      g.setGeneration({ ...gen, blogPostId: postId });
      nav.goTo("blog", { postId });
    } catch (e) {
      toast({
        title: t("admin.studio.publishError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  const onReopen = (row: GenerationRow) => {
    g.setError(null);
    g.setGeneration({
      id: row.id,
      outputs: rowOutputs(row),
      language: row.language === "en" ? "en" : "es",
      voice: asVoice(row.voice),
      gw: asVoice(row.voice) === "greenworld" ? { kind: asGwKind(row.gw_kind) } : null,
      blogPostId: row.blog_post_id,
    });
    generatedRef.current?.scrollIntoView({ block: "start" });
  };

  // STUDIO.HISTORY.1 — the deleted generation was the one open in Contenido
  // generado: back to the empty state.
  const onDeleted = (id: string) => {
    if (g.generation?.id === id) g.setGeneration(null);
  };

  const errorText = (e: string) =>
    e === "cancelled" ? t("admin.studio.cancelled") : e === "tooLong" ? t("admin.studio.tooLong") : e;

  const statusText = {
    researching: t("admin.studio.statusResearching"),
    writing: t("admin.studio.statusWriting"),
    adapting: t("admin.studio.statusAdapting"),
    generating: t("admin.studio.statusGenerating"),
  } as const;

  const outputs = g.generation?.outputs;
  const hasOutputs = !!outputs && (outputs.blog !== undefined || Object.keys(outputs.social ?? {}).length > 0);

  return (
    <div className="studio" data-theme={theme} data-qa="studio">
      <header className="st-header">
        <div>
          <p className="st-eyebrow">{t("admin.studio.eyebrow")}</p>
          <h2 className="st-title">{t("admin.studio.title")}</h2>
        </div>
        <div className="st-header-actions">
          <button
            type="button"
            className="st-btn"
            data-qa="studio-voice-open"
            data-coach="studio.voiceEdit"
            onClick={() => setVoiceOpen(true)}
          >
            <Mic2 className="w-4 h-4" aria-hidden />
            {t("admin.studio.voiceButton")}
          </button>
        </div>
      </header>

      <div className="st-columns" data-qa="studio-columns">
        <StudioInput
          kind={kind}
          onKindChange={setKind}
          brainDump={brainDump}
          onBrainDumpChange={setBrainDump}
          ytUrl={ytUrl}
          onYtUrlChange={setYtUrl}
          transcript={transcript}
          onTranscript={setTranscript}
          extractTranscript={g.extractTranscript}
          disabled={g.generating}
        />
        <StudioOutput
          formats={formats}
          onFormatsChange={setFormats}
          platforms={platforms}
          onPlatformsChange={setPlatforms}
          language={language}
          onLanguageChange={setLanguage}
          voice={voice}
          onVoiceChange={pickVoice}
          gwKind={gwKind}
          onGwKindChange={setGwKind}
          productName={productName}
          onProductNameChange={setProductName}
          productUrl={productUrl}
          onProductUrlChange={setProductUrl}
          productUrlInvalid={productUrlInvalid}
          webSearch={webSearch}
          onWebSearchChange={setWebSearch}
          canGenerate={!!inputText.trim() && !productUrlInvalid}
          generating={g.generating}
          onGenerate={onGenerate}
        />
      </div>

      {(g.generating || g.error || g.usage) && (
        <div className="st-status" data-qa="studio-status" role="status">
          {g.generating && g.status && <span>{statusText[g.status]}</span>}
          {g.generating && (
            <button type="button" className="st-btn st-btn-danger" data-qa="studio-cancel" onClick={g.cancel}>
              {t("admin.studio.cancel")}
            </button>
          )}
          {!g.generating && g.usage && (
            <span data-qa="studio-usage">
              {t("admin.studio.usage", {
                tokens: (g.usage.input_tokens + g.usage.output_tokens + g.usage.cache_read_input_tokens + g.usage.cache_creation_input_tokens).toLocaleString(),
                cost: g.usage.cost_usd.toFixed(3),
              })}
              {g.usage.web_search_requests > 0 ? ` · ${t("admin.studio.webSearch")}` : ""}
            </span>
          )}
          {g.error && (
            <span className="st-error" data-qa="studio-error">
              {errorText(g.error)}
            </span>
          )}
        </div>
      )}

      <section className="st-section" ref={generatedRef} aria-labelledby="studio-generated-title">
        <h3 id="studio-generated-title" className="st-section-title" data-coach="studio.output">
          {t("admin.studio.drafts")}
        </h3>
        <p className="st-section-desc mb-4" data-coach="studio.output">
          {t("admin.studio.draftsDesc")}
        </p>
        {hasOutputs ? (
          <GeneratedContent
            key={g.generation?.id ?? "live"}
            outputs={outputs!}
            streaming={g.generating}
            onBlogEdited={onBlogEdited}
            onPublish={onPublish}
            publishing={publishing}
            blogPostId={g.generation?.blogPostId ?? null}
            onOpenDraft={() => g.generation?.blogPostId && nav.goTo("blog", { postId: g.generation.blogPostId })}
          />
        ) : (
          <p className="st-empty" data-coach="studio.output">
            {t("admin.studio.none")}
          </p>
        )}
      </section>

      <section className="st-section" aria-labelledby="studio-history-title">
        <h3 id="studio-history-title" className="st-section-title">
          {t("admin.studio.history")}
        </h3>
        <p className="st-section-desc mb-4">{t("admin.studio.historyDesc")}</p>
        <StudioHistory version={g.historyVersion} openId={g.generation?.id ?? null} onReopen={onReopen} onDeleted={onDeleted} />
      </section>

      <VoiceDrawer open={voiceOpen} onClose={closeVoice} voice={voice} />
    </div>
  );
};

export default StudioPanel;
