import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingBag } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CrossfadeLoopVideo from "./CrossfadeLoopVideo";
import { useViewportOrientation } from "@/hooks/useViewportOrientation";
import { GREEN_WORLD_SHOP_URL } from "@/lib/ventures";

gsap.registerPlugin(ScrollTrigger);

// --gw-green (#0B6E4F) / --gw-green-dark from index.css. Deep forest greens read
// AA against the ivory legibility scrim that sits behind the type block.
const FOREST = "hsl(160 75% 20%)";
const FOREST_SOFT = "hsl(160 70% 26%)";
const GW_GREEN = "hsl(160 70% 28%)";
const IVORY = "#F4F2EA";

type Props = { reduced: boolean };

/**
 * TA.7a — Green World act. A full-viewport section over a living, seamlessly
 * looping wave video. On first scroll into view two ivory curtains split at the
 * centreline and slide off to the edges (once per page visit), unveiling the
 * already-playing art; the right-aligned type block then staggers in.
 *
 * Under reduced motion there are no curtains and no autoplay: the poster renders
 * as a static cover image and the full type + CTA are visible immediately.
 */
const CinematicGreenWorld = ({ reduced }: Props) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  // `revealed` gates the curtains out of the DOM once they've opened. Reduced
  // motion starts already-revealed (there is nothing to reveal).
  const [revealed, setRevealed] = useState(reduced);

  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      // Hide the type BEFORE first paint so it never flashes before the curtains.
      gsap.set(".cine-gw-type > *", { opacity: 0, y: 26 });
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: "top 62%", once: true },
        onComplete: () => setRevealed(true),
      });
      tl.to(".cine-gw-curtain-left", { xPercent: -100, duration: 0.9, ease: "power3.inOut" }, 0)
        .to(".cine-gw-curtain-right", { xPercent: 100, duration: 0.9, ease: "power3.inOut" }, 0)
        .to(
          ".cine-gw-type > *",
          { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.12 },
          0.5,
        );
    }, sectionRef);
    return () => ctx.revert();
  }, [reduced]);

  // VENT.GW.1: portrait viewports get the dedicated 9:16 wave loop — the
  // landscape art's motion lives in regions a phone's cover-crop discards.
  const orientation = useViewportOrientation();
  const gwSrc =
    orientation === "portrait"
      ? "/ventures/greenworld-panel-loop-portrait.mp4"
      : "/ventures/greenworld-panel-loop.mp4";
  const gwPoster =
    orientation === "portrait"
      ? "/ventures/greenworld-poster-portrait.jpg"
      : "/ventures/greenworld-poster.jpg";

  return (
    <section
      ref={sectionRef}
      data-qa="cinematic-greenworld"
      className="cine-act-vh relative w-full overflow-hidden"
      style={{ backgroundColor: IVORY }}
    >
      {/* Living wave art (seamless crossfade loop, lazy + visibility-gated). */}
      <CrossfadeLoopVideo
        key={gwSrc}
        src={gwSrc}
        poster={gwPoster}
        reduced={reduced}
        data-qa="gw-video"
      />

      {/* Ivory legibility scrim behind the type — right-weighted on desktop,
          centred on mobile — so deep-forest type keeps AA contrast over the art. */}
      <div
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(to left, rgba(244,242,234,0.92) 0%, rgba(244,242,234,0.68) 26%, rgba(244,242,234,0.14) 52%, rgba(244,242,234,0) 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 md:hidden"
        style={{
          background:
            "linear-gradient(to top, rgba(244,242,234,0.94) 0%, rgba(244,242,234,0.78) 30%, rgba(244,242,234,0.28) 55%, rgba(244,242,234,0) 75%)",
        }}
        aria-hidden
      />

      {/* Type layer — right-aligned on desktop, centred on mobile. */}
      <div className="cine-act-vh relative z-20 flex items-end md:items-center">
        <div className="ml-auto w-full max-w-xl px-6 pb-16 pt-10 text-center md:py-16 md:pr-24 md:text-center lg:pr-40">
          <div className="cine-gw-type">
            <p
              className="text-xs font-semibold uppercase tracking-[0.32em]"
              style={{ color: FOREST_SOFT }}
            >
              {t("cinematic.gw.kicker")}
            </p>
            <h2
              data-qa="section-heading"
              className="mt-5 font-bold leading-[1.04]"
              style={{
                color: FOREST,
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.1rem, 5.2vw, 4.2rem)",
              }}
            >
              {t("cinematic.gw.headline")}
            </h2>
            <p
              className="mx-auto mt-6 max-w-md text-base leading-relaxed md:text-lg"
              style={{ color: FOREST_SOFT }}
            >
              {t("cinematic.gw.sub")}
            </p>
            <p className="mt-4 text-lg font-semibold md:text-xl" style={{ color: FOREST }}>
              {t("cinematic.gw.leadin")}
            </p>
            <div className="mt-9 flex justify-center">
              <a
                href={GREEN_WORLD_SHOP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-qa="gw-cta"
                translate="no"
                className="inline-flex items-center gap-2 rounded-md px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] shadow-lg transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                style={{ backgroundColor: GW_GREEN, color: IVORY }}
              >
                <ShoppingBag className="h-4 w-4" />
                {t("cinematic.gw.cta")}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Curtains — two ivory panels that split at the centreline and slide off.
          Rendered only while animating; unmounted once the reveal completes. */}
      {!reduced && !revealed && (
        <>
          <div
            className="cine-gw-curtain-left absolute inset-y-0 left-0 z-30 w-1/2"
            style={{ backgroundColor: IVORY }}
            data-qa="gw-curtain"
            aria-hidden
          />
          <div
            className="cine-gw-curtain-right absolute inset-y-0 right-0 z-30 w-1/2"
            style={{ backgroundColor: IVORY }}
            data-qa="gw-curtain"
            aria-hidden
          />
        </>
      )}
    </section>
  );
};

export default CinematicGreenWorld;
