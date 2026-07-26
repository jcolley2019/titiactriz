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
 * on her rather than as a screen laid over her.
 *
 * Veil: radial, 0 through 46%, 0.20 at 72%, 0.35 at the corners — the top of
 * the mandated band, spent entirely on the corners where no photograph
 * information lives. Moving the centre never raises that ceiling: 0.35 is the
 * darkest stop wherever the beam is aimed.
 *
 * CINE.FLOW.3 — the beam FOLLOWS THE SUBJECT. It used to sit at a fixed 50%/40%
 * (a guess at where a standing subject's face lands), which lit the middle of
 * the frame on every slide regardless of where she actually is. The centre now
 * reads the slide's own focal point — the same admin framing that already tells
 * the photo where to crop — so a subject panned to the right edge gets the beam
 * at the right edge. 50%/40% survives only as the fallback for a slide that
 * carries no focal at all.
 *
 * Why the focal can be used as a container percentage DIRECTLY, with no
 * conversion: in cover mode the resolver lays the media out at cover size and
 * pans it by posX = focal.x * 100. On an axis WITH overflow the rectangle is
 * `left = -f * overflow`, `width = 100 + overflow`, so the focal point lands at
 * `left + f * width = f * 100`. On an axis with none the rectangle is pinned at
 * 100% and the focal point lands at `f * 100` again. The mapping is exact, not
 * an approximation. (It only breaks below cover — zoom < 1 — where the media
 * shrinks inside the frame; reel slots are stored as a fit surface so a
 * sub-1 zoom is representable. That case letterboxes the photograph, which the
 * cover mandate rules out of this composition anyway.)
 * Gold: the numeral, set at display scale between two rules — gold as line AND
 * letter, which is the fullest legal reading of the One Filament Rule.
 * Motion: the beam opens (scale 1.06 → 1) as the type settles under it.
 *
 * CINE.FLOW.2-V2A/B — the numeral began as an 11px tracked sans caption and read
 * as incidental. It moved to the display face (caption tracking removed) and
 * through 34px, which overshot: at that size it competed with the title for the
 * role of subject. It settles at 22px — deliberately a step BELOW the title
 * — so the title is what the visitor reads and the numeral is what tells them
 * where they are in the reel. Flanking rules track the mark down with it
 * (40px → 28px), and the gap under the lockup halves (20px → 10px) so numeral,
 * rules and title bind as one object instead of three stacked lines.
 */
/** Where the beam points when a slide carries no framing at all. */
const FALLBACK_CENTRE = { x: 50, y: 40 };

/** The slide's focal as a percentage of the frame — see the derivation above. */
const beamCentre = (slide: VariantProps["slide"]) =>
  slide.focal ? { x: slide.focal.x * 100, y: slide.focal.y * 100 } : FALLBACK_CENTRE;

const veil = (c: { x: number; y: number }) =>
  `radial-gradient(ellipse 76% 56% at ${c.x}% ${c.y}%, rgba(11,10,8,0) 0%, rgba(11,10,8,0) 46%, rgba(11,10,8,0.20) 72%, rgba(11,10,8,0.35) 100%)`;

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

  const centre = beamCentre(slide);

  return (
    <div ref={rootRef} className={STAGE_CLASS} data-qa="bakeoff-variant" data-variant="v2">
      <div className="absolute inset-0">
        <ReelPhoto slide={slide} />
      </div>

      {/* The beam opens about its own centre, so the aim survives the entrance. */}
      <div
        ref={veilRef}
        className="absolute inset-0"
        data-qa="bakeoff-veil"
        data-beam={`${centre.x.toFixed(1)},${centre.y.toFixed(1)}`}
        style={{ background: veil(centre), transformOrigin: `${centre.x}% ${centre.y}%` }}
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
            fontSize: "28px",
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
