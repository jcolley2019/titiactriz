import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * BLOG.2 — "Voz" / "Voice": the drawer that edits site_settings studio.voice,
 * the document generate-content reads for every generation.
 *
 * ADMIN.SAVEBAR.1c's rule: Save is greyed until something differs from what
 * is stored, lit while it does. The drawer stays mounted while closed, so an
 * unsaved edit survives closing and reopening it.
 *
 * It renders INSIDE the Studio's themed wrapper (fixed-position, not a portal),
 * so it takes the Studio's light or dark tokens.
 */

export const VOICE_KEY = "studio.voice";

type Voice = {
  name: string;
  roles: string;
  audience: string;
  tone: string;
  topics: string[];
  avoid: string[];
  samplePhrases: string[];
};

type Form = Record<keyof Voice, string>;

const EMPTY: Form = { name: "", roles: "", audience: "", tone: "", topics: "", avoid: "", samplePhrases: "" };

const lines = (v: unknown): string =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : "";
const str = (v: unknown): string => (typeof v === "string" ? v : "");

const toForm = (v: unknown): Form => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    name: str(o.name),
    roles: str(o.roles),
    audience: str(o.audience),
    tone: str(o.tone),
    topics: lines(o.topics),
    avoid: lines(o.avoid),
    samplePhrases: lines(o.samplePhrases),
  };
};

const list = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

const toVoice = (f: Form): Voice => ({
  name: f.name.trim(),
  roles: f.roles.trim(),
  audience: f.audience.trim(),
  tone: f.tone.trim(),
  topics: list(f.topics),
  avoid: list(f.avoid),
  samplePhrases: list(f.samplePhrases),
});

const FIELDS: { key: keyof Form; label: string; rows?: number }[] = [
  { key: "name", label: "admin.studio.voiceName" },
  { key: "roles", label: "admin.studio.voiceRoles" },
  { key: "audience", label: "admin.studio.voiceAudience", rows: 3 },
  { key: "tone", label: "admin.studio.voiceTone", rows: 4 },
  { key: "topics", label: "admin.studio.voiceTopics", rows: 7 },
  { key: "avoid", label: "admin.studio.voiceAvoid", rows: 4 },
  { key: "samplePhrases", label: "admin.studio.voicePhrases", rows: 6 },
];

const VoiceDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<Form>(EMPTY);
  const [stored, setStored] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"saved" | "failed" | null>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", VOICE_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadFailed(true);
        const f = toForm(data?.value);
        setForm(f);
        setStored(f);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(flashTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Compare what would be SAVED, so a trailing space or blank line is not "work".
  const dirty = JSON.stringify(toVoice(form)) !== JSON.stringify(toVoice(stored));

  const save = async () => {
    setSaving(true);
    const value = toVoice(form);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: VOICE_KEY, value: value as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      setFlash("failed");
    } else {
      const f = toForm(value);
      setForm(f);
      setStored(f);
      setFlash("saved");
    }
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1800);
  };

  if (!open) return null;

  return (
    <>
      <div className="st-scrim" onClick={onClose} aria-hidden />
      <aside
        className="st-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-voice-title"
        data-qa="studio-voice-drawer"
      >
        <div className="st-drawer-head">
          <div>
            <h2 id="studio-voice-title" className="st-title">
              {t("admin.studio.voiceTitle")}
            </h2>
            <p className="st-caption">{t("admin.studio.voiceDesc")}</p>
          </div>
          <button type="button" className="st-btn" onClick={onClose} aria-label={t("admin.studio.voiceClose")}>
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="st-drawer-body">
          {loadFailed && <p className="st-error">{t("admin.studio.voiceLoadError")}</p>}
          {FIELDS.map((f, i) => (
            <div key={f.key}>
              <label className="st-field-label" htmlFor={`studio-voice-${f.key}`}>
                {t(f.label)}
              </label>
              {f.rows ? (
                <textarea
                  id={`studio-voice-${f.key}`}
                  className="st-input mt-2"
                  rows={f.rows}
                  data-qa={`studio-voice-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  disabled={loading}
                />
              ) : (
                <input
                  id={`studio-voice-${f.key}`}
                  ref={i === 0 ? firstField : undefined}
                  className="st-input mt-2"
                  data-qa={`studio-voice-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  disabled={loading}
                />
              )}
            </div>
          ))}
        </div>

        <div className="st-drawer-foot" data-qa="studio-voice-bar" data-dirty={dirty ? "true" : "false"}>
          {dirty && (
            <span className="st-unsaved inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" aria-hidden />
              {t("admin.studio.voiceUnsaved")}
            </span>
          )}
          {dirty && (
            <button type="button" className="st-btn" onClick={() => setForm(stored)} disabled={saving}>
              {t("admin.studio.voiceDiscard")}
            </button>
          )}
          {flash && (
            <span className={flash === "failed" ? "st-error" : "st-caption"} role="status" data-qa="studio-voice-flash">
              {flash === "failed" ? (
                t("admin.studio.voiceSaveError")
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Check className="w-4 h-4" aria-hidden />
                  {t("admin.studio.voiceSaved")}
                </span>
              )}
            </span>
          )}
          <button
            type="button"
            className="st-btn st-btn-primary"
            data-qa="studio-voice-save"
            onClick={save}
            disabled={saving || loading || !dirty}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
            {saving ? t("admin.studio.voiceSaving") : t("admin.studio.voiceSave")}
          </button>
        </div>
      </aside>
    </>
  );
};

export default VoiceDrawer;
