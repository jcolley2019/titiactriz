import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import imageCompression from "browser-image-compression";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Check, ExternalLink, GripVertical, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useStreamVideo } from "@/hooks/useStreamVideo";
import {
  emptyGreenWorldGuide,
  fetchGreenWorldGuide,
  GUIDE_MAX_STEPS,
  setGreenWorldGuide,
  type GreenWorldGuide,
  type GuideStep,
} from "@/lib/greenworld-guide";
import { isHttpUrl } from "@/lib/blog";
import {
  isAcceptedStreamVideo,
  isStreamRef,
  STREAM_MAX_BYTES,
  STREAM_MAX_MB,
  STREAM_VIDEO_ACCEPT_ATTR,
  StreamUploadError,
  uploadToStream,
  type StreamUploadProgress,
} from "@/lib/stream";
import { GREEN_WORLD_GUIDE_HREF } from "@/lib/ventures";
import { releaseStreamVideo, toastStreamOrphan } from "@/components/admin/streamRelease";

/**
 * GW.GUIDE.1 — the admin for the /green-world "Cómo comprar" guide: two video
 * slots (Spanish, English), the register link, and the numbered steps with an
 * optional screenshot each. One Guardar upserts the whole `greenworld_guide`
 * value; nothing half-written goes live.
 *
 * Media follows EventsBoardManager's law: a clip or screenshot the guide no
 * longer holds is deleted at once if the SAVED guide never referenced it, and
 * otherwise on the Save that drops it — the public page never points at a
 * file that is gone. Discard lets go of uploads only the working copy held.
 */

const BUCKET = "gallery";
const FLASH_MS = 1800;
type FlashState = "saved" | "failed" | undefined;
type VideoLang = "es" | "en";

const newStep = (): GuideStep => ({
  id: crypto.randomUUID(),
  title: { es: "", en: "" },
  body: { es: "", en: "" },
  image: null,
});

