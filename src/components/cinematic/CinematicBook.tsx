import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CHAPTER_GROUND_1 } from "./FramedVideo";

gsap.registerPlugin(ScrollTrigger);

/**
 * BOOK.ACT.1 — the book teaser, between the gallery and Green World.
 * BOOK.ACT.2 — it now holds, fills its stage, and seals its seam.
 *
 * ## UNMOUNTED (EVENTS.1, 2026-08-04)
 *
 * Owner ruling: this act is REPLACED in the cinematic home flow by the Events
 * act — see CinematicEvents and the flag note in ventures.ts. Book was a teaser
 * for something with no date; Events is a window on what Cristyna is actually
 * doing. (EVENTS.1 gave Events this exact slot; EVENTS.2 then moved it below
 * the hero, so this old slot is now simply empty — the gallery hands straight
 * to Green World.)
 *
 * The ruling was UNMOUNT, not delete. This component, its styles and its locale
 * keys all stay exactly as they were, and re-mounting it in HomeCinematic is the
 * whole revive. Its own gates (bookact2.spec.ts, review3-bookact.spec.ts) are
 * skipped rather than deleted, and point back here.
 *
 * PUBLISHER LAW STATUS — UNCHANGED and still binding. Nothing about this swap
 * relaxes it: the act remains a coming-soon teaser only, naming no title, date,
 * cover, or way to buy, and carrying no email capture, until written publisher
 * clearance exists. If it is ever re-mounted it re-enters under that law, with
 * the same /book locale keys and no new claims. The /book page is untouched.
 *
 * PUBLISHER LAW (strict): this act is a coming-soon teaser ONLY. It names no
 * title, no date, no cover, and no way to buy — none of that is settled, and
 * PRODUCT.md's owner-truth rule means the copy cannot run ahead of what
 * Cristyna has confirmed. Every string here is the /book page's own bilingual
 * coming-soon copy, reused via the SAME locale keys (`book.*`, plus the nav's
 * name for the page on the CTA) — a census, not new claims. The act gains
 * detail the day /book does, from the same keys.
 *
 * It speaks the acts' field language: one uninterrupted CHAPTER_GROUND room
 * (the warmest of the family — candle-light for a book, and a re-opening of the
 * reel's tonal sequence before Green World's bright water), the gold eyebrow,
 * the display face, and the site's outlined button.
 *
 * ## The stage (BOOK.ACT.2)
 *
 * The act is a FULL-VIEWPORT stage — `.cine-act-vh`, the acts' own height
 * grammar (`100vh` → `100dvh`, `100svh` at md+) — with its content column
 * vertically centred inside the site's act padding (`1.5rem` horizontal,
 * `6rem` top, `4rem` bottom; top-weighted to clear the fixed header). It was
 * `min-h-[80svh]`, which is where the SEAM DEFECT came from: an act one fifth
 * short of the frame left a strip of Green World's bright water showing beneath
 * it at the act's settled position. An act owns its full ground — the height is
 * the fix, and `min-height` (never `height`) so long copy grows the stage
 * rather than being clipped by it.
 *
 * ## The dwell (BOOK.ACT.2)
 *
 * The act joins the DWELL LAW as a story act: it pins (`start: "top top"`,
 * `end: "+=120%"`) and holds the frame for 120% of a viewport before releasing,
 * the same beat of stillness the gallery, About and Contact each earn. Before
 * this it cost the reader only its own height of scroll, and an announcement
 * that scrolls past unbidden reads as an aside.
 *
 * The entrance stays a MODEST scrub timeline (the reel spreads' y/opacity
 * settle, power3.out) over the act's arrival. It completes at `top 22%` —
 * before the pin engages at `top top` — so the hold always begins on an act
 * that has already settled. Reduced motion builds neither: the act renders
 * static, settled, and unpinned, and still fills its stage.
 */
const CinematicBook = ({ reduced }: { reduced: boolean }) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 78%",
          end: "top 22%",
          scrub: true,
        },
      });
      // The spreads' entrance grammar, scrubbed: each line settles up and in,
      // staggered down the stack, complete well before the act reads settled.
      gsap.utils.toArray<HTMLElement>(".cine-book-line").forEach((el, i) => {
        tl.fromTo(
          el,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.38, ease: "power3.out" },
          i * 0.12,
        );
      });

      // BOOK.ACT.2 — the DWELL. The About standard, unchanged: the act holds
      // the frame for +=120% before it releases. Pinning fixes the section's
      // place on the page and nothing else, so the CTA stays clickable through
      // the whole hold.
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
      data-qa="cinematic-book"
      className="cine-act-vh relative flex w-full flex-col items-center justify-center px-6 pb-16 pt-24 text-center"
      style={{ backgroundColor: CHAPTER_GROUND_1 }}
    >
      {/* The content column, centred in the padded stage. The act is a full
          viewport; the column is only as tall as the announcement needs. */}
      <div data-qa="book-act-column" className="flex w-full max-w-3xl flex-col items-center">
        <p
          data-qa="book-act-eyebrow"
          className="cine-book-line text-caps"
          style={{ color: "#C9A55C" }}
        >
          {t("book.eyebrow")}
        </p>

        {/* The single gold hairline the system allows: a rule, not a fill —
            the same device the /book page itself uses. */}
        <span
          aria-hidden
          className="cine-book-line mt-6 block h-px w-16"
          style={{ backgroundColor: "#C9A55C" }}
        />

        <h2
          data-qa="section-heading"
          className="cine-book-line mt-8"
          style={{
            // DESIGN.md headline ramp, exactly — not the contact act's local
            // clamp, which predates the ramp and is on the detector's books.
            fontFamily: "var(--font-display)",
            color: "#f4ecdb",
            fontSize: "clamp(1.75rem, 4vw, 3.25rem)",
            lineHeight: 1.15,
          }}
        >
          {t("book.title")}
        </h2>

        <p
          data-qa="book-act-body"
          className="cine-book-line mt-8 max-w-md text-sm leading-relaxed md:text-base"
          style={{
            color: "rgba(240,233,218,0.72)",
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
          }}
        >
          {t("book.body")}
        </p>

        <div className="cine-book-line mt-12">
          <Link
            to="/book"
            data-qa="book-act-cta"
            className="inline-flex items-center gap-2 border px-7 py-3 text-xs uppercase tracking-[0.2em] transition-transform duration-300 hover:-translate-y-0.5"
            style={{ borderColor: "#C9A55C", color: "#f4ecdb" }}
          >
            {t("nav.book")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CinematicBook;
