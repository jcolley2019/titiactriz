import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Pencil, Loader2, Upload, Trash2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import FramedImage from "@/components/cinematic/FramedImage";
import FramedVideo from "@/components/cinematic/FramedVideo";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";
import { fetchCinematicHeroPhotoId } from "@/hooks/useCinematicHero";
import {
  type CinematicMediaConfig,
  type SlotFraming,
  type Focal,
  HERO_DEFAULT_FOCAL,
  REEL_DEFAULT_FOCAL,
  DEFAULT_ZOOM,
  defaultSlot,
  defaultVideoFraming,
  videoFramingIsDefault,
  defaultCinematicMedia,
  fetchCinematicMedia,
  setCinematicMedia,
  clearCinematicMedia,
  getCinematicMedia,
} from "@/hooks/useCinematicMedia";
import {
  HERO_VIDEO_ACCEPT_ATTR,
  validateHeroVideo,
  uploadHeroVideo,
  fetchCinematicHeroVideo,
  setCinematicHeroVideo,
  clearCinematicHeroVideo,
} from "@/lib/hero-video";
import ImagePicker from "./ImagePicker";
import FramingEditor from "./FramingEditor";

/**
 * ADMIN.MEDIA.1 (ITEM 3) + ADMIN.MEDIA.2 — cinematic media manager.
 *
 * Four slots (Hero + Reel 1–3), each showing its resolved media WITH framing.
 * The camera action opens the gallery picker; the pencil opens the framing
 * editor. Choosing a photo (TA.8a-c) NEVER saves on its own — it opens the
 * editor at the slot's default framing, so the mandatory flow is pick → frame →
 * save. Reset clears the slot.
 *
 * ADMIN.MEDIA.2 adds hero video: upload (mp4/webm ≤60MB, ≤~15s) to the gallery
 * bucket under hero/, stored in cinematic_hero_video; when set, the hero card
 * shows the video (with a VIDEO badge) and the hero renders it over the photo
 * (which becomes its poster + reduced-motion still). Video framing lives in a
 * decoupled cinematic_media.hero.video block and is edited in the editor's video
 * mode. "Remove video" reverts to the image + Ken Burns instantly.
 *
 * Writes go to cinematic_media, and when every slot (including hero.video) is
 * back to default the key is removed so the absent-is-default contract holds.
 */
type SlotKind = "hero" | "reel";
type SlotDesc = { key: string; kind: SlotKind; reelIndex: number; titleKey?: string };

type EditorState = {
  slot: SlotDesc;
  photo: CinematicPhoto | null;
  focal: Focal;
  zoom: number;
  mode: "image" | "video";
  videoSrc?: string;
  poster?: string;
};

const REEL_TITLE_KEYS = ["hero.roles.actress", "hero.roles.streamer", "hero.roles.entrepreneur"];

const SLOTS: SlotDesc[] = [
  { key: "hero", kind: "hero", reelIndex: 0 },
  { key: "reel-0", kind: "reel", reelIndex: 0, titleKey: REEL_TITLE_KEYS[0] },
  { key: "reel-1", kind: "reel", reelIndex: 1, titleKey: REEL_TITLE_KEYS[1] },
  { key: "reel-2", kind: "reel", reelIndex: 2, titleKey: REEL_TITLE_KEYS[2] },
];

const HERO_SLOT = SLOTS[0];

const focalEq = (a: Focal, b: Focal) => a.x === b.x && a.y === b.y;

const slotIsDefault = (kind: SlotKind, s: SlotFraming) =>
  s.photo_id === null &&
  s.zoom === DEFAULT_ZOOM &&
  focalEq(s.focal, kind === "hero" ? HERO_DEFAULT_FOCAL : REEL_DEFAULT_FOCAL) &&
  (kind !== "hero" || videoFramingIsDefault(s.video));

const isAllDefault = (cfg: CinematicMediaConfig) =>
  slotIsDefault("hero", cfg.hero) && cfg.reel.every((s) => slotIsDefault("reel", s));

const readSlot = (cfg: CinematicMediaConfig, d: SlotDesc): SlotFraming =>
  d.kind === "hero" ? cfg.hero : cfg.reel[d.reelIndex];

