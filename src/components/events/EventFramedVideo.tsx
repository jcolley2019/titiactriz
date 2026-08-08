import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { FitMode, Focal } from "@/hooks/useCinematicMedia";
import { useEventFramedBox } from "./event-framed";

/**
 * EVENTS.MEDIA.EDITOR.1b — the event card's framed uploaded-video primitive.
 *
 * The video sibling of EventFramedImage: one `<video>` in the well box, its
 * geometry style resolver output and nothing else. This primitive keeps the
 * EVENTS grammar the hero's FramedVideo deliberately refuses (their laws are
 * opposite, both on purpose):
 *
 *   - `poster` is a real poster ATTRIBUTE — the card image IS the video's
 *     poster (EVENTS.VIDEO.1), where a hero video surface must never paint
 *     the hero photo (FIX.MEDIA.B).
 *   - reduced motion keeps the `<video>` ELEMENT: autoplay off, `controls`
 *     on, poster frame held — reachable, not removed (law 7).
 *   - `preload="metadata"` — a card must learn its shape without eagerly
 *     pulling a 60 MB announcement clip.
 */
type Props = {
  src: string;
  poster?: string;
  focal: Focal;
  zoom: number;
  fit?: FitMode;
  autoPlay: boolean;
  controls: boolean;
  ariaLabel?: string;
  /** The well's cap classes (EVENTS.PORTRAIT.1 / NAV.1 — EventMedia's law). */
  boxClassName?: string;
  boxStyle?: CSSProperties;
  videoDataQa?: string;
  /** data-* pass-through onto the <video> — the events attribute grammar. */
  mediaAttrs?: Record<string, string | undefined>;
  onNaturalSize?: (w: number, h: number) => void;
};

const EventFramedVideo = ({
  src,
  poster,
  focal,
  zoom,
  fit = "fill",
  autoPlay,
  controls,
  ariaLabel,
  boxClassName = "",
  boxStyle,
  videoDataQa,
  mediaAttrs,
  onNaturalSize,
}: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const box = useEventFramedBox(focal, zoom, fit, onNaturalSize);

  // Metadata may already be present on a cached clip — re-check on src change.
  useEffect(() => {
    const el = videoRef.current;
    if (el && el.videoWidth && el.videoHeight) box.report(el.videoWidth, el.videoHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div
      ref={box.boxRef}
      className={`relative overflow-hidden ${boxClassName}`}
      style={{ ...box.boxStyle, ...boxStyle }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        data-qa={videoDataQa}
        data-hero-framing={box.framingAttr}
        {...mediaAttrs}
        aria-label={ariaLabel}
        muted
        loop
        playsInline
        autoPlay={autoPlay}
        controls={controls}
        preload="metadata"
        style={box.mediaStyle}
        onLoadedMetadata={(e) => box.report(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
      />
    </div>
  );
};

export default EventFramedVideo;
