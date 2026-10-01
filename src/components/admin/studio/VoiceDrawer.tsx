import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { VOICES, voiceSettingKey, type VoiceName } from "@/lib/voices";

/**
 * BLOG.2 — "Voz" / "Voice": the drawer that edits the voice documents
 * generate-content reads for every generation.
 *
 * STUDIO.VOICES.1 — there are two, one per tab: Personal (site_settings
 * studio.voice.personal) and Green World (studio.voice.greenworld). The drawer
 * opens on the tab of the Studio's current Voz pick. The bare `studio.voice` is
 * never written here any more; it stays in the database only as the function's
 * fallback for old clients.
 *
 * ADMIN.SAVEBAR.1c's rule, per tab: Save is greyed until the tab's text differs
 * from what is stored, lit while it does, and Discard goes back to the stored
 * text. Each tab keeps its own text, so switching tabs loses nothing, and a tab
 * with unsaved text says so on its tab. The drawer stays mounted while closed,
 * so an unsaved edit survives closing and reopening it.
 *
 * It renders INSIDE the Studio's themed wrapper (fixed-position, not a portal),
 * so it takes the Studio's light or dark tokens.
 */

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

/** One voice's text as typed, and as stored. */
type Slot = { form: Form; stored: Form };
type Slots = Record<VoiceName, Slot>;

const EMPTY_SLOTS: Slots = {
  personal: { form: EMPTY, stored: EMPTY },
  greenworld: { form: EMPTY, stored: EMPTY },
};

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

// Compare what would be SAVED, so a trailing space or blank line is not "work".
const isDirty = (slot: Slot) => JSON.stringify(toVoice(slot.form)) !== JSON.stringify(toVoice(slot.stored));

const VoiceDrawer = ({ open, onClose, voice }: { open: boolean; onClose: () => void; voice: VoiceName }) => {
  const { t } = useTranslation();
  const [slots, setSlots] = useState<Slots>(EMPTY_SLOTS);
  const [tab, setTab] = useState<VoiceName>(voice);
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
      .select("key, value")
      .in("key", VOICES.map(voiceSettingKey))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadFailed(true);
        const next: Slots = { ...EMPTY_SLOTS };
        for (const v of VOICES) {
          const f = toForm(data?.find((r) => r.key === voiceSettingKey(v))?.value);
          next[v] = { form: f, stored: f };
        }
        setSlots(next);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(flashTimer.current);
    };
  }, []);

  // Opening the drawer lands on the tab of the Studio's current Voz pick.
  useEffect(() => {
    if (open) setTab(voice);
  }, [open, voice]);

  useEffect(() => {
    if (!open) return;
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { form, stored } = slots[tab];
  const dirty = isDirty(slots[tab]);

  const setForm = (next: Form) => setSlots((prev) => ({ ...prev, [tab]: { ...prev[tab], form: next } }));

  const selectTab = (v: VoiceName) => {
    window.clearTimeout(flashTimer.current);
    setFlash(null);
    setTab(v);
  };

  const save = async () => {
    const target = tab;
    setSaving(true);
    const value = toVoice(form);
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        { key: voiceSettingKey(target), value: value as unknown as Json, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setSaving(false);
    if (error) {
      setFlash("failed");
    } else {
      const f = toForm(value);
      // The saved text is now both what the tab shows and what is stored.
      setSlots((prev) => ({ ...prev, [target]: { form: f, stored: f } }));
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
        data-tab={tab}
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

        <div className="st-drawer-tabs">
          <div className="st-segment" role="tablist" aria-label={t("admin.studio.voiceTitle")}>
            {VOICES.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                id={`studio-voice-tab-${v}`}
                className="st-tab"
                data-qa={`studio-voice-tab-${v}`}
                data-dirty={isDirty(slots[v]) ? "true" : "false"}
                aria-selected={tab === v}
                aria-controls="studio-voice-panel"
                onClick={() => selectTab(v)}
              >
                {v === "personal" ? t("admin.studio.voicePersonal") : t("admin.studio.voiceGreenWorld")}
              </button>
            ))}
          </div>
        </div>

        <div
          className="st-drawer-body"
          role="tabpanel"
          id="studio-voice-panel"
          aria-labelledby={`studio-voice-tab-${tab}`}
        >
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
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  disabled={loading}
                />
              ) : (
                <input
                  id={`studio-voice-${f.key}`}
                  ref={i === 0 ? firstField : undefined}
                  className="st-input mt-2"
                  data-qa={`studio-voice-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
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
