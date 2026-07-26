import FramedImage from "@/components/cinematic/FramedImage";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";
import { REEL_DEFAULT_FOCAL, DEFAULT_ZOOM, type Focal } from "@/hooks/useCinematicMedia";

/**
 * CINE.FLOW.2 — shared contract for the reel-act bake-off (QA only).
 *
 * The five variants are five different answers to ONE question: how does the
 * veil work? So everything that is NOT the veil is defined once, here, and
 * imported by all five. In particular the photo layer is written exactly once:
 * every variant paints its photo through the real `FramedImage` primitive, so
 * geometry still resolves through `resolveHeroMediaStyle` and the parity law is
 * never bypassed for a mock.
 *
 * CINE.FLOW.2-FIX — the photo is COVER ("fill"), not letterbox. On a phone the
 * act is edge-to-edge: the photograph occupies the entire frame and the veil and
 * type layer on top of it. Letterbox ("fit", which the live reel still uses)
 * left bare ground inside the frame and made several variants argue against
 * dark bands rather than against the photograph. Changing it here changes it for
 * all five at once — that is the point of this file.
 *
 * Nothing in this folder is imported by any live surface.
 */

export type BakeoffSlide = {
  photo?: CinematicPhoto;
  title: string;
  focal?: Focal;
  zoom?: number;
};

export type VariantProps = {
  slide: BakeoffSlide;
  /** 0-based slide index; drives the 01/02/03 numeral. */
  index: number;
  /** Bumped by the harness on every variant/slide/language change to replay the entrance. */
  playKey: number;
  reduced: boolean;
};

/** DESIGN.md normative tokens. Restated as constants, never re-derived. */
export const GROUND = "#0b0a08";
export const GOLD = "#C9A55C";
export const IVORY = "#f4ecdb";

export const DISPLAY = "var(--font-display)";
export const SANS = "var(--font-sans)";

export const numeral = (i: number) => String(i + 1).padStart(2, "0");

/**
 * The photo layer. Same pipeline as `CinematicReel`'s `SlideBg` and the same
 * resolver, but in cover mode: the source fills whatever box it is given and
 * overflow is cropped about the focal point, so no variant ever shows ground
 * inside the frame. `loading` is "eager" rather than "lazy" only so screenshot
 * runs are deterministic; that flag does not touch geometry.
 */
export const ReelPhoto = ({ slide }: { slide: BakeoffSlide }) => (
  <FramedImage
    src={slide.photo?.image_url}
    alt={slide.photo?.alt_text ?? ""}
    focal={slide.focal ?? REEL_DEFAULT_FOCAL}
    zoom={slide.zoom ?? DEFAULT_ZOOM}
    fit="fill"
    imgDataQa="bakeoff-reel-img"
    loading="eager"
    fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
  />
);

/** Every variant fills the phone frame identically. */
export const STAGE_CLASS = "absolute inset-0 overflow-hidden";
