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
  useReelIsPhone,
} from "./reelSpotlight";
import {
  AmbientBackdrop,
  BAND_PAD_VH,
  PLATE_OUTLINE,
  PLATE_TOP_VH,
  WIDE_RULE_OPACITY,
  WIDE_RULE_X,
  WideLockup,
  focalFractions,
  plateBox,
  useFrameSize,
} from "./reelWide";

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

/**
 * The photo layer, on both acts. COVER on every surface as of CINE.FLOW.5: the
 * phone act is edge-to-edge and the wide act crops to a portrait plate that is
 * already the sources' own aspect, so the letterbox mode — and with it the
 * `reelSlideFit` selector that used to choose between them — has no caller left.
 */
const SlidePhoto = ({ slide }: { slide: ReelSlide }) => (
  <FramedImage
    src={slide.photo?.image_url}
    alt={slide.photo?.alt_text ?? ""}
    focal={slide.focal ?? REEL_DEFAULT_FOCAL}
    zoom={slide.zoom ?? DEFAULT_ZOOM}
    fit="fill"
    imgDataQa="cinematic-reel-img"
    loading="lazy"
    fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
  />
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
      <SlidePhoto slide={slide} />
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

/**
 * CINE.FLOW.5 — the wide act, promoted from bake-off variant W2 "Center Plate &
 * Rules" as it stood after CINE.FLOW.4B.
 *
 * A centred portrait plate in a gold hairline frame, hung between two vertical
 * gold hairlines, over an ambient backdrop built from the slide's own
 * photograph; the lockup is an engraved caption centred in the band beneath the
 * plate. The plate carries NO veil — the lockup never crosses the photograph,
 * so there is no type to protect there and a veil would only cost the plate its
 * light. This replaces the letterboxed rendering and its flat wash entirely.
 *
 * Geometry is measured, not declared in viewport units: `useFrameSize` reads the
 * box this slide actually paints into, which is the pinned stage under motion
 * and a 70svh slide under reduced motion.
 */
const WideSlide = ({
  slide,
  i,
  labelRef,
  titleRef,
}: {
  slide: ReelSlide;
  i: number;
  labelRef?: (el: HTMLElement | null) => void;
  titleRef?: (el: HTMLSpanElement | null) => void;
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const { w: frameW, h: frameH } = useFrameSize(frameRef);

  const box = plateBox(frameW, frameH);
  const plateLeft = (frameW - box.w) / 2;
  const plateTop = frameH * (PLATE_TOP_VH / 100);
  const bandPad = frameH * (BAND_PAD_VH / 100);
  const { fx, fy } = focalFractions(slide.focal);
  const measured = frameW > 0 && frameH > 0;

  return (
    <div ref={frameRef} className="absolute inset-0 overflow-hidden">
      <AmbientBackdrop src={slide.photo?.image_url} />

      {/* The two rules — identical on every slide, so the crossfade cannot make
          them move; DOM order keeps them below the plate. */}
      {measured &&
        WIDE_RULE_X.map((x) => (
          <div
            key={x}
            aria-hidden
            data-qa="wide-rule"
            className="absolute inset-y-0"
            style={{
              left: frameW * x,
              width: 1,
              backgroundColor: GOLD,
              opacity: WIDE_RULE_OPACITY,
            }}
          />
        ))}

      {measured && (
        <>
          <div
            data-qa="wide-plate"
            data-focal={`${fx.toFixed(4)},${fy.toFixed(4)}`}
            className="absolute overflow-hidden"
            style={{
              left: plateLeft,
              top: plateTop,
              width: box.w,
              height: box.h,
              outline: PLATE_OUTLINE,
            }}
          >
            {/* Unveiled: nothing paints over the photograph inside the plate. */}
            <SlidePhoto slide={slide} />
          </div>

          {/* The caption band: whatever height remains under the plate. */}
          <div
            className="absolute inset-x-0 flex items-center justify-center"
            style={{
              top: plateTop + box.h,
              bottom: 0,
              paddingTop: bandPad,
              paddingBottom: bandPad,
            }}
          >
            <WideLockup
              index={i}
              title={slide.title}
              frameW={frameW}
              labelRef={labelRef}
              titleRef={titleRef}
            />
          </div>
        </>
      )}
    </div>
  );
};

/**
 * TA.2 pinned reel — three "featured" slides (gallery photos 2–4; the hero
 * owns photo 1, so the reel never repeats it). Under motion, the stage is
 * pinned for ~300vh and scrubbed: each slide's photo crossfades in while the
 * type animates up. Under reduced motion the three slides simply stack, static.
 *
 * CINE.FLOW.5 — the act has two compositions, split at the phone breakpoint
 * (see ./reelSpotlight, which owns that line):
 *
 *  - PHONE: V1 "Edge Veil" — cover photography under one directional veil
 *    weighted to the foot of the frame, numeral over title.
 *  - WIDE: W2 "Center Plate & Rules" — an unveiled portrait plate on an ambient
 *    backdrop between two gold hairlines, lockup captioned beneath (./reelWide).
 *
 * Both are now inside DESIGN.md's veil band, so the reel-veil violation the
 * document has carried since TA.2 is closed on both device classes.
 *
 * The scrub grammar is shared, and as of the promotion it is also LITERALLY the
 * same code: both compositions expose a label element and a title element, so
 * slide N's elements enter on the same segment of the same pinned timeline with
 * no per-composition branch. Neither act has a veil the type must wait for, so
 * neither has a beam-open beat; the crossfade covers that mark on both.
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

        // The type settles in over the slide's own crossfade, scrubbed rather
        // than played. Same properties, easing and marks on both compositions,
        // so the segment's dead-stops and total duration are composition-blind.
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
      }
      tl.to({}, { duration: 0.5 }); // dwell on the final slide before release
    }, sectionRef);

    return () => ctx.revert();
  }, [reduced, slides.length, phone]);

  const Composition = phone ? PhoneSlide : WideSlide;

  // Reduced motion: static stacked slides, no pinning/scrubbing. Both acts are
  // their own first frame — the wide act keeps its backdrop and plate, and
  // neither has a veil whose entrance was carrying anything.
  if (reduced) {
    return (
      <section ref={sectionRef} data-qa="cinematic-section" className="relative">
        {slides.map((s, i) => (
          <div
            key={i}
            className="relative flex min-h-[70svh] items-center justify-center overflow-hidden"
          >
            <Composition slide={s} i={i} />
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
            <Composition
              slide={s}
              i={i}
              labelRef={(el) => (labelRefs.current[i] = el)}
              titleRef={(el) => (titleRefs.current[i] = el)}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default CinematicReel;
