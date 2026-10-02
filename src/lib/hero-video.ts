import { supabase } from "@/integrations/supabase/client";
import {
  STREAM_MAX_BYTES,
  STREAM_VIDEO_ACCEPT_ATTR,
  isAcceptedStreamVideo,
  isStreamRef,
  probeStreamSize,
} from "./stream";

/**
 * ADMIN.MEDIA.2 (ITEM 1) — hero-video validation + the setting.
 *
 * The cinematic hero renders a muted looping background video whenever the
 * site_settings key `cinematic_hero_video` holds a video value (video wins over
 * the image; Ken Burns is image-only). This module owns the admin write path:
 * client-side validation (type / size / duration) and the setting
 * read/write/clear helpers.
 *
 * MEDIA.VIDEO.2: new uploads go to Cloudflare Stream (src/lib/stream.ts) and
 * the setting stores `cfstream:<uid>`; a value that is still a gallery-bucket
 * URL keeps playing exactly as before. The size cap is Stream's single-request
 * ceiling (200 MB), the types are what a phone films (mp4, mov, webm), and the
 * 15.5 s rule is still probed locally before anything uploads.
 *
 * Native implementation. The validation shape (type, size cap, a short
 * max-duration probed from loadedmetadata) mirrors the TitiLinks paid hero-video
 * feature's upload guardrails — no code is shared with that product.
 */
export const HERO_VIDEO_KEY = "cinematic_hero_video";
/** VID.MODEL.1 — legacy key retained ONLY as a back-compat read fallback:
 *  pre-refactor uploads live here (today's prod video). New uploads write the
 *  canonical key and clear this one. */
export const HERO_VIDEO_PORTRAIT_KEY = "cinematic_hero_video_portrait";

export const HERO_VIDEO_ACCEPT_ATTR = STREAM_VIDEO_ACCEPT_ATTR;

export const HERO_VIDEO_MAX_BYTES = STREAM_MAX_BYTES;
/** Max clip length; a little slack over 15s absorbs container rounding. */
export const HERO_VIDEO_MAX_DURATION = 15.5; // seconds

/** Why a chosen file was rejected — maps to an admin.media.video.reject.* hint. */
export type HeroVideoRejectReason = "type" | "size" | "duration";
export type HeroVideoValidation = { ok: true } | { ok: false; reason: HeroVideoRejectReason };

export const isAcceptedHeroVideo = isAcceptedStreamVideo;

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

/**
 * Read a video's intrinsic dimensions (for the framing editors' clamp). A
 * Stream ref is measured through the player's own attach (MEDIA.VIDEO.2).
 */
export const probeVideoSize = (src: string): Promise<{ w: number; h: number }> =>
  isStreamRef(src) ? probeStreamSize(src) : probeUrlSize(src);

const probeUrlSize = (src: string): Promise<{ w: number; h: number }> =>
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

/** Read a hero-video setting by key, or null when absent/empty. */
const fetchSetting = async (key: string): Promise<string | null> => {
  const { data } = await supabase.from("site_settings").select("value").eq("key", key).maybeSingle();
  return typeof data?.value === "string" && data.value.length > 0 ? data.value : null;
};

const setSetting = async (key: string, url: string): Promise<void> => {
  const { error } = await supabase.from("site_settings").upsert({
    key,
    value: url,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

const clearSetting = async (key: string): Promise<void> => {
  const { error } = await supabase.from("site_settings").delete().eq("key", key);
  if (error) throw error;
};

/** VID.MODEL.1 — THE hero video: canonical key, falling back to the legacy
 *  portrait key (pre-refactor uploads live there). */
export const fetchHeroVideoResolved = async (): Promise<string | null> =>
  (await fetchSetting(HERO_VIDEO_KEY)) ?? (await fetchSetting(HERO_VIDEO_PORTRAIT_KEY));

/** Persist THE hero video (a `cfstream:` ref, or a legacy URL) under the canonical key. */
export const setCinematicHeroVideo = async (url: string): Promise<void> => {
  await setSetting(HERO_VIDEO_KEY, url);
  // VID.MODEL.1: single-video model — a fresh upload supersedes any legacy
  // portrait-key entry so exactly one key remains populated.
  await clearSetting(HERO_VIDEO_PORTRAIT_KEY);
};

/** VID.MODEL.1 — remove the hero video under BOTH keys (canonical + legacy
 *  portrait), so "remove hero video" leaves nothing behind. */
export const clearCinematicHeroVideoAll = async (): Promise<void> => {
  await clearSetting(HERO_VIDEO_KEY);
  await clearSetting(HERO_VIDEO_PORTRAIT_KEY);
};
