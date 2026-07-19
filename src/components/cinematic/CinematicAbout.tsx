import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Props = { reduced: boolean };

/**
 * TA.4 about — an editorial pull-quote (the existing about.p3 belief statement,
 * reused verbatim) with the supporting about paragraphs revealed line by line
 * on scroll. Reduced motion renders everything static.
 */
const CinematicAbout = ({ reduced }: Props) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

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
    }, sectionRef);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      data-qa="cinematic-section"
      className="relative px-6 py-24 md:py-32"
    >
      <div className="mx-auto max-w-4xl">
        <p className="cine-about-line text-caps mb-8" style={{ color: "#C9A55C" }}>
          {t("about.eyebrow")}
        </p>

        <blockquote
          data-qa="section-heading"
          className="cine-about-line"
          style={{
            fontFamily: "var(--font-display)",
            color: "#f4ecdb",
            fontSize: "clamp(1.75rem, 4vw, 3.25rem)",
            lineHeight: 1.22,
          }}
        >
          {t("about.p3")}
        </blockquote>

        <div
          className="mt-10 space-y-5"
          style={{ color: "rgba(240,233,218,0.72)", fontFamily: "var(--font-sans)", fontWeight: 300 }}
        >
          <p className="cine-about-line leading-relaxed">{t("about.p1")}</p>
          <p className="cine-about-line leading-relaxed">{t("about.p2")}</p>
        </div>

        <div className="cine-about-line mt-10 flex flex-wrap gap-3">
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

        <div className="cine-about-line mt-12">
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
