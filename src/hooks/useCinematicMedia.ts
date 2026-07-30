import { useEffect, useState } from "react";
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
 *   { hero: SlotFraming, reel: [ReelSlotFraming x3], about?: SlotFraming }
 * where SlotFraming = { photo_id: string|null, focal: {x,y} in 0..1, zoom >= 1 }.
 *
 * FRAME.SPLIT.1 — a REEL slot stores one framing record PER DEVICE CLASS:
 *   ReelSlotFraming = { photo_id, phone: {focal,zoom}, wide: {focal,zoom} }
 * The two classes are the reel's own render split (reelSpotlight's 768px line):
 * "phone" feeds the V1 edge-veil act, "wide" feeds the W2 plate. See
 * `normReelSlot` for the backward-compatibility law that lets a legacy
 * single-record slot keep rendering exactly as it does today.
 *
 * ABOUT.MEDIA.1: `about` is an OPT-IN portrait panel. Unlike the reel it has
 * NO pool fallback — an absent key or unresolvable photo_id resolves to null,
 * meaning "render no panel". It stores no `fit` (the panel is always fill).
 *
 * ADMIN.RESET.1b — the About panel now stores PER DEVICE CLASS too, on exactly
 * the reel's terms: `about = { photo_id, phone: {focal,zoom}, wide: {focal,zoom} }`
 * split at the same 768px line. `normClassSlot` carries the same
 * backward-compatibility law the reel has: a slot stored in the legacy
 * single-record shape seeds BOTH classes at read time, so every published About
 * panel keeps rendering exactly as it does today until an owner edits a class.
 *
 * ADMIN.ASPECT.1 — a WIDE record additionally carries the SHAPE of the plate it
 * hangs in: `wide = { focal, zoom, plate?: "portrait"|"landscape" }`. A landscape
 * photograph should not be forced into a portrait plate on desktop, and the choice
 * belongs to the wide record because it belongs to the wide composition — the
 * phone class hangs the portrait plate and has no opinion to store. The field is
 * WRITTEN ONLY WHEN LANDSCAPE (absent ≡ portrait), which is what keeps every
 * existing slide byte-identical, JSON included.
 *
 * ADMIN.ABOUT.2 — the About panel is a REEL-CLASS SURFACE, so `about` and a reel
 * slide are now the SAME KIND OF RECORD in every respect: both are read by
 * `normClassSlot` with the plate granted to their wide class. The ABOUT.MEDIA.1
 * fixed 3:4 frame is superseded — About's media paints in the plate law's box
 * (`plateLaw`), portrait by default and 3:2 landscape when the owner toggles the
 * wide record's shape, exactly as a slide does.
 *
 * The absent-key-is-default contract is total: a missing key, a missing slot, or
 * a missing field all resolve to *exactly* today's behavior — the legacy
 * cinematic_hero_photo (first published photo) for the hero, the TA.6d focal
 * default, and the photos-2..4 dedupe pool for the reel. getCinematicMedia is
 * the single merge point (cinematic_media → legacy → defaults). It never writes.
 */

export const CINEMATIC_MEDIA_KEY = "cinematic_media";

export type Focal = { x: number; y: number };

/** Display mode for a hero video whose aspect fights the viewport (ADMIN.MEDIA.3). */
export type FitMode = "fill" | "fit";

/** PORT.2 — bridge titiactriz's stored focal/zoom to the resolver's framing. */
export const framingFromFocalZoom = (
  focal: Focal,
  zoom: number,
  fit: FitMode = "fill",
): import("@/lib/hero-framing").HeroFraming => ({
  scale: zoom,
  posX: focal.x * 100,
  posY: focal.y * 100,
  fit,
});

/**
 * One hero-video SOURCE's framing + display mode (ADMIN.MEDIA.2 → .3). Decoupled
 * from the image's framing — the TitiLinks pattern. `fit` "fill" = object-cover
 * crop (default, zoom >= 1); "fit" = letterboxed at natural aspect over a blurred
 * backdrop, where zoom may drop below cover. Absent = centered, zoom 1, fill.
 */
