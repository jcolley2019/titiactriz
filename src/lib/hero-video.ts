import { supabase } from "@/integrations/supabase/client";
import { BUCKET } from "./gallery-upload";

/**
 * ADMIN.MEDIA.2 (ITEM 1) — hero-video storage + validation.
 *
 * The cinematic hero renders a muted looping background video whenever the
 * site_settings key `cinematic_hero_video` holds a public URL (video wins over
 * the image; Ken Burns is image-only). This module owns the admin write path:
 * client-side validation (type / size / duration), the upload to the gallery
 * bucket under a `hero/` prefix, and the setting read/write/clear helpers.
 *
 * Native implementation. The validation shape (mp4/webm, size cap, a short
 * max-duration probed from loadedmetadata) mirrors the TitiLinks paid hero-video
 * feature's upload guardrails — no code is shared with that product.
 */
export const HERO_VIDEO_KEY = "cinematic_hero_video";

export const HERO_VIDEO_ACCEPTED = ["video/mp4", "video/webm"];
export const HERO_VIDEO_ACCEPT_ATTR = "video/mp4,video/webm,.mp4,.webm";

export const HERO_VIDEO_MAX_BYTES = 60 * 1024 * 1024; // 60 MB
/** Max clip length; a little slack over 15s absorbs container rounding. */
export const HERO_VIDEO_MAX_DURATION = 15.5; // seconds

/** Why a chosen file was rejected — maps to an admin.media.video.reject.* hint. */
export type HeroVideoRejectReason = "type" | "size" | "duration";
export type HeroVideoValidation = { ok: true } | { ok: false; reason: HeroVideoRejectReason };

export const isAcceptedHeroVideo = (file: File): boolean => {
  const type = (file.type || "").toLowerCase();
  if (HERO_VIDEO_ACCEPTED.includes(type)) return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".mp4") || name.endsWith(".webm");
};

/**
 * Read a video file's duration by decoding just its metadata. Resolves on the
 * first `loadedmetadata`; rejects if the file can't be decoded. The object URL
 * is always revoked so nothing leaks.
 */
export const probeVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (fn: () => void) => {
      v.onloadedmetadata = null;
      v.onerror = null;
      URL.revokeObjectURL(url);
      fn();
    };
    v.onloadedmetadata = () => {
      const d = v.duration;
      done(() => resolve(d));
    };
    v.onerror = () => done(() => reject(new Error("video decode failed")));
    v.src = url;
  });

/**
 * Full client-side gate: type → size → duration, short-circuiting at the first
 * failure so an over-type/over-size file never has to decode.
 */
export const validateHeroVideo = async (file: File): Promise<HeroVideoValidation> => {
  if (!isAcceptedHeroVideo(file)) return { ok: false, reason: "type" };
  if (file.size > HERO_VIDEO_MAX_BYTES) return { ok: false, reason: "size" };
  let duration: number;
  try {
    duration = await probeVideoDuration(file);
  } catch {
    return { ok: false, reason: "duration" };
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > HERO_VIDEO_MAX_DURATION) {
    return { ok: false, reason: "duration" };
  }
  return { ok: true };
};

/** Read a video file's intrinsic dimensions (for the framing editor's clamp). */
export const probeVideoSize = (src: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.crossOrigin = "anonymous";
    v.onloadedmetadata = () => {
      v.onloadedmetadata = null;
      v.onerror = null;
      resolve({ w: v.videoWidth, h: v.videoHeight });
    };
    v.onerror = () => {
      v.onloadedmetadata = null;
      v.onerror = null;
      reject(new Error("video decode failed"));
    };
    v.src = src;
  });

/**
 * Upload a validated hero video to the gallery bucket under `hero/`, returning
 * its public URL. supabase-js storage has no byte-progress callback, so
 * `onProgress` is driven at coarse phase boundaries (start → uploaded).
 */
export const uploadHeroVideo = async (
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> => {
  const type = (file.type || "").toLowerCase() === "video/webm" ? "video/webm" : "video/mp4";
  const ext = type === "video/webm" ? "webm" : "mp4";
  const path = `hero/${crypto.randomUUID()}.${ext}`;

  onProgress?.(10);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: type });
  if (error) throw error;
  onProgress?.(100);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
};

/** Read the stored hero video URL, or null when the key is absent/empty. */
export const fetchCinematicHeroVideo = async (): Promise<string | null> => {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", HERO_VIDEO_KEY)
    .maybeSingle();
  return typeof data?.value === "string" && data.value.length > 0 ? data.value : null;
};

/** Persist the hero video public URL. */
export const setCinematicHeroVideo = async (url: string): Promise<void> => {
  const { error } = await supabase.from("site_settings").upsert({
    key: HERO_VIDEO_KEY,
    value: url,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

/** Remove the hero video setting — the hero falls back to the image + Ken Burns. */
export const clearCinematicHeroVideo = async (): Promise<void> => {
  const { error } = await supabase.from("site_settings").delete().eq("key", HERO_VIDEO_KEY);
  if (error) throw error;
};
