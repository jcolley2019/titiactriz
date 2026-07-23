import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { TITANS_ROUTE } from "@/lib/ventures";

// Titans red family (#C41E2A). The kicker uses a brightened tone so it holds AA
// over the dark art; the CTA is a solid on-brand red with white text.
const RED_ACCENT = "#E24A54";
const RED_BTN = "#C41E2A";
const NEAR_BLACK = "#0b0a08";

// Badge-land mark (seconds) in titans-badge-reveal.mp4 — type enters here.
const BADGE_LANDED = 3.4;

type Props = { reduced: boolean };

/**
 * TA.7b — Titans act. A full-viewport section over the badge-reveal video, which
 * plays exactly ONCE the first time the section reaches ~50% visibility and then
 * holds its final frame (never resets, never loops). The lower-third type block
 * enters when the badge lands (timeupdate ≥ 3.4s) or on 'ended' as a fallback.
 *
 * Under reduced motion nothing autoplays: the poster renders as a static cover
 * image and the full type + CTA are visible immediately.
 */
const CinematicTitans = ({ reduced }: Props) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [attached, setAttached] = useState(false); // lazy src attach
  const playedRef = useRef(false); // play-once latch (survives re-entry)
  const typeShownRef = useRef(false);

  // Hide the type until the badge lands — only when animating.
  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.set(".cine-titans-type > *", { opacity: 0, y: 22 });
    }, sectionRef);
    return () => ctx.revert();
  }, [reduced]);

  const showType = () => {
    if (typeShownRef.current || reduced) return;
    typeShownRef.current = true;
    const nodes = sectionRef.current?.querySelectorAll(".cine-titans-type > *");
    if (nodes && nodes.length) {
      gsap.to(nodes, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.12 });
    }
  };

  // Play once when the section first reaches ~50% viewport visibility.
  useEffect(() => {
    if (reduced) return;
    const root = sectionRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && e.intersectionRatio >= 0.5 && !playedRef.current) {
          playedRef.current = true;
          setAttached(true);
        }
      },
      { threshold: [0, 0.5] },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [reduced]);

  // Kick off the single playthrough once the source is attached.
  useEffect(() => {
    if (reduced || !attached) return;
    videoRef.current?.play().catch(() => {});
  }, [attached, reduced]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (v && v.currentTime >= BADGE_LANDED) showType();
  };

  // Hold the final frame — do NOT reset currentTime; the paused element keeps
  // displaying its last painted frame. Fallback-trigger the type if the clip
  // ended before the badge-land mark was reached.
  const onEnded = () => showType();

  return (
    <section
      ref={sectionRef}
      data-qa="cinematic-titans"
      className="cine-act-vh relative w-full overflow-hidden"
      style={{ backgroundColor: NEAR_BLACK }}
    >
      {reduced ? (
        <img
          src="/ventures/titans-poster.jpg"
          alt=""
          aria-hidden
          data-qa="titans-video"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          data-qa="titans-video"
          muted
          playsInline
          preload="none"
          poster="/ventures/titans-poster.jpg"
          src={attached ? "/ventures/titans-badge-reveal.mp4" : undefined}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Dark scrim — heaviest across the lower third where the type lives. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,10,8,0.28) 0%, rgba(11,10,8,0) 32%, rgba(11,10,8,0.35) 60%, rgba(11,10,8,0.9) 100%)",
        }}
        aria-hidden
      />

      {/* Type — lower third so the landed badge stays unobstructed. */}
      <div className="cine-act-vh relative z-20 flex items-end md:items-center">
        <div className="w-full px-6 pb-16 md:py-16">
          <div className="cine-titans-type mx-auto max-w-2xl text-center md:mx-0 md:max-w-xl md:pl-16 md:text-center lg:pl-32">
            <p
              className="text-xs font-semibold uppercase tracking-[0.3em]"
              style={{ color: RED_ACCENT }}
            >
              {t("cinematic.titans.kicker")}
            </p>
            <h2
              data-qa="section-heading"
              className="mt-4 font-bold uppercase leading-[1.02] text-white"
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 4rem)" }}
            >
              {t("cinematic.titans.headline")}
            </h2>
            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-white/80 md:text-lg">
              {t("cinematic.titans.sub")}
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                to={TITANS_ROUTE}
                data-qa="titans-cta"
                translate="no"
                className="inline-flex items-center gap-2 rounded-md px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white shadow-lg transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                style={{ backgroundColor: RED_BTN }}
              >
                {t("cinematic.titans.cta")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CinematicTitans;
