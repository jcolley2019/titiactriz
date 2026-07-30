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
  type ReelSlotFraming,
  type ClassSlotFraming,
  type ClassFramingPair,
  type Focal,
  type HeroVideoFraming,
  HERO_DEFAULT_FOCAL,
  ABOUT_DEFAULT_FOCAL,
  REEL_DEFAULT_FOCAL,
  VIDEO_DEFAULT_FOCAL,
  DEFAULT_ZOOM,
  defaultHeroSlot,
  defaultAboutSlot,
  defaultReelSlot,
  classFramingIsDefault,
  defaultHeroVideo,
  heroVideoIsDefault,
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
  fetchHeroVideoResolved,
  setCinematicHeroVideo,
  clearCinematicHeroVideoAll,
} from "@/lib/hero-video";
import ImagePicker from "./ImagePicker";
import FramingEditor from "./FramingEditor";

/**
 * ADMIN.MEDIA.1 → .3 — cinematic media manager.
 *
 * Four slots (Hero + Reel 1–3), each showing its resolved media WITH framing.
 * Camera opens the gallery picker; the pencil opens the framing editor. Choosing
 * a photo NEVER saves on its own — it opens the editor at default framing, so the
 * mandatory flow is pick → frame → save.
 *
 * VID.MODEL.1 hero video: ONE optional video (cinematic_hero_video, resolved
 * with a fallback to the legacy cinematic_hero_video_portrait key), uploaded
 * through the validated path (hero/ prefix). The SAME clip plays on every
 * screen; each viewport orientation keeps its own focal/zoom/fill-or-fit
 * framing record in cinematic_media.hero.video {landscape,portrait}. The editor
 * frames whichever viewport orientation the active device tab implies. Removing
 * the video clears both keys and falls back to the image + Ken Burns. When
 * every slot (incl. hero.video) is default the cinematic_media key is removed so
 * the absent-is-default contract holds.
 */
type SlotKind = "hero" | "reel" | "about";
type SlotDesc = { key: string; kind: SlotKind; reelIndex: number; titleKey?: string };

type EditorState =
  | {
      mode: "image";
      slot: SlotDesc;
      photo: CinematicPhoto | null;
      focal: Focal;
      zoom: number;
      /** FRAME.SPLIT.1 — reel slots only: the two class records under edit. */
      classes?: ClassFramingPair;
    }
  | {
      mode: "video";
      slot: SlotDesc;
      videoSrc: string | null;
      initialVideo: HeroVideoFraming;
      poster?: string;
    };

const REEL_TITLE_KEYS = ["hero.roles.actress", "hero.roles.streamer", "hero.roles.entrepreneur"];

const SLOTS: SlotDesc[] = [
  { key: "hero", kind: "hero", reelIndex: 0 },
  { key: "reel-0", kind: "reel", reelIndex: 0, titleKey: REEL_TITLE_KEYS[0] },
  { key: "reel-1", kind: "reel", reelIndex: 1, titleKey: REEL_TITLE_KEYS[1] },
  { key: "reel-2", kind: "reel", reelIndex: 2, titleKey: REEL_TITLE_KEYS[2] },
  // ABOUT.MEDIA.1 — fifth card: the opt-in 3:4 About portrait panel.
  { key: "about", kind: "about", reelIndex: 0 },
];

const HERO_SLOT = SLOTS[0];

const focalEq = (a: Focal, b: Focal) => a.x === b.x && a.y === b.y;

/** The hero is the last single-record image slot (it carries the video block). */
const heroSlotIsDefault = (s: SlotFraming) =>
  s.photo_id === null &&
  s.zoom === DEFAULT_ZOOM &&
  focalEq(s.focal, HERO_DEFAULT_FOCAL) &&
  heroVideoIsDefault(s.video);

/**
 * FRAME.SPLIT.1 / ADMIN.RESET.1b — a class-split slot is untouched only when
 * BOTH classes are. Each kind names its own default anchor.
 */
