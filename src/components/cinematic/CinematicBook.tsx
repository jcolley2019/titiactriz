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
 *
 * PUBLISHER LAW (strict): this act is a coming-soon teaser ONLY. It names no
 * title, no date, no cover, and no way to buy — none of that is settled, and
 * PRODUCT.md's owner-truth rule means the copy cannot run ahead of what
 * Cristyna has confirmed. Every string here is the /book page's own bilingual
 * coming-soon copy, reused via the SAME locale keys (`book.*`, plus the nav's
 * name for the page on the CTA) — a census, not new claims. The act gains
 * detail the day /book does, from the same keys.
 *
 * Showcase-class, so it speaks the acts' field language: one uninterrupted
 * CHAPTER_GROUND room (the warmest of the family — candle-light for a book,
 * and a re-opening of the reel's tonal sequence before Green World's bright
 * water), the gold eyebrow, the display face, and the site's outlined button.
 *
 * The entrance is a MODEST scrub timeline in the showcases' own grammar —
 * choreography scrubbed over the act's arrival (the reel spreads' y/opacity
 * settle, power3.out), with NO long pin: the act costs the reader only its own
 * height of scroll. Reduced motion renders the whole act static and settled.
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
    }, sectionRef);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      data-qa="cinematic-book"
      className="relative flex min-h-[80svh] flex-col items-center justify-center px-6 py-24 text-center md:py-32"
      style={{ backgroundColor: CHAPTER_GROUND_1 }}
    >
      <p data-qa="book-act-eyebrow" className="cine-book-line text-caps" style={{ color: "#C9A55C" }}>
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
        className="cine-book-line mt-8 max-w-3xl"
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
        style={{ color: "rgba(240,233,218,0.72)", fontFamily: "var(--font-sans)", fontWeight: 300 }}
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
    </section>
  );
};

export default CinematicBook;
