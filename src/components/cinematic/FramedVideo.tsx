import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import cornerOrn from "@/assets/cp-corner-ornament-v2.png";
import { framingFromFocalZoom, type Focal, type FitMode } from "@/hooks/useCinematicMedia";
import {
  heroFramingAttr,
  resolveHeroGeometry,
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
 *   - "fit": letterboxed at natural aspect (the resolver's contain math) on
 *     the brand-dark base. HERO.WIDE.1: where the letterbox leaves side
 *     flanks, they render as deliberate FIELDS — warm near-black ground with
 *     a barely-there vertical light, a 1px gold hairline seam at each
 *     video/field junction (the w2 plate-frame language), and one restrained
 *     corner-ornament filigree per field. The old blurred video-copy spill is
 *     gone: no hidden video ever decodes behind the plate. Fields and seams
 *     are static and derive their edges from the SAME resolver geometry the
 *     foreground paints with, so preview keeps equalling live.
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
/**
 * HERO.WIDE.1 — the framed-stage side fields. All three values are the site's
 * ratified tokens: the warm near-black ground every media surface already
 * holds on, its ivory (#f4ecdb) as a barely-there top light so the fields
 * read lit rather than dead, and the w2 plate's gold hairline
 * (rgba(201,165,92,…) = #C9A55C) for the seams.
 *
 * Exported since CINE.FLOW.6: the wide reel's chapter columns sit on this SAME
 * field treatment, so the hero and the reel read as one system by construction
 * rather than by imitation.
 */
export const FIELD_GROUND = "#0b0a08";
export const FIELD_LIGHT =
  "linear-gradient(180deg, rgba(244,236,219,0.05) 0%, rgba(244,236,219,0.015) 42%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.24) 100%)";
export const SEAM_GOLD = "rgba(201,165,92,0.55)";

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

  // HERO.WIDE.1: the fit-mode letterbox edges come from the SAME geometry the
  // foreground paints with. Side fields exist only where horizontal flanks do
  // (a portrait clip in a landscape box); vertical letterbox stays bare
  // brand-dark, and cover ('fill') never has flanks — mobile is untouched.
  const geo = fitMode
    ? resolveHeroGeometry(mediaAspect, containerAspect, styleInput.framing)
    : null;
  const flanks =
    geo && geo.widthPct < 99.5
      ? { leftPct: geo.leftPct, rightPct: geo.leftPct + geo.widthPct }
      : null;

  // ONE persistent foreground <video> across BOTH modes — switching fill↔fit
  // must never remount it (a fresh element repaints on remount). The fields
  // render AFTER it so its child index never shifts and React keeps the same
  // node; they occupy only the flank rectangles, so nothing overlaps the
  // plate. Everything is static — no parallax, no scroll coupling.
  return (
    <div
      ref={containerRef}
      data-qa={fitMode ? "framed-video-fit" : undefined}
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: FIELD_GROUND }}
    >
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
      {flanks ? (
        <>
          {([
            ["left", { left: 0, width: `${flanks.leftPct}%` }],
            ["right", { left: `${flanks.rightPct}%`, right: 0 }],
          ] as const).map(([side, box]) => (
            <div
              key={side}
              data-qa={`framed-video-field-${side}`}
              aria-hidden
              className="pointer-events-none absolute inset-y-0"
              style={{
                ...box,
                backgroundColor: FIELD_GROUND,
                backgroundImage: FIELD_LIGHT,
                ...fadeStyle,
              }}
            >
              {/* ONE restrained filigree per field — the site's existing
                  corner ornament, fine-line low-contrast gold, mirrored on
                  the right so the pair faces the plate. */}
              <img
                src={cornerOrn}
                alt=""
                aria-hidden
                className={`absolute top-1/2 left-1/2 h-auto -translate-x-1/2 -translate-y-1/2 select-none${
                  side === "right" ? " -scale-x-100" : ""
                }`}
                style={{ width: "min(56%, 110px)", opacity: 0.22 }}
                decoding="async"
              />
            </div>
          ))}
          {/* 1px gold hairline seams at each video/field junction, full
              container height — the plate hangs framed, w2's language. */}
          <div
            data-qa="framed-video-seam-left"
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{
              left: `calc(${flanks.leftPct}% - 1px)`,
              width: 1,
              backgroundColor: SEAM_GOLD,
              ...fadeStyle,
            }}
          />
          <div
            data-qa="framed-video-seam-right"
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{
              left: `${flanks.rightPct}%`,
              width: 1,
              backgroundColor: SEAM_GOLD,
              ...fadeStyle,
            }}
          />
        </>
      ) : null}
    </div>
  );
};

export default FramedVideo;