const classSlotIsDefault = (s: ClassSlotFraming, defaultFocal: Focal) =>
  s.photo_id === null &&
  classFramingIsDefault(s.phone, defaultFocal) &&
  classFramingIsDefault(s.wide, defaultFocal);

const reelSlotIsDefault = (s: ReelSlotFraming) => classSlotIsDefault(s, REEL_DEFAULT_FOCAL);
const aboutSlotIsDefault = (s: ClassSlotFraming) => classSlotIsDefault(s, ABOUT_DEFAULT_FOCAL);

/** True when this card should read as customized (drives the slot badge). */
const descIsDefault = (cfg: CinematicMediaConfig, d: SlotDesc): boolean =>
  d.kind === "hero"
    ? heroSlotIsDefault(cfg.hero)
    : d.kind === "about"
      ? cfg.about === undefined || aboutSlotIsDefault(cfg.about)
      : reelSlotIsDefault(cfg.reel[d.reelIndex]);

// ABOUT.MEDIA.1 — About is opt-in: an absent key OR a default (photo_id null)
// slot both count as "unconfigured", so the key is dropped for the absent-is-
// default contract exactly like hero/reel.
const isAllDefault = (cfg: CinematicMediaConfig) =>
  heroSlotIsDefault(cfg.hero) &&
  cfg.reel.every(reelSlotIsDefault) &&
  (cfg.about === undefined || aboutSlotIsDefault(cfg.about));

/** The hero slot — the only single-record image slot left. */
const writeHeroSlot = (cfg: CinematicMediaConfig, hero: SlotFraming): CinematicMediaConfig => ({
  ...cfg,
  hero,
});

/** ADMIN.RESET.1b — the About panel's two class records. */
const writeAboutSlot = (
  cfg: CinematicMediaConfig,
  about: ClassSlotFraming,
): CinematicMediaConfig => ({ ...cfg, about });

/** FRAME.SPLIT.1 — replace one reel slot, leaving the other two untouched. */
const writeReelSlot = (
  cfg: CinematicMediaConfig,
  index: number,
  slot: ReelSlotFraming,
): CinematicMediaConfig => ({
  ...cfg,
  reel: cfg.reel.map((s, i) => (i === index ? slot : s)) as [
    ReelSlotFraming,
    ReelSlotFraming,
    ReelSlotFraming,
  ],
});

/** Drop the hero's video framing block (used when both sources are removed). */
const stripHeroVideo = (cfg: CinematicMediaConfig): CinematicMediaConfig => {
  const { video: _video, ...heroNoVideo } = cfg.hero;
  return { ...cfg, hero: heroNoVideo };
};

/** Merge a hero.video block, dropping it entirely when it is all-default. */
const withHeroVideo = (cfg: CinematicMediaConfig, video: HeroVideoFraming): CinematicMediaConfig =>
  heroVideoIsDefault(video) ? stripHeroVideo(cfg) : writeHeroSlot(cfg, { ...cfg.hero, video });

/**
 * ADMIN.MOBILE.2 — slot-card icon buttons are translucent glass, not solid
 * black pucks: a dark wash + backdrop blur lets the photo read through, and a
 * white hairline keeps the circle legible over both bright and dark frames.
 * One const so every card's controls are identical.
 */
