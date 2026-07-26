import { useRef } from "react";
import { ReelPhoto, STAGE_CLASS } from "./shared";
import type { WideVariantProps } from "./wideVariants";
import {
  AmbientBackdrop,
  PLATE_OUTLINE,
  WideLockup,
  focalFractions,
  plateBox,
  plateVeil,
  useWideReelTimeline,
} from "./wideShared";

/**
 * W1 — "Plate & Spill".
 *
 * Thesis: the photograph is an exhibited object. The plate hangs right of
 * centre on the ambient spill of its own light, and the lockup gets the bare
 * left gutter — type and photograph never share ground.
 *
 * Composition: plate height 82vh capped at 52vw (smaller box wins), centre x
 * at 68% of the frame, vertically centred, gold hairline outline. The focal
 * veil (0 at focal → 0.35 at plate edges) paints on the plate only. Lockup
 * bottom-left: left margin 6vw, baseline 12vh, and its max-width runs to
 * 24px short of the plate's left edge so the title can never reach the plate.
 *
 * Motion is the shipped beats via useWideReelTimeline; under reduced motion
 * the act is its first frame, veil at final state, no beam, static backdrop.
 */
const W1 = ({ slides, progress, reduced, frameW, frameH }: WideVariantProps) => {
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

  const box = plateBox(frameW, frameH, 82, 52);
  const plateLeft = frameW * 0.68 - box.w / 2;
  const plateTop = (frameH - box.h) / 2;
  const lockupLeft = frameW * 0.06;
  const lockupBottom = frameH * 0.12;
  // The gutter is the lockup's whole world: it may never cross into the plate.
  const lockupMaxW = Math.max(0, plateLeft - frameW * 0.06 - 24);

  const list = reduced ? slides.slice(0, 1) : slides;

  return (
    <div ref={rootRef} className={STAGE_CLASS} data-qa="wide-variant" data-variant="w1">
      {list.map((s, i) => {
        const { fx, fy } = focalFractions(s);
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
              style={{
                left: plateLeft,
                top: plateTop,
                width: box.w,
                height: box.h,
                outline: PLATE_OUTLINE,
              }}
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
            <div className="absolute" style={{ left: lockupLeft, bottom: lockupBottom }}>
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

export default W1;
