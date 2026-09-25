import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun, Mic2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import type { Lang } from "@/hooks/useEventsBoard";
import { useAdminNav } from "@/components/admin/AdminShell";
import { studioDraft, uniqueSlug } from "@/lib/studio/publish";
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
 * The Studio owns its theme (light Luxe by default, or the site's dark) on its
 * own wrapper; nothing it sets reaches the rest of the admin. Remembered in
 * localStorage `studio.theme`.
 */

export const STUDIO_THEME_KEY = "studio.theme";
type Theme = "light" | "dark";

const readTheme = (): Theme => {
  try {
    return localStorage.getItem(STUDIO_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const StudioPanel = () => {
  const { t, i18n } = useTranslation();
  const nav = useAdminNav();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const closeVoice = useCallback(() => setVoiceOpen(false), []);

  const [kind, setKind] = useState<InputKind>("brain_dump");
  const [brainDump, setBrainDump] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [transcript, setTranscript] = useState("");

  const [formats, setFormats] = useState<StudioFormat[]>(["social"]);
  const [platforms, setPlatforms] = useState<StudioPlatform[]>(["tiktok"]);
  const [language, setLanguage] = useState<Lang>((i18n.language || "es").startsWith("en") ? "en" : "es");
  const [publishing, setPublishing] = useState(false);
  const generatedRef = useRef<HTMLElement>(null);

  const g = useStudioGeneration();
  const inputText = kind === "youtube" ? transcript : brainDump;

  const flipTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STUDIO_THEME_KEY, next);
    } catch {
      /* storage unavailable — the choice lasts for this visit */
    }
  };

  const onGenerate = () =>
    g.generate({
      inputKind: kind,
      inputText,
      sourceUrl: kind === "youtube" ? ytUrl.trim() || null : null,
      formats,
      platforms,
      language,
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
    const res = studioDraft(stripThinkingText(gen.outputs.blog, "blog"), gen.language);
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
      blogPostId: row.blog_post_id,
    });
    generatedRef.current?.scrollIntoView({ block: "start" });
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
          <button type="button" className="st-btn" data-qa="studio-voice-open" onClick={() => setVoiceOpen(true)}>
            <Mic2 className="w-4 h-4" aria-hidden />
            {t("admin.studio.voiceButton")}
          </button>
          <button
            type="button"
            className="st-btn"
            data-qa="studio-theme-toggle"
            aria-label={`${t("admin.studio.theme")}: ${theme === "dark" ? t("admin.studio.themeDark") : t("admin.studio.themeLight")}`}
            onClick={flipTheme}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" aria-hidden /> : <Moon className="w-4 h-4" aria-hidden />}
            {theme === "dark" ? t("admin.studio.themeLight") : t("admin.studio.themeDark")}
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
          canGenerate={!!inputText.trim()}
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
        <h3 id="studio-generated-title" className="st-section-title">
          {t("admin.studio.drafts")}
        </h3>
        <p className="st-section-desc mb-4">{t("admin.studio.draftsDesc")}</p>
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
          <p className="st-empty">{t("admin.studio.none")}</p>
        )}
      </section>

      <section className="st-section" aria-labelledby="studio-history-title">
        <h3 id="studio-history-title" className="st-section-title">
          {t("admin.studio.history")}
        </h3>
        <p className="st-section-desc mb-4">{t("admin.studio.historyDesc")}</p>
        <StudioHistory version={g.historyVersion} openId={g.generation?.id ?? null} onReopen={onReopen} />
      </section>

      <VoiceDrawer open={voiceOpen} onClose={closeVoice} />
    </div>
  );
};

export default StudioPanel;
