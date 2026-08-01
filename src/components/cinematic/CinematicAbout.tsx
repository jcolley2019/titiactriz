import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FramedImage from "./FramedImage";
import { useReelIsPhone } from "./reelSpotlight";
import { CHAPTER_FIELD_FRACTION, plateLaw } from "./reelWide";
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
 * The layout adapts to the shape rather than the shape to the layout.
 *
 * ADMIN.ABOUT.3 — AND IT IS SIZED BY THE PLATE LAW TOO, not merely shaped by it.
 * ABOUT.2 gave the panel the law's ASPECT but left ABOUT.MEDIA.1's rail clamp
 * (`clamp(300px, 32vw, 400px)`) holding its WIDTH, so an About plate stopped
 * growing at 400px while a reel plate at the same viewport kept going — visibly
 * two different sizes on one page. The clamp is gone. Both of `plateBox`'s rules
 * now reach the stylesheet as the widths they imply (below), so the About plate
 * and the reel plate resolve to the SAME BOX at the same viewport, both shapes.
 * The section's layout is what gives: the copy column narrows to its floor first,
 * and only then does the container grow (see `.cine-about-grid`). The act's
 * grammar — same named grid, same line-by-line reveal, same +=120% dwell — is
 * untouched.
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
  const { aspect: plateAspect, heightVh, maxWidthVw } = plateLaw(plate);

  /**
   * ADMIN.ABOUT.3 — `plateBox`'s two rules, handed to the stylesheet as the plate
   * WIDTH each one implies. CSS `min()` of the pair is the law's "smaller box wins"
   * comparison, evaluated live against the viewport — which is what lets a rail be
   * the plate rather than an approximation of one, with no measurement pass and no
   * resize listener.
   *
   * The frame is the reel's frame, deliberately: `svh` is the height its pinned
   * stage is declared at (`.cine-h-full`) and the width cap is taken against the
   * act's PHOTO PAGE — the frame minus the copy column — which is the same
   * `CHAPTER_FIELD_FRACTION` split the wide reel feeds `plateBox`. Feed the law a
   * different frame and the two plates stop matching, which is the whole defect
   * this brick closes.
   */
  const wFromHeight = `${(heightVh * plateAspect).toFixed(4)}svh`;
  const wCap = `${(maxWidthVw * (1 - CHAPTER_FIELD_FRACTION)).toFixed(4)}vw`;
  /**
   * ABOUT.CENTER.1 — the plate's HEIGHT under the same two rules ("smaller box
   * wins", restated as the height each rule implies). The stylesheet uses it to
   * centre the plate against the DWELL PAGE: the section pins top-top for its
   * +=120% dwell (REVIEW.2b), and the About copy block is taller than a typical
   * desktop viewport, so a plate centred against the GRID rides low on the
   * pinned screen and loses its foot below the fold. Joey's ruling 7/31:
   * "center the photo on the page vertically."
   */
  const plateH = `min(${heightVh}svh, ${((maxWidthVw * (1 - CHAPTER_FIELD_FRACTION)) / plateAspect).toFixed(4)}vw)`;

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
      // ABOUT.VCENTER.1 — `cine-about-section` carries the ≥1200px dwell-stage
      // centering (see cinematic.css): the act fills the dwell page and the
      // whole grid centres on it, per Joey's 7/31 ruling "in desktop the about
      // information needs to be centered".
      className="cine-about-section relative px-6 py-24 md:py-32"
    >
      <div
        // ADMIN.ABOUT.3 — the panelled container's width is the stylesheet's now
        // (`.cine-about-grid` restates the 64rem it had here and grows past it only
        // when the plate demands it). The text-only container is untouched.
        className={hasPanel ? "cine-about-grid" : "mx-auto max-w-4xl"}
        // ADMIN.ABOUT.3 — the grid's own `data-plate` is gone with the CSS rule that
        // selected on it (`.cine-about-grid[data-plate="landscape"]`, the landscape
        // rail clamp). The rail is a function of the two custom properties below
        // now, and the SHAPE is still declared where every surface reads it: on the
        // panel itself.
        style={
          hasPanel
            ? ({
                "--cine-plate-w-from-height": wFromHeight,
                "--cine-plate-w-cap": wCap,
                "--cine-plate-h": plateH,
              } as CSSProperties)
            : undefined
        }
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
            // ABOUT.VCENTER.1 — the svh term lets the quote compress on short
            // desktop viewports (laptops), where the un-scaled stack ran ~1.5×
            // the viewport and made the centred dwell impossible. At Joey's
            // 994px-tall window and above it resolves within a pixel of the
            // old 4vw/3.25rem value, so tall desktops are untouched.
            fontSize: "clamp(1.75rem, min(4vw, 5.2svh), 3.25rem)",
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
