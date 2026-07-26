import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import {
  DISPLAY,
  GOLD,
  IVORY,
  ReelPhoto,
  SANS,
  STAGE_CLASS,
  numeral,
  type VariantProps,
} from "./shared";

/**
 * V3 — "Split Frame".
 *
 * Thesis: the veil has an EDGE. Every other direction in the set fades; this one
 * cuts. A hard horizontal division at 64% splits the frame into an untouched
 * upper photograph and a suppressed lower reading zone, with no transition
 * between them at all. The division itself is the design.
 *
 * CINE.FLOW.2-FIX — this variant previously put bare ground below the line, so
 * the photograph stopped at 64%. Under the cover mandate the photo runs the full
 * height of the frame and the lower zone is a VEIL over it, not a substitute for
 * it. The abrupt onset survives — which was always the real signature — but the
 * image is now continuous underneath, and the direction reads as an argument
 * about veils rather than an argument about layout.
 *
 * Veil: nothing above the line. Below it, an abrupt 0.35 that eases OFF to 0.28
 * toward the bottom edge — directional, and inverted relative to V1 on purpose:
 * V1 is heaviest at the bottom, V3 is heaviest right under the cut. Peak 0.35.
 * Gold: the numeral only. The division is deliberately NOT gold — that is V5's
 * argument, and blending the two would make both weaker.
 * Motion: type enters laterally from the left margin it is aligned to.
 */
const PHOTO_ZONE = "64%";
const BELOW_VEIL =
  "linear-gradient(180deg, rgba(11,10,8,0.35) 0%, rgba(11,10,8,0.28) 100%)";

const V3 = ({ slide, index, playKey, reduced }: VariantProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .fromTo(
          numRef.current,
          { x: -18, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
          0,
        )
        .fromTo(
          titleRef.current,
          { x: -18, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
          0.12,
        );
    }, rootRef);
    return () => ctx.revert();
  }, [playKey, reduced]);

  return (
    <div ref={rootRef} className={STAGE_CLASS} data-qa="bakeoff-variant" data-variant="v3">
      {/* One continuous photograph, full frame. */}
      <div className="absolute inset-0">
        <ReelPhoto slide={slide} />
      </div>

      {/* The cut: veil begins abruptly at the division and never softens into it. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ top: PHOTO_ZONE, background: BELOW_VEIL }}
      />

      {/* Type sits inside the suppressed zone, left-aligned to its own margin. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col justify-center px-7"
        style={{ top: PHOTO_ZONE }}
      >
        <span
          ref={numRef}
          aria-hidden
          className="block uppercase"
          style={{
            fontFamily: SANS,
            color: GOLD,
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.3em",
          }}
        >
          {numeral(index)}
        </span>
        <span
          ref={titleRef}
          data-qa="bakeoff-title"
          className="mt-3 block uppercase"
          style={{
            fontFamily: DISPLAY,
            color: IVORY,
            fontSize: "34px",
            lineHeight: 1.05,
            letterSpacing: "0.03em",
          }}
        >
          {slide.title}
        </span>
      </div>
    </div>
  );
};

export default V3;
