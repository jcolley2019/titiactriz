import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { framingFromFocalZoom, type Focal, type FitMode } from "@/hooks/useCinematicMedia";
import {
  heroFramingAttr,
  imageAspect,
  resolveHeroMediaStyle,
  useElementAspect,
} from "@/lib/hero-framing";

/**
 * PORT.2 — the one framed-image render primitive, resolved through hero-framing.
 *
 * ALL image geometry comes from `resolveHeroMediaStyle`: the stored focal/zoom
 * is bridged via `framingFromFocalZoom` and the container/media aspects are
 * MEASURED (never assumed), so every surface that renders this component paints
 * the exact same source rectangle at the same aspect — the preview is the
 * contract. Nothing here may set object-fit/object-position outside what the
 * resolver returns.
 *
 * `fit` selects cover ("fill", hero surfaces) vs letterbox ("fit", reel
 * surfaces — the whole photo on dark edges). The backdrop is brand-dark, never
 * transparent, because the resolver reveals edges in fit mode and at scale < 1.
 *
 * The resolver's rectangle rides the <img> itself; `imgClassName` (Ken Burns)
 * animates transform on that same element, composing with the geometry
 * rectangle inside the overflow-hidden clip.
 */
type FramedImageProps = {
  src?: string;
  alt?: string;
  focal: Focal;
  zoom: number;
  /** Cover ("fill", default) or letterbox ("fit") — fixed per surface kind. */
  fit?: FitMode;
  /** Extra classes for the <img> (e.g. the Ken Burns class on the hero). */
  imgClassName?: string;
  /** data-qa marker placed on the <img>. */
  imgDataQa?: string;
  /** Rendered in place of the <img> when there's no src (color-block fallback). */
  fallback?: ReactNode;
  /** Omitted by default (matches the hero LCP image); the reel passes "lazy". */
  loading?: "lazy" | "eager";
};

const FramedImage = ({
  src,
  alt = "",
  focal,
  zoom,
  fit = "fill",
  imgClassName = "",
  imgDataQa,
  fallback,
  loading,
}: FramedImageProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerAspect = useElementAspect(containerRef);
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);

  // Natural aspect arrives onLoad; re-check on mount/src change in case the
  // image was already decoded (cache hit fires no load event we'd still need).
  useEffect(() => {
    setMediaAspect(src ? imageAspect(imgRef.current) : null);
  }, [src]);

  const styleInput = {
    mediaAspect,
    containerAspect,
    framing: framingFromFocalZoom(focal, zoom, fit),
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: "#0b0a08" }}
    >
      {src ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          data-qa={imgDataQa}
          data-hero-framing={heroFramingAttr(styleInput)}
          className={imgClassName}
          style={resolveHeroMediaStyle(styleInput)}
          onLoad={(e) => setMediaAspect(imageAspect(e.currentTarget))}
          loading={loading}
          decoding="async"
        />
      ) : (
        fallback ?? null
      )}
    </div>
  );
};

export default FramedImage;
