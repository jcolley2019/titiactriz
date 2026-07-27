import { useRef } from "react";
import { GOLD, ReelPhoto, STAGE_CLASS } from "./shared";
import type { WideVariantProps } from "./wideVariants";
import {
  AmbientBackdrop,
  PLATE_OUTLINE,
  WideLockup,
  focalFractions,
  plateBox,
  useWideReelTimeline,
} from "./wideShared";

/**
 * W2 — "Center Plate & Rules".
 *
 * Thesis: the gallery reading — a centred portrait plate hung between two
 * gold hairlines, the lockup as an engraved caption beneath it.
 *
 * Composition: plate height 76vh capped at 60vw (smaller box wins),
 * horizontally centred, top edge at 8vh, gold hairline outline. Two vertical
 * gold hairlines at 18% and 82% of the frame width, 0.35 opacity, below the
 * plate in z. Lockup bottom-CENTRE: horizontally centred in the band between
 * plate bottom and frame bottom, with at least 3vh of padding above and
 * below — a centred plate leaves no left gutter at 834px, so this composition
 * resolves the collision by construction rather than by clamping.
 *
 * NO PLATE VEIL (CINE.FLOW.4B). The focal radial veil exists to keep type
 * legible where type crosses the photograph. In W2 the lockup sits BELOW the
 * plate, over the ambient backdrop, and never overlays the photograph — so the
 * veil bought nothing and cost the plate its light. The photograph renders
 * unveiled inside its gold hairline frame; the AmbientBackdrop
 * (blur 64px / brightness 0.35) is what carries the lockup's legibility.
 * W1 and W3 keep their veils.
 *
 * Motion is the shipped beats via useWideReelTimeline, minus the beam-open —
 * the beam IS the veil's scale/opacity entrance, so a veil-less composition has
 * none. Crossfade, label/title settle and the dead-stop dwell are unchanged.
 * Under reduced motion the act is its first frame: no veil, static backdrop.
 */
const W2 = ({ slides, progress, reduced, frameW, frameH }: WideVariantProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // No veilRefs: this composition has no veil, so it has no beam-open beat.
  useWideReelTimeline(
    { rootRef, slideRefs, labelRefs, titleRefs },
    slides.length,
    reduced,
    progress,
  );

  const box = plateBox(frameW, frameH, 76, 60);
  const plateLeft = (frameW - box.w) / 2;
  const plateTop = frameH * 0.08;
  const plateBottom = plateTop + box.h;
  const bandPad = frameH * 0.03;

  const list = reduced ? slides.slice(0, 1) : slides;

  return (
    <div ref={rootRef} className={STAGE_CLASS} data-qa="wide-variant" data-variant="w2">
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
            {/* The two rules — identical on every slide, so the crossfade
                cannot make them move; DOM order keeps them below the plate. */}
            {[0.18, 0.82].map((x) => (
              <div
                key={x}
                aria-hidden
                data-qa="wide-rule"
                className="absolute inset-y-0"
                style={{ left: frameW * x, width: 1, backgroundColor: GOLD, opacity: 0.35 }}
              />
            ))}
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
              {/* Unveiled: nothing paints over the photograph inside the plate. */}
              <ReelPhoto slide={s} />
            </div>
            {/* The caption band: whatever height remains under the plate. */}
            <div
              className="absolute inset-x-0 flex items-center justify-center"
              style={{
                top: plateBottom,
                bottom: 0,
                paddingTop: bandPad,
                paddingBottom: bandPad,
              }}
            >
              <WideLockup
                index={i}
                title={s.title}
                frameW={frameW}
                align="center"
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

export default W2;
