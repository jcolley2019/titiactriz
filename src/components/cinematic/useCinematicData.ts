import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { REEL_CHAPTER_KEYS } from "./reelChapters";

export type CinematicPhoto = {
  id: string;
  image_url: string;
  alt_text: string | null;
};

/**
 * Data for the cinematic home page — published gallery photos ordered by
 * sort_order (same source/pattern as the editorial <Gallery>), plus two optional
 * site_settings values:
 *   - "cinematic_hero_video" → a hero background video URL
 *   - "cinematic_hero_photo" → the admin-chosen hero photo, stored as either a
 *     gallery photo id OR a full image_url (both resolutions are supported).
 *
 * CINE.FLOW.6 adds the wide reel's chapter copy overrides ("reel.chapter1..3",
 * raw JSON strings resolved by reelChapters.ts against in-repo defaults).
 *
 * All keys are READ-ONLY here: if a row doesn't exist we simply fall back to
 * default behavior (first published photo / seeded copy). This code never
 * creates the keys.
 */
export function useCinematicData() {
  const [photos, setPhotos] = useState<CinematicPhoto[]>([]);
  const [heroVideo, setHeroVideo] = useState<string | null>(null);
  const [heroPhotoSetting, setHeroPhotoSetting] = useState<string | null>(null);
  const [reelChapterSettings, setReelChapterSettings] = useState<(string | null)[]>([
    null,
    null,
    null,
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const readSetting = async (key: string): Promise<string | null> => {
        const { data } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", key)
          .maybeSingle();
        return typeof data?.value === "string" && data.value.length > 0 ? data.value : null;
      };

      // FIX.MEDIA.D: fetch everything in PARALLEL and commit in one batch
      // below. Committing photos before the video setting resolves gives the
      // photo-hero branch a frame to paint (the "old hero photo flash") —
      // the page must learn photos + video as a single fact.
      const [photosRes, resolvedVideo, heroSetting, ...chapterSettings] = await Promise.all([
        supabase
          .from("gallery_photos")
          .select("id, image_url, alt_text")
          .eq("is_published", true)
          .eq("is_archived", false)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        // VID.MODEL.1: ONE hero video — canonical key first, then the legacy
        // portrait key where pre-refactor uploads still live.
        (async () =>
          (await readSetting("cinematic_hero_video")) ??
          (await readSetting("cinematic_hero_video_portrait")))(),
        // Optional admin-selected hero photo — absent key means default.
        readSetting("cinematic_hero_photo"),
        // CINE.FLOW.6 — optional chapter copy overrides, absent → seeds.
        ...REEL_CHAPTER_KEYS.map((key) => readSetting(key)),
      ]);

      if (cancelled) return;
      // Single batched commit (React 18 auto-batches these into one render).
      if (!photosRes.error && photosRes.data) {
        setPhotos(photosRes.data as CinematicPhoto[]);
      }
      if (resolvedVideo) setHeroVideo(resolvedVideo);
      if (heroSetting) setHeroPhotoSetting(heroSetting);
      setReelChapterSettings(chapterSettings);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { photos, heroVideo, heroPhotoSetting, reelChapterSettings, loading };
}

/**
 * Resolve the admin-selected hero photo against the published pool. Accepts an
 * id or a full image_url (the stored setting may be either); falls back to the
 * first published photo when the setting is absent or no longer resolves to a
 * published photo. Returns `undefined` only when there are no photos at all.
 */
export function resolveHeroPhoto(
  photos: CinematicPhoto[],
  setting: string | null,
): CinematicPhoto | undefined {
  if (setting) {
    const match = photos.find((p) => p.id === setting || p.image_url === setting);
    if (match) return match;
  }
  return photos[0];
}
