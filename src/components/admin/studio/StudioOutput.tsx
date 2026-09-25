import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";
import type { Lang } from "@/hooks/useEventsBoard";
import { STUDIO_PLATFORMS, type StudioFormat, type StudioPlatform } from "./useStudioGeneration";

/**
 * BLOG.2 — the OUTPUT column (joeyc.ai FormatSelector + PlatformPicker):
 * Social Post / Blog Article, the four platforms Titi uses with "All", the
 * output language, and Generate. At least one format stays selected; with
 * Social Post on, at least one platform stays selected.
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

      <div>
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
        <div>
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

      <div>
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

      <button
        type="button"
        className="st-btn st-btn-primary st-generate"
        data-qa="studio-generate"
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
