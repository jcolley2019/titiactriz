import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { GOLD, IVORY, spotlightCentre } from "./reelSpotlight";
import type { Focal } from "@/hooks/useCinematicMedia";

/**
 * CINE.FLOW.5 — the wide (>= 768px) reel act, promoted from bake-off variant W2
 * ("Center Plate & Rules") as it stood after CINE.FLOW.4B.
 *
 * This retires the letterboxed rendering entirely. The old wide act put the
 * whole photo in a letterbox on brand dark under a flat 0.5 → 0.8 wash — bare
 * ground inside the frame, and a wash squarely in DESIGN.md's banned 50–80%
 * range. W2 replaces both moves at once: the photograph is a bounded PLATE in
 * true portrait aspect, hung between two gold hairlines over an ambient
 * backdrop (a blurred, darkened copy of the slide's own photograph), with the
 * lockup as an engraved caption in the band beneath it.
 *
 * NO VEIL. The plate photograph renders unveiled inside its gold hairline
 * frame. The veil law is that veils exist only to protect type over
 * photography; here the lockup sits BELOW the plate and never crosses it, so a
 * veil would buy nothing and cost the plate its light. The AmbientBackdrop is
 * what carries the lockup's legibility.
 *
 * Geometry is computed in px from the frame's true measured CSS dimensions,
 * never in CSS vw/vh: the reel's frame is the pinned stage, and under reduced
 * motion it is a 70svh slide, so real viewport units would describe neither.
 *
 * The bake-off harness keeps its own frozen copy of these primitives
 * (src/components/qa/reel-bakeoff/wideShared.tsx). That duplication is
 * deliberate: the harness is a museum piece and live code does not import from
 * `qa/`. The laws below are the ones that ship.
 */

/** The plate's aspect (width / height) — the portrait sources' own. */
export const PLATE_ASPECT = 0.563;

/** Ambient backdrop filter — a LAW: this filter NEVER animates. */
export const AMBIENT_BLUR_PX = 64;
export const AMBIENT_FILTER = `blur(${AMBIENT_BLUR_PX}px) brightness(0.35) saturate(0.9)`;

/** Gold hairline for the plate outline. */
export const PLATE_OUTLINE = "1px solid rgba(201,165,92,0.55)";

/** W2's declared composition, as fractions of the frame. */
export const PLATE_HEIGHT_VH = 76;
export const PLATE_MAX_WIDTH_VW = 60;
export const PLATE_TOP_VH = 8;
/** The two vertical gold hairlines, at these fractions of the frame width. */
export const WIDE_RULE_X = [0.18, 0.82] as const;
export const WIDE_RULE_OPACITY = 0.35;
/** Minimum breathing room above and below the lockup inside the caption band. */
export const BAND_PAD_VH = 3;

const clampNum = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type PlateBox = { w: number; h: number };

/**
 * Plate sizing law: a portrait box at `PLATE_ASPECT`. The height rule and the
 * max-width cap are both declared as percentages of the frame; the plate takes
 * whichever yields the SMALLER box, so a short landscape frame is governed by
 * height and a narrow tall one by width.
 */
export function plateBox(
  frameW: number,
  frameH: number,
  heightVh: number = PLATE_HEIGHT_VH,
  maxWidthVw: number | undefined = PLATE_MAX_WIDTH_VW,
): PlateBox {
  const hRule = (frameH * heightVh) / 100;
  const wFromH = hRule * PLATE_ASPECT;
  if (maxWidthVw != null) {
    const wCap = (frameW * maxWidthVw) / 100;
    if (wCap < wFromH) return { w: wCap, h: wCap / PLATE_ASPECT };
  }
  return { w: wFromH, h: hRule };
}

/**
 * Focal source — the reel's ONE resolver (`spotlightCentre`, fallback 50/40),
 * returned as FRACTIONS of the plate box. The focal-as-container-percentage
 * mapping is exact in cover mode (see the derivation in reelSpotlight.ts), and
 * the plate paints its photo in cover mode, so this is the plate's true subject
 * position and not an approximation.
 */
export function focalFractions(focal?: Focal): { fx: number; fy: number } {
  const c = spotlightCentre(focal);
  return { fx: c.x / 100, fy: c.y / 100 };
}

/**
 * Lockup type sizes: `clamp(1.75rem, 3.2vw, 3rem)` for the title and
 * `clamp(1.375rem, 2.5vw, 2.375rem)` for the numeral, computed in px against
 * the FRAME width (a CSS clamp() would read the real viewport, not the frame).
 *
 * The TITLE is continuous across the 768px boundary: this floor (28px) is the
 * phone title clamp's ceiling, so a tablet a hair above the breakpoint sets the
 * same title as a phone a hair below it.
 *
 * The NUMERAL is not, and deliberately so. W1-W3 were built against the 4C
 * phone act, whose numeral was a 22px caption mark; the promoted V1 act sets it
 * at 66px, where it carries the lockup's mass rather than labelling it. The two
 * acts are different compositions and the numeral changes role between them —
 * see the reel lockup steps in DESIGN.md.
 */
