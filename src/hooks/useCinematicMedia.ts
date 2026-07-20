import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  resolveHeroPhoto,
  type CinematicPhoto,
} from "@/components/cinematic/useCinematicData";

/**
 * ADMIN.MEDIA.1 (ITEM 1) — cinematic media model + resolver.
 *
 * site_settings key "cinematic_media" (jsonb):
 *   { hero: SlotFraming, reel: [SlotFraming, SlotFraming, SlotFraming] }
 * where SlotFraming = { photo_id: string|null, focal: {x,y} in 0..1, zoom >= 1 }.
 *
 * The absent-key-is-default contract is total: a missing key, a missing slot, or
 * a missing field all resolve to *exactly* today's behavior — the legacy
 * cinematic_hero_photo (first published photo) for the hero, the TA.6d focal
 * default, and the photos-2..4 dedupe pool for the reel. getCinematicMedia is
 * the single merge point (cinematic_media → legacy → defaults). It never writes.
 */

export const CINEMATIC_MEDIA_KEY = "cinematic_media";

export type Focal = { x: number; y: number };

/** One slot's stored framing. photo_id null = "use the resolver's default photo". */
export type SlotFraming = {
  photo_id: string | null;
  focal: Focal;
  zoom: number;
};

/** The full cinematic_media value — one hero slot plus exactly three reel slots. */
export type CinematicMediaConfig = {
  hero: SlotFraming;
  reel: [SlotFraming, SlotFraming, SlotFraming];
};

export const REEL_SLOT_COUNT = 3;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
export const DEFAULT_ZOOM = 1;

/** TA.6d hero anchor: object-position "center 8%" ≡ focal (0.5, 0.08). */
export const HERO_DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.08 };
/** Reel slides render object-cover centered today ≡ focal (0.5, 0.5). */
export const REEL_DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.5 };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const clampZoom = (n: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, n));

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

const normFocal = (raw: unknown, fallback: Focal): Focal => {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const f = raw as { x?: unknown; y?: unknown };
  return {
    x: isNum(f.x) ? clamp01(f.x) : fallback.x,
    y: isNum(f.y) ? clamp01(f.y) : fallback.y,
  };
};

const normSlot = (raw: unknown, defaultFocal: Focal): SlotFraming => {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    photo_id?: unknown;
    focal?: unknown;
    zoom?: unknown;
  };
  return {
    photo_id:
      typeof r.photo_id === "string" && r.photo_id.length > 0 ? r.photo_id : null,
    focal: normFocal(r.focal, defaultFocal),
    zoom: isNum(r.zoom) ? clampZoom(r.zoom) : DEFAULT_ZOOM,
  };
};

/** Default (untouched) slot config for a given slot kind. */
export const defaultSlot = (kind: "hero" | "reel"): SlotFraming => ({
  photo_id: null,
  focal: { ...(kind === "hero" ? HERO_DEFAULT_FOCAL : REEL_DEFAULT_FOCAL) },
  zoom: DEFAULT_ZOOM,
});

/** A fully-default config — the shape the editor starts from when the key is absent. */
export const defaultCinematicMedia = (): CinematicMediaConfig => ({
  hero: defaultSlot("hero"),
  reel: [defaultSlot("reel"), defaultSlot("reel"), defaultSlot("reel")],
});

/**
 * Parse a raw site_settings value into a normalized config, tolerant of partial
 * / malformed data. Returns null only when the key is genuinely absent, so
 * callers can honor the absent-is-default contract.
 */
export const parseCinematicMedia = (raw: unknown): CinematicMediaConfig | null => {
  let val: unknown = raw;
  if (typeof val === "string") {
    try {
      val = JSON.parse(val);
    } catch {
      return null;
    }
  }
  if (val === null || val === undefined || typeof val !== "object") return null;
  const v = val as { hero?: unknown; reel?: unknown };
  const reelRaw = Array.isArray(v.reel) ? v.reel : [];
  return {
    hero: normSlot(v.hero, HERO_DEFAULT_FOCAL),
    reel: [
      normSlot(reelRaw[0], REEL_DEFAULT_FOCAL),
      normSlot(reelRaw[1], REEL_DEFAULT_FOCAL),
      normSlot(reelRaw[2], REEL_DEFAULT_FOCAL),
    ],
  };
};

