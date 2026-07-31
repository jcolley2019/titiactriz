import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import cornerOrn from "@/assets/cp-corner-ornament-v2.png";
import { GOLD, IVORY, spotlightCentre } from "./reelSpotlight";
import { SEAM_GOLD } from "./FramedVideo";
import type { ReelChapterCopy } from "./reelChapters";
import type { Focal, PlateAspect } from "@/hooks/useCinematicMedia";

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
 * W2 are superseded everywhere — MIRROR.SYNC.1 brought the admin SectionPreview
 * onto this spread too, so their constants are deleted rather than exported
 * (the bake-off harness keeps its own frozen copy).
 *
 * The chapter FIELD is not a veil. It is an opaque ground beside the
 * photograph — no type ever crosses the plate, which stays unveiled exactly as
 * W2 settled it.
 *
 * REVIEW.2 — the spread is a TONAL ROOM. The blurred ambient backdrop is gone
 * from the live act: each spread is one uninterrupted field edge to edge, both
 * sides of the seam, on the chapter's own sibling shade of FIELD_GROUND
 * (CHAPTER_GROUNDS, see FramedVideo.tsx) under the HERO.WIDE.1 luminance
 * gradient. The plate's gold hairline frame is no longer a static outline: it
 * DRAWS itself (PlateFrame, a stroke-dashoffset rect) on the slide's segment of
 * the pinned timeline, and the corner filigree blooms in after the line
 * completes. The blurred AmbientBackdrop's last consumer was the admin
 * SectionPreview's frozen W2 mirror; MIRROR.SYNC.1 retired both.
 *
 * CINE.FLOW.5 — the plate itself is unchanged from the promoted bake-off
 * variant W2 ("Center Plate & Rules") as it stood after CINE.FLOW.4B.
 *
 * ADMIN.ASPECT.1 — the plate now has TWO shapes and each slide picks one: the W2
 * portrait plate (the default; every law of it unchanged) or a 3:2 landscape
 * plate, so a landscape photograph is no longer forced into a portrait box on
 * desktop. Both shapes are declared once in `plateLaw` and sized by the one
 * `plateBox` comparison, and everything hung ON the plate — the self-drawing gold
 * frame, the filigree bloom, the seam, the ground — is shape-blind by
 * construction: it measures the plate rather than restating its aspect.
 * The choice lives on the slide's WIDE framing record because it is a WIDE-only
 * concern: the phone act is edge-to-edge and hangs no plate at all.
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
 * veil would buy nothing and cost the plate its light. The chapter's opaque
 * tonal ground is what carries the copy's legibility.
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

/**
 * ADMIN.ASPECT.1 — the LANDSCAPE plate: 3:2, the classic still-photography
 * frame. Chosen over 16:10 because this is a photographer's plate, not a screen:
 * 3:2 is what a full-frame camera hands over, and at every supported wide frame
 * it is the deeper of the two, which is what keeps the plate reading as the
 * spread's photo PAGE beside a full-height copy column rather than as a banner.
 * The portrait plate (`PLATE_ASPECT`) remains the default; nothing about it moves.
 */
export const PLATE_LANDSCAPE_ASPECT = 1.5;

/** W2's declared composition, as fractions of the frame. */
export const PLATE_HEIGHT_VH = 76;
export const PLATE_MAX_WIDTH_VW = 60;
/**
 * ADMIN.ASPECT.1 — the landscape plate's own two declared fractions. It cannot
 * inherit the portrait pair: at 76vh a 3:2 box would be 114vw wide, so the width
 * cap alone would govern at every frame and the height rule would be dead
 * arithmetic. These two are the landscape reading of the same intent — the plate
 * is the spread's wider page (78% of the photo page against the portrait plate's
 * 60%) and a shallower one (52% of the frame's height against 76%) — so a
 * landscape slide is visibly WIDER and SHALLOWER than a portrait one at every
 * supported frame, which is the whole point of the choice.
 */
export const PLATE_LANDSCAPE_HEIGHT_VH = 52;
export const PLATE_LANDSCAPE_MAX_WIDTH_VW = 78;
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
 * CINE.FLOW.6 — the spread's split: the chapter column takes this fraction of
 * the frame width, the plate hangs centred in the remainder. 0.42 keeps the
 * plate the wider page of the spread — the photograph still carries the act —
 * while giving the copy a true column rather than a margin note.
 */
export const CHAPTER_FIELD_FRACTION = 0.42;

const clampNum = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type PlateBox = { w: number; h: number };

/**
 * ADMIN.ASPECT.1 — one plate shape's whole geometry: its aspect and its two
 * declared fractions of the frame. THE single source for both shapes, so the live
 * act, the admin drag math and the admin CSS mirror cannot hold three opinions
 * about what a landscape plate is.
 */
export type PlateLaw = { aspect: number; heightVh: number; maxWidthVw: number };

export function plateLaw(plate: PlateAspect = "portrait"): PlateLaw {
  return plate === "landscape"
    ? {
        aspect: PLATE_LANDSCAPE_ASPECT,
        heightVh: PLATE_LANDSCAPE_HEIGHT_VH,
        maxWidthVw: PLATE_LANDSCAPE_MAX_WIDTH_VW,
      }
    : { aspect: PLATE_ASPECT, heightVh: PLATE_HEIGHT_VH, maxWidthVw: PLATE_MAX_WIDTH_VW };
}