const writeSlot = (
  cfg: CinematicMediaConfig,
  d: SlotDesc,
  slot: SlotFraming,
): CinematicMediaConfig =>
  d.kind === "hero"
    ? { ...cfg, hero: slot }
    : {
        ...cfg,
        reel: cfg.reel.map((s, i) => (i === d.reelIndex ? slot : s)) as [
          SlotFraming,
          SlotFraming,
          SlotFraming,
        ],
      };

/** Drop the hero's video framing block (used when removing/resetting the video). */
const stripHeroVideo = (cfg: CinematicMediaConfig): CinematicMediaConfig => {
  const { video: _video, ...heroNoVideo } = cfg.hero;
  return { ...cfg, hero: heroNoVideo };
};

const CinematicMediaManager = () => {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<CinematicPhoto[]>([]);
  const [config, setConfig] = useState<CinematicMediaConfig>(defaultCinematicMedia());
  const [legacyHero, setLegacyHero] = useState<string | null>(null);
  const [heroVideo, setHeroVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [pickerSlot, setPickerSlot] = useState<SlotDesc | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [photosRes, media, legacy, video] = await Promise.all([
        supabase
          .from("gallery_photos")
          .select("id, image_url, alt_text")
          .eq("is_published", true)
          .eq("is_archived", false)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        fetchCinematicMedia(),
        fetchCinematicHeroPhotoId(),
        fetchCinematicHeroVideo(),
      ]);
      if (cancelled) return;
      if (photosRes.data) setPhotos(photosRes.data as CinematicPhoto[]);
      if (media) setConfig(media);
      setLegacyHero(legacy);
      setHeroVideo(video);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = useMemo(
    () => getCinematicMedia(photos, config, legacyHero, heroVideo),
    [photos, config, legacyHero, heroVideo],
  );

  const resolvedFor = (d: SlotDesc) => (d.kind === "hero" ? resolved.hero : resolved.reel[d.reelIndex]);
  const heroPosterUrl = resolved.hero.photo?.image_url;

  const persist = async (next: CinematicMediaConfig, slotKey: string, kind: "saved" | "reset") => {
    setSavingKey(slotKey);
    try {
      if (isAllDefault(next)) await clearCinematicMedia();
      else await setCinematicMedia(next);
      setConfig(next);
      toast({
        title: t(kind === "saved" ? "admin.media.editor.saved" : "admin.media.editor.resetDone"),
        description: kind === "saved" ? t("admin.media.editor.savedDesc") : undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.media.editor.saveFailed");
      toast({ title: t("admin.media.editor.saveFailed"), description: msg, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  // Choosing a photo opens the framing editor at the slot's default framing.
  // Selection alone never writes — the editor's Save is the only persist path.
  const assignPhoto = (d: SlotDesc, photo: CinematicPhoto) => {
    const base = defaultSlot(d.kind);
    setPickerSlot(null);
    setEditor({ slot: d, photo, focal: base.focal, zoom: base.zoom, mode: "image" });
  };

  const openImageEditor = (d: SlotDesc) => {
    const r = resolvedFor(d);
    if (!r.photo) return;
    setEditor({ slot: d, photo: r.photo, focal: r.focal, zoom: r.zoom, mode: "image" });
  };

  const openVideoEditor = (src: string | null = heroVideo) => {
    if (!src) return;
    const v = config.hero.video ?? defaultVideoFraming();
    setEditor({
      slot: HERO_SLOT,
      photo: resolved.hero.photo ?? null,
      focal: v.focal,
      zoom: v.zoom,
      mode: "video",
      videoSrc: src,
      poster: heroPosterUrl,
    });
  };

  // Pencil: hero with an active video adjusts the VIDEO framing; otherwise image.
  const openEditor = (d: SlotDesc) => {
    if (d.kind === "hero" && heroVideo) openVideoEditor();
    else openImageEditor(d);
  };

  const saveFraming = (focal: Focal, zoom: number) => {
    if (!editor) return;
    const { slot, mode } = editor;
    let next: CinematicMediaConfig;
    if (mode === "video") {
      // Video framing is decoupled — preserve the hero's image framing.
      next = writeSlot(config, slot, { ...config.hero, video: { focal, zoom } });
    } else {
      if (!editor.photo) return;
      // On a hero image save, keep any existing video framing intact.
      const base: SlotFraming =
        slot.kind === "hero" && config.hero.video
          ? { photo_id: editor.photo.id, focal, zoom, video: config.hero.video }
          : { photo_id: editor.photo.id, focal, zoom };
      next = writeSlot(config, slot, base);
    }
    setEditor(null);
    void persist(next, slot.key, "saved");
  };

  const resetSlot = () => {
    if (!editor) return;
    const { slot, mode } = editor;
    let next: CinematicMediaConfig;
    if (mode === "video") {
      next = stripHeroVideo(config); // reset video framing to centered default
    } else {
      const base = defaultSlot(slot.kind);
      next =
        slot.kind === "hero" && config.hero.video
          ? writeSlot(config, slot, { ...base, video: config.hero.video })
          : writeSlot(config, slot, base);
    }
    setEditor(null);
    void persist(next, slot.key, "reset");
  };

  /* ---------------- Hero video: upload / remove ---------------- */
  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (!file) return;

    const check = await validateHeroVideo(file);
    if (!check.ok) {
      toast({
        title: t("admin.media.video.uploadFailed"),
        description: t(`admin.media.video.reject.${check.reason}`),
        variant: "destructive",
      });
      return;
    }

    setUploadingVideo(true);
    setUploadPct(0);
    try {
      const url = await uploadHeroVideo(file, setUploadPct);
      await setCinematicHeroVideo(url);
      setHeroVideo(url);
      toast({ title: t("admin.media.video.uploaded"), description: t("admin.media.video.uploadedDesc") });
      openVideoEditor(url); // straight into framing, video mode
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("admin.media.video.uploadFailed");
      toast({ title: t("admin.media.video.uploadFailed"), description: msg, variant: "destructive" });
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeVideo = async () => {
    setSavingKey("hero");
    try {
      await clearCinematicHeroVideo();
      // Drop the now-orphaned video framing so absent-is-default stays intact.
      if (config.hero.video) {
        const next = stripHeroVideo(config);
        if (isAllDefault(next)) await clearCinematicMedia();
        else await setCinematicMedia(next);
        setConfig(next);
      }
      setHeroVideo(null);
      toast({ title: t("admin.media.video.removed"), description: t("admin.media.video.removedDesc") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.media.video.removeFailed");
      toast({ title: t("admin.media.video.removeFailed"), description: msg, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const slotLabel = (d: SlotDesc) =>
    d.kind === "hero" ? t("admin.media.slots.hero") : t("admin.media.reelLabel", { n: d.reelIndex + 1 });

  const editorSlotLabel = (e: EditorState) =>
    e.mode === "video" ? `${slotLabel(e.slot)} · ${t("admin.media.video.badge")}` : slotLabel(e.slot);

  return (
    <div data-qa="admin-media" className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-foreground">{t("admin.media.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.media.subtitle")}</p>
      </div>

      {/* Hero video management (ADMIN.MEDIA.2). */}
      {!loading && (
        <div data-qa="media-hero-video" className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Video className="mt-0.5 h-4 w-4 text-accent" />
              <div>
                <h3 className="text-sm font-medium text-foreground">{t("admin.media.video.title")}</h3>
                <p className="text-xs text-muted-foreground">{t("admin.media.video.subtitle")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-qa="media-hero-upload-video"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploadingVideo}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-accent/5 disabled:opacity-60"
              >
                {uploadingVideo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {heroVideo ? t("admin.media.video.replaceVideo") : t("admin.media.video.uploadVideo")}
              </button>
              {heroVideo && (
                <button
                  type="button"
                  data-qa="media-hero-adjust-video"
                  onClick={() => openVideoEditor()}
                  disabled={uploadingVideo}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-accent/5 disabled:opacity-60"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("admin.media.video.adjustFraming")}
                </button>
              )}
              {heroVideo && (
                <button
                  type="button"
                  data-qa="media-hero-remove-video"
                  onClick={removeVideo}
                  disabled={uploadingVideo || savingKey === "hero"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("admin.media.video.removeVideo")}
                </button>
              )}
            </div>
          </div>

          <input
            ref={videoInputRef}
            type="file"
            accept={HERO_VIDEO_ACCEPT_ATTR}
            className="hidden"
            data-qa="media-hero-video-input"
            onChange={handleVideoFile}
          />

          {uploadingVideo && (
            <div data-qa="media-hero-upload-progress" className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${Math.max(5, uploadPct)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("admin.media.video.uploading")}</p>
            </div>
          )}

          {heroVideo && !uploadingVideo && (
            <p
              data-qa="media-hero-video-note"
              className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500"
            >
              {t("admin.media.video.precedenceNote")}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("admin.cinematicHero.loading")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SLOTS.map((d) => {
            const r = resolvedFor(d);
            const slotCfg = readSlot(config, d);
            const custom = !slotIsDefault(d.kind, slotCfg);
            const isHeroVideo = d.kind === "hero" && !!heroVideo;
            const canEdit = isHeroVideo || !!r.photo;
            return (
              <div
                key={d.key}
                data-qa="media-slot"
                data-slot={d.key}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-[#141210]">
                  {isHeroVideo ? (
                    <FramedVideo
                      src={heroVideo}
                      poster={heroPosterUrl}
                      focal={resolved.hero.videoFocal}
                      zoom={resolved.hero.videoZoom}
                      autoPlay
                      videoDataQa="media-slot-video"
                      fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
                    />
                  ) : r.photo ? (
                    <FramedImage src={r.photo.image_url} focal={r.focal} zoom={r.zoom} loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                      {t("admin.media.slotEmpty")}
                    </div>
                  )}

                  {isHeroVideo && (
                    <span
                      data-qa="media-slot-video-badge"
                      className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                    >
                      <Video className="h-2.5 w-2.5" />
                      {t("admin.media.video.badge")}
                    </span>
                  )}

                  <div className="absolute right-1.5 top-1.5 flex gap-1">
                    <button
                      type="button"
                      data-qa="media-slot-pick"
                      aria-label={t("admin.media.changePhoto")}
                      title={t("admin.media.changePhoto")}
                      onClick={() => setPickerSlot(d)}
                      disabled={savingKey === d.key}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      data-qa="media-slot-edit"
                      aria-label={t("admin.media.editFraming")}
                      title={t("admin.media.editFraming")}
                      onClick={() => openEditor(d)}
                      disabled={!canEdit || savingKey === d.key}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {savingKey === d.key && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                      <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{slotLabel(d)}</span>
                    <span
                      data-qa="media-slot-badge"
                      className={`text-[10px] uppercase tracking-wide ${
                        custom ? "text-accent" : "text-muted-foreground"
                      }`}
                    >
                      {custom ? t("admin.media.customized") : t("admin.media.usesDefault")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isHeroVideo
                      ? t("admin.media.video.slotDesc")
                      : d.kind === "hero"
                        ? t("admin.media.slots.heroDesc")
                        : t("admin.media.slots.reelDesc", { n: d.reelIndex + 1 })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pickerSlot && (
        <ImagePicker
          open={!!pickerSlot}
          slotLabel={slotLabel(pickerSlot)}
          photos={photos}
          currentPhotoId={resolvedFor(pickerSlot).photo?.id ?? null}
          onSelect={(photo) => assignPhoto(pickerSlot, photo)}
          onUploaded={(photo) => {
            setPhotos((prev) => (prev.some((p) => p.id === photo.id) ? prev : [...prev, photo]));
            assignPhoto(pickerSlot, photo);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {editor && (
        <FramingEditor
          open={!!editor}
          slotLabel={editorSlotLabel(editor)}
          kind={editor.slot.kind}
          reelIndex={editor.slot.reelIndex}
          reelTitle={editor.slot.titleKey ? t(editor.slot.titleKey) : undefined}
          photo={editor.photo ?? undefined}
          initialFocal={editor.focal}
          initialZoom={editor.zoom}
          mode={editor.mode}
          videoSrc={editor.videoSrc}
          poster={editor.poster}
          heroVideoActive={editor.mode === "image" && editor.slot.kind === "hero" && !!heroVideo}
          saving={savingKey === editor.slot.key}
          onSave={saveFraming}
          onReset={resetSlot}
          onCancel={() => setEditor(null)}
        />
      )}
    </div>
  );
};

export default CinematicMediaManager;
