import { useEffect, useLayoutEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import gsap from "gsap";
import { spotlightCentre } from "@/components/cinematic/reelSpotlight";
import { DISPLAY, GOLD, IVORY, numeral, type BakeoffSlide } from "./shared";

/**
 * CINE.FLOW.4A — shared primitives for the wide (>= 768px) plate compositions.
 *
 * The architect withdrew the full-bleed cover ruling for wide: portrait
 * sources (aspect 0.563) under cover keep only 24–42% of the photograph at
 * desktop widths. The wide rendering is instead a PLATE ON AMBIENT BACKDROP:
 * the photo in true portrait aspect, bounded, over a full-frame blurred and
 * darkened copy of itself. W1–W3 are three compositions of that one idea, so
 * everything they share — backdrop law, plate sizing law, focal coordinates,
 * lockup, timeline beats — is defined once, here.
 *
 * All geometry is computed in px from the frame's true CSS dimensions
 * (frameW/frameH), never in CSS vw/vh: the frame is a div inside the harness
 * page, so real viewport units would measure the judging window instead of
 * the frame and the composition would lie.
 */

export const PLATE_ASPECT = 0.563;

/** Ambient backdrop filter — a LAW: this filter NEVER animates. */
export const AMBIENT_FILTER = "blur(64px) brightness(0.35) saturate(0.9)";

/**
 * The full-frame ambient ground: the slide's own photograph, cover-fit,
 * blurred/darkened, scaled 1.1 so the blur never reveals its own edges.
 * Each slide layer carries its own backdrop and the slide layers crossfade by
 * OPACITY ONLY — backdrop and plate fade together, the filter itself is
 * static. (That is the whole of the backdrop transition law.)
 */
export const AmbientBackdrop = ({ slide }: { slide: BakeoffSlide }) => (
  <div aria-hidden className="absolute inset-0 overflow-hidden">
    {slide.photo?.image_url ? (
      <img
        src={slide.photo.image_url}
        alt=""
        data-qa="wide-backdrop"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: AMBIENT_FILTER,
          transform: "scale(1.1)",
        }}
      />
    ) : (
      <div className="h-full w-full" style={{ backgroundColor: "#141210" }} />
    )}
  </div>
);

export type PlateBox = { w: number; h: number };

/**
 * Plate sizing law: a portrait box at aspect 0.563. A variant declares a
 * height rule (vh of the frame) and optionally a max-width (vw of the frame);
 * the plate takes whichever yields the SMALLER box.
 */
export function plateBox(
  frameW: number,
  frameH: number,
  heightVh: number,
  maxWidthVw?: number,
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
 * Focal source — the same resolver the shipped phone act reads
 * (`spotlightCentre`, fallback 50/40). Returned as FRACTIONS of the plate box;
 * the focal-as-container-percentage mapping is exact in cover mode (see the
 * derivation in reelSpotlight.ts).
 */
export function focalFractions(slide: BakeoffSlide): { fx: number; fy: number } {
  const c = spotlightCentre(slide.focal);
  return { fx: c.x / 100, fy: c.y / 100 };
}

/** The same focal in frame ("viewport") px — for assertions and W3 clamps. */
export function focalViewportPoint(
  plate: { left: number; top: number; w: number; h: number },
  fx: number,
  fy: number,
): { x: number; y: number } {
  return { x: plate.left + fx * plate.w, y: plate.top + fy * plate.h };
}

/**
 * The plate veil law for the compositions whose lockup crosses the
 * photograph (W1, W3): fully open (0) at the focal point, closing radially to
 * 0.35 at the plate edges. Plate-local — it paints inside the plate box only,
 * never on the backdrop. W2 declines it: its lockup sits below the plate over
 * the ambient backdrop, so the veil would darken the photograph for nothing.
 */
export const plateVeil = (fxPct: number, fyPct: number) =>
  `radial-gradient(ellipse farthest-corner at ${fxPct}% ${fyPct}%, rgba(11,10,8,0) 0%, rgba(11,10,8,0) 40%, rgba(11,10,8,0.20) 75%, rgba(11,10,8,0.35) 100%)`;

/** Gold hairline for plate outlines (W1/W2; W3 runs frameless). */
export const PLATE_OUTLINE = "1px solid rgba(201,165,92,0.55)";

const clampNum = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Lockup type sizes. These are clamp(1.75rem, 3.2vw, 3rem) for the title and
 * clamp(1.375rem, 2.5vw, 2.375rem) for the numeral, computed in px against the
 * FRAME width (a CSS clamp() would read the real viewport, not the frame).
 *
 * Rationale: the floors equal the shipped phone act's sizes (28px title,
 * 22px numeral), so type is CONTINUOUS across the 768px boundary — a tablet a
 * hair above the breakpoint sets the same sizes as a phone a hair below it —
 * and the ~0.78 numeral:title ratio the phone act established holds across
 * the whole range up to the 48px/38px ceilings.
 */
export const lockupTitlePx = (frameW: number) => clampNum(28, frameW * 0.032, 48);
export const lockupNumeralPx = (frameW: number) => clampNum(22, frameW * 0.025, 38);

/**
 * The wide lockup: gold Cinzel numeral ABOVE the title, the numeral flanked by
 * two SYMMETRIC gold rules — equal width both sides, which retires the shipped
 * phone act's 28/40 asymmetry wart rather than porting it up.
 */
