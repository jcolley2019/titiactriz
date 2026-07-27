import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FramedImage from "./FramedImage";
import type { CinematicPhoto } from "./useCinematicData";
import { REEL_DEFAULT_FOCAL, DEFAULT_ZOOM, type Focal } from "@/hooks/useCinematicMedia";
import {
  GOLD,
  IVORY,
  LOCKUP_BOX_PX,
  LOCKUP_RULE_W_PX,
  LOCKUP_SCRIM_FEATHER_VH,
  WIDE_VEIL,
  lockupScrim,
  reelSlideFit,
  useReelIsPhone,
} from "./reelSpotlight";

gsap.registerPlugin(ScrollTrigger);

export type ReelSlide = {
  photo?: CinematicPhoto;
  title: string;
  /** Admin framing (ADMIN.MEDIA.1). Absent → centered/1×, i.e. today's render. */
  focal?: Focal;
  zoom?: number;
};

type Props = { slides: ReelSlide[]; reduced: boolean };

const numeral = (i: number) => String(i + 1).padStart(2, "0");

const SlidePhoto = ({ slide, phone }: { slide: ReelSlide; phone: boolean }) => (
  <FramedImage
    src={slide.photo?.image_url}
    alt={slide.photo?.alt_text ?? ""}
    focal={slide.focal ?? REEL_DEFAULT_FOCAL}
    zoom={slide.zoom ?? DEFAULT_ZOOM}
    fit={reelSlideFit(phone)}
    imgDataQa="cinematic-reel-img"
    loading="lazy"
    fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
  />
);

const SlideBg = ({ slide }: { slide: ReelSlide }) => (
  <>
    <SlidePhoto slide={slide} phone={false} />
    <div className="absolute inset-0" style={{ background: WIDE_VEIL }} />
  </>
);

/**
 * CINE.FLOW.3 — the phone act. Photograph edge-to-edge and the lockup bound as
 * one object at the foot of the frame: a 22px gold numeral between two rules,
 * sitting a step BELOW the title so the title is what gets read and the numeral
 * only says where you are in the reel. Geometry is V2B (7169686) verbatim; the
 * title is 28px — V2B's 26px snapped onto the DESIGN.md Headline floor
 * (`clamp(1.75rem, …)`), which is the ramp step it was already sitting next to —
 * and held there by a clamp so the narrowest phones shrink instead of wrapping.
 *
 * CINE.FLOW.4C — the photograph is UNVEILED. What used to be a focal radial
 * beam over the whole picture is now a scrim confined to the lockup's own zone
 * (see ./reelSpotlight): everything above it renders at full brightness.
 */
const PhoneSlide = ({
  slide,
  i,
  labelRef,
  titleRef,
}: {
  slide: ReelSlide;
  i: number;
  labelRef?: (el: HTMLDivElement | null) => void;
  titleRef?: (el: HTMLSpanElement | null) => void;
}) => {
  return (
    <>
      <div className="absolute inset-0">
        <SlidePhoto slide={slide} phone />
      </div>

      {/* Local type scrim: above the photo, below the lockup, bound to its box. */}
      <div
        data-qa="reel-lockup-scrim"
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: `calc(${LOCKUP_BOX_PX}px + ${LOCKUP_SCRIM_FEATHER_VH}vh)`,
          background: lockupScrim("vh"),
        }}
      />

      <div
        data-qa="reel-spotlight"
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-6 pb-16 text-center"
      >
        <div ref={labelRef} className="mb-2.5 flex items-center gap-3">
          <span
            aria-hidden
            data-qa="reel-rule"
            className="block h-px"
            style={{ width: LOCKUP_RULE_W_PX, backgroundColor: GOLD }}
          />
          <span
            aria-hidden
            className="block leading-none"
            style={{
              fontFamily: "var(--font-display)",
              color: GOLD,
              fontSize: "22px",
              letterSpacing: "0.12em",
              // Tracking adds trailing space after the last glyph, which drags
              // the numeral left of true centre between the two rules. Indent
              // by the same amount to put it back optically.
              textIndent: "0.12em",
            }}
          >
            {numeral(i)}
          </span>
          <span
            aria-hidden
            data-qa="reel-rule"
            className="block h-px"
            style={{ width: LOCKUP_RULE_W_PX, backgroundColor: GOLD }}
          />
        </div>
        <span
          ref={titleRef}
          data-qa="section-heading"
          className="block uppercase"
          style={{
            fontFamily: "var(--font-display)",
            color: IVORY,
            // 28px — the DESIGN.md Headline floor — on every phone the editor
            // models (375 and up). Bounded rather than flat because the longest
            // title fills the frame exactly at 360 (Galaxy S26): a flat 28px
            // wraps it to two lines and the lockup stops reading as one mark.
            fontSize: "clamp(1.5rem, 7.2vw, 1.75rem)",
            lineHeight: 1.1,
            letterSpacing: "0.06em",
          }}
        >
          {slide.title}
        </span>
      </div>
    </>
  );
};

