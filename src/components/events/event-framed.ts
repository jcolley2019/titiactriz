import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { framingFromFocalZoom, type FitMode, type Focal } from "@/hooks/useCinematicMedia";
import {
  heroFramingAttr,
  resolveHeroMediaStyle,
  useElementAspect,
} from "@/lib/hero-framing";

/**
 * EVENTS.MEDIA.EDITOR.1b — the shared geometry core of EventFramedImage and
 * EventFramedVideo. ALL foreground geometry is `resolveHeroMediaStyle` output;
 * neither primitive spells object-fit / object-position / a transform of its
 * own. The admin editor canvas and the public card both render through these
 * primitives, so preview = publish holds by construction (the hero's own
 * WYSIWYG law, reached through the same resolver).
 *
 * ## The two resolver branches, and why default framing takes the second
 *
 * The resolver's geometry branch emits an explicit percentage RECTANGLE for the
 * media element. That is exactly right for a framed (zoomed/panned) card — and
 * exactly wrong for an unframed one, because the event well's legacy law is
 * ELEMENT-BOX semantics: the `<img>`/`<video>` element itself is the 768x420
 * band the specs measure, with the crop happening inside it via object-fit. A
 * rectangle element overflows its box whenever the capped well's aspect is not
 * the media's, so the measured element would grow and EVENTS.PORTRAIT.1's
 * numbers would move.
 *
 * The resolver already owns the answer: its aspect-unknown fallback returns an
 * equivalent style built from the browser's own object-fit, and its contract
 * states the two branches AGREE at scale 1 / pos 50 (see hero-framing.ts).
 * Default framing IS scale 1 / pos 50 — so an unframed card is painted by the
 * fallback branch (element fills the box, object-fit crops, today's render to
 * the pixel), and only a deliberately framed card takes the rectangle branch.
 */

/** True when a record is the untouched default — the legacy-render case. */
export const isDefaultEventFraming = (focal: Focal, zoom: number, fit: FitMode): boolean =>
  zoom === 1 && focal.x === 0.5 && focal.y === 0.5 && fit === "fill";

export type EventFramedBox = {
  boxRef: React.RefObject<HTMLDivElement | null>;
  /** Style for the well box div: measured intrinsic ratio + framing backdrop. */
  boxStyle: CSSProperties;
  /** Resolver-produced style for the media element. Nothing else touches it. */
  mediaStyle: CSSProperties;
  /** `data-hero-framing` value — the resolved framing + rectangle, testable. */
  framingAttr: string;
  /** Report the media's decoded intrinsic size (onLoad / loadedmetadata). */
  report: (w: number, h: number) => void;
};

export function useEventFramedBox(
  focal: Focal,
  zoom: number,
  fit: FitMode,
  onNaturalSize?: (w: number, h: number) => void,
): EventFramedBox {
  const boxRef = useRef<HTMLDivElement>(null);
  const containerAspect = useElementAspect(boxRef);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const report = (w: number, h: number) => {
    if (!w || !h) return;
    setNatural((cur) => (cur && cur.w === w && cur.h === h ? cur : { w, h }));
    onNaturalSize?.(w, h);
  };

  const useRectangle = !isDefaultEventFraming(focal, zoom, fit);
  const styleInput = {
    // Default framing withholds the aspects on purpose: the resolver then emits
    // its own object-fit fallback — the branch it defines as equal to the
    // rectangle at scale 1 / pos 50 — which is the element-box render the
    // legacy well laws are measured against.
    mediaAspect: useRectangle && natural ? natural.w / natural.h : null,
    containerAspect: useRectangle ? containerAspect : null,
    framing: framingFromFocalZoom(focal, zoom, fit),
  };

  const boxStyle: CSSProperties = {
    // The box's own shape is the media's intrinsic ratio; the well's caps
    // (EventMedia's classes) clamp it exactly as they clamped the legacy <img>.
    aspectRatio: natural ? `${natural.w} / ${natural.h}` : undefined,
    // Read by EventMedia's cap classes: ratio for height→width cap transfer,
    // natural width so a small image never upscales past itself (the legacy
    // intrinsic-size behaviour of `w-auto h-auto`).
    ["--evf-ar" as string]: natural ? String(natural.w / natural.h) : undefined,
    ["--evf-nw" as string]: natural ? String(natural.w) : undefined,
    // The hero contract: media paints over brand-dark, never transparent —
    // scale < 1 and fit mode legally reveal the backdrop.
    backgroundColor: "#0b0a08",
  };

  return {
    boxRef,
    boxStyle,
    mediaStyle: resolveHeroMediaStyle(styleInput),
    framingAttr: heroFramingAttr(styleInput),
    report,
  };
}
