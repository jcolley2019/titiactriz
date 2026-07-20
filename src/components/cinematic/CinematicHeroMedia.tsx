import FramedImage from "./FramedImage";
import type { CinematicPhoto } from "./useCinematicData";
import { HERO_DEFAULT_FOCAL, DEFAULT_ZOOM, type Focal } from "@/hooks/useCinematicMedia";

type Props = {
  photo?: CinematicPhoto;
  videoSrc?: string | null;
  reduced: boolean;
  /** Admin framing (ADMIN.MEDIA.1). Absent → TA.6d defaults, i.e. today's render. */
  focal?: Focal;
  zoom?: number;
};

/**
 * Hero background layer. Renders a muted looping <video> when a
 * `cinematic_hero_video` URL is configured, otherwise the resolved hero photo
 * with a slow Ken Burns drift. Framing (focal → object-position, zoom → scale)
 * comes from cinematic_media; with no admin data set, focal defaults to the
 * TA.6d anchor (center 8%) and zoom to 1, so the render is byte-for-byte today's.
 * A dark gradient scrim sits on top so the foreground type stays legible. The
 * video path is future-ready — the site_settings key is only ever read here.
 */
const CinematicHeroMedia = ({
  photo,
  videoSrc,
  reduced,
  focal = HERO_DEFAULT_FOCAL,
  zoom = DEFAULT_ZOOM,
}: Props) => {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {videoSrc ? (
        <video
          src={videoSrc}
          muted
          loop
          playsInline
          autoPlay
          className="h-full w-full object-cover"
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