export type VideoSourceFraming = {
  focal: Focal;
  zoom: number;
  fit: FitMode;
};

/**
 * Hero video framing, one entry per orientation source (ADMIN.MEDIA.3). Each of
 * the landscape (desktop/tablet) and portrait (phone) sources keeps its own
 * framing. The legacy single {focal,zoom} shape is migrated in as `landscape`.
 */
export type HeroVideoFraming = {
  landscape: VideoSourceFraming;
  portrait: VideoSourceFraming;
};

/** Which orientation source a render/edit targets. */
export type VideoOrientation = "landscape" | "portrait";

/** One slot's stored framing. photo_id null = "use the resolver's default photo". */
export type SlotFraming = {
  photo_id: string | null;
  focal: Focal;
  zoom: number;
  /** Hero slot only: per-orientation framing for the hero background video(s). */
  video?: HeroVideoFraming;
};

/**
 * FRAME.SPLIT.1 — which of the reel's two renderings a framing record serves.
 * The line is `reelSpotlight`'s REEL_PHONE_BREAKPOINT (768), the same one the
 * live act forks on; this type never carries a second opinion about it.
 */
export type DeviceClass = "phone" | "wide";

/**
 * ADMIN.ASPECT.1 — the SHAPE of the plate a WIDE record hangs in. "portrait" is
 * the W2 plate the act has drawn since CINE.FLOW.5; "landscape" is the 3:2 plate a
 * landscape photograph earns instead of being forced into a portrait box on
 * desktop. The geometry of each is one law — `plateLaw` in reelWide.tsx.
 *
 * ADMIN.ABOUT.2 — the choice is offered by every WIDE record of a reel-class
 * surface (a reel slide, and now the About panel). The reel's PHONE act stores
 * none because it is edge-to-edge and hangs no plate at all; the About panel's
 * phone class stores none because a phone panel is always the portrait plate.
 */
export type PlateAspect = "portrait" | "landscape";

/**
 * One device class's framing for a slide or panel — position and scale, plus (on
 * the reel's WIDE record only) the shape of the box that position is measured
 * against.
 */
export type ClassFraming = {
  focal: Focal;
  zoom: number;
  /**
   * ADMIN.ASPECT.1 — A WIDE RECORD ONLY, AND ONLY WHEN LANDSCAPE.
   *
   * Absent ≡ "portrait". Every record written before this brick, and every
   * portrait slide written after it, therefore stores byte-identical JSON — the
   * field materializes only when an owner chooses landscape, exactly as `about`
   * and `hero.video` materialize only when they are not the default.
   *
   * Two laws keep that honest and they live in one place each: `normClassSlot`
   * parses the PHONE class without a plate, so it can never carry one (ADMIN.ABOUT.2
   * left that half untouched while granting the field to About's wide record);
   * `plateAspectOf` is the single read, so no surface spells `?? "portrait"` for
   * itself and drifts.
   */
  plate?: PlateAspect;
};

/**
 * ADMIN.ASPECT.1 — the ONE read of a record's plate shape. Absent (and any
 * unrecognized value) is portrait, which is what makes a legacy slide render
 * exactly as it does today without a migration.
 */
export const plateAspectOf = (c?: ClassFraming | null): PlateAspect =>
  c?.plate === "landscape" ? "landscape" : "portrait";

/**
 * Both device classes' records. Every class-split slot carries exactly two —
 * reel slides (FRAME.SPLIT.1) and, since ADMIN.RESET.1b, the About panel.
 */
export type ClassFramingPair = Record<DeviceClass, ClassFraming>;

/**
 * FRAME.SPLIT.1 — a slot's stored framing as the chosen photo plus an
 * INDEPENDENT record per device class. There is deliberately no slot-level
 * focal/zoom: a reader must name the class it is rendering, so no surface can
 * silently pick up the other class's crop.
 */
