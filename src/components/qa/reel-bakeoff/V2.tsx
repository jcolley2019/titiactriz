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
 * V2 — "Spotlight".
 *
 * Thesis: the veil is a LENS, not a curtain. It is fully open over the subject
 * and closes radially toward the corners, so the frame reads as a beam falling
 * on her rather than as a screen laid over her. The ellipse is centred slightly
 * high (40%) because that is where a standing subject's face sits.
 *
 * Veil: radial, 0 through 46%, 0.20 at 72%, 0.35 at the corners — the top of
 * the mandated band, spent entirely on the corners where no photograph
 * information lives.
 * Gold: the numeral, set at display scale between two rules — gold as line AND
 * letter, which is the fullest legal reading of the One Filament Rule.
 * Motion: the beam opens (scale 1.06 → 1) as the type settles under it.
 *
 * CINE.FLOW.2-V2A/B — the numeral began as an 11px tracked sans caption and read
 * as incidental. It moved to the display face (caption tracking removed) and
 * through 34px, which overshot: at that size it competed with the title for the
 * role of subject. It settles at 22px — deliberately a step BELOW the 26px title
 * — so the title is what the visitor reads and the numeral is what tells them
 * where they are in the reel. Flanking rules track the mark down with it
 * (40px → 28px), and the gap under the lockup halves (20px → 10px) so numeral,
 * rules and title bind as one object instead of three stacked lines.
 */
const VEIL =
  "radial-gradient(ellipse 76% 56% at 50% 40%, rgba(11,10,8,0) 0%, rgba(11,10,8,0) 46%, rgba(11,10,8,0.20) 72%, rgba(11,10,8,0.35) 100%)";

const V2 = ({ slide, index, playKey, reduced }: VariantProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .fromTo(
          veilRef.current,
          { scale: 1.06, opacity: 0.6 },
          { scale: 1, opacity: 1, duration: 0.9, ease: "power3.out" },
          0,
        )
        .fromTo(
          labelRef.current,
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
          0.25,
        )
        .fromTo(
          titleRef.current,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
          0.3,
        );
    }, rootRef);
    return () => ctx.revert();
  }, [playKey, reduced]);

  return (
    <div ref={rootRef} className={STAGE_CLASS} data-qa="bakeoff-variant" data-variant="v2">
      <div className="absolute inset-0">
        <ReelPhoto slide={slide} />
      </div>

      <div
        ref={veilRef}
        className="absolute inset-0"
        style={{ background: VEIL, transformOrigin: "50% 40%" }}
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-16 text-center">
        <div ref={labelRef} className="mb-2.5 flex items-center gap-3">
          <span aria-hidden className="block h-px w-7" style={{ backgroundColor: GOLD }} />
          <span
            aria-hidden
            className="block leading-none"
            style={{
              fontFamily: DISPLAY,
              color: GOLD,
              fontSize: "22px",
              letterSpacing: "0.12em",
              // Tracking adds trailing space after the last glyph, which drags
              // the numeral left of true centre between the two rules. Indent
              // by the same amount to put it back optically.
              textIndent: "0.12em",
            }}
          >
            {numeral(index)}
          </span>
          <span aria-hidden className="block h-px w-10" style={{ backgroundColor: GOLD }} />
        </div>
        <span
          ref={titleRef}
          data-qa="bakeoff-title"
          className="block uppercase"
          style={{
            fontFamily: DISPLAY,
            color: IVORY,
            fontSize: "26px",
            lineHeight: 1.1,
            letterSpacing: "0.06em",
          }}
        >
          {slide.title}
        </span>
      </div>
    </div>
  );
};

export default V2;