/** Read the stored cinematic_media, or null when the key is absent. */
export const fetchCinematicMedia = async (): Promise<CinematicMediaConfig | null> => {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", CINEMATIC_MEDIA_KEY)
    .maybeSingle();
  return parseCinematicMedia(data?.value ?? null);
};

/** Persist the full cinematic_media config (jsonb object). */
export const setCinematicMedia = async (cfg: CinematicMediaConfig): Promise<void> => {
  const { error } = await supabase.from("site_settings").upsert({
    key: CINEMATIC_MEDIA_KEY,
    value: cfg as unknown as Json,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

/** Restore full default behavior by removing the key (absent = default). */
export const clearCinematicMedia = async (): Promise<void> => {
  const { error } = await supabase
    .from("site_settings")
    .delete()
    .eq("key", CINEMATIC_MEDIA_KEY);
  if (error) throw error;
};

/** A slot resolved against the published pool, ready to render. */
export type ResolvedSlot = {
  photo?: CinematicPhoto;
  focal: Focal;
  zoom: number;
};

export type ResolvedCinematicMedia = {
  hero: ResolvedSlot & { videoSrc: string | null };
  reel: [ResolvedSlot, ResolvedSlot, ResolvedSlot];
};

const findPhoto = (
  photos: CinematicPhoto[],
  ref: string | null,
): CinematicPhoto | undefined =>
  ref ? photos.find((p) => p.id === ref || p.image_url === ref) : undefined;

/**
 * The one merge point. Produces the resolved hero + three reel slots.
 *
 * - hero photo: explicit cinematic_media hero.photo_id → else legacy
 *   cinematic_hero_photo (first published). Its framing applies only when the
 *   explicit photo resolves; otherwise the TA.6d defaults hold.
 * - reel slot i: explicit reel[i].photo_id → else the i-th photo of the
 *   non-hero pool (today's photos-2..4 dedupe). Framing applies only for an
 *   explicit, resolvable photo.
 *
 * With `media` null (or every slot untouched) the output equals today's render.
 */
export function getCinematicMedia(
  photos: CinematicPhoto[],
  media: CinematicMediaConfig | null,
  legacyHeroSetting: string | null,
  heroVideo: string | null,
): ResolvedCinematicMedia {
  const heroExplicit = findPhoto(photos, media?.hero.photo_id ?? null);
  const heroPhoto = heroExplicit ?? resolveHeroPhoto(photos, legacyHeroSetting);

  const hero: ResolvedSlot & { videoSrc: string | null } = {
    photo: heroPhoto,
    focal: heroExplicit ? media!.hero.focal : { ...HERO_DEFAULT_FOCAL },
    zoom: heroExplicit ? media!.hero.zoom : DEFAULT_ZOOM,
    videoSrc: heroVideo,
  };

  // Non-hero pool preserves the existing dedupe (reel never repeats the hero).
  const pool = photos.filter((p) => p.id !== heroPhoto?.id);

  const reel = ([0, 1, 2] as const).map((i): ResolvedSlot => {
    const slot = media?.reel?.[i];
    const explicit = findPhoto(photos, slot?.photo_id ?? null);
    if (explicit && slot) {
      return { photo: explicit, focal: slot.focal, zoom: slot.zoom };
    }
    return { photo: pool[i], focal: { ...REEL_DEFAULT_FOCAL }, zoom: DEFAULT_ZOOM };
  }) as [ResolvedSlot, ResolvedSlot, ResolvedSlot];

  return { hero, reel };
}
