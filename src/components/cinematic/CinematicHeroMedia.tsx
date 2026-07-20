import FramedImage from "./FramedImage";
import FramedVideo from "./FramedVideo";
import type { CinematicPhoto } from "./useCinematicData";
import {
  HERO_DEFAULT_FOCAL,
  VIDEO_DEFAULT_FOCAL,
  DEFAULT_ZOOM,
  type Focal,
} from "@/hooks/useCinematicMedia";

type Props = {
  photo?: CinematicPhoto;
  videoSrc?: string | null;
  reduced: boolean;
  /** Admin image framing (ADMIN.MEDIA.1). Absent → TA.6d defaults, i.e. today's render. */
  focal?: Focal;
  zoom?: number;
  /** Admin video framing (ADMIN.MEDIA.2). Decoupled from the image's framing. */
  videoFocal?: Focal;
  videoZoom?: number;
};

/**
 * Hero background layer. Renders a muted looping <video> when a
 * `cinematic_hero_video` URL is configured, otherwise the resolved hero photo
 * with a slow Ken Burns drift. Image framing (focal → object-position, zoom →
 * scale) comes from cinematic_media; video framing is a separate, decoupled
 * config (ADMIN.MEDIA.2). With no admin data set, both default to today's render.
 * The hero photo is the video's poster (instant paint) and its reduced-motion
 * still — under reduced motion the poster image renders instead of autoplaying.
 * A dark gradient scrim sits on top so the foreground type stays legible.
 */
const CinematicHeroMedia = ({
  photo,
  videoSrc,
  reduced,
  focal = HERO_DEFAULT_FOCAL,
  zoom = DEFAULT_ZOOM,
  videoFocal = VIDEO_DEFAULT_FOCAL,
  videoZoom = DEFAULT_ZOOM,
}: Props) => {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {videoSrc ? (
        <FramedVideo
          src={videoSrc}
          poster={photo?.image_url}
          focal={videoFocal}
          zoom={videoZoom}
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
