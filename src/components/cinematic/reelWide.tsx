import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import cornerOrn from "@/assets/cp-corner-ornament-v2.png";
import { GOLD, IVORY, spotlightCentre } from "./reelSpotlight";
import { FIELD_GROUND, FIELD_LIGHT, SEAM_GOLD } from "./FramedVideo";
import type { ReelChapterCopy } from "./reelChapters";
import type { Focal } from "@/hooks/useCinematicMedia";

/**
 * CINE.FLOW.6 — the wide (>= 768px) reel act: an editorial STORY SPREAD.
 *
 * Each numbered slide is a two-page spread: the photo plate on one side, a
 * story chapter on the other — gold chapter-number eyebrow (01/02/03), a
 * headline, one short paragraph — with the sides alternating per slide. The
 * chapter column sits on the SAME warm near-black field treatment HERO.WIDE.1
 * ratified for the hero's side fields (its exact exported tokens: subtle
 * luminance gradient, restrained corner-ornament filigree, 1px gold hairline
 * seam at the junction with the plate), so the hero and the reel read as one
 * system. The centred caption band and the two symmetric 18%/82% hairlines of
 * W2 are superseded on the LIVE act; their constants remain exported below
 * because the admin SectionPreview still restates the frozen W2 mirror.
 *
 * The chapter FIELD is not a veil. It is an opaque ground beside the
 * photograph — no type ever crosses the plate, which stays unveiled exactly as
 * W2 settled it.
 *
 * CINE.FLOW.5 — the plate itself is unchanged from the promoted bake-off
 * variant W2 ("Center Plate & Rules") as it stood after CINE.FLOW.4B.
 *
 * This retires the letterboxed rendering entirely. The old wide act put the
 * whole photo in a letterbox on brand dark under a flat 0.5 → 0.8 wash — bare
 * ground inside the frame, and a wash squarely in DESIGN.md's banned 50–80%
 * range. W2 replaces both moves at once: the photograph is a bounded PLATE in
 * true portrait aspect, hung between two gold hairlines over an ambient
 * backdrop (a blurred, darkened copy of the slide's own photograph), with the
 * lockup as an engraved caption in the band beneath it.
 *
 * NO VEIL. The plate photograph renders unveiled inside its gold hairline
 * frame. The veil law is that veils exist only to protect type over
 * photography; here the lockup sits BELOW the plate and never crosses it, so a
 * veil would buy nothing and cost the plate its light. The AmbientBackdrop is
 * what carries the lockup's legibility.
 *
 * Geometry is computed in px from the frame's true measured CSS dimensions,
 * never in CSS vw/vh: the reel's frame is the pinned stage, and under reduced
 * motion it is a 70svh slide, so real viewport units would describe neither.
 *
 * The bake-off harness keeps its own frozen copy of these primitives
 * (src/components/qa/reel-bakeoff/wideShared.tsx). That duplication is
 * deliberate: the harness is a museum piece and live code does not import from
 * `qa/`. The laws below are the ones that ship.
 */

/** The plate's aspect (width / height) — the portrait sources' own. */
export const PLATE_ASPECT = 0.563;

/** Ambient backdrop filter — a LAW: this filter NEVER animates. */
export const AMBIENT_BLUR_PX = 64;
export const AMBIENT_FILTER = `blur(${AMBIENT_BLUR_PX}px) brightness(0.35) saturate(0.9)`;

/** Gold hairline for the plate outline. */
export const PLATE_OUTLINE = "1px solid rgba(201,165,92,0.55)";

/** W2's declared composition, as fractions of the frame. */
export const PLATE_HEIGHT_VH = 76;
export const PLATE_MAX_WIDTH_VW = 60;
/**
 * The plate's top edge. W2 declared 8, which the bake-off harness could afford
 * because its frame was a bare div. The live act is pinned UNDER the fixed
 * header, and at 900px-tall viewports 8vh resolves to 72px against a header
 * whose bottom edge is 76px — so the plate's top gold hairline was occluded by
 * 4px at 1440x900 and 1600x900, the two most common laptop frames. 10vh clears
 * the header at every supported width (the tightest is 90px at 900px tall, a
 * 14px margin) and costs the caption band 2vh it did not need: the band still
 * runs 14vh against a 3vh minimum padding.
 */
export const PLATE_TOP_VH = 10;
/**
 * The two vertical gold hairlines, at these fractions of the frame width, and
 * the caption band's breathing room. SUPERSEDED on the live act by the
 * CINE.FLOW.6 spread (the seam is the spread's one vertical gold line); still
 * exported because the admin SectionPreview restates the frozen W2 mirror.
 */
