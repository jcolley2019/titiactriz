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
  /** Landscape (desktop/tablet) hero video source. */
  videoSrc?: string | null;
  /** Portrait (phone) hero video source. */
  videoPortraitSrc?: string | null;
  reduced: boolean;
  /** Admin image framing (ADMIN.MEDIA.1). Absent → TA.6d defaults, i.e. today's render. */
  focal?: Focal;
  zoom?: number;
  /** Per-orientation video framing (ADMIN.MEDIA.2 → .3), decoupled from the image. */
  videoLandscape?: VideoSourceFraming;
  videoPortrait?: VideoSourceFraming;
};

/**
 * Hero background layer. Renders a muted looping <video> when a hero video is
 * configured, otherwise the resolved hero photo with a slow Ken Burns drift.
 *
 * ADMIN.MEDIA.3: two orientation sources. The viewport's aspect (re-evaluated on
 * resize) picks the source — a portrait viewport prefers the portrait clip (else
 * landscape), a landscape viewport prefers landscape (else portrait) — and each
 * source carries its own framing + fill/fit display mode. The hero photo is the
 * video's poster (instant paint) and its reduced-motion still; under reduced
 * motion the poster image renders instead of autoplaying. A dark gradient scrim
 * sits on top so the foreground type stays legible.
 */
const CinematicHeroMedia = ({
  photo,
  videoSrc,
  videoPortraitSrc,
  reduced,
  focal = HERO_DEFAULT_FOCAL,
  zoom = DEFAULT_ZOOM,
  videoLandscape = defaultVideoSource(),
  videoPortrait = defaultVideoSource(),
}: Props) => {
  const orientation = useViewportOrientation();

  // Pick the source by viewport aspect, with the cross-orientation fallback.
  const useLandscape =
    orientation === "portrait" ? !videoPortraitSrc : !!videoSrc;
  const activeSrc = useLandscape ? videoSrc : videoPortraitSrc;
  const activeFraming = useLandscape ? videoLandscape : videoPortrait;

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
          backdropDataQa="cinematic-hero-video-backdrop"
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
