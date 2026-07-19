import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CinematicPhoto = {
  id: string;
  image_url: string;
  alt_text: string | null;
};

/**
 * Data for the cinematic home page — published gallery photos ordered by
 * sort_order (same source/pattern as the editorial <Gallery>), plus an optional
 * hero video URL read from site_settings key "cinematic_hero_video".
 *
 * The video key is READ-ONLY here: if the row doesn't exist we simply fall back
 * to the first photo. This code never creates the key.
 */
export function useCinematicData() {
  const [photos, setPhotos] = useState<CinematicPhoto[]>([]);
  const [heroVideo, setHeroVideo] = useState<string | null>(null);
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

      // Optional hero video — the key may not exist; that's expected.
      const { data: videoRow } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "cinematic_hero_video")
        .maybeSingle();

      if (!cancelled && typeof videoRow?.value === "string" && videoRow.value.length > 0) {
        setHeroVideo(videoRow.value);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { photos, heroVideo, loading };
}
