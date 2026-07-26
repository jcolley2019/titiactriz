import { useRef } from "react";
import { ReelPhoto, STAGE_CLASS } from "./shared";
import type { WideVariantProps } from "./wideVariants";
import {
  AmbientBackdrop,
  WideLockup,
  focalFractions,
  plateBox,
  plateVeil,
  useWideReelTimeline,
} from "./wideShared";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * W3 — "Offset Bleed".
 *
 * Thesis: cinema, not gallery — the plate is larger than the frame and bleeds
 * off its edges, frameless, so the photograph reads as a scene the viewport
 * has cut into rather than an object it displays.
 *
 * Composition: plate height 108vh, NO width cap (bleed is the identity),
 * centre x at 62% of the frame. The vertical offset is anchored on the
 * slide's focal.y — the plate slides so the focal centres — clamped so the
 * focal always sits inside the middle 60% of the frame's height; the
 * horizontal clamp keeps it inside the middle 70% of the width. At narrow
 * wide viewports the plate overflows sideways; that overflow is permitted and
 * clipped by the frame. No outline. Shared veil law.
 *
 * Each slide's plate is positioned for that slide's own focal and never moves
 * during the act — slides CROSSFADE between fixed positions, which is what
 * "the plate never moves per slide" means for a focal-anchored composition.
 *
 * Lockup bottom-left with W1's margins; its max-width runs to the plate's
 * VISIBLE left edge (floor 0). When the plate reaches the frame's left edge
 * there is no gutter: the cap is dropped, the lockup overlays the plate, and
 * only the focal-safe-circle law of the safety spec applies.
 */
const W3 = ({ slides, progress, reduced, frameW, frameH }: WideVariantProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const veilRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useWideReelTimeline(
    { rootRef, slideRefs, veilRefs, labelRefs, titleRefs },
    slides.length,
    reduced,
    progress,
  );

  const box = plateBox(frameW, frameH, 108); // no width cap — bleed is the identity
  const lockupLeft = frameW * 0.06;
  const lockupBottom = frameH * 0.12;

  const list = reduced ? slides.slice(0, 1) : slides;

  return (
    <div ref={rootRef} className={STAGE_CLASS} data-qa="wide-variant" data-variant="w3">
      {list.map((s, i) => {
        const { fx, fy } = focalFractions(s);

        // Vertical: centre the focal, keep full vertical bleed when possible,
        // and let the middle-60% law win over both.
        const desiredTop = frameH * 0.5 - fy * box.h;
        const bleedTop = clamp(desiredTop, frameH - box.h, 0);
        const top = clamp(bleedTop, frameH * 0.2 - fy * box.h, frameH * 0.8 - fy * box.h);

        // Horizontal: centre x at 62%, focal clamped to the middle 70%.
        const desiredLeft = frameW * 0.62 - box.w / 2;
        const left = clamp(desiredLeft, frameW * 0.15 - fx * box.w, frameW * 0.85 - fx * box.w);

        // The gutter cap, measured to the plate's VISIBLE left edge, floor 0.
        const visibleLeft = Math.max(left, 0);
        const gutterCap = visibleLeft - frameW * 0.06 - 24;
        const lockupMaxW = gutterCap > 0 ? gutterCap : undefined;

        return (
          <div
            key={i}
            ref={(el) => (slideRefs.current[i] = el)}
            data-qa="wide-slide"
            data-index={i}
            className="absolute inset-0"
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            <AmbientBackdrop slide={s} />
            <div
              data-qa="wide-plate"
              data-focal={`${fx.toFixed(4)},${fy.toFixed(4)}`}
              className="absolute overflow-hidden"
              style={{ left, top, width: box.w, height: box.h }}
            >
              <ReelPhoto slide={s} />
              {/* The beam opens about its own centre, so the aim survives the entrance. */}
              <div
                ref={(el) => (veilRefs.current[i] = el)}
                data-qa="wide-veil"
                className="absolute inset-0"
                style={{
                  background: plateVeil(fx * 100, fy * 100),
                  transformOrigin: `${fx * 100}% ${fy * 100}%`,
                }}
              />
            </div>
            <div className="absolute z-10" style={{ left: lockupLeft, bottom: lockupBottom }}>
              <WideLockup
                index={i}
                title={s.title}
                frameW={frameW}
                align="left"
                maxWidth={lockupMaxW}
                labelRef={(el) => (labelRefs.current[i] = el)}
                titleRef={(el) => (titleRefs.current[i] = el)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default W3;
