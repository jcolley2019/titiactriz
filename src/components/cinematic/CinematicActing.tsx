import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CHAPTER_FIELD_FRACTION, WideChapter, useFrameSize } from "./reelWide";
import { FIELD_GROUND, FIELD_LIGHT, SEAM_GOLD } from "./FramedVideo";
import { GOLD, IVORY } from "./reelSpotlight";
import { useActingCredits, resolveActingChapter } from "./useActingCredits";
import type { ActingCredit } from "./useActingCredits";
import actingImage from "@/assets/cristyna-acting-headshot.webp";

gsap.registerPlugin(ScrollTrigger);

/**
 * PORT.ACT.2 — the Acting act. Candidate C (editorial split), picked 2026-08-01.
 *
 * The photograph IS the page: full-bleed to the frame edges, occupying the room
 * beside the copy column rather than sitting in a plate. That is the one place
 * this act departs from the reel spread, and it is deliberate — a plate has to
 * be width-capped, so at 1024x1366 it floats in a tall room with dead space
 * above and below (the defect that sank candidates A and B in the bakeoff). A
 * full-bleed page fills any frame it is given.
 *
 * Everything else is the reel's grammar, reused rather than re-drawn: the copy
 * column is `WideChapter` itself, so the gold hairline seam at the junction, the
 * corner filigree at the column's outer top corner, the chapter eyebrow
 * (numeral · rule · label), the Cinzel headline and the body all come from the
 * same code the three reel spreads use. The gold FRAME language survives as an
 * engraved panel around the credits index, which is what makes the act read as
 * a magazine contents page facing a portrait.
 *
 * Numbering: the gold numerals come from POSITION in the ordered, enabled list —
 * not from the stored `order_index`. Disabling a row must not punch a hole in
 * the sequence (01, 02, 04).
 *
 * Content law: a credit with a `url` is a real link and says "Ver"; a credit
 * without one is inert and says "Próximamente". Nothing here is ever drawn as a
 * link that goes nowhere — that is the whole lesson of STRIP.FAKE.1.
 *
 * Under reduced motion the act renders complete and static: every entrance uses
 * gsap.from(), so if the timeline never runs, nothing was ever hidden.
 */

type Props = { reduced: boolean };

