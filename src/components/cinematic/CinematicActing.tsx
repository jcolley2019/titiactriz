import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  CHAPTER_FIELD_FRACTION,
  WideChapter,
  chapterBodyPx,
  lockupNumeralPx,
  lockupTitlePx,
  useFrameSize,
} from "./reelWide";
import { FIELD_GROUND, FIELD_LIGHT, SEAM_GOLD } from "./FramedVideo";
import { GOLD, IVORY, useReelIsPhone } from "./reelSpotlight";
import { useActingCredits, resolveActingChapter } from "./useActingCredits";
import type { ActingCredit, ActingChapterCopy } from "./useActingCredits";
import actingImage from "@/assets/cristyna-acting-headshot.webp";

gsap.registerPlugin(ScrollTrigger);

/**
 * PORT.ACT.2 — the Acting act. Candidate C (editorial split), picked 2026-08-01.
 *
 * The act has TWO compositions split at the reel's phone breakpoint, the same
 * shape CinematicReel uses (PhoneSlide / WideSlide) — because the wide split is
 * not a layout that can be squeezed. At 390 the 0.42 copy column is ~164px
 * before padding, which clipped the headline against WideChapter's own
 * overflow-hidden, wrapped the eyebrow under the photograph and left the credit
 * row's flex children fighting over ~70px. Joey caught all three on device
 * 2026-08-02. A phone gets its own shape, it does not get the desktop shrunk.
 *
 * WIDE (>= the phone breakpoint) — unchanged, and deliberately so: the
 * photograph IS the page, full-bleed to the frame edges, and the copy column is
 * `WideChapter` itself, so the gold seam at the junction, the corner filigree at
 * the column's outer top corner, the numeral·rule·label eyebrow, the Cinzel
 * headline and the body are the same code the three reel spreads run. The gold
 * frame language survives as an engraved panel around a numbered credits index.
 * A plate would have to be width-capped and would float in a tall portrait
 * tablet frame; a full-bleed page fills whatever frame it is given, which is why
 * candidate C won the bakeoff and why 1024x1366 holds.
 *
 * PHONE — the stack, following the About act's tablet treatment: the photograph
 * becomes a BAND across the top of the frame, the gold seam turns horizontal at
 * the junction, and the chapter and index stack beneath it at the full stack
 * width. The corner filigree is not drawn, exactly as the reel's phone act omits
 * it: it is a composition of the wide spread, not of the phone.
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

/* ───────────────────────────── credits index ───────────────────────────── */

/**
 * One row of the index.
 *
 * The action label RESERVES its width — `flex-none` plus `whitespace-nowrap` —
 * and the title takes what is left and WRAPS into it (`overflowWrap: anywhere`).
 * The first build gave the title `min-w-0 flex-1` and nothing else, so at a
 * narrow width its box shrank below its own text, the text overflowed the box
 * instead of wrapping, and the label painted straight through the middle of it:
 * "EL VER CASTING", which Joey caught at 390 on 2026-08-02. Overflow is not a
 * phone bug — a long enough title does it at any width — so the fix lives on
 * the row itself, not behind a breakpoint.
 */
const IndexRow = ({
  credit,
  position,
  title,
  viewLabel,
  soonLabel,
}: {
  credit: ActingCredit;
  position: number;
  title: string;
  viewLabel: string;
  soonLabel: string;
}) => {
  const live = Boolean(credit.url);
  const numeral = String(position + 1).padStart(2, "0");
  const rowStyle = {
    borderTop: "1px solid rgba(201,165,92,0.20)",
    opacity: live ? 1 : 0.45,
  } as const;

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
        data-qa="acting-title"
        className="min-w-0 flex-1 uppercase"
        style={{
          fontFamily: "var(--font-display)",
          color: IVORY,
          fontSize: 16,
          letterSpacing: "0.05em",
          lineHeight: 1.25,
          overflowWrap: "anywhere",
        }}
      >
        {title}
      </span>
      <span
        data-qa="acting-state"
        className="flex-none whitespace-nowrap uppercase"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 10,
          letterSpacing: "0.18em",
          color: live ? GOLD : "rgba(240,233,218,0.4)",
        }}
      >
        {live ? viewLabel : soonLabel}
      </span>
    </>
  );

  // A row links only when there is somewhere to go. The inert row is a <div>:
  // no href, no hover, no pointer.
  return live ? (
    <a
      data-qa="acting-credit"
      data-live="true"
      href={credit.url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-baseline gap-3 py-3.5 transition-opacity hover:opacity-80"
      style={rowStyle}
    >
      {inner}
    </a>
  ) : (
    <div
      data-qa="acting-credit"
      data-live="false"
      className="flex items-baseline gap-3 py-3.5"
      style={rowStyle}
    >
      {inner}
    </div>
  );
};

