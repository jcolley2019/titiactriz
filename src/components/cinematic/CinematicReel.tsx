import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FramedImage from "./FramedImage";
import type { CinematicPhoto } from "./useCinematicData";
import { REEL_DEFAULT_FOCAL, DEFAULT_ZOOM, type Focal } from "@/hooks/useCinematicMedia";

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

const SlideBg = ({ slide }: { slide: ReelSlide }) => (
  <>
    <FramedImage
      src={slide.photo?.image_url}
      alt={slide.photo?.alt_text ?? ""}
      focal={slide.focal ?? REEL_DEFAULT_FOCAL}
      zoom={slide.zoom ?? DEFAULT_ZOOM}
      fit="fit"
      imgDataQa="cinematic-reel-img"
      loading="lazy"
      fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
    />
    <div
      className="absolute inset-0"
      style={{ background: "linear-gradient(180deg, rgba(11,10,8,0.5), rgba(11,10,8,0.8))" }}
    />
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
 * owns photo 1, so the reel never repeats it). Under motion,
 * the stage is pinned for ~300vh and scrubbed: each slide's photo crossfades in
 * while an oversized 01/02/03 numeral and its title line animate up. Under
 * reduced motion the three slides simply stack, static.
 */
const CinematicReel = ({ slides, reduced }: Props) => {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRefs = useRef<(HTMLSpanElement | null)[]>([]);

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
        tl.fromTo(
          titleRefs.current[i],
          { yPercent: 45 },
          { yPercent: 0, duration: 0.5 },
          i,
        );
      }
      tl.to({}, { duration: 0.5 }); // dwell on the final slide before release
    }, sectionRef);

    return () => ctx.revert();
  }, [reduced, slides.length]);

  // Reduced motion: static stacked slides, no pinning/scrubbing.
  if (reduced) {
    return (
      <section ref={sectionRef} data-qa="cinematic-section" className="relative">
        {slides.map((s, i) => (
          <div
            key={i}
            className="relative flex min-h-[70svh] items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0">
              <SlideBg slide={s} />
            </div>
            <SlideContent i={i} title={s.title} />
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
            className="absolute inset-0"
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            <div className="absolute inset-0">
              <SlideBg slide={s} />
            </div>
            <SlideContent
              i={i}
              title={s.title}
              titleRef={(el) => (titleRefs.current[i] = el)}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default CinematicReel;
