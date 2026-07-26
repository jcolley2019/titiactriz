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
 * V5 — "Gold Rule".
 *
 * Thesis: the DIVISION is the design, and the division is the one filament.
 * A single gold hairline crosses the frame; above it the photograph is
 * completely open, below it a shallow veil seats the type. The line does the
 * job that a heavy scrim usually does — it tells the eye where the image ends
 * and the reading begins — at a cost of one pixel instead of thirty points of
 * opacity.
 *
 * This is the most literal reading of DESIGN.md's One Filament Rule: gold as a
 * line, load-bearing, and used exactly once per frame.
 *
 * Veil: nothing above the rule. Below it, 0.20 → 0.30 downward — directional,
 * starting at the brief's 0.2 and closing gently to the bottom edge. In band.
 * Gold: the rule, plus the numeral as a tracked label. Nothing else.
 * Motion: the rule DRAWS from its centre (scaleX 0 → 1), then the type arrives
 * beneath it. The line is the entrance.
 */
const RULE_TOP = "64%";
const BELOW_VEIL =
  "linear-gradient(180deg, rgba(11,10,8,0.20) 0%, rgba(11,10,8,0.30) 100%)";

const V5 = ({ slide, index, playKey, reduced }: VariantProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .fromTo(
          ruleRef.current,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.8, ease: "power3.out" },
          0,
        )
        .fromTo(
          labelRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, ease: "power2.out" },
          0.3,
        )
        .fromTo(
          titleRef.current,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
          0.36,
        );
    }, rootRef);
    return () => ctx.revert();
  }, [playKey, reduced]);

  return (
    <div ref={rootRef} className={STAGE_CLASS} data-qa="bakeoff-variant" data-variant="v5">
      <div className="absolute inset-0">
        <ReelPhoto slide={slide} />
      </div>

      {/* Veil lives ONLY below the rule. Above it the photograph is untouched. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ top: RULE_TOP, background: BELOW_VEIL }}
      />

      {/* The filament. */}
      <span
        ref={ruleRef}
        aria-hidden
        className="absolute block h-px"
        style={{
          top: RULE_TOP,
          left: "24px",
          right: "24px",
          backgroundColor: GOLD,
          transformOrigin: "50% 50%",
        }}
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-16 text-center">
        <span
          ref={labelRef}
          aria-hidden
          className="mb-3 block uppercase"
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
          className="block uppercase"
          style={{
            fontFamily: DISPLAY,
            color: IVORY,
            fontSize: "28px",
            lineHeight: 1.1,
            letterSpacing: "0.05em",
          }}
        >
          {slide.title}
        </span>
      </div>
    </div>
  );
};

export default V5;