export type ClassSlotFraming = {
  photo_id: string | null;
  phone: ClassFraming;
  wide: ClassFraming;
};

/**
 * One reel slot. Same shape as any class-split slot — the reel named it first.
 * ADMIN.ASPECT.1: the reel is also the one kind whose WIDE record may carry a
 * `plate`; the type is shared, and `normReelSlot` is what grants the field.
 */
export type ReelSlotFraming = ClassSlotFraming;

/** The full cinematic_media value — one hero slot plus exactly three reel slots. */
export type CinematicMediaConfig = {
  hero: SlotFraming;
  reel: [ReelSlotFraming, ReelSlotFraming, ReelSlotFraming];
  /**
   * ABOUT.MEDIA.1 — opt-in portrait panel; absent = no panel (no fallback).
   * ADMIN.RESET.1b / ADMIN.ABOUT.2 — a class-split, plate-carrying reel-class
   * slot: the same type, read by the same normalizer, as a reel slide.
   */
  about?: ClassSlotFraming;
};

export const REEL_SLOT_COUNT = 3;
export const MIN_ZOOM = 1;
/** Fit mode may zoom BELOW cover (down toward letterbox) — a sub-1 floor. */
export const FIT_MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const DEFAULT_ZOOM = 1;

/** TA.6d hero anchor: object-position "center 8%" ≡ focal (0.5, 0.08). */
export const HERO_DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.08 };
/** Reel slides render object-cover centered today ≡ focal (0.5, 0.5). */
export const REEL_DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.5 };
/** Hero video defaults to a plain centered, unzoomed cover. */
export const VIDEO_DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.5 };
/** ABOUT.MEDIA.1 — the About portrait panel fills its plate, centred. */
export const ABOUT_DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.5 };

/** Default (untouched) framing for one video source. */
export const defaultVideoSource = (): VideoSourceFraming => ({
  focal: { ...VIDEO_DEFAULT_FOCAL },
  zoom: DEFAULT_ZOOM,
  fit: "fill",
});

/** Default (untouched) hero-video framing — both orientation sources default. */
export const defaultHeroVideo = (): HeroVideoFraming => ({
  landscape: defaultVideoSource(),
  portrait: defaultVideoSource(),
});

/** FRAME.SPLIT.1 — an untouched reel class record: centered, unzoomed. */
export const defaultClassFraming = (): ClassFraming => ({
  focal: { ...REEL_DEFAULT_FOCAL },
  zoom: DEFAULT_ZOOM,
});

/** ADMIN.RESET.1b — an untouched About class record: centered, unzoomed. */
export const defaultAboutClassFraming = (): ClassFraming => ({
  focal: { ...ABOUT_DEFAULT_FOCAL },
  zoom: DEFAULT_ZOOM,
});

/**
 * FRAME.SPLIT.1 — both class records at their defaults. Each call builds FRESH
 * objects: the two classes must never share a reference, or editing one would
 * silently move the other.
 */
export const defaultReelClasses = (): ClassFramingPair => ({
  phone: defaultClassFraming(),
  wide: defaultClassFraming(),
});

/** ADMIN.RESET.1b — both About class records at their defaults, fresh objects. */
export const defaultAboutClasses = (): ClassFramingPair => ({
  phone: defaultAboutClassFraming(),
  wide: defaultAboutClassFraming(),
});

/**
 * True when one class record sits at its kind's default (centered, unzoomed, and
 * — ADMIN.ASPECT.1 — in the portrait plate). The default focal is passed in
 * because the reel and the About panel each own their own anchor — they happen to
 * agree on centre today, and a reader should not have to know that to trust this
 * function.
 */
export const classFramingIsDefault = (
  c: ClassFraming,
  defaultFocal: Focal = REEL_DEFAULT_FOCAL,
): boolean =>
  c.focal.x === defaultFocal.x &&
  c.focal.y === defaultFocal.y &&
  c.zoom === DEFAULT_ZOOM &&
  plateAspectOf(c) === "portrait";

