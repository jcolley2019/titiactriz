import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  localizedSource,
  localizedText,
  setLocalizedText,
  type Lang,
  type Localized,
} from "@/hooks/useEventsBoard";
import {
  docToFields,
  fetchHeroCopyDoc,
  fieldsToDoc,
  heroCopyDefaults,
  setHeroCopyDoc,
  type HeroCopy,
  type HeroCopyField,
  type HeroCopyFields,
} from "@/hooks/useHeroCopy";
import { syncLocalizedRecord } from "@/lib/translate-copy";

/**
 * HERO.EDIT.1 — Titi edits the words under her name and her search listing.
 *
 * Four fields, one `hero.copy` row (see useHeroCopy). Each field is the Events
 * board's single Localized field: type in either language, and Save fills the
 * other through translate-text. A small disclosure under each field opens the
 * translation for correction; a correction is the owner's own words, so it is
 * never re-translated over.
 *
 * A blank field is not an empty hero: it means "the site's default", which is
 * what the placeholder shows. "Restore default" is how a field goes back to it,
 * and restoring every field deletes the row (setHeroCopyDoc).
 *
 * Nothing here writes on change. All four are text, so they wait for ONE Save on
 * the same pinned, opaque bar as the Events board (ADMIN.QOL.1 / SAVEBAR.1b).
 */

const FLASH_MS = 1800;

/** Soft limits for the search listing: they warn, they never block. */
const TITLE_MAX = 62;
const DESCRIPTION_MIN = 150;
const DESCRIPTION_MAX = 160;

const EMPTY_FIELDS = docToFields(null);

/** Characters as a reader counts them: "·" and "í" are one each. */
const chars = (s: string) => [...s].length;

type FlashState = "saved" | "failed" | undefined;

type FieldSpec = {
  field: HeroCopyField;
  label: string;
  help?: string;
  multiline: boolean;
  maxLength: number;
};

/** The search-listing length hint under the title and description fields. */
const LengthHint = ({ field, text, qa }: { field: HeroCopyField; text: string; qa: string }) => {
  const { t } = useTranslation();
  if (field !== "title" && field !== "description") return null;
  const n = chars(text);
  const warning =
    field === "title"
      ? n > TITLE_MAX
        ? t("admin.heroCopy.titleLong")
        : null
      : n < DESCRIPTION_MIN
        ? t("admin.heroCopy.descriptionShort")
        : n > DESCRIPTION_MAX
          ? t("admin.heroCopy.descriptionLong")
          : null;
  return (
    <p data-qa={qa} data-warn={warning ? "true" : "false"} className="text-xs text-muted-foreground">
      {t("admin.heroCopy.chars", { n })}
      {warning && <span className="text-destructive"> · {warning}</span>}
    </p>
  );
};

const FieldEditor = ({
  spec,
  value,
  defaults,
  disabled,
  onChange,
}: {
  spec: FieldSpec;
  value: Localized;
  defaults: Record<Lang, HeroCopy>;
  disabled: boolean;
  onChange: (next: Localized) => void;
}) => {
  const { t } = useTranslation();
  const { field } = spec;
  const src = localizedSource(value);
  const other: Lang = src === "es" ? "en" : "es";
  const main = localizedText(value);
  // While a field is pending, its other slot holds a verbatim copy of what was
  // typed (or nothing, after a failed translation) — not a translation, so the
  // disclosure does not present it as one.
  const otherText = value.pending ? "" : (value[other] ?? "");
  const hasOverride = !!(value.es.trim() || value.en.trim());
  const id = `hero-copy-${field}`;

  const setMain = (text: string) => onChange(setLocalizedText(value, text));
  // A correction is the owner's own words in that slot: no longer pending, so
  // Save does not translate over it.
  const setOther = (text: string) =>
    onChange({ ...value, [src]: main, [other]: text, src, pending: false });

  const control = (qa: string, text: string, placeholder: string, set: (t: string) => void) =>
    spec.multiline ? (
      <Textarea
        id={qa === id ? id : undefined}
        data-qa={qa}
        rows={field === "description" ? 3 : 2}
        maxLength={spec.maxLength}
        value={text}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
        disabled={disabled}
      />
    ) : (
      <Input
        id={qa === id ? id : undefined}
        data-qa={qa}
        maxLength={spec.maxLength}
        value={text}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
        disabled={disabled}
      />
    );

  return (
    <div className="space-y-1.5" data-qa={`hero-copy-field-${field}`}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-foreground text-sm">
          {spec.label}
        </Label>
        <button
          type="button"
          data-qa={`hero-copy-restore-${field}`}
          onClick={() => onChange({ es: "", en: "" })}
          disabled={disabled || !hasOverride}
          className="shrink-0 text-xs text-accent hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-40"
        >
          {t("admin.heroCopy.restoreDefault")}
        </button>
      </div>
      {spec.help && <p className="text-xs text-muted-foreground">{spec.help}</p>}

      {control(id, main, defaults[src][field], setMain)}
      {!main.trim() && (
        <p data-qa={`hero-copy-default-${field}`} className="text-xs text-muted-foreground italic">
          {t("admin.heroCopy.usingDefault")}
        </p>
      )}
      <LengthHint
        field={field}
        text={main.trim() || defaults[src][field]}
        qa={`hero-copy-count-${field}`}
      />

      <details data-qa={`hero-copy-other-${field}`} className="text-xs">
        <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
          {other === "en" ? t("admin.heroCopy.english") : t("admin.heroCopy.spanish")}
          {value.pending && (
            <span className="text-accent"> · {t("admin.heroCopy.translatedOnSave")}</span>
          )}
        </summary>
        <div className="mt-2 space-y-1">
          {control(`${id}-${other}`, otherText, defaults[other][field], setOther)}
          <LengthHint
            field={field}
            text={otherText.trim() || defaults[other][field]}
            qa={`hero-copy-count-${field}-${other}`}
          />
        </div>
      </details>
    </div>
  );
};