const CinematicActing = ({ reduced }: Props) => {
  const { t, i18n } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLElement | null>(null);
  const ornRef = useRef<HTMLImageElement | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLDivElement>(null);

  const { w: frameW, h: frameH } = useFrameSize(stageRef);
  const measured = frameW > 0 && frameH > 0;
  const colW = frameW * CHAPTER_FIELD_FRACTION;

  const { credits, chapterRaw } = useActingCredits();
  const locale = i18n.language?.toLowerCase().startsWith("en") ? "en" : "es";

  // In-repo defaults; `site_settings('acting.chapter')` may override per locale.
  const copy = resolveActingChapter(chapterRaw, locale, {
    eyebrow: t("cinematic.acting.eyebrow"),
    title: t("cinematic.acting.title"),
    body: t("cinematic.acting.body"),
  });

  // Built once the stage has been MEASURED, because nothing inside the
  // composition is in the DOM until then — `WideChapter` and the index panel
  // both live behind the `measured` gate, so an effect that ran on mount would
  // hand gsap.from() a fistful of nulls and animate nothing.
  //
  // `credits` is deliberately NOT a dependency. Rebuilding on data arrival was
  // the first version and it was wrong twice over: gsap.from() re-applied its
  // opacity-0 start state to elements whose trigger had already been scrolled
  // past, so the chapter and index rendered blank; and rebuilding a PINNED
  // trigger mid-page stales every act below it by the pin's own distance unless
  // the whole list is re-sorted. The rows are covered by animating the panel
  // they sit in, which exists at measure time whether there are credits or not.
  useLayoutEffect(() => {
    if (reduced || !measured) return;
    const stage = stageRef.current;
    if (!stage) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: "top 72%" },
      });
      tl.from(pageRef.current, { opacity: 0, scale: 1.04, duration: 0.9, ease: "power2.out" }, 0);
      tl.from(labelRef.current, { opacity: 0, y: 14, duration: 0.5, ease: "power3.out" }, 0.15);
      tl.from(titleRef.current, { opacity: 0, y: 18, duration: 0.6, ease: "power3.out" }, 0.28);
      // The filigree blooms in last, as it does on the reel spreads.
      tl.from(ornRef.current, { opacity: 0, duration: 0.7, ease: "power2.out" }, 0.5);
      tl.from(indexRef.current, { opacity: 0, y: 12, duration: 0.5, ease: "power3.out" }, 0.5);

      // A short dwell so the index can be read before the page moves on.
      ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: "+=80%",
        pin: true,
        anticipatePin: 1,
      });
    }, sectionRef);

    // A new pinned trigger inserted above existing ones leaves their start/end
    // positions computed against a page that just got taller. Sort then refresh,
    // in that order, or the acts below this one drift by the pin distance.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();

    return () => ctx.revert();
  }, [reduced, measured]);

  const rowLabel = (c: ActingCredit) => (locale === "en" ? c.title_en : c.title_es);

  return (
    <section ref={sectionRef} data-qa="cinematic-acting" className="relative w-full">
      <div
        ref={stageRef}
        className="cine-vh-full relative w-full overflow-hidden"
        // The tonal room, edge to edge on both sides of the seam — the same
        // ground and luminance gradient the reel spreads paint.
        style={{ backgroundColor: FIELD_GROUND, backgroundImage: FIELD_LIGHT }}
      >
        {measured && (
          <>
            {/* The photograph as the PAGE: no plate, no frame, full-bleed. */}
            <div
              ref={pageRef}
              data-qa="acting-page"
              className="absolute inset-y-0 right-0 overflow-hidden"
              style={{ left: colW }}
            >
              <img
                src={actingImage}
                alt={t("cinematic.acting.photoAlt")}
                className="h-full w-full object-cover"
                style={{ objectPosition: "50% 38%" }}
                decoding="async"
              />
            </div>

            <WideChapter
              index={0}
              copy={copy}
              frameW={frameW}
              side="left"
              labelRef={(el) => (labelRef.current = el)}
              titleRef={(el) => (titleRef.current = el)}
              ornRef={(el) => (ornRef.current = el)}
              after={
                <div
                  ref={indexRef}
                  data-qa="acting-index"
                  className="mt-7"
                  style={{ border: `1px solid ${SEAM_GOLD}`, padding: "4px 18px 14px" }}
                >
                  <span
                    className="mb-1 mt-3.5 block uppercase"
                    style={{
                      fontFamily: "var(--font-sans)",
                      color: GOLD,
                      fontSize: 10,
                      letterSpacing: "0.25em",
                    }}
                  >
                    {t("cinematic.acting.creditsLabel")}
                  </span>

                  {credits.length === 0 ? (
                    <p
                      data-qa="acting-index-empty"
                      className="py-3"
                      style={{
                        fontFamily: "var(--font-sans)",
                        color: "rgba(240,233,218,0.45)",
                        fontSize: 12,
                        fontWeight: 300,
                      }}
                    >
                      {t("cinematic.acting.empty")}
                    </p>
                  ) : (
                    credits.map((c, i) => {
                      const live = Boolean(c.url);
                      const numeral = String(i + 1).padStart(2, "0");
                      const inner = (
                        <>
                          <span
                            aria-hidden
                            data-qa="acting-numeral"
                            className="block flex-none leading-none"
                            style={{
                              fontFamily: "var(--font-display)",
                              color: GOLD,
                              fontSize: 20,
                              letterSpacing: "0.12em",
                            }}
                          >
                            {numeral}
                          </span>
                          <span
                            className="min-w-0 flex-1 uppercase"
                            style={{
                              fontFamily: "var(--font-display)",
                              color: IVORY,
                              fontSize: 16,
                              letterSpacing: "0.05em",
                              lineHeight: 1.25,
                            }}
                          >
                            {rowLabel(c)}
                          </span>
                          <span
                            data-qa="acting-state"
                            className="flex-none uppercase"
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: 10,
                              letterSpacing: "0.18em",
                              color: live ? GOLD : "rgba(240,233,218,0.4)",
                            }}
                          >
                            {live ? t("cinematic.acting.view") : t("cinematic.acting.soon")}
                          </span>
                        </>
                      );

                      const rowStyle = {
                        borderTop: "1px solid rgba(201,165,92,0.20)",
                        opacity: live ? 1 : 0.45,
                      } as const;

                      // A row links only when there is somewhere to go. The
                      // inert row is a <div>: no href, no hover, no pointer.
                      return live ? (
                        <a
                          key={c.id}
                          data-qa="acting-credit"
                          data-live="true"
                          href={c.url ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-baseline gap-4 py-3.5 transition-opacity hover:opacity-80"
                          style={rowStyle}
                        >
                          {inner}
                        </a>
                      ) : (
                        <div
                          key={c.id}
                          data-qa="acting-credit"
                          data-live="false"
                          className="flex items-baseline gap-4 py-3.5"
                          style={rowStyle}
                        >
                          {inner}
                        </div>
                      );
                    })
                  )}
                </div>
              }
            />
          </>
        )}
      </div>
    </section>
  );
};

export default CinematicActing;