/** The engraved panel — the gold frame language, surviving without a plate. */
const CreditsPanel = ({
  credits,
  titleOf,
  labels,
  panelRef,
}: {
  credits: ActingCredit[];
  titleOf: (c: ActingCredit) => string;
  labels: { credits: string; view: string; soon: string; empty: string };
  panelRef?: React.Ref<HTMLDivElement>;
}) => (
  <div
    ref={panelRef}
    data-qa="acting-index"
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
      {labels.credits}
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
        {labels.empty}
      </p>
    ) : (
      credits.map((c, i) => (
        <IndexRow
          key={c.id}
          credit={c}
          position={i}
          title={titleOf(c)}
          viewLabel={labels.view}
          soonLabel={labels.soon}
        />
      ))
    )}
  </div>
);

/* ─────────────────────────── the two compositions ─────────────────────────── */

type CompositionProps = {
  copy: ActingChapterCopy;
  frameW: number;
  frameH: number;
  credits: ActingCredit[];
  titleOf: (c: ActingCredit) => string;
  labels: { credits: string; view: string; soon: string; empty: string };
  photoAlt: string;
  pageRef: React.Ref<HTMLDivElement>;
  indexRef: React.Ref<HTMLDivElement>;
  labelRef: (el: HTMLDivElement | null) => void;
  titleRef: (el: HTMLElement | null) => void;
  ornRef: (el: HTMLImageElement | null) => void;
};

/** WIDE — the editorial split. Unchanged: desktop and tablet were ratified. */
const WideActing = (p: CompositionProps) => {
  const colW = p.frameW * CHAPTER_FIELD_FRACTION;
  return (
    <>
      {/* The photograph as the PAGE: no plate, no frame, full-bleed. */}
      <div
        ref={p.pageRef}
        data-qa="acting-page"
        className="absolute inset-y-0 right-0 overflow-hidden"
        style={{ left: colW }}
      >
        <img
          src={actingImage}
          alt={p.photoAlt}
          className="h-full w-full object-cover"
          style={{ objectPosition: "50% 38%" }}
          decoding="async"
        />
      </div>

      <WideChapter
        index={0}
        copy={p.copy}
        frameW={p.frameW}
        side="left"
        labelRef={p.labelRef}
        titleRef={p.titleRef}
        ornRef={p.ornRef}
        after={
          <div className="mt-7">
            <CreditsPanel
              credits={p.credits}
              titleOf={p.titleOf}
              labels={p.labels}
              panelRef={p.indexRef}
            />
          </div>
        }
      />
    </>
  );
};

/**
 * PHONE — the stack. Photograph as a band across the top, horizontal gold seam
 * at the junction, chapter and index beneath at the full stack width.
 *
 * The band is the smaller of 42% of the frame and a 1.15:1 slice of its width,
 * so a short phone loses band height rather than pushing the index below the
 * fold, and a tall one never lets the photograph eat the stack. No filigree:
 * it belongs to the wide spread's outer corner, and the reel's phone act omits
 * it for the same reason.
 */