const HeroCopyEditor = () => {
  const { t, i18n } = useTranslation();
  const [fields, setFields] = useState<HeroCopyFields>(EMPTY_FIELDS);
  /** The fields as the database has them: Discard's target and dirty's baseline. */
  const [committedFields, setCommittedFields] = useState<HeroCopyFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [flash, setFlash] = useState<FlashState>(undefined);
  const flashTimer = useRef<number | undefined>(undefined);

  const defaults: Record<Lang, HeroCopy> = {
    es: heroCopyDefaults(i18n.getFixedT("es")),
    en: heroCopyDefaults(i18n.getFixedT("en")),
  };

  const specs: FieldSpec[] = [
    {
      field: "roles",
      label: t("admin.heroCopy.roles"),
      help: t("admin.heroCopy.rolesHelp"),
      multiline: false,
      maxLength: 80,
    },
    { field: "intro", label: t("admin.heroCopy.intro"), multiline: true, maxLength: 240 },
    { field: "title", label: t("admin.heroCopy.pageTitle"), multiline: false, maxLength: 100 },
    {
      field: "description",
      label: t("admin.heroCopy.pageDescription"),
      multiline: true,
      maxLength: 300,
    },
  ];

  useEffect(() => {
    let cancelled = false;
    fetchHeroCopyDoc()
      .then((doc) => {
        if (cancelled) return;
        const loaded = docToFields(doc);
        setFields(loaded);
        setCommittedFields(loaded);
      })
      // A failed read must never look like "nothing stored": Save stays off, so
      // the owner cannot write blanks over copy this page simply failed to see.
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const showFlash = (state: Exclude<FlashState, undefined>) => {
    setFlash(state);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(undefined), FLASH_MS);
  };

  const dirty = !loading && JSON.stringify(fields) !== JSON.stringify(committedFields);

  const discard = () => setFields(committedFields);

  // Reload, tab close or a typed URL with unsaved copy asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onSave = async () => {
    setSaving(true);
    try {
      const { fields: translated, failed } = await syncLocalizedRecord(fields);
      const doc = fieldsToDoc(translated);
      await setHeroCopyDoc(doc);
      // Re-read what was stored, so the editor holds exactly what a reload would.
      const stored = docToFields(doc);
      setFields(stored);
      setCommittedFields(stored);
      setTranslationFailed(failed > 0);
      showFlash("saved");
      if (failed > 0) {
        toast({ title: t("admin.heroCopy.translationFailed"), variant: "destructive" });
      }
    } catch (e) {
      showFlash("failed");
      toast({
        title: t("admin.heroCopy.saveError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      data-qa="hero-copy-editor"
      // `overflow-clip`, not `hidden`: a scroll container here would cancel the
      // bar's stickiness (ADMIN.QOL.1).
      className="bg-card border border-border rounded-lg mb-10 overflow-clip"
    >
      <div className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left">
        <div>
          <h2 className="font-serif text-base text-foreground leading-tight">
            {t("admin.heroCopy.title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("admin.heroCopy.subtitle")}</p>
        </div>
      </div>

      <div className="px-6 py-4 space-y-6 border-t border-border">
        <p className="text-xs text-muted-foreground">{t("admin.heroCopy.autoTranslateHelp")}</p>

        {loadFailed && (
          <p data-qa="hero-copy-load-failed" role="alert" className="text-xs text-destructive">
            {t("admin.heroCopy.loadError")}
          </p>
        )}
        {translationFailed && (
          <p data-qa="hero-copy-translation-failed" role="alert" className="text-xs text-destructive">
            {t("admin.heroCopy.translationFailedHelp")}
          </p>
        )}

        {specs.map((spec) => (
          <FieldEditor
            key={spec.field}
            spec={spec}
            value={fields[spec.field]}
            defaults={defaults}
            disabled={loading || loadFailed || saving}
            onChange={(next) => setFields((prev) => ({ ...prev, [spec.field]: next }))}
          />
        ))}

        {/* The Events board's bar: pinned always, opaque, warning and Discard
            only while there is unsaved copy. */}
        <div
          data-qa="hero-copy-save-bar"
          data-dirty={dirty ? "true" : "false"}
          className="sticky bottom-0 z-40 -mx-6 px-6 py-3 border-t border-border bg-card flex items-center justify-end gap-3"
        >
          {dirty && (
            <span
              data-qa="hero-copy-unsaved"
              className="mr-auto inline-flex items-center gap-2 text-xs text-destructive"
            >
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
              {t("admin.heroCopy.unsaved")}
            </span>
          )}
          {dirty && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              data-qa="hero-copy-discard"
              onClick={discard}
              disabled={saving}
            >
              {t("admin.heroCopy.discard")}
            </Button>
          )}
          {flash && (
            <span
              data-qa="flash-hero-copy"
              data-state={flash}
              role="status"
              className={`inline-flex items-center gap-1 text-[0.7rem] ${
                flash === "failed" ? "text-destructive" : "text-accent"
              }`}
            >
              {flash === "failed" ? (
                <AlertTriangle className="w-3 h-3" aria-hidden />
              ) : (
                <Check className="w-3 h-3" aria-hidden />
              )}
              {flash === "failed" ? t("admin.heroCopy.flashFailed") : t("admin.heroCopy.flashSaved")}
            </span>
          )}
          <Button
            type="button"
            onClick={onSave}
            disabled={saving || loading || loadFailed}
            data-qa="hero-copy-save"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t("admin.heroCopy.saving")}
              </>
            ) : (
              t("admin.heroCopy.save")
            )}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroCopyEditor;
