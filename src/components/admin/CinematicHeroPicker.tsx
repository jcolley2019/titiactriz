import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronDown, ChevronRight, Check, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  CINEMATIC_HERO_PHOTO_KEY,
  fetchCinematicHeroPhotoId,
  setCinematicHeroPhotoId,
  clearCinematicHeroPhoto,
} from "@/hooks/useCinematicHero";

type Photo = { id: string; image_url: string; alt_text: string | null };

// Sentinel used only in local UI state to represent the "Default" tile.
const DEFAULT_KEY = "__default__";

/**
 * Admin control for the cinematic hero photo (TA.6a). A visual picker of the
 * published gallery thumbnails plus a "Default (first photo)" option, persisting
 * to site_settings "cinematic_hero_photo" via the shared hero-setting helpers.
 * Lives alongside the Home page variant control and mirrors its collapsible card
 * styling. Only affects the /cinematic hero; absence of the key = default.
 */
const CinematicHeroPicker = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  // Current stored setting: null = default (first photo).
  const [current, setCurrent] = useState<string | null>(null);
  // Which tile is mid-save (photo id or DEFAULT_KEY), for the spinner.
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data }, stored] = await Promise.all([
        supabase
          .from("gallery_photos")
          .select("id, image_url, alt_text")
          .eq("is_published", true)
          .eq("is_archived", false)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        fetchCinematicHeroPhotoId(),
      ]);
      if (cancelled) return;
      if (data) setPhotos(data as Photo[]);
      setCurrent(stored);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A photo is selected if the stored value matches its id or its image_url
  // (the setting may hold either form).
  const isSelected = (photo: Photo) =>
    current !== null && (current === photo.id || current === photo.image_url);
  const defaultSelected = current === null;

  const selectDefault = async () => {
    if (defaultSelected || saving) return;
    setSaving(DEFAULT_KEY);
    try {
      await clearCinematicHeroPhoto();
      setCurrent(null);
      toast({ title: t("admin.cinematicHero.updated"), description: t("admin.cinematicHero.updatedDefault") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.cinematicHero.failedFallback");
      toast({ title: t("admin.cinematicHero.updateFailed"), description: msg, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const selectPhoto = async (photo: Photo) => {
    if (isSelected(photo) || saving) return;
    setSaving(photo.id);
    try {
      await setCinematicHeroPhotoId(photo.id);
      setCurrent(photo.id);
      toast({ title: t("admin.cinematicHero.updated"), description: t("admin.cinematicHero.updatedPhoto") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.cinematicHero.failedFallback");
      toast({ title: t("admin.cinematicHero.updateFailed"), description: msg, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const summary = defaultSelected
    ? t("admin.cinematicHero.default")
    : t("admin.cinematicHero.custom");

  return (
    <section
      data-qa="admin-cinematic-hero"
      data-setting-key={CINEMATIC_HERO_PHOTO_KEY}
      className="bg-card border border-border rounded-lg mb-10 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left hover:bg-accent/5 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <div>
            <h2 className="font-serif text-base text-foreground leading-tight">
              {t("admin.cinematicHero.title")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("admin.cinematicHero.subtitle")}</p>
          </div>
        </div>
        <span className="text-xs uppercase tracking-wider text-accent shrink-0">{summary}</span>
      </button>

      {open && (
        <div className="px-6 pb-5 border-t border-border pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("admin.cinematicHero.loading")}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {/* Default (first photo) tile */}
              <button
                type="button"
                onClick={selectDefault}
                disabled={saving !== null}
                aria-pressed={defaultSelected}
                className={`relative flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-md border p-2 text-center transition-all ${
                  defaultSelected
                    ? "border-accent bg-accent/10 ring-1 ring-accent"
                    : "border-border hover:border-accent/60 hover:bg-accent/5"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {saving === DEFAULT_KEY ? (
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                ) : (
                  <ImageOff className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="text-[11px] leading-tight text-foreground">
                  {t("admin.cinematicHero.defaultOption")}
                </span>
                {defaultSelected && (
                  <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>

              {/* Published photo thumbnails */}
              {photos.map((photo) => {
                const selected = isSelected(photo);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => selectPhoto(photo)}
                    disabled={saving !== null}
                    aria-pressed={selected}
                    aria-label={photo.alt_text ?? t("admin.cinematicHero.thumbAlt")}
                    className={`relative aspect-[4/5] overflow-hidden rounded-md border transition-all ${
                      selected
                        ? "border-accent ring-2 ring-accent"
                        : "border-border hover:border-accent/60"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <img
                      src={photo.image_url}
                      alt={photo.alt_text ?? ""}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    {(selected || saving === photo.id) && (
                      <span className="absolute inset-0 flex items-center justify-center bg-background/40">
                        {saving === photo.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-accent" />
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default CinematicHeroPicker;
