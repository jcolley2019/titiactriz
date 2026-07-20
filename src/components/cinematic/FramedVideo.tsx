import type { CSSProperties, ReactNode } from "react";
import type { Focal } from "@/hooks/useCinematicMedia";

/**
 * ADMIN.MEDIA.2 (ITEM 3) — the framed-video render primitive, the video sibling
 * of FramedImage. `focal` drives object-position and `zoom` (>= 1) drives a
 * scale from that same focal point (transform on the wrapper, never the media),
 * so object-cover + zoom >= 1 make gaps structurally impossible — identical math
 * to FramedImage, so the two surfaces stay WYSIWYG.
 *
 * The video is always muted / loop / playsInline (autoplay is gated by
 * `autoPlay`, default true). Under reduced motion — or before the video can
 * paint — the `poster` image renders instead, which is also the hero's
 * instant-paint LCP. This same component powers the live hero, the editor drag
 * surface, and the device-tab previews.
 */
type FramedVideoProps = {
  src?: string;
  focal: Focal;
  zoom: number;
  /** Poster image — instant paint + the reduced-motion still. */
  poster?: string;
  /** Reduced motion (or a forced still): render the poster image, no video. */
  reduced?: boolean;
  autoPlay?: boolean;
  videoClassName?: string;
  videoDataQa?: string;
  posterDataQa?: string;
  /** Rendered when there's neither a video src nor a poster. */
  fallback?: ReactNode;
};

const FramedVideo = ({
  src,
  focal,
  zoom,
  poster,
  reduced = false,
  autoPlay = true,
  videoClassName = "",
  videoDataQa,
  posterDataQa,
  fallback,
}: FramedVideoProps) => {
  const objectPosition = `${focal.x * 100}% ${focal.y * 100}%`;
  const wrapperStyle: CSSProperties | undefined =
    zoom > 1
      ? { transform: `scale(${zoom})`, transformOrigin: objectPosition, willChange: "transform" }
      : undefined;

  // Reduced motion (or no decodable src) → the poster still, framed identically.
  const showPoster = reduced || !src;

  return (
    <div className="h-full w-full" style={wrapperStyle}>
      {showPoster ? (
        poster ? (
          <img
            src={poster}
            alt=""
            data-qa={posterDataQa}
            className="h-full w-full object-cover"
            style={{ objectPosition }}
            decoding="async"
          />
        ) : (
          fallback ?? null
        )
      ) : (
        <video
          src={src}
          poster={poster}
          data-qa={videoDataQa}
          muted
          loop
          playsInline
          autoPlay={autoPlay}
          className={`h-full w-full object-cover ${videoClassName}`.trim()}
          style={{ objectPosition }}
        />
      )}
    </div>
  );
};

export default FramedVideo;
