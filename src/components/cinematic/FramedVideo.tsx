import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { framingFromFocalZoom, type Focal, type FitMode } from "@/hooks/useCinematicMedia";
import {
  heroFramingAttr,
  resolveHeroMediaStyle,
  useElementAspect,
  videoAspect,
} from "@/lib/hero-framing";

/**
 * PORT.3 — the framed-video render primitive, resolved through hero-framing.
 * The video sibling of FramedImage: ALL foreground geometry comes from
 * `resolveHeroMediaStyle`. Stored focal/zoom bridge via `framingFromFocalZoom`
 * and the container/media aspects are MEASURED (container box + video
 * metadata), so every surface that renders this component paints the exact
 * same source rectangle — the preview is the contract. Nothing here may set
 * object-fit/object-position on the FOREGROUND outside what the resolver
 * returns.
 *
 * Display modes (ADMIN.MEDIA.3):
 *   - "fill" (default): the resolver's cover math — gaps only at scale < 1,
 *     held by the brand-dark base.
 *   - "fit": letterboxed at natural aspect (the resolver's contain math) over
 *     a blurred, oversized cover copy of ITSELF — a single extra aria-hidden
 *     video with the same muted/loop playback. The backdrop keeps its shipped
 *     cover/blur/scale look; only the foreground rides the resolver.
 *
 * FIX.MEDIA.B: NO poster attribute on the <video>s — a video surface never
 * paints the hero photo. It holds on the site's dark base and fades the video
 * in once its first frame is decodable; `ready` re-arms whenever the src
 * changes (Replace video) so a stale frame never lingers. Under reduced
 * motion — or before a decodable src exists — the `poster` still renders
 * instead (identical across fit modes).
 *
 * The video is always muted / loop / playsInline (autoplay gated by
 * `autoPlay`). This same component powers the live hero, the editor drag
 * surface, and the device-tab previews.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerAspect = useElementAspect(containerRef);
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);

  // FIX.MEDIA.B: fade gate. `ready` re-arms on src change.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
  }, [src]);

  // Natural aspect arrives on loadedmetadata; re-check on mount/src change in
  // case metadata is already present (a cached clip fires no event we'd need).
  useEffect(() => {
    setMediaAspect(src ? videoAspect(videoRef.current) : null);
  }, [src]);

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
    muted: true,
    loop: true,
    playsInline: true,
    autoPlay,
    preload: "auto",
  } as const;

  const fitMode = fit === "fit";
  const fadeStyle: CSSProperties = {
    opacity: ready ? 1 : 0,
    transition: "opacity 400ms ease",
  };

  const styleInput = {
    mediaAspect,
    containerAspect,
    framing: framingFromFocalZoom(focal, zoom, fit),
  };

  // ONE persistent foreground <video> across BOTH modes — switching fill↔fit
  // must never remount it (a fresh element repaints on remount). The backdrop
  // is conditionally rendered FIRST so the foreground's child index never
  // shifts and React keeps the same node.
  return (
    <div
      ref={containerRef}
      data-qa={fitMode ? "framed-video-fit" : undefined}
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: "#0b0a08" }}
    >
      {fitMode ? (
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
            ...fadeStyle,
          }}
        />
      ) : null}
      <video
        {...videoBase}
        ref={videoRef}
        data-qa={videoDataQa}
        data-hero-framing={heroFramingAttr(styleInput)}
        onLoadedMetadata={(e) => setMediaAspect(videoAspect(e.currentTarget))}
        onLoadedData={() => setReady(true)}
        className={videoClassName}
        style={{ ...resolveHeroMediaStyle(styleInput), ...fadeStyle }}
      />
    </div>
  );
};

export default FramedVideo;
