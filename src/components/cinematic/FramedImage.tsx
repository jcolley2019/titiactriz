import type { CSSProperties, ReactNode } from "react";
import type { Focal } from "@/hooks/useCinematicMedia";

/**
 * ADMIN.MEDIA.1 (ITEM 1b) — the one framed-image render primitive.
 *
 * Non-destructive framing: `focal` drives object-position and `zoom` (>= 1)
 * drives a scale from that same focal point. object-cover guarantees the frame
 * is always covered, and a zoom >= 1 only ever grows the image, so gaps can
 * never appear — the guarantee is structural, not clamped.
 *
 * The zoom transform rides a wrapper <div>, never the <img>, so it composes with
 * a Ken Burns animation applied to the image (via `imgClassName`) instead of
 * being overwritten by it. At zoom === 1 the wrapper carries no transform and the
 * output is identical to a bare object-cover <img> — the regression baseline.
 *
 * This same component renders the live hero, the live reel, the editor drag
 * surface, the device previews, and the slot thumbnails, so every surface is
 * WYSIWYG with the others by construction.
 */
type FramedImageProps = {
  src?: string;
  alt?: string;
  focal: Focal;
  zoom: number;
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
  imgClassName = "",
  imgDataQa,
  fallback,
  loading,
}: FramedImageProps) => {
  const objectPosition = `${focal.x * 100}% ${focal.y * 100}%`;
  const wrapperStyle: CSSProperties | undefined =
    zoom > 1
      ? { transform: `scale(${zoom})`, transformOrigin: objectPosition, willChange: "transform" }
      : undefined;

  return (
    <div className="h-full w-full" style={wrapperStyle}>
      {src ? (
        <img
          src={src}
          alt={alt}
          data-qa={imgDataQa}
          className={`h-full w-full object-cover ${imgClassName}`.trim()}
          style={{ objectPosition }}
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
