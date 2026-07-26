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
 * V1 — "Edge Veil".
 *
 * Thesis: the veil is a WEIGHT AT THE BOTTOM OF THE FRAME, nothing more. The
 * photograph is completely unveiled for its top half; suppression begins only
 * where the type is actually going to land and deepens to the bottom edge,
 * which doubles as the hand-off to the next act.
 *
 * Veil: 0 → 0 (54%) → 0.16 (70%) → 0.32 (100%). Peak 0.32, inside the mandated
 * 0.15–0.35 band, and directional on the vertical axis.
 * Gold: the numeral, and nothing else.
 * Motion: the type rises into the weighted edge and stops dead (power3.out).
 */
const VEIL =
  "linear-gradient(180deg, rgba(11,10,8,0) 0%, rgba(11,10,8,0) 54%, rgba(11,10,8,0.16) 70%, rgba(11,10,8,0.32) 100%)";

const V1 = ({ slide, index, playKey, reduced }: VariantProps) => {
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
          { y: 26, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
          0,
        )
        .fromTo(
          titleRef.current,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
          0.1,
        );
    }, rootRef);
    return () => ctx.revert();
  }, [playKey, reduced]);

  return (
    <div ref={rootRef} className={STAGE_CLASS} data-qa="bakeoff-variant" data-variant="v1">
      <div className="absolute inset-0">
        <ReelPhoto slide={slide} />
      </div>

      <div className="absolute inset-0" style={{ background: VEIL }} />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-14 text-center">
        <span
          ref={numRef}
          aria-hidden
          className="block leading-none"
          style={{ fontFamily: DISPLAY, color: GOLD, fontSize: "82px" }}
        >
          {numeral(index)}
        </span>
        <span
          ref={titleRef}
          data-qa="bakeoff-title"
          className="mt-2 block uppercase"
          style={{
            fontFamily: DISPLAY,
            color: IVORY,
            fontSize: "22px",
            letterSpacing: "0.06em",
          }}
        >
          {slide.title}
        </span>
      </div>
    </div>
  );
};

export default V1;