const SLOT_ICON_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60";

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
        // VID.MODEL.1: resolve canonical → legacy portrait key (today's prod row).
        fetchHeroVideoResolved(),
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

  // ABOUT.MEDIA.1 — the About slot resolves to null when unconfigured; surface a
  // photo-less shape so the card falls to its empty state (never a pool photo).
  //
  // FRAME.SPLIT.1 / ADMIN.RESET.1b — a class-split card is one small 3:4
  // thumbnail, so it must pick a single class: it shows PHONE. That is the class
  // the editor's first tab opens on, so card → pencil is continuous, and it is
  // the crop Joey approves first. True for the reel and, now, for About.
  const resolvedFor = (
    d: SlotDesc,
  ): { photo?: CinematicPhoto; focal: Focal; zoom: number } => {
    if (d.kind === "hero") return resolved.hero;
    if (d.kind === "about") {
      const a = resolved.about;
      return a
        ? { photo: a.photo, focal: a.phone.focal, zoom: a.phone.zoom }
        : { focal: ABOUT_DEFAULT_FOCAL, zoom: DEFAULT_ZOOM };
    }
    const r = resolved.reel[d.reelIndex];
    return { photo: r.photo, focal: r.phone.focal, zoom: r.phone.zoom };
  };

  /** The two resolved class records behind a class-split card (reel or About). */
  const classesFor = (d: SlotDesc): ClassFramingPair | undefined => {
    if (d.kind === "reel") {
      const r = resolved.reel[d.reelIndex];
      return { phone: r.phone, wide: r.wide };
    }
    if (d.kind === "about" && resolved.about) {
      return { phone: resolved.about.phone, wide: resolved.about.wide };
    }
    return undefined;
  };
  const heroPosterUrl = resolved.hero.photo?.image_url;
  const anyHeroVideo = !!heroVideo;

  /**
   * ADMIN.RESET.1a — the ONE write path, and it is only ever a save. The editor's
   * Reset is a local transform control now (see FramingEditor): it changes the
   * open editor's active tab and nothing else, so nothing here is reachable
   * without the owner pressing Save.
   */
  const persist = async (next: CinematicMediaConfig, slotKey: string) => {
    setSavingKey(slotKey);
    try {
      if (isAllDefault(next)) await clearCinematicMedia();
      else await setCinematicMedia(next);
      setConfig(next);
      toast({
        title: t("admin.media.editor.saved"),
        description: t("admin.media.editor.savedDesc"),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.media.editor.saveFailed");
      toast({ title: t("admin.media.editor.saveFailed"), description: msg, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  // Choosing a photo opens the editor at the slot's default framing (never saves).
  const assignPhoto = (d: SlotDesc, photo: CinematicPhoto) => {
    const base =
      d.kind === "reel"
        ? defaultReelSlot().phone
        : d.kind === "about"
          ? defaultAboutSlot().phone
          : defaultHeroSlot();
    setPickerSlot(null);
    setEditor({ mode: "image", slot: d, photo, focal: base.focal, zoom: base.zoom });
  };

  const openImageEditor = (d: SlotDesc) => {
    const r = resolvedFor(d);
    if (!r.photo) return;
    // FRAME.SPLIT.1 / ADMIN.RESET.1b — a class-split slot opens with BOTH class
    // records, already seeded by the resolver, so the editor never re-derives the
    // compatibility law. `undefined` (a freshly picked photo) makes the editor
    // seed both classes from the default framing above, which is the same law.
    const classes = classesFor(d);
    setEditor({ mode: "image", slot: d, photo: r.photo, focal: r.focal, zoom: r.zoom, classes });
  };

  const openVideoEditor = () => {
    if (!anyHeroVideo) return;
    setEditor({
      mode: "video",
      slot: HERO_SLOT,
      videoSrc: heroVideo,
      initialVideo: config.hero.video ?? defaultHeroVideo(),
      poster: heroPosterUrl,
    });
  };

  // Pencil: hero with any active video adjusts the VIDEO framing; otherwise image.
  const openEditor = (d: SlotDesc) => {
    if (d.kind === "hero" && anyHeroVideo) openVideoEditor();
    else openImageEditor(d);
  };

  /** The hero image slot — the only single-record image save path left. */
  const saveImageFraming = (focal: Focal, zoom: number) => {
    if (!editor || editor.mode !== "image" || !editor.photo) return;
    const { slot } = editor;
    if (slot.kind !== "hero") return;
    // On a hero image save, keep any existing video framing intact.
    const base: SlotFraming = config.hero.video
      ? { photo_id: editor.photo.id, focal, zoom, video: config.hero.video }
      : { photo_id: editor.photo.id, focal, zoom };
    setEditor(null);
    void persist(writeHeroSlot(config, base), slot.key);
  };

  /**
   * FRAME.SPLIT.1 / ADMIN.RESET.1b — persist a class-split slot's two class
   * records. The editor hands both back; the class the owner did not touch returns
   * byte-identical to what it read, so one class's save can never rewrite the
   * other's crop. This is also where a legacy single-record slot is finally
   * rewritten in the new shape — on save, never on load. One function for the reel
   * and the About panel, so the two cannot drift apart.
   */
  const saveClassFraming = (classes: ClassFramingPair) => {
    if (!editor || editor.mode !== "image" || !editor.photo) return;
    const { slot } = editor;
    const next: ClassSlotFraming = {
      photo_id: editor.photo.id,
      phone: classes.phone,
      wide: classes.wide,
    };
    setEditor(null);
    if (slot.kind === "about") {
      void persist(writeAboutSlot(config, next), slot.key);
      return;
    }
    if (slot.kind !== "reel") return;
    void persist(writeReelSlot(config, slot.reelIndex, next), slot.key);
  };

  const saveVideoFraming = (video: HeroVideoFraming) => {
    setEditor(null);
    void persist(withHeroVideo(config, video), "hero");
  };

  /* ---------------- Hero video: upload / remove (VID.MODEL.1 — one video) ---------------- */
  const triggerUpload = () => {
    videoInputRef.current?.click();
  };

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
      // setCinematicHeroVideo writes canonical AND clears the legacy portrait key.
      await setCinematicHeroVideo(url);
      setHeroVideo(url);
      toast({ title: t("admin.media.video.uploaded"), description: t("admin.media.video.uploadedDesc") });
      // Straight into framing, video mode, on the single video.
      setEditor({
        mode: "video",
        slot: HERO_SLOT,
        videoSrc: url,
        initialVideo: config.hero.video ?? defaultHeroVideo(),
        poster: heroPosterUrl,
      });
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
      await clearCinematicHeroVideoAll();
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
    d.kind === "hero"
      ? t("admin.media.slots.hero")
      : d.kind === "about"
        ? t("admin.media.slots.about")
        : t("admin.media.reelLabel", { n: d.reelIndex + 1 });

  const editorSlotLabel = (e: EditorState) =>
    e.mode === "video" ? `${slotLabel(e.slot)} · ${t("admin.media.video.badge")}` : slotLabel(e.slot);

  // VID.MODEL.1: one video. The 3/4 slot tile is a portrait box, so preview it
  // with the portrait viewport framing record.
  const thumbSrc = heroVideo;
  const thumbFraming = resolved.hero.videoPortrait;

  return (
    <div data-qa="admin-media" className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-foreground">{t("admin.media.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.media.subtitle")}</p>
      </div>

      {/* Hero video management (VID.MODEL.1 — one video, framed per screen type). */}
      {!loading && (
        <div data-qa="media-hero-video" className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-2">
            <Video className="mt-0.5 h-4 w-4 text-accent" />
            <div>
              <h3 className="text-sm font-medium text-foreground">{t("admin.media.video.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("admin.media.video.subtitle")}</p>
            </div>
          </div>

          <div
            data-qa="media-hero-source"
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${heroVideo ? "text-accent" : "text-foreground"}`}>
                {t("admin.media.video.rowLabel")}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {heroVideo ? t("admin.media.video.sourceSet") : t("admin.media.video.sourceEmpty")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-qa="media-hero-upload"
                onClick={triggerUpload}
                disabled={uploadingVideo}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-accent/5 disabled:opacity-60"
              >
                {uploadingVideo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {heroVideo ? t("admin.media.video.replaceVideo") : t("admin.media.video.uploadVideo")}
              </button>
              {heroVideo && (
                <button
                  type="button"
                  data-qa="media-hero-remove"
                  onClick={removeVideo}
                  disabled={uploadingVideo || savingKey === "hero"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("admin.media.video.removeSource")}
                </button>
              )}
            </div>
          </div>

          {anyHeroVideo && (
            <button
              type="button"
              data-qa="media-hero-adjust-video"
              onClick={openVideoEditor}
              disabled={uploadingVideo}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-accent/5 disabled:opacity-60"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("admin.media.video.adjustFraming")}
            </button>
          )}

          <input
            ref={videoInputRef}
            type="file"
            accept={HERO_VIDEO_ACCEPT_ATTR}
            className="hidden"
            data-qa="media-hero-video-input"
            onChange={handleVideoFile}
          />

          {uploadingVideo && (
            <div data-qa="media-hero-upload-progress">
              <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                <div className="h-full bg-accent transition-all" style={{ width: `${Math.max(5, uploadPct)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("admin.media.video.uploading")}</p>
            </div>
          )}

          {anyHeroVideo && !uploadingVideo && (
            <p
              data-qa="media-hero-video-note"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500"
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
            const custom = !descIsDefault(config, d);
            const isHeroVideo = d.kind === "hero" && anyHeroVideo;
            const canEdit = isHeroVideo || !!r.photo;
            return (
              <div
                key={d.key}
                data-qa="media-slot"
                data-slot={d.key}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-[#141210]">
                  {isHeroVideo && thumbSrc ? (
                    <FramedVideo
                      src={thumbSrc}
                      poster={heroPosterUrl}
                      focal={thumbFraming.focal}
                      zoom={thumbFraming.zoom}
                      fit={thumbFraming.fit}
                      autoPlay
                      videoDataQa="media-slot-video"
                      fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
                    />
                  ) : r.photo ? (
                    <FramedImage
                      src={r.photo.image_url}
                      focal={r.focal}
                      zoom={r.zoom}
                      // CINE.FLOW.5: a slot card is a 3:4 identifier belonging
                      // to no device, so the reel shows its WIDE rendering —
                      // which is now the W2 plate, cropped to the subject in
                      // cover mode rather than letterboxed whole. Every reel
                      // surface is cover now, so there is nothing left to
                      // choose between: `reelSlideFit` is retired.
                      fit="fill"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                      {d.kind === "about" ? t("admin.media.about.empty") : t("admin.media.slotEmpty")}
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
                      className={`${SLOT_ICON_BUTTON} disabled:opacity-60`}
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
                      className={`${SLOT_ICON_BUTTON} disabled:opacity-40`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* ADMIN.MOBILE.2 — slot cards carry camera + pencil only. No
                      destructive control here: the owner's workflow is swap,
                      never empty, so a stray tap can't blank a section.
                      ADMIN.RESET.1a — Reset inside the editor is a transform
                      control and no longer clears a slot, so there is no
                      slot-clearing path on this screen at all. */}

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
                      {custom
                        ? t("admin.media.customized")
                        : d.kind === "about"
                          ? t("admin.media.about.none")
                          : t("admin.media.usesDefault")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isHeroVideo
                      ? t("admin.media.video.slotDesc")
                      : d.kind === "hero"
                        ? t("admin.media.slots.heroDesc")
                        : d.kind === "about"
                          ? t("admin.media.slots.aboutDesc")
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
          photo={
            editor.mode === "image" ? (editor.photo ?? undefined) : (resolved.hero.photo ?? undefined)
          }
          initialFocal={editor.mode === "image" ? editor.focal : VIDEO_DEFAULT_FOCAL}
          initialZoom={editor.mode === "image" ? editor.zoom : DEFAULT_ZOOM}
          initialClasses={editor.mode === "image" ? editor.classes : undefined}
          mode={editor.mode}
          videoSrc={editor.mode === "video" ? editor.videoSrc : undefined}
          initialVideo={editor.mode === "video" ? editor.initialVideo : undefined}
          poster={editor.mode === "video" ? editor.poster : undefined}
          saving={savingKey === editor.slot.key}
          onSave={saveImageFraming}
          onSaveClasses={saveClassFraming}
          onSaveVideo={saveVideoFraming}
          onCancel={() => setEditor(null)}
        />
      )}
    </div>
  );
};

export default CinematicMediaManager;
