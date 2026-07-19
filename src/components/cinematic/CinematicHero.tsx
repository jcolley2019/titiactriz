import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CinematicHeroMedia from "./CinematicHeroMedia";
import type { CinematicPhoto } from "./useCinematicData";

gsap.registerPlugin(ScrollTrigger);

const NAME_LINES = ["CRISTYNA", "POLENTINO"] as const;

/** One display line split into per-letter <span>s (manual, no SplitText). */
const HeroWord = ({ text }: { text: string }) => (
  <span className="block">
    {text.split("").map((ch, i) => (
      <span key={i} className="cine-letter">
        {ch}
      </span>
    ))}
  </span>
);

type Props = {
  photo?: CinematicPhoto;
  videoSrc?: string | null;
  subtitle: string;
  scrollLabel: string;
  reduced: boolean;
};

/**
 * TA.1 hero — full-viewport, kinetic name reveal over a Ken Burns / video
 * background, subtitle fade-up, scroll cue, and a slight title parallax on
 * scroll. Under reduced motion nothing animates: the layout renders static.
 */
const CinematicHero = ({ photo, videoSrc, subtitle, scrollLabel, reduced }: Props) => {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const restRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (reduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".cine-letter", {
        yPercent: 60,
        opacity: 0,
        duration: 0.8,
        stagger: 0.04,
      });
      tl.from(restRef.current, { y: 22, opacity: 0, duration: 0.8 }, "-=0.15");

      // Slight parallax: the title drifts up and fades as the hero scrolls away.
      gsap.to(titleRef.current, {
        yPercent: -16,
        opacity: 0.7,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      data-qa="cinematic-section"
      className="cine-vh-full relative flex items-center justify-center overflow-hidden px-6 pt-24 pb-16 text-center"
    >
      <CinematicHeroMedia photo={photo} videoSrc={videoSrc} reduced={reduced} />

      {/* TA.6d: nudge the whole lockup down ~8vh (to ~58% of the viewport) so
          the name overlaps her chest/torso and her head sits clearly above the
          first line, at both viewports. Composes with the title's scroll
          parallax (animated on titleRef, a child) and the reduced-motion path. */}
      <div className="relative z-10 flex flex-col items-center" style={{ transform: "translateY(8vh)" }}>
        <div ref={titleRef}>
          <h1
            data-qa="section-heading"
            aria-label="Cristyna Polentino"
            translate="no"
            className="notranslate uppercase leading-[0.92] tracking-[0.05em]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.75rem, 11vw, 9rem)",
            }}
          >
            <span aria-hidden className="block text-[#f4ecdb]">
              <HeroWord text={NAME_LINES[0]} />
            </span>
            <span aria-hidden className="block" style={{ color: "#C9A55C" }}>
              <HeroWord text={NAME_LINES[1]} />
            </span>
          </h1>
        </div>

        <div ref={restRef} className="mt-6">
          <p
            className="uppercase"
            style={{
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.32em",
              fontSize: "clamp(0.7rem, 1.5vw, 0.95rem)",
              color: "rgba(240,233,218,0.85)",
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>

      {/* Scroll cue */}
      <div data-qa="cinematic-scrollcue" className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <div className="flex flex-col items-center gap-2 text-[#f0e9da]/60">
          <span className="text-[10px] uppercase tracking-[0.3em]">{scrollLabel}</span>
          <span className="cine-scrollcue-line block h-10 w-px bg-gradient-to-b from-[#C9A55C]/80 to-transparent" />
        </div>
      </div>
    </section>
  );
};

export default CinematicHero;