export const WideLockup = ({
  index,
  title,
  frameW,
  align,
  maxWidth,
  labelRef,
  titleRef,
}: {
  index: number;
  title: string;
  frameW: number;
  align: "left" | "center";
  /** Optional hard cap so the lockup can never reach a plate. */
  maxWidth?: number;
  labelRef?: (el: HTMLDivElement | null) => void;
  titleRef?: (el: HTMLSpanElement | null) => void;
}) => {
  const titlePx = lockupTitlePx(frameW);
  const numeralPx = lockupNumeralPx(frameW);
  // Rules scale with the numeral they flank (the phone act's larger rule was
  // 40px against a 22px numeral; ~1.7x holds that proportion, symmetrically).
  const rulePx = Math.round(numeralPx * 1.7);
  return (
    <div
      data-qa="wide-lockup"
      className={`flex flex-col ${align === "center" ? "items-center text-center" : "items-start text-left"}`}
      style={maxWidth != null ? { maxWidth } : undefined}
    >
      <div ref={labelRef} className="flex items-center gap-3" style={{ marginBottom: 10 }}>
        <span aria-hidden className="block h-px" style={{ width: rulePx, backgroundColor: GOLD }} />
        <span
          aria-hidden
          className="block leading-none"
          style={{
            fontFamily: DISPLAY,
            color: GOLD,
            fontSize: numeralPx,
            letterSpacing: "0.12em",
            // Tracking adds trailing space after the last glyph, which drags
            // the numeral left of true centre between the two rules. Indent
            // by the same amount to put it back optically.
            textIndent: "0.12em",
          }}
        >
          {numeral(index)}
        </span>
        <span aria-hidden className="block h-px" style={{ width: rulePx, backgroundColor: GOLD }} />
      </div>
      <span
        ref={titleRef}
        data-qa="wide-title"
        className="block uppercase"
        style={{
          fontFamily: DISPLAY,
          color: IVORY,
          fontSize: titlePx,
          lineHeight: 1.1,
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </span>
    </div>
  );
};

export type WideTimelineRefs = {
  rootRef: RefObject<HTMLDivElement>;
  slideRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  /** Omitted by veil-less compositions (W2) — no veil, no beam-open beat. */
  veilRefs?: MutableRefObject<(HTMLDivElement | null)[]>;
  labelRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  titleRefs: MutableRefObject<(HTMLSpanElement | null)[]>;
};

/**
 * Motion parity — the shipped reel beats, exactly, on a PAUSED timeline the
 * harness scrubs linearly (progress 0..1 maps linearly onto timeline time):
 * slide crossfades (0.5 at whole-number marks), beam-open where a veil exists
 * (scale 1.06 → 1, power3.out), label/title settle (+0.12/+0.15, power3.out),
 * and a 0.5 dead-stop dwell at the end. Structure mirrors CinematicReel's
 * pinned timeline one-for-one so judging the bake-off judges the real motion.
 *
 * The hook advertises the act's landmarks on the root element:
 * `data-deadstops` (per-slide settled states, as progress fractions) and
 * `data-midpoints` (crossfade midpoints) — the harness's ↑/↓ jump and the
 * safety spec both read them instead of re-deriving timeline arithmetic.
 */
export function useWideReelTimeline(
  refs: WideTimelineRefs,
  count: number,
  reduced: boolean,
  progress: number,
) {
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    const els = refs.slideRefs.current.filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      for (let i = 1; i < els.length; i++) {
        tl.to(els[i - 1], { opacity: 0, duration: 0.5 }, i);
        tl.to(els[i], { opacity: 1, duration: 0.5 }, i);
        // Beam-open — the veil's own entrance. A veil-less composition (W2)
        // passes no veilRefs and simply has no beam; the beat it would occupy
        // (0.5 at mark i) is already covered by the crossfade, so the
        // timeline's duration, dead-stops and midpoints are identical either way.
        const veilEl = refs.veilRefs?.current[i];
        if (veilEl) {
          tl.fromTo(
            veilEl,
            { scale: 1.06, opacity: 0.6 },
            { scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" },
            i,
          );
        }
        tl.fromTo(
          refs.labelRefs.current[i],
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.38, ease: "power3.out" },
          i + 0.12,
        );
        tl.fromTo(
          refs.titleRefs.current[i],
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.38, ease: "power3.out" },
          i + 0.15,
        );
      }
      tl.to({}, { duration: 0.5 }); // dwell — the act's dead-stop
      tlRef.current = tl;

      const root = refs.rootRef.current;
      if (root) {
        const T = tl.duration();
        // Dead-stops: slide 0 rests before the first crossfade begins at t=1;
        // slide 1 rests between its entrance end (~1.53) and the next
        // crossfade at 2; slide 2's dead-stop is the end of the dwell.
        const deadStops = [0.6, 1.75, T];
        const midpoints = [1.25, 2.25];
        root.dataset.deadstops = deadStops.map((tt) => (tt / T).toFixed(4)).join(",");
        root.dataset.midpoints = midpoints.map((tt) => (tt / T).toFixed(4)).join(",");
      }
    }, refs.rootRef);

    return () => {
      ctx.revert();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, count]);

  useEffect(() => {
    tlRef.current?.progress(clampNum(0, progress, 1));
  }, [progress]);
}