/** The events board's screenshot pipeline (webp, upsert false, public URL), under guide/. */
const uploadGuideImage = async (file: File): Promise<string> => {
  let blob: Blob = file;
  try {
    blob = await imageCompression(file, {
      maxWidthOrHeight: 2400,
      fileType: "image/webp",
      initialQuality: 0.85,
      maxSizeMB: 1.0,
      useWebWorker: true,
      preserveExif: false,
    });
  } catch {
    // fall back to original file
  }
  const path = `guide/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: false, contentType: "image/webp" });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
};

/** The storage path inside BUCKET, from a public URL — the gallery's pattern. */
const pathFromUrl = (url: string): string | null => {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
};

/** Every file a guide references: its two clips and each step's screenshot. */
const mediaOf = (g: GreenWorldGuide): Set<string> =>
  new Set(
    [g.video.es, g.video.en, ...g.steps.map((s) => s.image?.url ?? null)].filter((v): v is string => !!v),
  );

const SaveFlash = ({ state }: { state: FlashState }) => {
  const { t } = useTranslation();
  if (!state) return null;
  const failed = state === "failed";
  return (
    <span
      data-qa="flash-gwg-save"
      data-state={state}
      role="status"
      className={`inline-flex items-center gap-1 text-[0.7rem] ${failed ? "text-destructive" : "text-accent-ink"}`}
    >
      {failed ? <AlertTriangle className="w-3 h-3" aria-hidden /> : <Check className="w-3 h-3" aria-hidden />}
      {failed ? t("admin.greenworld.flashFailed") : t("admin.greenworld.flashSaved")}
    </span>
  );
};

/** The slot's clip, played through the same hook as the public section. */
const VideoPreviewTile = ({ src, lang }: { src: string; lang: VideoLang }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const stream = useStreamVideo(ref, src, { autoLoad: false });
  return (
    <video
      ref={ref}
      src={stream.src}
      poster={stream.poster}
      data-stream-src={stream.manifest}
      data-qa={`gwg-video-${lang}-preview`}
      controls
      playsInline
      preload="metadata"
      className="w-40 aspect-video object-cover rounded-md border border-border bg-muted"
    />
  );
};

type VideoSlotProps = {
  lang: VideoLang;
  value: string | null;
  disabled: boolean;
  onChange: (ref: string | null) => void;
  release: (ref: string) => void;
};

const VideoSlot = ({ lang, value, disabled, onChange, release }: VideoSlotProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<StreamUploadProgress>({ phase: "uploading", pct: 0 });
  const [rejected, setRejected] = useState<"type" | "size" | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setRejected(null);
    if (!isAcceptedStreamVideo(file)) return setRejected("type");
    if (file.size > STREAM_MAX_BYTES) return setRejected("size");
    const previous = value;
    setBusy(true);
    setProgress({ phase: "uploading", pct: 0 });
    try {
      const ref = await uploadToStream(file, "guide", setProgress);
      if (!mounted.current) {
        release(ref);
        return;
      }
      onChange(ref);
      if (previous && previous !== ref) release(previous);
    } catch (e) {
      toast({
        title: t("admin.greenworld.videoUploadFailed"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
      if (e instanceof StreamUploadError && e.orphan) toastStreamOrphan(e.orphan, t);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="space-y-2" data-qa={`gwg-video-${lang}`}>
      <Label className="text-foreground text-sm">{t(`admin.greenworld.video.${lang}`)}</Label>
      {value && (
        <div className="flex items-center gap-3">
          <VideoPreviewTile src={value} lang={lang} />
          <span data-qa={`gwg-video-${lang}-ready`} className="text-xs text-accent-ink inline-flex items-center gap-1">
            <Check className="w-3 h-3" aria-hidden />
            {t("admin.greenworld.video.ready")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-qa={`gwg-video-${lang}-remove`}
            disabled={busy || disabled}
            onClick={() => {
              onChange(null);
              release(value);
            }}
          >
            <X className="w-3 h-3 mr-1" />
            {t("admin.greenworld.video.remove")}
          </Button>
        </div>
      )}
      <button
        type="button"
        data-qa={`gwg-video-${lang}-upload`}
        data-phase={busy ? progress.phase : undefined}
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border hover:border-accent/50 rounded-md p-5 transition-colors cursor-pointer disabled:cursor-default"
      >
        {busy ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="w-5 h-5 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground text-center">
          {busy
            ? progress.phase === "processing"
              ? t("admin.stream.processing")
              : t("admin.stream.uploading", { pct: progress.pct })
            : value
              ? t("admin.greenworld.video.replace")
              : t("admin.greenworld.video.upload")}
        </span>
        <span className="text-[0.65rem] text-muted-foreground/70">
          {t("admin.greenworld.video.hint", { mb: STREAM_MAX_MB })}
        </span>
      </button>
      {rejected && (
        <p data-qa={`gwg-video-${lang}-reject`} role="alert" className="text-xs text-destructive">
          {t(`admin.greenworld.video.reject.${rejected}`, { mb: STREAM_MAX_MB })}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={STREAM_VIDEO_ACCEPT_ATTR}
        className="hidden"
        data-qa={`gwg-video-${lang}-input`}
        onChange={(e) => {
          // The FileList is a live view of the input: copy the file out before
          // the reset empties it (VIDEO.1.FIX-B).
          const file = Array.from(e.target.files ?? [])[0];
          e.target.value = "";
          void handleFile(file);
        }}
      />
    </div>
  );
};

type StepRowProps = {
  step: GuideStep;
  index: number;
  disabled: boolean;
  onChange: (patch: Partial<GuideStep>) => void;
  onRemove: () => void;
  release: (url: string) => void;
};

const StepRow = ({ step, index, disabled, onChange, onRemove, release }: StepRowProps) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleImage = async (file: File | undefined) => {
    if (!file || !(file.type || "").startsWith("image/")) return;
    const previous = step.image?.url ?? null;
    setBusy(true);
    try {
      const url = await uploadGuideImage(file);
      onChange({ image: { url, alt: step.image?.alt ?? "" } });
      if (previous && previous !== url) release(previous);
    } catch (e) {
      toast({
        title: t("admin.greenworld.imageUploadFailed"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const field = (key: "title" | "body", lang: VideoLang, value: string) =>
    onChange({ [key]: { ...step[key], [lang]: value } } as Partial<GuideStep>);

  return (
    <li ref={setNodeRef} style={style} data-qa="gwg-step" className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label={t("admin.greenworld.steps.drag")}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs uppercase tracking-wider text-accent-ink">
          {t("admin.greenworld.steps.step", { n: index + 1 })}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          data-qa="gwg-step-remove"
          disabled={disabled}
          onClick={onRemove}
          className="ml-auto text-destructive hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden />
          {t("admin.greenworld.steps.remove")}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("admin.greenworld.steps.titleEs")}</Label>
          <Input data-qa="gwg-step-title-es" value={step.title.es} disabled={disabled} onChange={(e) => field("title", "es", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("admin.greenworld.steps.titleEn")}</Label>
          <Input data-qa="gwg-step-title-en" value={step.title.en} disabled={disabled} onChange={(e) => field("title", "en", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("admin.greenworld.steps.bodyEs")}</Label>
          <Textarea data-qa="gwg-step-body-es" rows={3} value={step.body.es} disabled={disabled} onChange={(e) => field("body", "es", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("admin.greenworld.steps.bodyEn")}</Label>
          <Textarea data-qa="gwg-step-body-en" rows={3} value={step.body.en} disabled={disabled} onChange={(e) => field("body", "en", e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("admin.greenworld.steps.image")}</Label>
        {step.image ? (
          <div className="flex flex-wrap items-start gap-3">
            <img
              src={step.image.url}
              alt={step.image.alt}
              data-qa="gwg-step-image-preview"
              className="w-28 h-20 object-cover rounded-md border border-border"
            />
            <div className="flex-1 min-w-[12rem] space-y-1">
              <Label className="text-xs text-muted-foreground">{t("admin.greenworld.steps.imageAlt")}</Label>
              <Input
                data-qa="gwg-step-image-alt"
                value={step.image.alt}
                disabled={disabled}
                onChange={(e) => onChange({ image: { url: step.image!.url, alt: e.target.value } })}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-qa="gwg-step-image-remove"
              disabled={busy || disabled}
              onClick={() => {
                const url = step.image!.url;
                onChange({ image: null });
                release(url);
              }}
            >
              <X className="w-3 h-3 mr-1" />
              {t("admin.greenworld.steps.imageRemove")}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-qa="gwg-step-image-upload"
            disabled={busy || disabled}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
            {t("admin.greenworld.steps.imageUpload")}
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-qa="gwg-step-image-input"
          onChange={(e) => {
            const file = Array.from(e.target.files ?? [])[0];
            e.target.value = "";
            void handleImage(file);
          }}
        />
      </div>
    </li>
  );
};

const GreenWorldGuideManager = () => {
  const { t } = useTranslation();
  const [guide, setGuide] = useState<GreenWorldGuide>(emptyGreenWorldGuide);
  const [committedGuide, setCommittedGuide] = useState<GreenWorldGuide>(emptyGreenWorldGuide);
  const committed = useRef<GreenWorldGuide>(committedGuide);
  committed.current = committedGuide;
  const working = useRef<GreenWorldGuide>(guide);
  working.current = guide;
  const [signupUrl, setSignupUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<FlashState>(undefined);
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchGreenWorldGuide()
      .then((g) => {
        if (cancelled) return;
        setGuide(g);
        setCommittedGuide(g);
        setSignupUrl(g.signupUrl ?? "");
      })
      .catch((e) => {
        if (cancelled) return;
        toast({
          title: t("admin.greenworld.loadError"),
          description: e instanceof Error ? e.message : "",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(flashTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showFlash = (state: Exclude<FlashState, undefined>) => {
    setFlash(state);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(undefined), FLASH_MS);
  };

  /** Delete one file the guide no longer holds — a Stream clip there, a screenshot in the bucket. */
  const deleteMedia = async (ref: string) => {
    if (isStreamRef(ref)) {
      await releaseStreamVideo(ref, t);
      return;
    }
    const path = pathFromUrl(ref);
    if (!path) return;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) toast({ title: t("admin.greenworld.imageDeleteFailed"), description: error.message, variant: "destructive" });
  };

  /** Now if the saved guide never referenced it; otherwise on the Save that drops it. */
  const release = (ref: string) => {
    if (mediaOf(committed.current).has(ref)) return;
    void deleteMedia(ref);
  };

  /** Throwing away the working guide abandons the uploads it alone held. */
  const releaseUnsaved = () => {
    const saved = mediaOf(committed.current);
    for (const ref of mediaOf(working.current)) if (!saved.has(ref)) void deleteMedia(ref);
  };

  const urlInvalid = !!signupUrl.trim() && !isHttpUrl(signupUrl);
  const draft: GreenWorldGuide = { ...guide, signupUrl: signupUrl.trim() || null };
  const dirty = JSON.stringify(draft) !== JSON.stringify(committedGuide);
  const atMax = guide.steps.length >= GUIDE_MAX_STEPS;

  const setVideo = (lang: VideoLang, ref: string | null) =>
    setGuide((prev) => ({ ...prev, video: { ...prev.video, [lang]: ref } }));

  const updateStep = (id: string, patch: Partial<GuideStep>) =>
    setGuide((prev) => ({ ...prev, steps: prev.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addStep = () => {
    if (atMax) return;
    setGuide((prev) => ({ ...prev, steps: [...prev.steps, newStep()] }));
  };

  const removeStep = (id: string) => {
    const gone = guide.steps.find((s) => s.id === id);
    setGuide((prev) => ({ ...prev, steps: prev.steps.filter((s) => s.id !== id) }));
    if (gone?.image) release(gone.image.url);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setGuide((prev) => {
      const oldIndex = prev.steps.findIndex((s) => s.id === active.id);
      const newIndex = prev.steps.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return { ...prev, steps: arrayMove(prev.steps, oldIndex, newIndex) };
    });
  };

  const discard = () => {
    releaseUnsaved();
    setGuide(committedGuide);
    setSignupUrl(committedGuide.signupUrl ?? "");
  };

  const onSave = async () => {
    if (urlInvalid) return;
    setSaving(true);
    try {
      const before = mediaOf(committedGuide);
      await setGreenWorldGuide(draft);
      setGuide(draft);
      setCommittedGuide(draft);
      committed.current = draft;
      showFlash("saved");
      // The files this Save dropped are no longer shown anywhere: let them go.
      const after = mediaOf(draft);
      for (const ref of before) if (!after.has(ref)) void deleteMedia(ref);
    } catch (e) {
      showFlash("failed");
      toast({
        title: t("admin.greenworld.saveError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  return (
    <section data-qa="admin-greenworld" className="bg-card border border-border rounded-lg mb-10 overflow-clip">
      <div className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left">
        <div>
          <h2 className="font-serif text-base text-foreground leading-tight">{t("admin.greenworld.sectionTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("admin.greenworld.sectionSubtitle")}</p>
        </div>
        <a
          href={GREEN_WORLD_GUIDE_HREF}
          target="_blank"
          rel="noopener noreferrer"
          data-qa="gwg-view"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
        >
          {t("admin.greenworld.viewSection")}
          <ExternalLink className="w-3 h-3" aria-hidden />
        </a>
      </div>

      <div className="px-6 py-4 space-y-8 border-t border-border">
        {loading && <p className="text-sm text-muted-foreground">{t("admin.greenworld.loading")}</p>}

        <div className="grid gap-6 md:grid-cols-2">
          <VideoSlot lang="es" value={guide.video.es} disabled={disabled} onChange={(r) => setVideo("es", r)} release={release} />
          <VideoSlot lang="en" value={guide.video.en} disabled={disabled} onChange={(r) => setVideo("en", r)} release={release} />
        </div>
        <p className="text-xs text-muted-foreground -mt-4">{t("admin.greenworld.video.fallbackHint")}</p>

        <div className="space-y-2 max-w-xl">
          <Label htmlFor="gwg-signup-url" className="text-foreground text-sm">
            {t("admin.greenworld.signupUrl")}
          </Label>
          <Input
            id="gwg-signup-url"
            data-qa="gwg-signup-url"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={signupUrl}
            disabled={disabled}
            onChange={(e) => setSignupUrl(e.target.value)}
            aria-invalid={urlInvalid || undefined}
          />
          {urlInvalid ? (
            <p data-qa="gwg-signup-url-invalid" className="text-xs text-destructive">
              {t("admin.greenworld.signupUrlInvalid")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("admin.greenworld.signupUrlHelp")}</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-sm text-foreground mr-auto">{t("admin.greenworld.steps.title")}</h3>
            <Button type="button" size="sm" variant="outline" data-qa="gwg-step-add" onClick={addStep} disabled={disabled || atMax}>
              <Plus className="w-3 h-3 mr-1" />
              {t("admin.greenworld.steps.add")}
            </Button>
            {atMax && (
              <span className="text-xs text-muted-foreground">{t("admin.greenworld.steps.max", { n: GUIDE_MAX_STEPS })}</span>
            )}
          </div>
          {guide.steps.length === 0 ? (
            <p data-qa="gwg-steps-empty" className="text-sm text-muted-foreground italic">
              {t("admin.greenworld.steps.empty")}
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={guide.steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul data-qa="gwg-steps" className="space-y-3 list-none">
                  {guide.steps.map((step, i) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      index={i}
                      disabled={disabled}
                      onChange={(patch) => updateStep(step.id, patch)}
                      onRemove={() => removeStep(step.id)}
                      release={release}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* ADMIN.SAVEBAR.1b/1c — one Save, pinned always, opaque, wrapping. */}
        <div
          data-qa="gwg-save-bar"
          data-dirty={dirty ? "true" : "false"}
          className="sticky bottom-0 z-40 -mx-6 px-6 py-3 border-t border-border bg-card flex flex-wrap items-center justify-end gap-x-3 gap-y-2"
        >
          {dirty && (
            <span data-qa="gwg-unsaved" className="mr-auto inline-flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
              {t("admin.greenworld.unsaved")}
            </span>
          )}
          <SaveFlash state={flash} />
          {dirty && (
            <Button type="button" size="sm" variant="ghost" data-qa="gwg-discard" onClick={discard} disabled={saving}>
              {t("admin.greenworld.discard")}
            </Button>
          )}
          <Button
            type="button"
            onClick={onSave}
            disabled={disabled || !dirty || urlInvalid}
            data-qa="gwg-save"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t("admin.greenworld.saving")}
              </>
            ) : (
              t("admin.greenworld.save")
            )}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default GreenWorldGuideManager;
