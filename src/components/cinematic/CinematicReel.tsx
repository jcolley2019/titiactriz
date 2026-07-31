import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FramedImage from "./FramedImage";
import type { CinematicPhoto } from "./useCinematicData";
import {
  defaultClassFraming,
  plateAspectOf,
  type ClassFraming,
  type ClassFramingPair,
} from "@/hooks/useCinematicMedia";
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
  CHAPTER_FIELD_FRACTION,
  ORNAMENT_OPACITY,
  PLATE_TOP_VH,
  PlateFrame,
  WideChapter,
  focalFractions,
  plateBox,
  useFrameSize,
} from "./reelWide";
import { CHAPTER_GROUNDS, FIELD_LIGHT } from "./FramedVideo";
import { REEL_CHAPTER_DEFAULTS, type ReelChapterCopy } from "./reelChapters";

gsap.registerPlugin(ScrollTrigger);

export type ReelSlide = {
  photo?: CinematicPhoto;
  title: string;
  /**
   * Admin framing (ADMIN.MEDIA.1), split per device class by FRAME.SPLIT.1: the
   * phone act reads `framing.phone`, the wide act reads `framing.wide`. Absent →
   * centered/1× on both, i.e. today's render.
   */
  framing?: ClassFramingPair;
  /**
   * CINE.FLOW.6 — the wide act's story chapter (eyebrow/title/body), resolved
   * by the page from site_settings over the in-repo seeds. The phone act never
   * reads it. Absent → the seed for this slide's index.
   */
  chapter?: ReelChapterCopy;
};

type Props = { slides: ReelSlide[]; reduced: boolean };

const numeral = (i: number) => String(i + 1).padStart(2, "0");

/**
 * FRAME.SPLIT.1 — the class record this act paints with. Each act names its own
 * class, so an act can never inherit the other's crop; an unframed slide falls
 * to the reel default on both.
 */
const framingFor = (slide: ReelSlide, cls: "phone" | "wide"): ClassFraming =>
  slide.framing?.[cls] ?? defaultClassFraming();

/**
 * The photo layer, on both acts. COVER on every surface as of CINE.FLOW.5: the
 * phone act is edge-to-edge and the wide act crops to a portrait plate that is
 * already the sources' own aspect, so the letterbox mode — and with it the
 * `reelSlideFit` selector that used to choose between them — has no caller left.
 *
 * The framing is passed in, never read off the slide: the caller is the act,
 * and the act is what knows its device class.
 */
const SlidePhoto = ({ slide, framing }: { slide: ReelSlide; framing: ClassFraming }) => (
  <FramedImage
    src={slide.photo?.image_url}
    alt={slide.photo?.alt_text ?? ""}
    focal={framing.focal}
    zoom={framing.zoom}
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
  /** Wide-only entrance refs (REVIEW.2); the phone act never renders them. */
  ornRef?: (el: HTMLImageElement | null) => void;
  frameRef?: (el: SVGRectElement | null) => void;
}) => (
  <>
    <div className="absolute inset-0">
      <SlidePhoto slide={slide} framing={framingFor(slide, "phone")} />
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
 * CINE.FLOW.6 — the wide act: an editorial STORY SPREAD.
 *
 * The W2 portrait plate (unchanged laws: true portrait aspect, gold hairline
 * frame, NO veil — no type ever crosses the photograph) hangs centred in the
 * spread's photo page while the story chapter occupies the other page,
 * separated from the plate's page by a 1px gold seam. REVIEW.2: the spread is
 * ONE tonal room — a single uninterrupted field on the chapter's sibling shade
 * of the hero ground (no blurred backdrop, no second material behind the
 * plate) — and the plate's gold hairline DRAWS itself on the slide's entrance
 * slot of the pinned timeline, the corner filigree blooming in after. Sides ALTERNATE per slide: 01 plate-left/copy-right,
 * 02 flipped, 03 as 01, so the pinned crossfade turns pages rather than
 * repeating one. W2's centred caption band and its two 18%/82% hairlines are
 * superseded — the seam is the spread's one vertical gold line.
 *
 * Geometry is measured, not declared in viewport units: `useFrameSize` reads the
 * box this slide actually paints into, which is the pinned stage under motion
 * and a 70svh slide under reduced motion. `plateBox`'s "smaller box wins" law
 * is applied against the PHOTO PAGE's width (the frame minus the chapter
 * column), so the max-width cap keeps protecting the plate from short frames.
 *
 * ADMIN.ASPECT.1 — the plate's SHAPE is per slide, read off the wide framing
 * record: portrait (the default, and every existing slide) or a 3:2 landscape
 * plate. Only `plateBox`'s three numbers change with it. The spread's own
 * geometry — the 0.42 chapter column, the alternation, the seam, the centring —
 * is measured against the plate's box and so needs no branch, and the drawn gold
 * frame and the filigree keep working on a landscape plate for the same reason.
 */
