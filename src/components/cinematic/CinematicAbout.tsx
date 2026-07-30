import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FramedImage from "./FramedImage";
import { useReelIsPhone } from "./reelSpotlight";
import { plateLaw } from "./reelWide";
import type { CinematicPhoto } from "./useCinematicData";
import { plateAspectOf, type ClassFraming } from "@/hooks/useCinematicMedia";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  reduced: boolean;
  /**
   * ABOUT.MEDIA.1 — the resolved About portrait panel (from resolved.about).
   * All three arrive together or all are absent: with no photo the panel isn't
   * rendered and the section is byte-identical to its text-only original.
   *
   * ADMIN.RESET.1b — the framing arrives as BOTH device-class records; this
   * component picks one, at the same 768px line the reel act forks on.
   */
  photo?: CinematicPhoto;
  phone?: ClassFraming;
  wide?: ClassFraming;
};

/**
 * TA.4 about — an editorial pull-quote (the existing about.p3 belief statement,
 * reused verbatim) with the supporting about paragraphs revealed line by line
 * on scroll. Reduced motion renders everything static.
 *
 * ABOUT.MEDIA.1 — when an About photo is configured, the copy becomes the left
 * column of a two-column editorial split with the photo panel on the right (md+);
 * on mobile the panel stacks between the blockquote and the paragraphs. With no
 * photo, none of that attaches (see `hasPanel`).
 *
 * ADMIN.RESET.1b — the panel's CROP is class-split like a reel slide: below 768px
 * it paints the `phone` record, at or above it the `wide` one.
 *
 * ADMIN.ABOUT.2 — AND SO IS ITS SHAPE. The panel is a REEL-CLASS PLATE: its box is
 * the plate law's (`plateLaw`, the one the wide reel act sizes its plate with), so
 * the phone class paints the portrait plate — a phone record stores no shape, and
 * cannot — while the wide class paints whichever shape its record chose, the
 * portrait plate or the 3:2 landscape one. The ABOUT.MEDIA.1 fixed 3:4 frame is
 * SUPERSEDED; nothing else about the act moves (same grid, same dwell, same reveal).
 * The layout adapts to the shape rather than the shape to the layout: the md+ rail
 * widens for a landscape panel (see `.cine-about-grid[data-plate]`), because a 3:2
 * page squeezed into a portrait rail would read as a strip, not as a photograph.
 */
const CinematicAbout = ({ reduced, photo, phone, wide }: Props) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  // The SAME hook and the SAME 768px line the reel act forks on — read
  // synchronously on first render, so the panel never paints one class's crop
  // and then swaps to the other under the visitor.
  const isPhone = useReelIsPhone();
  const framing = isPhone ? phone : wide;

  // Opt-in: only a fully-resolved panel switches the container to the grid and
  // tags each block with its grid area. Without it, every class below is exactly
  // today's and no panel node renders — a byte-identical text-only section.
  const hasPanel = !!photo && !!framing;
  const area = (name: string) => (hasPanel ? ` cine-a-${name}` : "");

  // ADMIN.ABOUT.2 — the panel's plate. ONE read (`plateAspectOf`), so this surface
  // never spells `?? "portrait"` for itself: on the phone class the field is parsed
  // away by the resolver and this is portrait by law, not by a branch here.
  const plate = plateAspectOf(framing);
  const plateAspect = plateLaw(plate).aspect;

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
      <div
        className={hasPanel ? "mx-auto max-w-5xl cine-about-grid" : "mx-auto max-w-4xl"}
        // The rail's width is a function of the panel's shape (md+ only, where the
        // rail exists). Declared on the grid so the CSS owns the two widths.
        data-plate={hasPanel ? plate : undefined}
      >
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
          <div
            data-qa="cinematic-about-panel"
            data-plate={plate}
            className="cine-about-line cine-about-panel mt-10 md:mt-0"
            // The plate law's shape, inline: the box the framing is resolved
            // against must be the law's answer, never a CSS restatement of it.
            style={{ aspectRatio: plateAspect }}
          >
            <FramedImage
              src={photo!.image_url}
              alt={photo!.alt_text ?? ""}
              focal={framing!.focal}
              zoom={framing!.zoom}
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
