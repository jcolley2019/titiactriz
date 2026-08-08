import { supabase } from "@/integrations/supabase/client";
import { BUCKET } from "./gallery-upload";

/**
 * EVENTS.VIDEO.1 — what an event card is allowed to call "video".
 *
 * Two sources, never both on one card:
 *
 *   uploaded — an mp4/webm in the gallery bucket under `events/`. Ours, served
 *              from our own origin, rendered by our own <video>.
 *   social   — a TikTok / Instagram / YouTube link, rendered by THE PLATFORM'S
 *              OWN PLAYER and nothing else.
 *
 * ## The integrity spine, stated as code
 *
 * A social card embeds the platform's official player at the platform's official
 * embed URL, built from the id that is already in the link the owner pasted.
 * Nothing here fetches a page, scrapes a thumbnail, or reconstructs a player. A
 * link this module cannot read is UNRECOGNISED — it is never guessed at, never
 * turned into a fake embed, and the public card falls back to the still image
 * (the admin is told; the visitor is never shown a broken frame).
 *
 * That is also why the short-link hosts are absent: `vm.tiktok.com/XXXX` carries
 * no video id, and the only way to learn it is to follow the redirect from a
 * server — a fetch of a user-supplied URL, which is the exact thing this brick
 * refuses to do. A short link is unrecognised, and the admin says so with the
 * fix ("paste the full link").
 */

export type EventVideoPlatform = "youtube" | "tiktok" | "instagram";

export type EventSocialVideo = {
  platform: EventVideoPlatform;
  /** The platform's own id for the post, read straight out of the link. */
  id: string;
  /** The platform's official embed endpoint — the only src an iframe ever gets. */
  embedUrl: string;
};

/** The shape a social embed's own player wants to be. */
export const SOCIAL_EMBED_SHAPE: Record<EventVideoPlatform, "landscape" | "portrait"> = {
  youtube: "landscape",
  tiktok: "portrait",
  instagram: "portrait",
};