const SlideContent = ({
  i,
  title,
  titleRef,
}: {
  i: number;
  title: string;
  titleRef?: (el: HTMLSpanElement | null) => void;
}) => (
  <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center">
    <span
      aria-hidden
      className="block leading-none"
      style={{
        fontFamily: "var(--font-display)",
        color: "rgba(201,165,92,0.85)",
        fontSize: "clamp(4.5rem, 20vw, 15rem)",
      }}
    >
      {numeral(i)}
    </span>
    <span
      ref={titleRef}
      data-qa="section-heading"
      className="mt-1 block uppercase"
      style={{
        fontFamily: "var(--font-display)",
        color: "#f4ecdb",
        fontSize: "clamp(1.5rem, 5vw, 3.5rem)",
        letterSpacing: "0.06em",
      }}
    >
      {title}
    </span>
  </div>
);

/**
 * TA.2 pinned reel — three "featured" slides (gallery photos 2–4; the hero
 * owns photo 1, so the reel never repeats it). Under motion,
 * the stage is pinned for ~300vh and scrubbed: each slide's photo crossfades in
 * while the type animates up. Under reduced motion the three slides simply
 * stack, static.
 *
 * CINE.FLOW.3 — the act has two compositions, split at the phone breakpoint
 * (see ./reelSpotlight, which owns that line and both veils):
 *
 *  - PHONE: cover photography, UNVEILED, with the V2B lockup at the foot over a
 *    scrim bound to the lockup's own zone (CINE.FLOW.4C). This is what retires
 *    the flat 0.5 → 0.8 wash DESIGN.md recorded as an open violation; nothing
 *    now darkens the photograph at all.
 *  - WIDE: untouched — letterboxed photo, flat wash, centred oversized numeral
 *    over its title. The reel keeps its gallery character above the fold line.
 *
 * The scrub grammar is shared: whichever composition is mounted, slide N's
 * elements enter on the same segment of the same pinned timeline.
 */
const CinematicReel = ({ slides, reduced }: Props) => {
  const phone = useReelIsPhone();
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    if (reduced) return;
    const els = slideRefs.current.filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          start: "top top",
          end: "+=300%",
          scrub: true,
          pin: true,
          anticipatePin: 1,
        },
      });

      for (let i = 1; i < els.length; i++) {
        tl.to(els[i - 1], { opacity: 0, duration: 0.5 }, i);
        tl.to(els[i], { opacity: 1, duration: 0.5 }, i);

        if (phone) {
          // V2's entrance, scrubbed instead of played, minus the beam it no
          // longer has (CINE.FLOW.4C): the type settles in over the slide's own
          // crossfade, which is what now carries the scrim on with it. Same
          // properties, easing and marks as before for the two type tweens, so
          // the segment's dead-stops and total duration are unchanged.
          tl.fromTo(
            labelRefs.current[i],
            { y: 10, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.38, ease: "power3.out" },
            i + 0.12,
          );
          tl.fromTo(
            titleRefs.current[i],
            { y: 14, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.38, ease: "power3.out" },
            i + 0.15,
          );
        } else {
          tl.fromTo(
            titleRefs.current[i],
            { yPercent: 45 },
            { yPercent: 0, duration: 0.5 },
            i,
          );
        }
      }
      tl.to({}, { duration: 0.5 }); // dwell on the final slide before release
    }, sectionRef);

    return () => ctx.revert();
  }, [reduced, slides.length, phone]);

  // Reduced motion: static stacked slides, no pinning/scrubbing.
  if (reduced) {
    return (
      <section ref={sectionRef} data-qa="cinematic-section" className="relative">
        {slides.map((s, i) => (
          <div
            key={i}
            className="relative flex min-h-[70svh] items-center justify-center overflow-hidden"
          >
            {phone ? (
              <PhoneSlide slide={s} i={i} />
            ) : (
              <>
                <div className="absolute inset-0">
                  <SlideBg slide={s} />
                </div>
                <SlideContent i={i} title={s.title} />
              </>
            )}
          </div>
        ))}
      </section>
    );
  }

  return (
    <section ref={sectionRef} data-qa="cinematic-section" className="relative">
      <div ref={pinRef} className="cine-h-full relative w-full overflow-hidden">
        {slides.map((s, i) => (
          <div
            key={i}
            ref={(el) => (slideRefs.current[i] = el)}
            data-qa="reel-slide"
            data-slide={i}
            className="absolute inset-0"
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            {phone ? (
              <PhoneSlide
                slide={s}
                i={i}
                labelRef={(el) => (labelRefs.current[i] = el)}
                titleRef={(el) => (titleRefs.current[i] = el)}
              />
            ) : (
              <>
                <div className="absolute inset-0">
                  <SlideBg slide={s} />
                </div>
                <SlideContent
                  i={i}
                  title={s.title}
                  titleRef={(el) => (titleRefs.current[i] = el)}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default CinematicReel;
