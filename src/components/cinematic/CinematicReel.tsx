import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FramedImage from "./FramedImage";
import type { CinematicPhoto } from "./useCinematicData";
import { REEL_DEFAULT_FOCAL, DEFAULT_ZOOM, type Focal } from "@/hooks/useCinematicMedia";
import {
  GOLD,
  IVORY,
  PHONE_LOCKUP_GAP_PX,
  PHONE_LOCKUP_PAD_BOTTOM_PX,
  PHONE_LOCKUP_PAD_X_PX,
  PHONE_NUMERAL_PX,
  PHONE_TITLE_CLAMP,
  PHONE_VEIL,
  WIDE_VEIL,
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
 * CINE.FLOW.5 — the phone act, promoted from bake-off variant V1 "Edge Veil".
 *
 * The photograph covers the frame and carries ONE directional veil: nothing at
 * all through the top 54%, suppression starting only where the type lands and
 * deepening to 0.32 at the bottom edge, which hands off to the next act. The
 * lockup is the numeral over its title — the numeral at 66px (V1's 82px reduced
 * 20%), the title at the V2 lockup clamp.
 *
 * This SUPERSEDES CINE.FLOW.4C's composition. The lockup-bound scrim and the
 * two gold rules that flanked the old 22px numeral are gone: V1 draws a bare
 * numeral over its title, and where V1 and 4C conflict, V1 wins. What survives
 * from 4C is the finding — the flat 0.5 → 0.8 wash is retired for good.
 */
const PhoneSlide = ({
  slide,
  i,
  labelRef,
  titleRef,
}: {
  slide: ReelSlide;
  i: number;
  labelRef?: (el: HTMLElement | null) => void;
  titleRef?: (el: HTMLSpanElement | null) => void;
}) => (
  <>
    <div className="absolute inset-0">
      <SlidePhoto slide={slide} phone />
    </div>

    {/* The edge veil: a weight at the foot of the frame, nothing more. */}
    <div
      data-qa="reel-veil"
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ background: PHONE_VEIL }}
    />

    <div
      data-qa="reel-lockup"
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center text-center"
      style={{
        paddingLeft: PHONE_LOCKUP_PAD_X_PX,
        paddingRight: PHONE_LOCKUP_PAD_X_PX,
        paddingBottom: PHONE_LOCKUP_PAD_BOTTOM_PX,
      }}
    >
      <span
        ref={labelRef}
        aria-hidden
        data-qa="reel-numeral"
        className="block leading-none"
        style={{
          fontFamily: "var(--font-display)",
          color: GOLD,
          fontSize: PHONE_NUMERAL_PX,
        }}
      >
        {numeral(i)}
      </span>
      <span
        ref={titleRef}
        data-qa="section-heading"
        className="block uppercase"
        style={{
          fontFamily: "var(--font-display)",
          color: IVORY,
          fontSize: PHONE_TITLE_CLAMP,
          lineHeight: 1.1,
          letterSpacing: "0.06em",
          marginTop: PHONE_LOCKUP_GAP_PX,
        }}
      >
        {slide.title}
      </span>
    </div>
  </>
);

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
 * owns photo 1, so the reel never repeats it). Under motion, the stage is
 * pinned for ~300vh and scrubbed: each slide's photo crossfades in while the
 * type animates up. Under reduced motion the three slides simply stack, static.
 *
 * CINE.FLOW.5 — the act has two compositions, split at the phone breakpoint
 * (see ./reelSpotlight, which owns that line and the phone veil):
 *
 *  - PHONE: V1 "Edge Veil" — cover photography under one directional veil
 *    weighted to the foot of the frame, numeral over title.
 *  - WIDE: unchanged for one more commit — letterboxed photo, flat wash,
 *    centred oversized numeral over its title. The wide promotion to W2
 *    "Center Plate & Rules" lands next and retires all of it, along with
 *    `WIDE_VEIL` and `reelSlideFit`.
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
  const labelRefs = useRef<(HTMLElement | null)[]>([]);

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
          // The type settles in over the slide's own crossfade, scrubbed rather
          // than played. Same properties, easing and marks as before, so the
          // segment's dead-stops and total duration are unchanged.
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