const PhoneActing = (p: CompositionProps) => {
  const bandH = Math.min(p.frameH * 0.42, p.frameW / 1.15);
  const padX = 24;
  return (
    <div className="flex h-full flex-col">
      <div
        ref={p.pageRef}
        data-qa="acting-page"
        className="relative w-full flex-none overflow-hidden"
        style={{ height: bandH }}
      >
        <img
          src={actingImage}
          alt={p.photoAlt}
          className="h-full w-full object-cover"
          style={{ objectPosition: "50% 32%" }}
          decoding="async"
        />
        {/* The seam, horizontal here — the same hairline, turned with the stack. */}
        <div
          aria-hidden
          data-qa="wide-chapter-seam"
          className="absolute inset-x-0 bottom-0"
          style={{ height: 1, backgroundColor: SEAM_GOLD }}
        />
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col justify-center"
        style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 26, paddingBottom: 26 }}
      >
        <div ref={p.labelRef as React.Ref<HTMLDivElement>} data-qa="chapter-eyebrow" className="flex items-center gap-3">
          <span
            aria-hidden
            data-qa="wide-numeral"
            className="block flex-none leading-none"
            style={{
              fontFamily: "var(--font-display)",
              color: GOLD,
              fontSize: lockupNumeralPx(p.frameW),
              letterSpacing: "0.12em",
            }}
          >
            01
          </span>
          <span
            aria-hidden
            data-qa="chapter-eyebrow-rule"
            className="block h-px flex-none"
            style={{ width: Math.round(lockupNumeralPx(p.frameW) * 1.2), backgroundColor: GOLD }}
          />
          <span
            data-qa="chapter-eyebrow-label"
            className="block uppercase"
            style={{
              fontFamily: "var(--font-sans)",
              color: GOLD,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.2em",
            }}
          >
            {p.copy.eyebrow}
          </span>
        </div>

        <div ref={p.titleRef as React.Ref<HTMLDivElement>}>
          <h3
            data-qa="section-heading"
            className="uppercase"
            style={{
              fontFamily: "var(--font-display)",
              color: IVORY,
              fontSize: lockupTitlePx(p.frameW),
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "0.06em",
              marginTop: 14,
            }}
          >
            {p.copy.title}
          </h3>
          <p
            data-qa="chapter-body"
            style={{
              fontFamily: "var(--font-sans)",
              color: "rgba(240,233,218,0.85)",
              fontSize: chapterBodyPx(p.frameW),
              fontWeight: 300,
              lineHeight: 1.65,
              letterSpacing: "0.01em",
              marginTop: 12,
            }}
          >
            {p.copy.body}
          </p>
        </div>

        <div className="mt-6">
          <CreditsPanel
            credits={p.credits}
            titleOf={p.titleOf}
            labels={p.labels}
            panelRef={p.indexRef}
          />
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────── the act ─────────────────────────────── */

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

  const phone = useReelIsPhone();
  const { w: frameW, h: frameH } = useFrameSize(stageRef);
  const measured = frameW > 0 && frameH > 0;

  const { credits, chapterRaw } = useActingCredits();
  const locale = i18n.language?.toLowerCase().startsWith("en") ? "en" : "es";

  // In-repo defaults; `site_settings('acting.chapter')` may override per locale.
  const copy = resolveActingChapter(chapterRaw, locale, {
    eyebrow: t("cinematic.acting.eyebrow"),
    title: t("cinematic.acting.title"),
    body: t("cinematic.acting.body"),
  });

  // Built once the stage has been MEASURED, because nothing inside the
  // composition is in the DOM until then — both compositions live behind the
  // `measured` gate, so an effect that ran on mount would hand gsap.from() a
  // fistful of nulls and animate nothing.
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
      if (pageRef.current) {
        tl.from(pageRef.current, { opacity: 0, scale: 1.04, duration: 0.9, ease: "power2.out" }, 0);
      }
      if (labelRef.current) {
        tl.from(labelRef.current, { opacity: 0, y: 14, duration: 0.5, ease: "power3.out" }, 0.15);
      }
      if (titleRef.current) {
        tl.from(titleRef.current, { opacity: 0, y: 18, duration: 0.6, ease: "power3.out" }, 0.28);
      }
      // The filigree blooms in last, as it does on the reel spreads. The phone
      // stack never renders one, so this simply does not run there.
      if (ornRef.current) {
        tl.from(ornRef.current, { opacity: 0, duration: 0.7, ease: "power2.out" }, 0.5);
      }
      if (indexRef.current) {
        tl.from(indexRef.current, { opacity: 0, y: 12, duration: 0.5, ease: "power3.out" }, 0.5);
      }

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
    // `phone` is a dependency because the two compositions mount different
    // elements: the refs the timeline animates are not the same objects across
    // a breakpoint crossing.
  }, [reduced, measured, phone]);

  const titleOf = (c: ActingCredit) => (locale === "en" ? c.title_en : c.title_es);
  const labels = {
    credits: t("cinematic.acting.creditsLabel"),
    view: t("cinematic.acting.view"),
    soon: t("cinematic.acting.soon"),
    empty: t("cinematic.acting.empty"),
  };

  const Composition = phone ? PhoneActing : WideActing;

  return (
    <section ref={sectionRef} data-qa="cinematic-acting" className="relative w-full">
      <div
        ref={stageRef}
        data-qa="acting-stage"
        data-shape={phone ? "phone" : "wide"}
        className="cine-vh-full relative w-full overflow-hidden"
        // The tonal room, edge to edge on both sides of the seam — the same
        // ground and luminance gradient the reel spreads paint.
        style={{ backgroundColor: FIELD_GROUND, backgroundImage: FIELD_LIGHT }}
      >
        {measured && (
          <Composition
            copy={copy}
            frameW={frameW}
            frameH={frameH}
            credits={credits}
            titleOf={titleOf}
            labels={labels}
            photoAlt={t("cinematic.acting.photoAlt")}
            pageRef={pageRef}
            indexRef={indexRef}
            labelRef={(el) => (labelRef.current = el)}
            titleRef={(el) => (titleRef.current = el)}
            ornRef={(el) => (ornRef.current = el)}
          />
        )}
      </div>
    </section>
  );
};

export default CinematicActing;
