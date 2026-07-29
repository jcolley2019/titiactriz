import FramedImage from "./FramedImage";
import FramedVideo from "./FramedVideo";
import type { CinematicPhoto } from "./useCinematicData";
import {
  HERO_DEFAULT_FOCAL,
  DEFAULT_ZOOM,
  defaultVideoSource,
  type Focal,
  type VideoSourceFraming,
} from "@/hooks/useCinematicMedia";
import { useViewportOrientation } from "@/hooks/useViewportOrientation";

type Props = {
  photo?: CinematicPhoto;
  /** THE hero video source (single video, resolved upstream). */
  videoSrc?: string | null;
  reduced: boolean;
  /** Admin image framing (ADMIN.MEDIA.1). Absent → TA.6d defaults, i.e. today's render. */
  focal?: Focal;
  zoom?: number;
  /** Per-viewport-orientation video framing (VID.MODEL.1), decoupled from the image. */
  videoLandscape?: VideoSourceFraming;
  videoPortrait?: VideoSourceFraming;
};

/**
 * Hero background layer. Renders a muted looping <video> when a hero video is
 * configured, otherwise the resolved hero photo with a slow Ken Burns drift.
 *
 * VID.MODEL.1: ONE hero video. The viewport's orientation (re-evaluated on
 * resize) picks which FRAMING record applies to that single clip — portrait
 * viewports read the `portrait` record, landscape viewports the `landscape`
 * one — and each record carries its own focal/zoom + fill/fit display mode.
 * Video surfaces never paint the photo (FIX.MEDIA.B): they dark-hold then
 * fade in; the photo serves only as the reduced-motion still. A dark gradient
 * scrim sits on top so the foreground type stays legible.
 */
const CinematicHeroMedia = ({
  photo,
  videoSrc,
  reduced,
  focal = HERO_DEFAULT_FOCAL,
  zoom = DEFAULT_ZOOM,
  videoLandscape = defaultVideoSource(),
  videoPortrait = defaultVideoSource(),
}: Props) => {
  const orientation = useViewportOrientation();

  // VID.MODEL.1: ONE video. The viewport's orientation picks which FRAMING
  // record applies to it — phones read `portrait`, desktop reads `landscape`.
  const activeSrc = videoSrc;
  const activeFraming = orientation === "portrait" ? videoPortrait : videoLandscape;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {activeSrc ? (
        <FramedVideo
          src={activeSrc}
          poster={photo?.image_url}
          focal={activeFraming.focal}
          zoom={activeFraming.zoom}
          fit={activeFraming.fit}
          reduced={reduced}
          videoDataQa="cinematic-hero-video"
          posterDataQa="cinematic-hero-video-poster"
          fallback={<div className="h-full w-full" style={{ backgroundColor: "#0b0a08" }} />}
        />
      ) : (
        // TA.6d framing preserved via the focal default (center 8%); paired with
        // the `center top` Ken Burns origin the slow zoom still pushes
        // downward/outward and never clips her head. A saved admin focal/zoom
        // overrides it.
        <FramedImage
          src={photo?.image_url}
          focal={focal}
          zoom={zoom}
          imgClassName={reduced ? "" : "cine-kenburns"}
          imgDataQa="cinematic-hero-img"
          fallback={<div className="h-full w-full" style={{ backgroundColor: "#0b0a08" }} />}
        />
      )}

      {/* Dark cinematic scrim — heavier at the edges, lighter in the middle. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,10,8,0.72) 0%, rgba(11,10,8,0.42) 38%, rgba(11,10,8,0.60) 72%, rgba(11,10,8,0.92) 100%)",
        }}
      />
    </div>
  );
};

export default CinematicHeroMedia;