/** True when a single source equals the centered / unzoomed / fill default. */
export const videoSourceIsDefault = (s: VideoSourceFraming | undefined): boolean =>
  !s ||
  (s.focal.x === VIDEO_DEFAULT_FOCAL.x &&
    s.focal.y === VIDEO_DEFAULT_FOCAL.y &&
    s.zoom === DEFAULT_ZOOM &&
    s.fit === "fill");

/** True when both hero-video sources are at their defaults. */
export const heroVideoIsDefault = (v: HeroVideoFraming | undefined): boolean =>
  !v || (videoSourceIsDefault(v.landscape) && videoSourceIsDefault(v.portrait));

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Zoom clamp for a framed source — fit mode allows sub-cover values. */
export const clampSourceZoom = (n: number, fit: FitMode) =>
  Math.min(MAX_ZOOM, Math.max(fit === "fit" ? FIT_MIN_ZOOM : MIN_ZOOM, n));

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

const normFocal = (raw: unknown, fallback: Focal): Focal => {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const f = raw as { x?: unknown; y?: unknown };
  return {
    x: isNum(f.x) ? clamp01(f.x) : fallback.x,
    y: isNum(f.y) ? clamp01(f.y) : fallback.y,
  };
};

const normFit = (raw: unknown): FitMode => (raw === "fit" ? "fit" : "fill");

const normVideoSource = (raw: unknown): VideoSourceFraming => {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    focal?: unknown;
    zoom?: unknown;
    fit?: unknown;
  };
  const fit = normFit(r.fit);
  return {
    focal: normFocal(r.focal, VIDEO_DEFAULT_FOCAL),
    zoom: isNum(r.zoom) ? clampSourceZoom(r.zoom, fit) : DEFAULT_ZOOM,
    fit,
  };
};

/**
 * Normalize the hero.video block. Back-compat: a legacy single {focal,zoom(,fit)}
 * shape (ADMIN.MEDIA.2) is read as the LANDSCAPE source, with portrait defaulting.
 */
const normHeroVideo = (raw: unknown): HeroVideoFraming | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as {
    landscape?: unknown;
    portrait?: unknown;
    focal?: unknown;
    zoom?: unknown;
    fit?: unknown;
  };
  if (r.landscape === undefined && r.portrait === undefined && (r.focal !== undefined || r.zoom !== undefined)) {
    return { landscape: normVideoSource(r), portrait: defaultVideoSource() };
  }
  return {
    landscape: normVideoSource(r.landscape),
    portrait: normVideoSource(r.portrait),
  };
};

// PORT.2: the slot kind fixes the image display mode (reel = fit, hero = fill),
// and fit mode legally zooms below cover — clamp with the mode's own floor so a
// saved sub-1 reel zoom round-trips instead of snapping back to 1.
const normSlot = (raw: unknown, defaultFocal: Focal, fit: FitMode): SlotFraming => {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    photo_id?: unknown;
    focal?: unknown;
    zoom?: unknown;
    video?: unknown;
  };
  const video = normHeroVideo(r.video);
  return {
    photo_id:
      typeof r.photo_id === "string" && r.photo_id.length > 0 ? r.photo_id : null,
    focal: normFocal(r.focal, defaultFocal),
    zoom: isNum(r.zoom) ? clampSourceZoom(r.zoom, fit) : DEFAULT_ZOOM,
    ...(video ? { video } : {}),
  };
};

/**
 * ADMIN.ASPECT.1 — a stored plate value. Only the exact string "landscape" is a
 * landscape plate; everything else (absent, null, a typo, a future value this
 * build does not know) is the portrait default, and is returned as UNDEFINED so
 * the normalized record stays sparse and portrait JSON never grows a field.
 */
const normPlate = (raw: unknown): PlateAspect | undefined =>
  raw === "landscape" ? "landscape" : undefined;

