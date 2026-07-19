import { supabase } from "@/integrations/supabase/client";

/**
 * Read/write helpers for the admin-selectable cinematic hero photo, stored in
 * site_settings under "cinematic_hero_photo". Mirrors the fetch/set pattern used
 * by useHomeVariant. The stored value is a gallery photo id.
 *
 * Absence of the key means "default" (first published photo) — selecting the
 * Default option deletes the row rather than writing a sentinel, keeping the
 * absent-key-is-default contract intact.
 */
export const CINEMATIC_HERO_PHOTO_KEY = "cinematic_hero_photo";

/** Returns the stored hero photo id, or null when the key is absent/empty. */
export const fetchCinematicHeroPhotoId = async (): Promise<string | null> => {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", CINEMATIC_HERO_PHOTO_KEY)
    .maybeSingle();
  return typeof data?.value === "string" && data.value.length > 0 ? data.value : null;
};

/** Persist a specific gallery photo id as the cinematic hero. */
export const setCinematicHeroPhotoId = async (id: string): Promise<void> => {
  const { error } = await supabase.from("site_settings").upsert({
    key: CINEMATIC_HERO_PHOTO_KEY,
    value: id,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

/** Restore default behavior (first published photo) by removing the key. */
export const clearCinematicHeroPhoto = async (): Promise<void> => {
  const { error } = await supabase
    .from("site_settings")
    .delete()
    .eq("key", CINEMATIC_HERO_PHOTO_KEY);
  if (error) throw error;
};
