import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FramedImage from "./FramedImage";
import type { CinematicPhoto } from "./useCinematicData";
import type { Focal } from "@/hooks/useCinematicMedia";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  reduced: boolean;
  /**
   * ABOUT.MEDIA.1 — the resolved About portrait panel (from resolved.about).
   * All three arrive together or all are absent: with no photo the panel isn't
   * rendered and the section is byte-identical to its text-only original.
   */
  photo?: CinematicPhoto;
  focal?: Focal;
  zoom?: number;
};

/**
 * TA.4 about — an editorial pull-quote (the existing about.p3 belief statement,
 * reused verbatim) with the supporting about paragraphs revealed line by line
 * on scroll. Reduced motion renders everything static.
 *
 * ABOUT.MEDIA.1 — when an About photo is configured, the copy becomes the left
 * column of a two-column editorial split with a fixed 3:4 portrait panel on the
 * right (md+); on mobile the panel stacks between the blockquote and the
 * paragraphs. With no photo, none of that attaches (see `hasPanel`).
 */
const CinematicAbout = ({ reduced, photo, focal, zoom }: Props) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

  // Opt-in: only a fully-resolved panel switches the container to the grid and
  // tags each block with its grid area. Without it, every class below is exactly
  // today's and no panel node renders — a byte-identical text-only section.
  const hasPanel = !!photo && !!focal && typeof zoom === "number";
  const area = (name: string) => (hasPanel ? ` cine-a-${name}` : "");

  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.from(".cine-about-line", {
        y: 28,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.14,
        scrollTrigger: { trigger: sectionRef.current, start: "top 72%" },
      });

      // REVIEW.2b — the About DWELL: the section pins for +=120% before it
      // releases, so the reader sits with the belief statement instead of
      // sliding straight through to contact. Reduced motion skips the pin with
      // the rest of this effect. REVIEW.3a made this the UNIFORM dwell law:
      // every story act (gallery, About, contact) pins with these exact
      // numbers. Only the footer never pins (still ruled).
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=120%",
        pin: true,
        anticipatePin: 1,
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      id="cinematic-about"
      data-qa="cinematic-section"
      className="relative px-6 py-24 md:py-32"
    >
      <div className={hasPanel ? "mx-auto max-w-5xl cine-about-grid" : "mx-auto max-w-4xl"}>
        <p className={`cine-about-line text-caps mb-8${area("eyebrow")}`} style={{ color: "#C9A55C" }}>
          {t("about.eyebrow")}
        </p>

        <blockquote
          data-qa="section-heading"
          className={`cine-about-line${area("quote")}`}
          style={{
            fontFamily: "var(--font-display)",
            color: "#f4ecdb",
            fontSize: "clamp(1.75rem, 4vw, 3.25rem)",
            lineHeight: 1.22,
          }}
        >
          {t("about.p3")}
        </blockquote>

        {hasPanel && (
          <div className="cine-about-line cine-about-panel mt-10 md:mt-0">
            <FramedImage
              src={photo!.image_url}
              alt={photo!.alt_text ?? ""}
              focal={focal!}
              zoom={zoom!}
              fit="fill"
              imgDataQa="cinematic-about-img"
              loading="lazy"
            />
          </div>
        )}

        <div
          className={`mt-10 space-y-5${area("paras")}`}
          style={{ color: "rgba(240,233,218,0.72)", fontFamily: "var(--font-sans)", fontWeight: 300 }}
        >
          <p className="cine-about-line leading-relaxed">{t("about.p1")}</p>
          <p className="cine-about-line leading-relaxed">{t("about.p2")}</p>
        </div>

        <div className={`cine-about-line mt-10 flex flex-wrap gap-3${area("chips")}`}>
          {[
            t("about.strengths.presence"),
            t("about.strengths.discipline"),
            t("about.strengths.creative"),
            t("about.strengths.brand"),
          ].map((s) => (
            <span
              key={s}
              className="border px-4 py-2 text-sm"
              style={{ borderColor: "rgba(201,165,92,0.4)", color: "rgba(240,233,218,0.85)" }}
            >
              {s}
            </span>
          ))}
        </div>

        <div className={`cine-about-line mt-12${area("cta")}`}>
          <Link
            to="/work"
            className="inline-flex items-center gap-2 border px-7 py-3 text-xs uppercase tracking-[0.2em] transition-transform duration-300 hover:-translate-y-0.5"
            style={{ borderColor: "#C9A55C", color: "#f4ecdb" }}
          >
            {t("about.viewWork")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CinematicAbout;