/**
 * One class record. `fit` is the ZOOM FLOOR's owner, not a geometry choice: reel
 * slides legally zoom BELOW cover (the `fit` floor of 0.5), so a saved sub-1 reel
 * zoom round-trips instead of snapping back to 1, while the About panel keeps the
 * cover floor of 1 it has always had.
 *
 * ADMIN.ASPECT.1 — `carriesPlate` is how the "wide record only" half of the plate
 * law is enforced at the read: a record parsed without it comes back with no plate
 * no matter what the stored JSON holds, so a stray field on a phone record is
 * dropped rather than silently ignored downstream.
 */
const normClassFraming = (
  raw: unknown,
  defaultFocal: Focal,
  fit: FitMode,
  carriesPlate = false,
): ClassFraming => {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    focal?: unknown;
    zoom?: unknown;
    plate?: unknown;
  };
  const plate = carriesPlate ? normPlate(r.plate) : undefined;
  return {
    focal: normFocal(r.focal, defaultFocal),
    zoom: isNum(r.zoom) ? clampSourceZoom(r.zoom, fit) : DEFAULT_ZOOM,
    ...(plate ? { plate } : {}),
  };
};

/**
 * FRAME.SPLIT.1 — normalize one class-split slot, and THE BACKWARD-COMPATIBILITY
 * LAW. ADMIN.RESET.1b generalized it from the reel to the About panel; both kinds
 * are read through this one function, so neither can drift from the law.
 *
 * A slot stored before the split holds a single slot-level {focal, zoom}. That
 * record SEEDS BOTH classes at read time, so every slide/panel renders
 * pixel-identical to what it rendered before the split until an owner edits a
 * class. Nothing is migrated: no SQL, no rewrite on load. The new two-record
 * shape is written only when the editor saves, and from then on each class is
 * read on its own.
 *
 * A half-written slot (one class present, the other not) falls back the same
 * way — the missing class inherits the legacy record if there is one, else the
 * kind's default. Each class gets its own object, never a shared reference.
 *
 * ADMIN.ASPECT.1 / ADMIN.ABOUT.2 — `widePlate` says whether THIS kind's WIDE
 * record may carry a plate shape. Both reel-class kinds pass true (a slide and the
 * About panel), and in both cases only the WIDE class is offered it: a phone
 * surface never hangs a chosen plate, so the field is parsed away here rather than
 * tolerated further down. The hero is not class-split at all.
 */
const normClassSlot = (
  raw: unknown,
  defaultFocal: Focal,
  fit: FitMode,
  widePlate = false,
): ClassSlotFraming => {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    photo_id?: unknown;
    focal?: unknown;
    zoom?: unknown;
    phone?: unknown;
    wide?: unknown;
  };
  // The legacy single record — read off the slot itself. With no focal/zoom
  // stored this normalizes to the kind's default, which is the same answer.
  const legacy = (carriesPlate: boolean) => normClassFraming(r, defaultFocal, fit, carriesPlate);
  const cls = (v: unknown, carriesPlate = false) =>
    v !== undefined && v !== null
      ? normClassFraming(v, defaultFocal, fit, carriesPlate)
      : legacy(carriesPlate);
  return {
    photo_id:
      typeof r.photo_id === "string" && r.photo_id.length > 0 ? r.photo_id : null,
    phone: cls(r.phone),
    wide: cls(r.wide, widePlate),
  };
};

/** ADMIN.ASPECT.1 — a slide's wide record carries the plate it hangs in. */
const normReelSlot = (raw: unknown): ReelSlotFraming =>
  normClassSlot(raw, REEL_DEFAULT_FOCAL, "fit", true);

/**
 * ADMIN.RESET.1b — the About panel is always cover, so its zoom floor is 1.
 * ADMIN.ABOUT.2 — and its wide record carries a plate on the reel's exact terms:
 * the panel IS a plate now, so the shape is the wide composition's to choose.
 */