export const lockupTitlePx = (frameW: number) => clampNum(28, frameW * 0.032, 48);
export const lockupNumeralPx = (frameW: number) => clampNum(22, frameW * 0.025, 38);

/** The rules flanking the wide numeral scale with it, symmetrically. */
export const lockupRulePx = (frameW: number) => Math.round(lockupNumeralPx(frameW) * 1.7);

const numeral = (i: number) => String(i + 1).padStart(2, "0");

/**
 * The full-frame ambient ground: the slide's own photograph, cover-fit,
 * blurred/darkened, scaled 1.1 so the blur never reveals its own edges.
 *
 * Each slide layer carries its own backdrop and the slide layers crossfade by
 * OPACITY ONLY — backdrop and plate fade together, the filter itself is static.
 * That is the whole of the backdrop transition law.
 */
export const AmbientBackdrop = ({ src, blur }: { src?: string; blur?: string }) => (
  <div aria-hidden className="absolute inset-0 overflow-hidden">
    {src ? (
      <img
        src={src}
        alt=""
        data-qa="wide-backdrop"
        loading="lazy"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // `blur` overrides only the radius, never the brightness/saturate
          // grade — the admin preview has no fixed size, so it restates 64px as
          // a fraction of its own box rather than blurring a thumbnail to mud.
          filter: blur ? `blur(${blur}) brightness(0.35) saturate(0.9)` : AMBIENT_FILTER,
          transform: "scale(1.1)",
        }}
      />
    ) : (
      <div className="h-full w-full" style={{ backgroundColor: "#141210" }} />
    )}
  </div>
);

/**
 * The wide lockup: gold Cinzel numeral above the title, the numeral flanked by
 * two SYMMETRIC gold rules — equal width both sides.
 */
export const WideLockup = ({
  index,
  title,
  frameW,
  labelRef,
  titleRef,
}: {
  index: number;
  title: string;
  frameW: number;
  labelRef?: (el: HTMLDivElement | null) => void;
  titleRef?: (el: HTMLSpanElement | null) => void;
}) => {
  const rulePx = lockupRulePx(frameW);
  return (
    <div
      data-qa="wide-lockup"
      className="flex flex-col items-center text-center"
    >
      <div ref={labelRef} className="flex items-center gap-3" style={{ marginBottom: 10 }}>
        <span
          aria-hidden
          data-qa="wide-lockup-rule"
          className="block h-px"
          style={{ width: rulePx, backgroundColor: GOLD }}
        />
        <span
          aria-hidden
          data-qa="wide-numeral"
          className="block leading-none"
          style={{
            fontFamily: "var(--font-display)",
            color: GOLD,
            fontSize: lockupNumeralPx(frameW),
            letterSpacing: "0.12em",
            // Tracking adds trailing space after the last glyph, which drags
            // the numeral left of true centre between the two rules. Indent
            // by the same amount to put it back optically.
            textIndent: "0.12em",
          }}
        >
          {numeral(index)}
        </span>
        <span
          aria-hidden
          data-qa="wide-lockup-rule"
          className="block h-px"
          style={{ width: rulePx, backgroundColor: GOLD }}
        />
      </div>
      <span
        ref={titleRef}
        data-qa="section-heading"
        className="block uppercase"
        style={{
          fontFamily: "var(--font-display)",
          color: IVORY,
          fontSize: lockupTitlePx(frameW),
          lineHeight: 1.1,
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </span>
    </div>
  );
};

/**
 * The frame's true CSS size. The wide composition is pure measured geometry, so
 * it needs the box it is actually painting into — the pinned stage under
 * motion, a 70svh slide under reduced motion. Measured in a layout effect
 * (before paint, so there is no flash of an unsized plate) and kept current by a
 * ResizeObserver, which is what catches a mobile URL-bar collapse or a rotation.
 */
export function useFrameSize(ref: RefObject<HTMLElement>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const last = useRef({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      // Sub-pixel churn from Blink's 1/64-px layout snapping would otherwise
      // re-render the whole act on every scroll-driven reflow.
      if (Math.abs(r.width - last.current.w) < 0.5 && Math.abs(r.height - last.current.h) < 0.5) {
        return;
      }
      last.current = { w: r.width, h: r.height };
      setSize({ w: r.width, h: r.height });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