export const WIDE_RULE_X = [0.18, 0.82] as const;
export const WIDE_RULE_OPACITY = 0.35;
export const BAND_PAD_VH = 3;

/**
 * CINE.FLOW.6 — the spread's split: the chapter column takes this fraction of
 * the frame width, the plate hangs centred in the remainder. 0.42 keeps the
 * plate the wider page of the spread — the photograph still carries the act —
 * while giving the copy a true column rather than a margin note.
 */
export const CHAPTER_FIELD_FRACTION = 0.42;

const clampNum = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type PlateBox = { w: number; h: number };

/**
 * Plate sizing law: a portrait box at `PLATE_ASPECT`. The height rule and the
 * max-width cap are both declared as percentages of the frame; the plate takes
 * whichever yields the SMALLER box, so a short landscape frame is governed by
 * height and a narrow tall one by width.
 */
export function plateBox(
  frameW: number,
  frameH: number,
  heightVh: number = PLATE_HEIGHT_VH,
  maxWidthVw: number | undefined = PLATE_MAX_WIDTH_VW,
): PlateBox {
  const hRule = (frameH * heightVh) / 100;
  const wFromH = hRule * PLATE_ASPECT;
  if (maxWidthVw != null) {
    const wCap = (frameW * maxWidthVw) / 100;
    if (wCap < wFromH) return { w: wCap, h: wCap / PLATE_ASPECT };
  }
  return { w: wFromH, h: hRule };
}

/**
 * Focal source — the reel's ONE resolver (`spotlightCentre`, fallback 50/40),
 * returned as FRACTIONS of the plate box. The focal-as-container-percentage
 * mapping is exact in cover mode (see the derivation in reelSpotlight.ts), and
 * the plate paints its photo in cover mode, so this is the plate's true subject
 * position and not an approximation.
 */
export function focalFractions(focal?: Focal): { fx: number; fy: number } {
  const c = spotlightCentre(focal);
  return { fx: c.x / 100, fy: c.y / 100 };
}

/**
 * Lockup type sizes: `clamp(1.75rem, 3.2vw, 3rem)` for the title and
 * `clamp(1.375rem, 2.5vw, 2.375rem)` for the numeral, computed in px against
 * the FRAME width (a CSS clamp() would read the real viewport, not the frame).
 *
 * The TITLE is continuous across the 768px boundary: this floor (28px) is the
 * phone title clamp's ceiling, so a tablet a hair above the breakpoint sets the
 * same title as a phone a hair below it.
 *
 * The NUMERAL is not, and deliberately so. W1-W3 were built against the 4C
 * phone act, whose numeral was a 22px caption mark; the promoted V1 act sets it
 * at 66px, where it carries the lockup's mass rather than labelling it. The two
 * acts are different compositions and the numeral changes role between them —
 * see the reel lockup steps in DESIGN.md.
 */
export const lockupTitlePx = (frameW: number) => clampNum(28, frameW * 0.032, 48);
export const lockupNumeralPx = (frameW: number) => clampNum(22, frameW * 0.025, 38);

/** The rules flanking the wide numeral scale with it, symmetrically. */
export const lockupRulePx = (frameW: number) => Math.round(lockupNumeralPx(frameW) * 1.7);

const numeral = (i: number) => String(i + 1).padStart(2, "0");

/**
 * The full-frame ambient ground: the slide's own photograph, cover-fit,
 * blurred/darkened, scaled 1.1 so the blur never reveals its own edges.
 *
 * Each slide layer carries its own backdrop and the slide layers crossfade by
 * OPACITY ONLY — backdrop and plate fade together, the filter itself is static.
 * That is the whole of the backdrop transition law.
 */
export const AmbientBackdrop = ({ src, blur }: { src?: string; blur?: string }) => (
  <div aria-hidden className="absolute inset-0 overflow-hidden">
    {src ? (
      <img
        src={src}
        alt=""
        data-qa="wide-backdrop"
        loading="lazy"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // `blur` overrides only the radius, never the brightness/saturate
          // grade — the admin preview has no fixed size, so it restates 64px as
          // a fraction of its own box rather than blurring a thumbnail to mud.
          filter: blur ? `blur(${blur}) brightness(0.35) saturate(0.9)` : AMBIENT_FILTER,
          transform: "scale(1.1)",
        }}
      />
    ) : (
      <div className="h-full w-full" style={{ backgroundColor: "#141210" }} />
    )}
  </div>
);

/** Chapter body copy: quiet Jost, clamped in px against the measured frame. */
export const chapterBodyPx = (frameW: number) => clampNum(14, frameW * 0.0115, 17);