const hostOf = (url: string): string | null => {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

const pathParts = (url: string): string[] => {
  try {
    return new URL(url.trim()).pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
};

/** YouTube ids are 11 chars of the URL-safe base64 alphabet. */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
/** TikTok video ids are a long run of digits. */
const TT_ID = /^\d{5,}$/;
/** Instagram shortcodes are URL-safe base64-ish, ~11 chars but not fixed. */
const IG_CODE = /^[A-Za-z0-9_-]{5,}$/;

const parseYouTube = (url: string): string | null => {
  const host = hostOf(url);
  if (!host) return null;
  const parts = pathParts(url);
  if (host === "youtu.be") return YT_ID.test(parts[0] ?? "") ? parts[0] : null;
  if (host !== "youtube.com" && !host.endsWith(".youtube.com")) return null;
  try {
    const v = new URL(url.trim()).searchParams.get("v");
    if (v && YT_ID.test(v)) return v;
  } catch {
    return null;
  }
  // /shorts/<id>, /embed/<id>, /live/<id> — the three path forms that carry one.
  const idx = parts.findIndex((p) => p === "shorts" || p === "embed" || p === "live");
  const candidate = idx >= 0 ? parts[idx + 1] : undefined;
  return candidate && YT_ID.test(candidate) ? candidate : null;
};

const parseTikTok = (url: string): string | null => {
  const host = hostOf(url);
  // vm./vt. short links carry no id — see the header: unrecognised, not guessed.
  if (host !== "tiktok.com" && !(host ?? "").endsWith(".tiktok.com")) return null;
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return null;
  const parts = pathParts(url);
  // /@user/video/<id> and the bare /v/<id>.
  const idx = parts.findIndex((p) => p === "video" || p === "v");
  const candidate = idx >= 0 ? (parts[idx + 1] ?? "").replace(/\.html$/, "") : undefined;
  return candidate && TT_ID.test(candidate) ? candidate : null;
};

/** Instagram's embed path keeps the post KIND, so a reel embeds as a reel. */
const parseInstagram = (url: string): { kind: "p" | "reel" | "tv"; code: string } | null => {
  const host = hostOf(url);
  if (host !== "instagram.com" && !(host ?? "").endsWith(".instagram.com")) return null;
  const parts = pathParts(url);
  const idx = parts.findIndex((p) => p === "p" || p === "reel" || p === "reels" || p === "tv");
  if (idx < 0) return null;
  const code = parts[idx + 1] ?? "";
  if (!IG_CODE.test(code)) return null;
  const raw = parts[idx];
  // `/reels/<code>` is the same post as `/reel/<code>`; embed uses the singular.
  const kind = raw === "reels" ? "reel" : (raw as "p" | "reel" | "tv");
  return { kind, code };
};

/**
 * Read a pasted link into the platform's own embed, or null when the link is
 * not a recognised video post. Null is a FINAL answer: callers fall back to the
 * still image rather than inventing a player.
 */
export const parseSocialVideo = (url: string): EventSocialVideo | null => {
  const trimmed = (url || "").trim();
  if (!trimmed) return null;

  const yt = parseYouTube(trimmed);
  if (yt) {
    return {
      platform: "youtube",
      id: yt,
      // Mounted only on click, so autoplay here is the visitor's own request.
      embedUrl: `https://www.youtube.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`,
    };
  }

  const tt = parseTikTok(trimmed);
  if (tt) {
    return { platform: "tiktok", id: tt, embedUrl: `https://www.tiktok.com/embed/v2/${tt}` };
  }

  const ig = parseInstagram(trimmed);
  if (ig) {
    return {
      platform: "instagram",
      id: ig.code,
      embedUrl: `https://www.instagram.com/${ig.kind}/${ig.code}/embed`,
    };
  }

  return null;
};

/** True when the owner typed something that is not a readable video link. */
export const socialVideoUnrecognised = (url: string): boolean =>
  !!(url || "").trim() && parseSocialVideo(url) === null;

/* ──────────────────────── which medium a card shows ──────────────────────── */

/**
 * ONE medium per card, decided in one place so the /events grid, the cinematic
 * act, the admin preview and the pin's decode-wait can never disagree about
 * what a row renders.
 *
 * `social` is returned even when `video` is null — an unreadable link still has
 * to be REPORTED (to the admin) rather than silently swallowed, and the public
 * render of that case is the poster on its own, which is what `poster` carries.
 */
export type EventMediaChoice =
  | { kind: "upload"; src: string; poster: string }
  | { kind: "social"; url: string; video: EventSocialVideo | null; poster: string }
  | { kind: "image"; src: string }
  | { kind: "none" };

export const resolveEventMedia = (item: {
  imageUrl?: string;
  videoUrl?: string;
  videoFileUrl?: string;
}): EventMediaChoice => {
  const poster = (item.imageUrl || "").trim();
  const upload = (item.videoFileUrl || "").trim();
  const social = (item.videoUrl || "").trim();

  if (upload) return { kind: "upload", src: upload, poster };
  if (social) return { kind: "social", url: social, video: parseSocialVideo(social), poster };
  if (poster) return { kind: "image", src: poster };
  return { kind: "none" };
};

/* ───────────────────────────── uploads ───────────────────────────── */

export const EVENT_VIDEO_ACCEPTED = ["video/mp4", "video/webm"];
export const EVENT_VIDEO_ACCEPT_ATTR = "video/mp4,video/webm,.mp4,.webm";

/**
 * The size cap, matching the hero video's (ADMIN.MEDIA.2). It is the storage
 * bucket's real ceiling as much as a taste ruling: an announcement clip that
 * cannot be uploaded is worse than one that had to be trimmed, and the admin
 * says which of the two happened.
 *
 * Deliberately NO duration cap. The hero video caps at 15.5s because it is a
 * background loop; an event announcement is content, and a length rule this
 * brick was never asked for would be a way to reject Joey's real file.
 */
export const EVENT_VIDEO_MAX_BYTES = 60 * 1024 * 1024; // 60 MB
export const EVENT_VIDEO_MAX_MB = 60;

export type EventVideoRejectReason = "type" | "size";
export type EventVideoValidation = { ok: true } | { ok: false; reason: EventVideoRejectReason };

export const isAcceptedEventVideo = (file: File): boolean => {
  const type = (file.type || "").toLowerCase();
  if (EVENT_VIDEO_ACCEPTED.includes(type)) return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".mp4") || name.endsWith(".webm");
};

/** Type, then size — an over-type file never has to be weighed. */
export const validateEventVideo = (file: File): EventVideoValidation => {
  if (!isAcceptedEventVideo(file)) return { ok: false, reason: "type" };
  if (file.size > EVENT_VIDEO_MAX_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
};

/**
 * Upload a validated event video to the gallery bucket under `events/` — the
 * same prefix the card's images already use — and return its public URL.
 */
export const uploadEventVideo = async (file: File): Promise<string> => {
  const type = (file.type || "").toLowerCase() === "video/webm" ? "video/webm" : "video/mp4";
  const ext = type === "video/webm" ? "webm" : "mp4";
  const path = `events/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: type });
  if (error) throw error;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
};
