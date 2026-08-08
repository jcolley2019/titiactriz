import {
  clampSourceZoom,
  DEFAULT_ZOOM,
  type ClassFraming,
  type ClassFramingPair,
  type DeviceClass,
  type FitMode,
  type Focal,
  type HeroVideoFraming,
  type VideoOrientation,
  type VideoSourceFraming,
} from "@/hooks/useCinematicMedia";
import { reelIsPhoneWidth } from "@/components/cinematic/reelSpotlight";

/**
 * EVENTS.MEDIA.EDITOR.1b — an event card's stored framing, in the hero system's
 * proven shapes and nothing else.
 *
 *   still image    → ClassFramingPair  { phone, wide }        (the reel's shape:
 *                    iPad and Desktop edit the one `wide` record, split at the
 *                    same 768px line the reel forks on — `reelIsPhoneWidth` IS
 *                    that line, imported rather than restated)
 *   uploaded video → HeroVideoFraming  { landscape, portrait } (the hero video's
 *                    shape: one record per VIEWPORT orientation, each carrying
 *                    focal / zoom / fit)
 *
 * ABSENT IS DEFAULT, TOTALLY. Every row written before this brick carries
 * neither field and must parse — and render — exactly as it does today. So the
 * coercers return `undefined` for anything that is not a stored framing object,
 * the admin OMITS a field whose value is all-defaults (a card framed and then
 * reset round-trips to byte-identical JSON), and the render treats a missing
 * record as "centered, unzoomed, fill" — which the event primitives paint as
 * precisely today's object-cover/contain well.
 *
 * The event card hangs no plate, so a `plate` field is parsed away here the same
 * way `normClassFraming` parses it off the reel's phone record: dropped at read,
 * never tolerated downstream. Social-linked video is DELIBERATELY absent from
 * this file — a platform's own player frames itself, so a social card stores no
 * framing at all.
 */

/** The event well's framing anchor: centered. (Same value the reel uses.) */
export const EVENT_DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.5 };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

const coerceFocal = (raw: unknown): Focal => {
  if (!raw || typeof raw !== "object") return { ...EVENT_DEFAULT_FOCAL };
  const f = raw as { x?: unknown; y?: unknown };
  return {
    x: isNum(f.x) ? clamp01(f.x) : EVENT_DEFAULT_FOCAL.x,
    y: isNum(f.y) ? clamp01(f.y) : EVENT_DEFAULT_FOCAL.y,
  };
};

const coerceFit = (raw: unknown): FitMode => (raw === "fit" ? "fit" : "fill");

/** An untouched image class record: centered, unzoomed. Fresh objects always. */
export const defaultEventClassFraming = (): ClassFraming => ({
  focal: { ...EVENT_DEFAULT_FOCAL },
  zoom: DEFAULT_ZOOM,
});

/** Both image class records at their defaults — never a shared reference. */
export const defaultEventImageFraming = (): ClassFramingPair => ({
  phone: defaultEventClassFraming(),
  wide: defaultEventClassFraming(),
});

/** An untouched video source record: centered, unzoomed, fill. */
export const defaultEventVideoSource = (): VideoSourceFraming => ({
  focal: { ...EVENT_DEFAULT_FOCAL },
  zoom: DEFAULT_ZOOM,
  fit: "fill",
});

/** Both video orientation records at their defaults. */
export const defaultEventVideoFraming = (): HeroVideoFraming => ({
  landscape: defaultEventVideoSource(),
  portrait: defaultEventVideoSource(),
});

/** The image well is fill-only (ClassFraming stores no fit) — cover floor 1. */
const coerceClass = (raw: unknown): ClassFraming => {
  const r = (raw && typeof raw === "object" ? raw : {}) as { focal?: unknown; zoom?: unknown };
  return {
    focal: coerceFocal(r.focal),
    zoom: isNum(r.zoom) ? clampSourceZoom(r.zoom, "fill") : DEFAULT_ZOOM,
  };
};

/**
 * Read a stored image framing, or undefined when the row carries none. A
 * half-written pair (one class present) seeds the missing class from the
 * default, mirroring `normClassSlot`'s tolerance for partial data.
 */
export const coerceEventImageFraming = (raw: unknown): ClassFramingPair | undefined => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as { phone?: unknown; wide?: unknown };
  if (r.phone === undefined && r.wide === undefined) return undefined;
  return { phone: coerceClass(r.phone), wide: coerceClass(r.wide) };
};

const coerceVideoSource = (raw: unknown): VideoSourceFraming => {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    focal?: unknown;
    zoom?: unknown;
    fit?: unknown;
  };
  const fit = coerceFit(r.fit);
  return {
    focal: coerceFocal(r.focal),
    zoom: isNum(r.zoom) ? clampSourceZoom(r.zoom, fit) : DEFAULT_ZOOM,
    fit,
  };
};

/** Read a stored video framing, or undefined when the row carries none. */
export const coerceEventVideoFraming = (raw: unknown): HeroVideoFraming | undefined => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as { landscape?: unknown; portrait?: unknown };
  if (r.landscape === undefined && r.portrait === undefined) return undefined;
  return { landscape: coerceVideoSource(r.landscape), portrait: coerceVideoSource(r.portrait) };
};

/** One record at its default — what an absent record renders as. */
export const eventClassIsDefault = (c: ClassFraming): boolean =>
  c.focal.x === EVENT_DEFAULT_FOCAL.x &&
  c.focal.y === EVENT_DEFAULT_FOCAL.y &&
  c.zoom === DEFAULT_ZOOM;

/** All-default image framing — the admin omits the field for this value. */
export const eventImageFramingIsDefault = (p: ClassFramingPair): boolean =>
  eventClassIsDefault(p.phone) && eventClassIsDefault(p.wide);

const videoSourceIsDefault = (s: VideoSourceFraming): boolean =>
  s.focal.x === EVENT_DEFAULT_FOCAL.x &&
  s.focal.y === EVENT_DEFAULT_FOCAL.y &&
  s.zoom === DEFAULT_ZOOM &&
  s.fit === "fill";

/** All-default video framing — the admin omits the field for this value. */
export const eventVideoFramingIsDefault = (v: HeroVideoFraming): boolean =>
  videoSourceIsDefault(v.landscape) && videoSourceIsDefault(v.portrait);

/**
 * Which image class a surface of `width` renders — the reel's own 768px line,
 * by identity. The admin's device tabs and the live card both pass through
 * here, so they cannot disagree about which record a width edits/paints.
 */
export const eventDeviceClassFor = (width: number): DeviceClass =>
  reelIsPhoneWidth(width) ? "phone" : "wide";

/**
 * Which video record a viewport renders — the hero's own orientation law
 * (VID.MODEL.1: aspect < 1 is a portrait viewport).
 */
export const eventOrientationFor = (width: number, height: number): VideoOrientation =>
  height > 0 && width / height < 1 ? "portrait" : "landscape";
