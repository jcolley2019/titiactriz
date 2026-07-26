import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import {
  DISPLAY,
  GOLD,
  GROUND,
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
 * Thesis: don't veil the photograph — GIVE THE TYPE ITS OWN ROOM. The frame is
 * divided by a hard horizontal edge: above it the photograph is open, below it
 * is bare ground where type sits at full contrast with nothing over the image
 * at all. This is the one direction that treats "veil" as a layout problem
 * rather than an opacity problem.
 *
 * Zone geometry is load-bearing here and was tuned against the real source. The
 * reel photos are ~0.56 aspect (tall portraits). A short photo zone is WIDER
 * than the source, so letterbox fits by height and leaves dead bands down both
 * sides — which reads as an accident, not a decision. The zone is therefore set
 * at 82% of the frame (390x692 ≈ 0.564), where the source fills the width
 * edge-to-edge and the division below it becomes a deliberate bar rather than a
 * consequence.
 *
 * Veil: none across the open photo. A single directional seat, 0 → 0.30, over
 * the last 14% of the photo zone, so the division reads as the image settling
 * onto the band rather than as a sticker laid on top. Peak 0.30, in band.
 * Gold: the numeral only. The division is deliberately NOT gold — that is V5's
 * argument, and blending the two would make both weaker.
 * Motion: type enters laterally from the left margin it is aligned to.
 */
const PHOTO_ZONE = "82%";
const SEAM =
  "linear-gradient(180deg, rgba(11,10,8,0) 0%, rgba(11,10,8,0) 86%, rgba(11,10,8,0.30) 100%)";

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
    <div
      ref={rootRef}
      className={STAGE_CLASS}
      style={{ backgroundColor: GROUND }}
      data-qa="bakeoff-variant"
      data-variant="v3"
    >
      {/* Photo zone — open, hard-edged, ends at the division. */}
      <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: PHOTO_ZONE }}>
        <ReelPhoto slide={slide} />
        <div className="absolute inset-0" style={{ background: SEAM }} />
      </div>

      {/* Type band — bare ground, no veil, left-aligned. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col justify-center px-7"
        style={{ top: PHOTO_ZONE, backgroundColor: GROUND }}
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
          className="mt-2 block uppercase"
          style={{
            fontFamily: DISPLAY,
            color: IVORY,
            fontSize: "26px",
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