const normAboutSlot = (raw: unknown): ClassSlotFraming =>
  normClassSlot(raw, ABOUT_DEFAULT_FOCAL, "fill", true);

/** FRAME.SPLIT.1 — an untouched reel slot: no photo, both classes default. */
export const defaultReelSlot = (): ReelSlotFraming => ({
  photo_id: null,
  ...defaultReelClasses(),
});

/** ADMIN.RESET.1b — an untouched About slot: no photo, both classes default. */
export const defaultAboutSlot = (): ClassSlotFraming => ({
  photo_id: null,
  ...defaultAboutClasses(),
});

/**
 * Default (untouched) HERO slot config. FRAME.SPLIT.1 / ADMIN.RESET.1b: the reel
 * and the About panel are deliberately NOT callers — their slots are two-record,
 * so they default through `defaultReelSlot` / `defaultAboutSlot` and tsc rejects
 * the old one-record path. The hero is the last single-record slot (it carries
 * the video block, which has its own per-orientation split).
 */
export const defaultHeroSlot = (): SlotFraming => ({
  photo_id: null,
  focal: { ...HERO_DEFAULT_FOCAL },
  zoom: DEFAULT_ZOOM,
});

/** A fully-default config — the shape the editor starts from when the key is absent. */
export const defaultCinematicMedia = (): CinematicMediaConfig => ({
  hero: defaultHeroSlot(),
  reel: [defaultReelSlot(), defaultReelSlot(), defaultReelSlot()],
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
  const v = val as { hero?: unknown; reel?: unknown; about?: unknown };
  const reelRaw = Array.isArray(v.reel) ? v.reel : [];
  // ABOUT.MEDIA.1 — the About panel is opt-in and stored fill (no fit); carry
  // the key only when the raw actually holds an about object. ADMIN.RESET.1b —
  // read through the class-split normalizer, whose legacy law seeds both classes
  // from a pre-split single record.
  const about =
    v.about && typeof v.about === "object" ? normAboutSlot(v.about) : undefined;
  return {
    hero: normSlot(v.hero, HERO_DEFAULT_FOCAL, "fill"),
    reel: [normReelSlot(reelRaw[0]), normReelSlot(reelRaw[1]), normReelSlot(reelRaw[2])],
    ...(about ? { about } : {}),
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

/**
 * Read-only hook for the cinematic_media config. Kept separate from
 * useCinematicData (which owns the photo pool) so the one-way import direction
 * useCinematicMedia → useCinematicData stays acyclic. `media` is null until the
 * fetch resolves and whenever the key is absent — the resolver treats both as
 * "use defaults".
 */
export function useCinematicMediaConfig(): {
  media: CinematicMediaConfig | null;
  loading: boolean;
} {
  const [media, setMedia] = useState<CinematicMediaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCinematicMedia()
      .then((m) => {
        if (!cancelled) setMedia(m);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { media, loading };
}

/** A slot resolved against the published pool, ready to render. */
export type ResolvedSlot = {
  photo?: CinematicPhoto;
  focal: Focal;
  zoom: number;
};

/**
 * VID.MODEL.1 — the hero has ONE video. Its resolved framing carries the single
 * source plus two framing records keyed to VIEWPORT orientation: the render
 * applies `videoLandscape` on landscape viewports and `videoPortrait` on portrait
 * ones (same clip, different framing); the admin edits whichever record a
 * device-preview tab implies.
 */
export type ResolvedHeroSlot = ResolvedSlot & {
  /** THE hero video (canonical, legacy-portrait fallback resolved upstream). */
  videoSrc: string | null;
  /** Framing applied on LANDSCAPE viewports (desktop/tablet). */
  videoLandscape: VideoSourceFraming;
  /** Framing applied on PORTRAIT viewports (phones). */
  videoPortrait: VideoSourceFraming;
};

/**
 * ABOUT.MEDIA.1 — the resolved About panel. Null whenever the About slot is
 * unconfigured or its photo can't be resolved (opt-in; no pool fallback). When
 * non-null the photo is guaranteed present, ready to render in its plate.
 *
 * ADMIN.RESET.1b — carries BOTH class records, like a resolved reel slide. There
 * is no slot-level focal/zoom to fall back to: the panel names the class it is
 * painting (at the same 768px line the reel forks on), so it cannot render one
 * class's crop while claiming to be the other.
 */
export type ResolvedAboutSlot = {
  photo: CinematicPhoto;
  phone: ClassFraming;
  wide: ClassFraming;
} | null;

/**
 * FRAME.SPLIT.1 — a resolved reel slide: the photo plus BOTH class records,
 * ready for whichever act paints. The render picks its class at the same 768px
 * line it already forks its composition on; the admin picks the class its
 * active device tab implies. There is no slot-level focal/zoom to fall back to,
 * so a surface cannot render one class's crop while claiming to be the other.
 */
export type ResolvedReelSlot = {
  photo?: CinematicPhoto;
  phone: ClassFraming;
  wide: ClassFraming;
};

export type ResolvedCinematicMedia = {
  hero: ResolvedHeroSlot;
  reel: [ResolvedReelSlot, ResolvedReelSlot, ResolvedReelSlot];
  /** ABOUT.MEDIA.1 — the About portrait panel, or null when unconfigured. */
  about: ResolvedAboutSlot;
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
 *   explicit, resolvable photo, and resolves as BOTH class records
 *   (FRAME.SPLIT.1) — the caller names the class it renders.
 * - about panel: explicit about.photo_id ONLY (opt-in; no pool fallback). An
 *   absent slot or unresolvable id resolves to null → the section renders no
 *   panel, byte-identical to today. ADMIN.RESET.1b: resolves as BOTH class
 *   records, on the reel's terms — the caller names the class it renders.
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

  // VID.MODEL.1: ONE video, framing decoupled from the image. Each viewport
  // orientation keeps its own framing record; applied whenever a video exists.
  const videoFraming = media?.hero.video;

  const hero: ResolvedHeroSlot = {
    photo: heroPhoto,
    focal: heroExplicit ? media!.hero.focal : { ...HERO_DEFAULT_FOCAL },
    zoom: heroExplicit ? media!.hero.zoom : DEFAULT_ZOOM,
    videoSrc: heroVideo,
    videoLandscape: videoFraming ? videoFraming.landscape : defaultVideoSource(),
    videoPortrait: videoFraming ? videoFraming.portrait : defaultVideoSource(),
  };

  // Non-hero pool preserves the existing dedupe (reel never repeats the hero).
  const pool = photos.filter((p) => p.id !== heroPhoto?.id);

  // FRAME.SPLIT.1: both class records travel together. Framing still applies
  // only for an explicit, resolvable photo — a pool fallback renders default.
  const reel = ([0, 1, 2] as const).map((i): ResolvedReelSlot => {
    const slot = media?.reel?.[i];
    const explicit = findPhoto(photos, slot?.photo_id ?? null);
    if (explicit && slot) {
      return { photo: explicit, phone: slot.phone, wide: slot.wide };
    }
    return { photo: pool[i], ...defaultReelClasses() };
  }) as [ResolvedReelSlot, ResolvedReelSlot, ResolvedReelSlot];

  // ABOUT.MEDIA.1 — opt-in panel: resolve ONLY an explicit, resolvable photo.
  // No pool fallback — an absent slot or dangling photo_id means "no panel".
  const aboutSlot = media?.about;
  const aboutExplicit = findPhoto(photos, aboutSlot?.photo_id ?? null);
  const about: ResolvedAboutSlot =
    aboutExplicit && aboutSlot
      ? { photo: aboutExplicit, phone: aboutSlot.phone, wide: aboutSlot.wide }
      : null;

  return { hero, reel, about };
}