/**
 * Plate sizing law: a box at the chosen shape's aspect. The height rule and the
 * max-width cap are both declared as percentages of the frame; the plate takes
 * whichever yields the SMALLER box, so a short landscape frame is governed by
 * height and a narrow tall one by width.
 *
 * ADMIN.ASPECT.1 — the "smaller box wins" comparison is untouched; only the three
 * numbers it runs on come from `plateLaw` now. A portrait plate therefore computes
 * exactly the box it computed before this brick, arithmetic included. The old
 * heightVh / maxWidthVw override parameters are gone: they had no live caller (the
 * frozen bake-off harness keeps its own copy of this function for W1/W3), and
 * leaving them would have offered a second way to declare a plate.
 */
export function plateBox(
  frameW: number,
  frameH: number,
  plate: PlateAspect = "portrait",
): PlateBox {
  const { aspect, heightVh, maxWidthVw } = plateLaw(plate);
  const hRule = (frameH * heightVh) / 100;
  const wFromH = hRule * aspect;
  const wCap = (frameW * maxWidthVw) / 100;
  if (wCap < wFromH) return { w: wCap, h: wCap / aspect };
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

const numeral = (i: number) => String(i + 1).padStart(2, "0");

/**
 * REVIEW.2 — the plate's gold hairline frame as a SELF-DRAWING line. A single
 * SVG rect, `pathLength` normalised to 1 with a matching dash, whose
 * stroke-dashoffset the pinned timeline scrubs 1 → 0 on the slide's entrance
 * segment — the line draws around the photograph as the spread settles, from
 * the top-left corner clockwise, and never free-runs.
 *
 * The MARKUP state is the finished frame (dashoffset 0): reduced motion — and
 * any surface that never wires `frameRef` into a timeline — renders the frame
 * complete and static with no branch. Under motion the timeline's fromTo sets
 * the undrawn state at creation, exactly as the chapter type's entrances do.
 *
 * The rect is inset half a stroke so the 1px line paints whole on the plate's
 * edge; overflow stays visible so no corner pixel is clipped.
 */
export const PlateFrame = ({
  frameRef,
}: {
  frameRef?: (el: SVGRectElement | null) => void;
}) => (
  <svg
    aria-hidden
    data-qa="plate-frame"
    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
  >
    <rect
      ref={frameRef}
      data-qa="plate-frame-line"
      x="0.5"
      y="0.5"
      fill="none"
      stroke={SEAM_GOLD}
      strokeWidth="1"
      pathLength={1}
      style={{
        // Geometry via CSS (SVG2 geometry properties): calc() keeps the 1px
        // stroke wholly inside the plate at any measured size.
        width: "calc(100% - 1px)",
        height: "calc(100% - 1px)",
        strokeDasharray: 1,
        strokeDashoffset: 0,
      }}
    />
  </svg>
);

/** Chapter body copy: quiet Jost, clamped in px against the measured frame. */
export const chapterBodyPx = (frameW: number) => clampNum(14, frameW * 0.0115, 17);

/**
 * CINE.FLOW.6 — the story chapter: the spread's copy page. Gold chapter-number
 * eyebrow (numeral · hairline · role label), ivory headline at the wide title
 * step, one short paragraph. The scrub grammar's two entrance elements are the
 * eyebrow row (labelRef) and the headline+body block (titleRef) — same
 * properties, marks and easing as the phone act, so the pinned timeline stays
 * composition-blind.
 *
 * REVIEW.2 — the column paints NO ground of its own: the spread is one
 * continuous field owned by the slide, so the seam is a hairline on the room's
 * wall, not the join of two different materials. The ornament is the site's ONE
 * corner filigree, placed at the copy column's OUTER top corner (the frame-edge
 * side), mirrored per alternation so the pair of spreads book-end; it carries
 * `ornRef` so the timeline can bloom it in after the plate frame finishes
 * drawing.
 */
export const ORNAMENT_OPACITY = 0.18;

export const WideChapter = ({
  index,
  copy,
  frameW,
  side,
  labelRef,
  titleRef,
  ornRef,
}: {
  index: number;
  copy: ReelChapterCopy;
  frameW: number;
  side: "left" | "right";
  labelRef?: (el: HTMLDivElement | null) => void;
  titleRef?: (el: HTMLElement | null) => void;
  ornRef?: (el: HTMLImageElement | null) => void;
}) => {
  const colW = frameW * CHAPTER_FIELD_FRACTION;
  const padX = clampNum(28, frameW * 0.04, 96);
  return (
    <div
      data-qa="wide-chapter"
      data-side={side}
      className="absolute inset-y-0 overflow-hidden"
      style={{ [side]: 0, width: colW }}
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
      {/* Outer-corner law: the filigree sits at the column's OUTER top corner —
          the frame-edge side — mirrored on a right-hand column, one per spread.
          Its settled opacity lives in the markup so reduced motion renders it
          complete without a branch; the timeline blooms it from 0 after the
          plate frame's line completes. */}
      <img
        ref={ornRef}
        src={cornerOrn}
        alt=""
        aria-hidden
        data-qa="chapter-ornament"
        className={`absolute h-auto select-none${side === "right" ? " -scale-x-100" : ""}`}
        style={{
          // 112px clears the fixed header band (and its grounded REVIEW.2b
          // state) at every supported frame, so the filigree is never swallowed
          // by site chrome while still reading as the column's top corner.
          top: 112,
          [side]: 28,
          width: "min(22%, 96px)",
          opacity: ORNAMENT_OPACITY,
        }}
        decoding="async"
      />
      <div
        className="flex h-full flex-col justify-center"
        style={{ paddingLeft: padX, paddingRight: padX }}
      >
        <div style={{ maxWidth: Math.min(colW - 2 * padX, 420) }}>
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