/**
 * CINE.FLOW.6 — the story chapter: the spread's copy page, on the hero's field
 * treatment. Gold chapter-number eyebrow (numeral · hairline · role label),
 * ivory headline at the wide title step, one short paragraph. The scrub
 * grammar's two entrance elements are the eyebrow row (labelRef) and the
 * headline+body block (titleRef) — same properties, marks and easing as the
 * phone act, so the pinned timeline stays composition-blind.
 *
 * The ornament is the site's ONE corner filigree, exactly as the hero fields
 * carry it: fine-line low-contrast gold, mirrored on a right-hand column so it
 * faces the plate.
 */
export const WideChapter = ({
  index,
  copy,
  frameW,
  side,
  labelRef,
  titleRef,
}: {
  index: number;
  copy: ReelChapterCopy;
  frameW: number;
  side: "left" | "right";
  labelRef?: (el: HTMLDivElement | null) => void;
  titleRef?: (el: HTMLElement | null) => void;
}) => {
  const colW = frameW * CHAPTER_FIELD_FRACTION;
  const padX = clampNum(28, frameW * 0.04, 96);
  return (
    <div
      data-qa="wide-chapter"
      data-side={side}
      className="absolute inset-y-0 overflow-hidden"
      style={{
        [side]: 0,
        width: colW,
        backgroundColor: FIELD_GROUND,
        backgroundImage: FIELD_LIGHT,
      }}
    >
      {/* The 1px gold hairline seam at the chapter/plate junction. */}
      <div
        aria-hidden
        data-qa="wide-chapter-seam"
        className="absolute inset-y-0"
        style={{
          [side === "left" ? "right" : "left"]: 0,
          width: 1,
          backgroundColor: SEAM_GOLD,
        }}
      />
      <div
        className="flex h-full flex-col justify-center"
        style={{ paddingLeft: padX, paddingRight: padX }}
      >
        <div style={{ maxWidth: Math.min(colW - 2 * padX, 420) }}>
          <img
            src={cornerOrn}
            alt=""
            aria-hidden
            className={`block h-auto select-none${side === "right" ? " -scale-x-100" : ""}`}
            style={{ width: "min(34%, 96px)", opacity: 0.18, marginBottom: 26 }}
            decoding="async"
          />
          <div ref={labelRef} data-qa="chapter-eyebrow" className="flex items-center gap-3">
            <span
              aria-hidden
              data-qa="wide-numeral"
              className="block leading-none"
              style={{
                fontFamily: "var(--font-display)",
                color: GOLD,
                fontSize: lockupNumeralPx(frameW),
                letterSpacing: "0.12em",
              }}
            >
              {numeral(index)}
            </span>
            <span
              aria-hidden
              data-qa="chapter-eyebrow-rule"
              className="block h-px"
              style={{ width: Math.round(lockupNumeralPx(frameW) * 1.2), backgroundColor: GOLD }}
            />
            <span
              data-qa="chapter-eyebrow-label"
              className="block uppercase"
              style={{
                fontFamily: "var(--font-sans)",
                color: GOLD,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.25em",
              }}
            >
              {copy.eyebrow}
            </span>
          </div>
          <div ref={titleRef}>
            <h3
              data-qa="section-heading"
              className="uppercase"
              style={{
                fontFamily: "var(--font-display)",
                color: IVORY,
                fontSize: lockupTitlePx(frameW),
                fontWeight: 400,
                lineHeight: 1.1,
                letterSpacing: "0.06em",
                marginTop: 18,
              }}
            >
              {copy.title}
            </h3>
            <p
              data-qa="chapter-body"
              style={{
                fontFamily: "var(--font-sans)",
                color: "rgba(240,233,218,0.85)",
                fontSize: chapterBodyPx(frameW),
                fontWeight: 300,
                lineHeight: 1.7,
                letterSpacing: "0.01em",
                marginTop: 18,
                maxWidth: "36ch",
              }}
            >
              {copy.body}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * The frame's true CSS size. The wide composition is pure measured geometry, so
 * it needs the box it is actually painting into — the pinned stage under
 * motion, a 70svh slide under reduced motion. Measured in a layout effect
 * (before paint, so there is no flash of an unsized plate) and kept current by a
 * ResizeObserver, which is what catches a mobile URL-bar collapse or a rotation.
 */
export function useFrameSize(ref: RefObject<HTMLElement>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const last = useRef({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      // Sub-pixel churn from Blink's 1/64-px layout snapping would otherwise
      // re-render the whole act on every scroll-driven reflow.
      if (Math.abs(r.width - last.current.w) < 0.5 && Math.abs(r.height - last.current.h) < 0.5) {
        return;
      }
      last.current = { w: r.width, h: r.height };
      setSize({ w: r.width, h: r.height });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
