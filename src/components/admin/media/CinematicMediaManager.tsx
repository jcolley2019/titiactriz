import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import FramedImage from "@/components/cinematic/FramedImage";
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
  defaultCinematicMedia,
  fetchCinematicMedia,
  setCinematicMedia,
  clearCinematicMedia,
  getCinematicMedia,
} from "@/hooks/useCinematicMedia";
import ImagePicker from "./ImagePicker";
import FramingEditor from "./FramingEditor";

/**
 * ADMIN.MEDIA.1 (ITEM 3) — cinematic media manager.
 *
 * Four slots (Hero + Reel 1–3), each showing its resolved photo WITH framing.
 * The camera action opens the gallery picker; the pencil action opens the
 * framing editor. Choosing a photo pins it at default framing; the editor
 * refines focal/zoom; reset clears the slot. Writes go to cinematic_media, and
 * when every slot is back to default the key is removed entirely so the
 * absent-is-default contract stays intact.
 */
type SlotKind = "hero" | "reel";
type SlotDesc = { key: string; kind: SlotKind; reelIndex: number; titleKey?: string };

const REEL_TITLE_KEYS = ["hero.roles.actress", "hero.roles.streamer", "hero.roles.entrepreneur"];

const SLOTS: SlotDesc[] = [
  { key: "hero", kind: "hero", reelIndex: 0 },
  { key: "reel-0", kind: "reel", reelIndex: 0, titleKey: REEL_TITLE_KEYS[0] },
  { key: "reel-1", kind: "reel", reelIndex: 1, titleKey: REEL_TITLE_KEYS[1] },
  { key: "reel-2", kind: "reel", reelIndex: 2, titleKey: REEL_TITLE_KEYS[2] },
];

const focalEq = (a: Focal, b: Focal) => a.x === b.x && a.y === b.y;

const slotIsDefault = (kind: SlotKind, s: SlotFraming) =>
  s.photo_id === null &&
  s.zoom === DEFAULT_ZOOM &&
  focalEq(s.focal, kind === "hero" ? HERO_DEFAULT_FOCAL : REEL_DEFAULT_FOCAL);

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

const CinematicMediaManager = () => {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<CinematicPhoto[]>([]);
  const [config, setConfig] = useState<CinematicMediaConfig>(defaultCinematicMedia());
  const [legacyHero, setLegacyHero] = useState<string | null>(null);
  const [heroVideo, setHeroVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [pickerSlot, setPickerSlot] = useState<SlotDesc | null>(null);
  const [editor, setEditor] = useState<
    { slot: SlotDesc; photo: CinematicPhoto; focal: Focal; zoom: number } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [photosRes, media, legacy, videoRes] = await Promise.all([
        supabase
          .from("gallery_photos")
          .select("id, image_url, alt_text")
          .eq("is_published", true)
          .eq("is_archived", false)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        fetchCinematicMedia(),
        fetchCinematicHeroPhotoId(),
        supabase
          .from("site_settings")
          .select("value")
          .eq("key", "cinematic_hero_video")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (photosRes.data) setPhotos(photosRes.data as CinematicPhoto[]);
      if (media) setConfig(media);
      setLegacyHero(legacy);
      const v = videoRes.data?.value;
      if (typeof v === "string" && v.length > 0) setHeroVideo(v);
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

  // Choosing a photo pins it at default framing for that slot kind.
  const assignPhoto = (d: SlotDesc, photo: CinematicPhoto) => {
    const base = defaultSlot(d.kind);
    const next = writeSlot(config, d, { ...base, photo_id: photo.id });
    setPickerSlot(null);
    void persist(next, d.key, "saved");
  };

  const saveFraming = (focal: Focal, zoom: number) => {
    if (!editor) return;
    const { slot, photo } = editor;
    const next = writeSlot(config, slot, { photo_id: photo.id, focal, zoom });
    setEditor(null);
    void persist(next, slot.key, "saved");
  };

  const resetSlot = () => {
    if (!editor) return;
    const { slot } = editor;
    const next = writeSlot(config, slot, defaultSlot(slot.kind));
    setEditor(null);
    void persist(next, slot.key, "reset");
  };

  const openEditor = (d: SlotDesc) => {
    const r = resolvedFor(d);
    if (!r.photo) return;
    setEditor({ slot: d, photo: r.photo, focal: r.focal, zoom: r.zoom });
  };

  const slotLabel = (d: SlotDesc) =>
    d.kind === "hero" ? t("admin.media.slots.hero") : t("admin.media.reelLabel", { n: d.reelIndex + 1 });

  return (
    <div data-qa="admin-media" className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-foreground">{t("admin.media.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.media.subtitle")}</p>
      </div>

      {heroVideo && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          {t("admin.media.heroVideoNote")}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("admin.cinematicHero.loading")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SLOTS.map((d) => {
            const r = resolvedFor(d);
            const slotCfg = readSlot(config, d);
            const custom = !slotIsDefault(d.kind, slotCfg);
            return (
              <div
                key={d.key}
                data-qa="media-slot"
                data-slot={d.key}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-[#141210]">
                  {r.photo ? (
                    <FramedImage src={r.photo.image_url} focal={r.focal} zoom={r.zoom} loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                      {t("admin.media.slotEmpty")}
                    </div>
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
                      disabled={!r.photo || savingKey === d.key}
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
                    {d.kind === "hero"
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
          slotLabel={slotLabel(editor.slot)}
          kind={editor.slot.kind}
          reelIndex={editor.slot.reelIndex}
          reelTitle={editor.slot.titleKey ? t(editor.slot.titleKey) : undefined}
          photo={editor.photo}
          initialFocal={editor.focal}
          initialZoom={editor.zoom}
          heroVideoActive={editor.slot.kind === "hero" && !!heroVideo}
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
