import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import {
  DISPLAY,
  GOLD,
  IVORY,
  ReelPhoto,
  STAGE_CLASS,
  numeral,
  type VariantProps,
} from "./shared";

/**
 * V4 — "Glow Type".
 *
 * Thesis: the floor case. Take DESIGN.md's Unboxed Type Rule to its literal
 * limit — if type is supposed to earn legibility from its own weight and glow
 * rather than from anything drawn behind it, then push the veil to the
 * mandated minimum and make the letterforms do ALL the work.
 *
 * Veil: a flat 0.15. This is the one variant where flat is sanctioned, because
 * flatness is the point being tested: it is the control against which the four
 * directional treatments are judged. If V4 is legible, every heavier veil in
 * the set is buying something it may not need.
 * Legibility comes from a three-stop dark bloom behind the glyphs — tight
 * contact shadow, mid halo, wide falloff — so the type carves its own space out
 * of whatever is under it, at any photo brightness.
 * Gold: the numeral, carrying a warm bloom of its own (the only place in the
 * set where gold emits rather than merely marks).
 * Motion: the type CONDENSES — tracking eases in from loose to set, so it
 * resolves into focus instead of sliding into place.
 *
 * Placement note: the block is anchored to the lower frame, not centred.
 * Centring it put the numeral squarely across the subject's mouth and chin on
 * a full-height portrait — the glow thesis is about the veil floor, not about
 * vertical centring, so the collision is not worth defending.
 */
const VEIL = "rgba(11,10,8,0.15)";

const TITLE_GLOW = [
  "0 1px 2px rgba(11,10,8,0.95)",
  "0 0 18px rgba(11,10,8,0.85)",
  "0 0 44px rgba(11,10,8,0.70)",
].join(", ");

const NUMERAL_GLOW = [
  "0 1px 2px rgba(11,10,8,0.9)",
  "0 0 14px rgba(11,10,8,0.85)",
  "0 0 38px rgba(201,165,92,0.30)",
].join(", ");

const V4 = ({ slide, index, playKey, reduced }: VariantProps) => {
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
          { opacity: 0, letterSpacing: "0.22em" },
          { opacity: 1, letterSpacing: "0.02em", duration: 0.9, ease: "power3.out" },
          0,
        )
        .fromTo(
          titleRef.current,
          { opacity: 0, letterSpacing: "0.3em" },
          { opacity: 1, letterSpacing: "0.08em", duration: 0.9, ease: "power3.out" },
          0.08,
        );
    }, rootRef);
    return () => ctx.revert();
  }, [playKey, reduced]);

  return (
    <div ref={rootRef} className={STAGE_CLASS} data-qa="bakeoff-variant" data-variant="v4">
      <div className="absolute inset-0">
        <ReelPhoto slide={slide} />
      </div>

      <div className="absolute inset-0" style={{ backgroundColor: VEIL }} />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-20 text-center">
        <span
          ref={numRef}
          aria-hidden
          className="block leading-none"
          style={{
            fontFamily: DISPLAY,
            color: GOLD,
            fontSize: "88px",
            letterSpacing: "0.02em",
            textShadow: NUMERAL_GLOW,
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
            fontSize: "24px",
            letterSpacing: "0.08em",
            textShadow: TITLE_GLOW,
          }}
        >
          {slide.title}
        </span>
      </div>
    </div>
  );
};

export default V4;
