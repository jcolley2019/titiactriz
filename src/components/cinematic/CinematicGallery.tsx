import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CinematicPhoto } from "./useCinematicData";

gsap.registerPlugin(ScrollTrigger);

type Props = { photos: CinematicPhoto[]; reduced: boolean };

/**
 * TA.3 horizontal gallery — vertical scroll drives a horizontal track through
 * ALL published photos (ordered by sort_order upstream), each with a subtle
 * parallax as it crosses the viewport, ending on a total-count marker. Under
 * reduced motion it becomes a plain vertical grid.
 */
const CinematicGallery = ({ photos, reduced }: Props) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const altFor = (p: CinematicPhoto, i: number) =>
    p.alt_text && p.alt_text.trim().length > 0
      ? p.alt_text
      : t("gallery.imageAlt", { number: i + 1 });

  useLayoutEffect(() => {
    if (reduced || photos.length === 0) return;

    const ctx = gsap.context(() => {
      const track = trackRef.current!;
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

      const hAnim = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: () => `+=${distance()}`,
          scrub: true,
          pin: pinRef.current,
          invalidateOnRefresh: true,
        },
      });

      // Subtle per-image parallax, tied to the horizontal scroll.
      gsap.utils.toArray<HTMLElement>(".cine-gallery-img").forEach((img) => {
        gsap.fromTo(
          img,
          { xPercent: -5 },
          {
            xPercent: 5,
            ease: "none",
            scrollTrigger: {
              trigger: img,
              containerAnimation: hAnim,
              start: "left right",
              end: "right left",
              scrub: true,
            },
          },
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [reduced, photos.length]);

  // Reduced motion: standard vertical grid.
  if (reduced) {
    return (
      <section ref={sectionRef} data-qa="cinematic-gallery" className="relative px-6 py-20">
        <div className="mb-10 text-center">
          <p className="text-caps mb-3" style={{ color: "#C9A55C" }}>
            {t("gallery.eyebrow")}
          </p>
          <h2
            data-qa="section-heading"
            className="text-3xl md:text-4xl"
            style={{ fontFamily: "var(--font-display)", color: "#f4ecdb" }}
          >
            {t("gallery.title")}
          </h2>
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 md:grid-cols-3">
          {photos.map((p, i) => (
            <img
              key={p.id}
              src={p.image_url}
              alt={altFor(p, i)}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full rounded-sm object-cover"
            />
          ))}
        </div>
        <p className="mt-10 text-center text-caps" style={{ color: "rgba(240,233,218,0.7)" }}>
          {photos.length} · {t("gallery.title")}
        </p>
      </section>
    );
  }

  return (
    <section ref={sectionRef} data-qa="cinematic-gallery" className="relative">
      <div ref={pinRef} className="relative h-[100svh] overflow-hidden">
        <div
          ref={trackRef}
          className="flex h-full items-center gap-6 pl-6 pr-6 md:gap-8 md:pl-12"
          style={{ width: "max-content" }}
        >
          {/* Intro panel */}
          <div className="flex h-[62svh] w-[80vw] shrink-0 flex-col justify-center sm:w-[46vw] lg:w-[30vw]">
            <p className="text-caps mb-3" style={{ color: "#C9A55C" }}>
              {t("gallery.eyebrow")}
            </p>
            <h2
              data-qa="section-heading"
              className="leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "#f4ecdb",
                fontSize: "clamp(2rem, 4vw, 3.5rem)",
              }}
            >
              {t("gallery.title")}
            </h2>
          </div>

          {/* Photos */}
          {photos.map((p, i) => (
            <figure
              key={p.id}
              className="relative h-[62svh] aspect-[4/5] shrink-0 overflow-hidden rounded-sm"
            >
              <img
                src={p.image_url}
                alt={altFor(p, i)}
                loading="lazy"
                decoding="async"
                className="cine-gallery-img absolute top-0 left-[-12%] h-full w-[124%] max-w-none object-cover"
              />
            </figure>
          ))}

          {/* End cap: total-count marker */}
          <div className="flex h-[62svh] shrink-0 flex-col items-center justify-center px-16 text-center">
            <span
              className="leading-none"
              style={{
                fontFamily: "var(--font-display)",
                color: "#C9A55C",
                fontSize: "clamp(4rem, 12vw, 9rem)",
              }}
            >
              {photos.length}
            </span>
            <span className="text-caps mt-3" style={{ color: "rgba(240,233,218,0.7)" }}>
              {t("gallery.title")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CinematicGallery;