const WideSlide = ({
  slide,
  i,
  labelRef,
  titleRef,
  ornRef,
  frameRef,
}: {
  slide: ReelSlide;
  i: number;
  labelRef?: (el: HTMLElement | null) => void;
  titleRef?: (el: HTMLElement | null) => void;
  ornRef?: (el: HTMLImageElement | null) => void;
  frameRef?: (el: SVGRectElement | null) => void;
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const { w: frameW, h: frameH } = useFrameSize(stageRef);

  // Alternation law: even slides read plate → copy, odd slides copy → plate.
  const copySide: "left" | "right" = i % 2 === 1 ? "left" : "right";
  const zoneW = frameW * (1 - CHAPTER_FIELD_FRACTION);
  const zoneX = copySide === "left" ? frameW * CHAPTER_FIELD_FRACTION : 0;

  // FRAME.SPLIT.1: the plate's crop AND its focal read-out come from the wide
  // record, so `data-focal` reports the class actually painted here.
  const framing = framingFor(slide, "wide");
  // ADMIN.ASPECT.1: and so does the plate's SHAPE. Absent ≡ portrait, so a slide
  // that predates the field sizes byte-identically to before.
  const plate = plateAspectOf(framing);
  const box = plateBox(zoneW, frameH, plate);
  const plateLeft = zoneX + (zoneW - box.w) / 2;
  // Centred in the frame's height, but never higher than W2's header-clearing
  // top edge (PLATE_TOP_VH) on short frames. ADMIN.ASPECT.1 needs no second rule:
  // a landscape plate is shallow, so this same expression centres it against the
  // full-height copy column, and the clamp only ever binds on the tall portrait
  // plate at short frames — exactly as it did before.
  const plateTop = Math.max(frameH * (PLATE_TOP_VH / 100), (frameH - box.h) / 2);
  const { fx, fy } = focalFractions(framing.focal);
  const measured = frameW > 0 && frameH > 0;
  const chapter = slide.chapter ?? REEL_CHAPTER_DEFAULTS[i % REEL_CHAPTER_DEFAULTS.length].es;

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 overflow-hidden"
      data-qa="wide-room"
      // REVIEW.2 — the tonal room: ONE uninterrupted field edge to edge, both
      // sides of the seam, on this chapter's sibling shade of the hero ground
      // under the same barely-there luminance gradient. The blurred backdrop is
      // retired from the live act.
      style={{
        backgroundColor: CHAPTER_GROUNDS[i % CHAPTER_GROUNDS.length],
        backgroundImage: FIELD_LIGHT,
      }}
    >
      {measured && (
        <>
          <div
            data-qa="wide-plate"
            data-focal={`${fx.toFixed(4)},${fy.toFixed(4)}`}
            // ADMIN.ASPECT.1 — the painted plate declares its own shape, so a
            // spec reads the choice off the render instead of inferring it from
            // a measured ratio.
            data-plate={plate}
            className="absolute overflow-hidden"
            style={{
              left: plateLeft,
              top: plateTop,
              width: box.w,
              height: box.h,
            }}
          >
            {/* Unveiled: nothing paints over the photograph inside the plate.
                The gold hairline is the self-drawing frame, not an outline. */}
            <SlidePhoto slide={slide} framing={framing} />
            <PlateFrame frameRef={frameRef} />
          </div>

          <WideChapter
            index={i}
            copy={chapter}
            frameW={frameW}
            side={copySide}
            labelRef={labelRef}
            titleRef={titleRef}
            ornRef={ornRef}
          />
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
 * The act has two compositions, split at the phone breakpoint (see
 * ./reelSpotlight, which owns that line):
 *
 *  - PHONE (CINE.FLOW.5): V1 "Edge Veil" — cover photography under one
 *    directional veil weighted to the foot of the frame, numeral over title.
 *  - WIDE (CINE.FLOW.6): the editorial story spread — the unveiled W2 portrait
 *    plate on one page, the story chapter on the hero's field treatment on the
 *    other, sides alternating per slide (./reelWide).
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
  const titleRefs = useRef<(HTMLElement | null)[]>([]);
  const labelRefs = useRef<(HTMLElement | null)[]>([]);
  // REVIEW.2 — wide-only entrance elements: the self-drawing plate frame and
  // the corner filigree that blooms after it. The phone act never sets these,
  // so on phone the guards below simply skip their tweens and the timeline is
  // byte-identical to CINE.FLOW.5's.
  const plateFrameRefs = useRef<(SVGRectElement | null)[]>([]);
  const ornRefs = useRef<(HTMLImageElement | null)[]>([]);
  // The wide composition mounts its entrance elements only AFTER useFrameSize
  // has measured (a second commit), which is after this component's layout
  // effect has already built the timeline — against null targets. Counting the
  // mounted plate frames in state re-runs the effect once they exist, so the
  // timeline is rebuilt against the real elements. Phone never sets these and
  // the count stays 0.
  const [wideFrameCount, setWideFrameCount] = useState(0);
  const setPlateFrameRef = (i: number) => (el: SVGRectElement | null) => {
    if (!!plateFrameRefs.current[i] !== !!el) setWideFrameCount((n) => n + (el ? 1 : -1));
    plateFrameRefs.current[i] = el;
  };

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

      // REVIEW.2 — the frame draw + filigree bloom, on each slide's entrance
      // slot of the SAME scrubbed timeline (never free-running). The line
      // finishes before the slide's dead-stop; the filigree blooms only AFTER
      // the line completes. Slide 1 has no crossfade — its slot is the head of
      // the scrub, so the frame draws as the pin engages and is complete by the
      // first dead-stop (0.5).
      const frameDraw = (i: number, at: number, duration: number) => {
        const line = plateFrameRefs.current[i];
        if (line) {
          tl.fromTo(
            line,
            { strokeDashoffset: 1 },
            { strokeDashoffset: 0, duration, ease: "power3.out" },
            at,
          );
        }
        const orn = ornRefs.current[i];
        if (orn) {
          tl.fromTo(
            orn,
            { opacity: 0 },
            { opacity: ORNAMENT_OPACITY, duration: 0.15, ease: "power2.out" },
            at + duration + 0.02,
          );
        }
      };
      frameDraw(0, 0, 0.3);

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
        frameDraw(i, i + 0.1, 0.4);
      }
      tl.to({}, { duration: 0.5 }); // dwell on the final slide before release

      // MOBILE.EDGE.4 — the skirt YIELDS to the photograph. It exists for one
      // scroll position: the rest, where Safari's expanded bar samples the
      // act's first rows past the hero's lvh foot. The moment the reader
      // scrolls, the chrome collapses and the need is gone — so the fade is
      // scrubbed out as the seam climbs, bare before the seam passes the
      // viewport's upper two-thirds. Slide 01's dwell never shows it (Joey's
      // eye, 2026-07-31: the static fade was very noticeable on the sky).
      const skirt = sectionRef.current?.querySelector('[data-qa="seam-skirt"]');
      if (skirt) {
        gsap.fromTo(
          skirt,
          { opacity: 1 },
          {
            opacity: 0,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "top 65%",
              scrub: true,
            },
          },
        );
      }
    }, sectionRef);

    // The wide rebuild (wideFrameCount) reverts and recreates this pinned
    // trigger AFTER the later acts created theirs, which leaves it LAST in
    // ScrollTrigger's refresh order: on the next global refresh every later
    // pinned act would be measured without this act's 300vh pin spacer and
    // pin ~2160px too early (the Green World canvas then swallows the
    // gallery). Re-sort into document order, then refresh, so the spacers
    // accumulate top-down again.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();

    return () => ctx.revert();
  }, [reduced, slides.length, phone, wideFrameCount]);

  const Composition = phone ? PhoneSlide : WideSlide;

  // Reduced motion: static stacked slides, no pinning/scrubbing. Both acts are
  // their own SETTLED frame — the wide act's plate frame and filigree render
  // complete and static (their markup state), and neither act has a veil whose
  // entrance was carrying anything.
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
        {/* MOBILE.EDGE.3 — seam skirt: the hero seam and the browser chrome are
            the same on this path; with no pin there is no scrub to leave with,
            so it simply marks the act's top edge. Phone composition only, like
            the motion path. */}
        {phone && <div aria-hidden data-qa="seam-skirt" className="cine-seam-skirt" />}
      </section>
    );
  }

  return (
    <section ref={sectionRef} data-qa="cinematic-section" className="relative">
      {/* MOBILE.EDGE.3 — the reel takes Green World's fix, being the same defect:
          an `svh` pinned stage stops ~12% short of the screen once Safari's
          chrome has collapsed, and by the time a reader is scrubbing the act the
          chrome IS collapsed, so a strip of page ground sat under the slide.
          `.cine-stage-lvh` is static like `svh` — the pin measures the same
          number on every refresh — and is the larger of the two. See the height
          law in cinematic.css. */}
      <div ref={pinRef} className="cine-stage-lvh relative w-full overflow-hidden">
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
              ornRef={(el) => (ornRefs.current[i] = el)}
              frameRef={setPlateFrameRef(i)}
            />
          </div>
        ))}
      </div>
      {/* MOBILE.EDGE.3 — seam skirt (DESIGN.md, veil grammar): darkens the reel's
          first rows toward the hero seam, so Safari's expanded bar samples
          near-black at the rest position instead of the first slide's sky. A
          child of the SECTION, not the pinned stage — it rides the seam and has
          left the screen before the scrub plays, so no slide ever wears it.
          MOBILE.EDGE.4 — and it YIELDS on approach: opacity scrubbed to zero
          (effect above) before the seam passes the upper two-thirds, so the
          photograph is never read through it.
          PHONE COMPOSITION ONLY, on the same line that splits the act: wide
          viewports have no mobile bottom chrome to guard against, and the wide
          census ("no veil at all on wide") keeps its exact three-rooms
          enumeration. */}
      {phone && <div aria-hidden data-qa="seam-skirt" className="cine-seam-skirt" />}
    </section>
  );
};

export default CinematicReel;
