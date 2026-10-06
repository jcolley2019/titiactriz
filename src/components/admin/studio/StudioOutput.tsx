import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";
import type { Lang } from "@/hooks/useEventsBoard";
import { VOICES, type VoiceName } from "@/lib/voices";
import { GW_KINDS, gwKindLabelKey, type GwKind, type GwProduct } from "@/lib/blog";
import GwProductRows from "@/components/admin/GwProductRows";
import { STUDIO_PLATFORMS, type StudioFormat, type StudioPlatform } from "./useStudioGeneration";

/**
 * BLOG.2 — the OUTPUT column (joeyc.ai FormatSelector + PlatformPicker):
 * Social Post / Blog Article, the four platforms Titi uses with "All", the
 * output language, and Generate. At least one format stays selected; with
 * Social Post on, the last platform picked cannot be unpicked (ADMIN.FIXES.1:
 * a press starts with none picked — StudioPanel holds Generate until a
 * social-only press has one).
 *
 * STUDIO.VOICES.1 — "Voz" sits above the language: Personal or Green World,
 * the voice the press is written in (the same segmented control as Idioma).
 *
 * BLOG.GW.2 — with Green World picked, "Tipo" stands beside Voz (Producto,
 * Capacitación, Negocio; the same control; under it when the column is too
 * narrow for both).
 *
 * ADMIN.FIXES.1 — under them, the Blog editor's products rows (GwProductRows,
 * the studio look): "Productos" with one row to fill in for Producto,
 * "Productos mencionados" to add to for Capacitación and Negocio. Each link is
 * http(s) or empty (an empty link points the piece at the Green World shop); a
 * link that is neither is marked as she types and holds Generate.
 */

export const PLATFORM_LABEL: Record<StudioPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  pinterest: "Pinterest",
  youtube: "YouTube",
};

const PLATFORM_DESC: Record<StudioPlatform, string> = {
  tiktok: "admin.studio.platformTiktok",
  instagram: "admin.studio.platformInstagram",
  pinterest: "admin.studio.platformPinterest",
  youtube: "admin.studio.platformYoutube",
};

type Props = {
  formats: StudioFormat[];
  onFormatsChange: (f: StudioFormat[]) => void;
  platforms: StudioPlatform[];
  onPlatformsChange: (p: StudioPlatform[]) => void;
  language: Lang;
  onLanguageChange: (l: Lang) => void;
  voice: VoiceName;
  onVoiceChange: (v: VoiceName) => void;
  gwKind: GwKind;
  onGwKindChange: (k: GwKind) => void;
  gwProducts: GwProduct[];
  onGwProductsChange: (rows: GwProduct[]) => void;
  webSearch: boolean;
  onWebSearchChange: (on: boolean) => void;
  canGenerate: boolean;
  generating: boolean;
  onGenerate: () => void;
};

