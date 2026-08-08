import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { FitMode, Focal } from "@/hooks/useCinematicMedia";
import { useEventFramedBox } from "./event-framed";

/**
 * EVENTS.MEDIA.EDITOR.1b — the event card's framed still-image primitive.
 *
 * Thin by design: the well box (sized by EventMedia's cap classes + the media's
 * own ratio) wraps one `<img>` whose ENTIRE geometry style is resolver output —
 * see event-framed.ts for the branch law. The events attribute grammar rides
 * the element itself (`data-aspect` / `data-aspect-source` etc. arrive via
 * `mediaAttrs`), because the specs read the medium, not a wrapper.
 */
type Props = {
  src: string;
  alt: string;
  focal: Focal;
  zoom: number;
  fit?: FitMode;
  /** The well's cap classes (EVENTS.PORTRAIT.1 / NAV.1 — EventMedia's law). */
  boxClassName?: string;
  boxStyle?: CSSProperties;
  imgDataQa?: string;
  /** data-* pass-through onto the <img> — the events attribute grammar. */
  mediaAttrs?: Record<string, string | undefined>;
  loading?: "lazy" | "eager";
  onNaturalSize?: (w: number, h: number) => void;
};

const EventFramedImage = ({
  src,
  alt,
  focal,
  zoom,
  fit = "fill",
  boxClassName = "",
  boxStyle,
  imgDataQa,
  mediaAttrs,
  loading,
  onNaturalSize,
}: Props) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const box = useEventFramedBox(focal, zoom, fit, onNaturalSize);

  // Cache hit fires no load event we'd still need — re-check on src change.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.naturalWidth && el.naturalHeight) box.report(el.naturalWidth, el.naturalHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div
      ref={box.boxRef}
      className={`relative overflow-hidden ${boxClassName}`}
      style={{ ...box.boxStyle, ...boxStyle }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        data-qa={imgDataQa}
        data-hero-framing={box.framingAttr}
        {...mediaAttrs}
        style={box.mediaStyle}
        onLoad={(e) => box.report(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
      />
    </div>
  );
};

export default EventFramedImage;
