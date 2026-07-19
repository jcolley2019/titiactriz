import type { CinematicPhoto } from "./useCinematicData";

type Props = {
  photo?: CinematicPhoto;
  videoSrc?: string | null;
  reduced: boolean;
};

/**
 * Hero background layer. Renders a muted looping <video> when a
 * `cinematic_hero_video` URL is configured, otherwise the first published
 * gallery photo with a slow Ken Burns drift. A dark gradient scrim sits on top
 * so the foreground type stays legible. The video path is future-ready — the
 * site_settings key is only ever read, never created, by this feature.
 */
const CinematicHeroMedia = ({ photo, videoSrc, reduced }: Props) => {
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
      ) : photo ? (
        <img
          src={photo.image_url}
          alt=""
          data-qa="cinematic-hero-img"
          className={`h-full w-full object-cover ${reduced ? "" : "cine-kenburns"}`}
          // Anchor from the top so the frame never crops the top of her head.
          // Paired with the `center top` Ken Burns origin in cinematic.css, the
          // slow zoom pushes downward/outward instead of eating the top edge.
          style={{ objectPosition: "center top" }}
          decoding="async"
        />
      ) : (
        <div className="h-full w-full" style={{ backgroundColor: "#0b0a08" }} />
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