const StudioOutput = ({
  formats,
  onFormatsChange,
  platforms,
  onPlatformsChange,
  language,
  onLanguageChange,
  voice,
  onVoiceChange,
  gwKind,
  onGwKindChange,
  gwProducts,
  onGwProductsChange,
  webSearch,
  onWebSearchChange,
  canGenerate,
  generating,
  onGenerate,
}: Props) => {
  const { t } = useTranslation();
  const socialOn = formats.includes("social");
  const allOn = platforms.length === STUDIO_PLATFORMS.length;

  const toggleFormat = (f: StudioFormat) => {
    if (formats.includes(f)) {
      if (formats.length > 1) onFormatsChange(formats.filter((x) => x !== f));
    } else {
      onFormatsChange([...formats, f].sort((a, b) => (a === "blog" ? -1 : b === "blog" ? 1 : 0)));
    }
  };
  const togglePlatform = (p: StudioPlatform) => {
    if (platforms.includes(p)) {
      if (platforms.length > 1) onPlatformsChange(platforms.filter((x) => x !== p));
    } else {
      onPlatformsChange(STUDIO_PLATFORMS.filter((x) => x === p || platforms.includes(x)));
    }
  };

  return (
    <div className="st-column" data-qa="studio-output">
      <div>
        <h3 className="st-section-title">{t("admin.studio.output")}</h3>
        <p className="st-section-desc">{t("admin.studio.outputDesc")}</p>
      </div>

      <div data-coach="studio.format">
        <div className="st-label-row">
          <span className="st-field-label">{t("admin.studio.format")}</span>
        </div>
        <div className="st-grid-2">
          {(["social", "blog"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className="st-choice"
              data-qa={`studio-format-${f}`}
              aria-pressed={formats.includes(f)}
              onClick={() => toggleFormat(f)}
              disabled={generating}
            >
              <span className="st-choice-title">
                {f === "social" ? t("admin.studio.formatSocial") : t("admin.studio.formatBlog")}
              </span>
              <span className="st-choice-desc">
                {f === "social" ? t("admin.studio.formatSocialDesc") : t("admin.studio.formatBlogDesc")}
              </span>
            </button>
          ))}
        </div>
      </div>

      {socialOn && (
        <div data-coach="studio.platforms">
          <div className="st-label-row">
            <span className="st-field-label">{t("admin.studio.platforms")}</span>
            <button
              type="button"
              className="st-btn"
              data-qa="studio-platform-all"
              aria-pressed={allOn}
              onClick={() => onPlatformsChange(allOn ? [platforms[0]] : [...STUDIO_PLATFORMS])}
              disabled={generating}
            >
              {t("admin.studio.all")}
            </button>
          </div>
          <div className="st-grid-2">
            {STUDIO_PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                className="st-choice"
                data-qa={`studio-platform-${p}`}
                aria-pressed={platforms.includes(p)}
                onClick={() => togglePlatform(p)}
                disabled={generating}
              >
                <span className="st-choice-title">
                  <PlatformIcon label={PLATFORM_LABEL[p]} size={16} color="currentColor" />
                  {PLATFORM_LABEL[p]}
                </span>
                <span className="st-choice-desc">{t(PLATFORM_DESC[p])}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="st-pair" data-qa="studio-voice-row">
        <div data-coach="studio.voice">
          <div className="st-label-row">
            <span className="st-field-label" id="studio-voice-label">
              {t("admin.studio.voiceLabel")}
            </span>
          </div>
          <div className="st-segment" role="radiogroup" aria-labelledby="studio-voice-label">
            {VOICES.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                className="st-tab"
                data-qa={`studio-voice-${v}`}
                aria-checked={voice === v}
                onClick={() => onVoiceChange(v)}
                disabled={generating}
              >
                {v === "personal" ? t("admin.studio.voicePersonal") : t("admin.studio.voiceGreenWorld")}
              </button>
            ))}
          </div>
        </div>

        {/* BLOG.GW.2 — Tipo, only for Green World: the same control as Voz. */}
        {voice === "greenworld" && (
          <div className="st-pair-wide" data-qa="studio-kind">
            <div className="st-label-row">
              <span className="st-field-label" id="studio-kind-label">
                {t("admin.studio.kindLabel")}
              </span>
            </div>
            <div className="st-segment" role="radiogroup" aria-labelledby="studio-kind-label">
              {GW_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  className="st-tab"
                  data-qa={`studio-kind-${k}`}
                  aria-checked={gwKind === k}
                  onClick={() => onGwKindChange(k)}
                  disabled={generating}
                >
                  {t(gwKindLabelKey(k))}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADMIN.FIXES.1 — the products a Green World press names, as rows. */}
      {voice === "greenworld" && (
        <GwProductRows
          rows={gwProducts}
          onChange={onGwProductsChange}
          kind={gwKind}
          help={t("admin.studio.productHelp")}
          showErrors
          disabled={generating}
          qa="studio"
          look="studio"
        />
      )}

      <div data-coach="studio.language">
        <div className="st-label-row">
          <span className="st-field-label" id="studio-language-label">
            {t("admin.studio.language")}
          </span>
        </div>
        <div className="st-segment" role="radiogroup" aria-labelledby="studio-language-label">
          {(["es", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              className="st-tab"
              data-qa={`studio-lang-${l}`}
              aria-checked={language === l}
              onClick={() => onLanguageChange(l)}
              disabled={generating}
            >
              {l === "es" ? t("admin.studio.langEs") : t("admin.studio.langEn")}
            </button>
          ))}
        </div>
      </div>

      {/* STUDIO.SPEED.2 — web research is off on every mount; a press turns it on for this press only. */}
      <button
        type="button"
        role="switch"
        className="st-switch"
        data-qa="studio-web-search"
        data-coach="studio.webSearch"
        aria-checked={webSearch}
        aria-describedby="studio-web-search-hint"
        onClick={() => onWebSearchChange(!webSearch)}
        disabled={generating}
      >
        <span className="st-switch-track" aria-hidden>
          <span className="st-switch-thumb" />
        </span>
        <span className="st-switch-text">
          <span className="st-switch-label">{t("admin.studio.webSearchToggle")}</span>
          <span className="st-switch-hint" id="studio-web-search-hint">
            {t("admin.studio.webSearchHint")}
          </span>
        </span>
      </button>

      <button
        type="button"
        className="st-btn st-btn-primary st-generate"
        data-qa="studio-generate"
        data-coach="studio.generate"
        onClick={onGenerate}
        disabled={!canGenerate || generating}
      >
        {generating && <Loader2 className="w-5 h-5 animate-spin" aria-hidden />}
        {generating ? t("admin.studio.generating") : t("admin.studio.generate")}
      </button>
    </div>
  );
};

export default StudioOutput;
