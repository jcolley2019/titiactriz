import type { CSSProperties, ReactNode } from "react";
import type { Focal, FitMode } from "@/hooks/useCinematicMedia";

/**
 * ADMIN.MEDIA.2 → .3 — the framed-video render primitive, the video sibling of
 * FramedImage. `focal` drives object-position and `zoom` drives a scale from that
 * same focal point (transform on the wrapper, never the media).
 *
 * Two display modes (ADMIN.MEDIA.3):
 *   - "fill" (default): object-cover crop, zoom >= 1 — gaps are structurally
 *     impossible, exactly the MEDIA.2 behavior.
 *   - "fit": the video is letterboxed/pillarboxed at its natural aspect over a
 *     blurred, oversized copy of ITSELF (a single extra aria-hidden video with
 *     the same muted/loop playback). zoom may drop below cover, so a portrait
 *     clip on a landscape canvas is shown whole instead of a cropped slice.
 *
 * The video is always muted / loop / playsInline (autoplay gated by `autoPlay`).
 * Under reduced motion — or before paint — the `poster` still renders instead
 * (poster logic is identical across fit modes). This same component powers the
 * live hero, the editor drag surface, and the device-tab previews.
 */
type FramedVideoProps = {
  src?: string;
  focal: Focal;
  zoom: number;
  fit?: FitMode;
  /** Poster image — instant paint + the reduced-motion still. */
  poster?: string;
  /** Reduced motion (or a forced still): render the poster image, no video. */
  reduced?: boolean;
  autoPlay?: boolean;
  videoClassName?: string;
  videoDataQa?: string;
  backdropDataQa?: string;
  posterDataQa?: string;
  /** Rendered when there's neither a video src nor a poster. */
  fallback?: ReactNode;
};

const FramedVideo = ({
  src,
  focal,
  zoom,
  fit = "fill",
  poster,
  reduced = false,
  autoPlay = true,
  videoClassName = "",
  videoDataQa,
  backdropDataQa,
  posterDataQa,
  fallback,
}: FramedVideoProps) => {
  const objectPosition = `${focal.x * 100}% ${focal.y * 100}%`;

  // Reduced motion (or no decodable src) → the poster still, framed identically.
  if (reduced || !src) {
    return (
      <div className="h-full w-full">
        {poster ? (
          <img
            src={poster}
            alt=""
            data-qa={posterDataQa}
            className="h-full w-full object-cover"
            style={{ objectPosition }}
            decoding="async"
          />
        ) : (
          (fallback ?? null)
        )}
      </div>
    );
  }

  const videoBase = {
    src,
    poster,
    muted: true,
    loop: true,
    playsInline: true,
    autoPlay,
  } as const;

  // Fit mode: full-frame video over a blurred, oversized copy of itself.
  if (fit === "fit") {
    return (
      <div data-qa="framed-video-fit" className="relative h-full w-full overflow-hidden">
        {/* Blurred backdrop — same playback, aria-hidden, fills the whole box. */}
        <video
          {...videoBase}
          data-qa={backdropDataQa}
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            objectPosition,
            transform: "scale(1.25)",
            filter: "blur(28px) brightness(0.65)",
            willChange: "transform",
          }}
        />
        {/* Foreground — the whole frame, letterboxed at its natural aspect. */}
        <video
          {...videoBase}
          data-qa={videoDataQa}
          className={`absolute inset-0 h-full w-full object-contain ${videoClassName}`.trim()}
          style={{
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: objectPosition,
            willChange: zoom !== 1 ? "transform" : undefined,
          }}
        />
      </div>
    );
  }

  // Fill mode (default): object-cover + a wrapper scale from the focal point.
  const wrapperStyle: CSSProperties | undefined =
    zoom > 1
      ? { transform: `scale(${zoom})`, transformOrigin: objectPosition, willChange: "transform" }
      : undefined;

  return (
    <div className="h-full w-full" style={wrapperStyle}>
      <video
        {...videoBase}
        data-qa={videoDataQa}
        className={`h-full w-full object-cover ${videoClassName}`.trim()}
        style={{ objectPosition }}
      />
    </div>
  );
};

export default FramedVideo;
