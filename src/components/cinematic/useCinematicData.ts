import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
 * Both keys are READ-ONLY here: if a row doesn't exist we simply fall back to
 * default behavior (first published photo). This code never creates the keys.
 */
export function useCinematicData() {
  const [photos, setPhotos] = useState<CinematicPhoto[]>([]);
  const [heroVideo, setHeroVideo] = useState<string | null>(null);
  const [heroPhotoSetting, setHeroPhotoSetting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("id, image_url, alt_text")
        .eq("is_published", true)
        .eq("is_archived", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!cancelled && !error && data) {
        setPhotos(data as CinematicPhoto[]);
      }

      // VID.MODEL.1: ONE hero video. Resolve the canonical key first, falling
      // back to the legacy portrait key where pre-refactor uploads still live.
      const readSetting = async (key: string): Promise<string | null> => {
        const { data } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", key)
          .maybeSingle();
        return typeof data?.value === "string" && data.value.length > 0 ? data.value : null;
      };

      const resolvedVideo =
        (await readSetting("cinematic_hero_video")) ??
        (await readSetting("cinematic_hero_video_portrait"));

      if (!cancelled && resolvedVideo) {
        setHeroVideo(resolvedVideo);
      }

      // Optional admin-selected hero photo — absent key means default behavior.
      const { data: heroRow } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "cinematic_hero_photo")
        .maybeSingle();

      if (!cancelled && typeof heroRow?.value === "string" && heroRow.value.length > 0) {
        setHeroPhotoSetting(heroRow.value);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { photos, heroVideo, heroPhotoSetting, loading };
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
