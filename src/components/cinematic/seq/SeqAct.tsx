import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import type { HeroFraming } from "@/lib/hero-framing";
import FrameScrubber from "./FrameScrubber";
import type { FrameScrubberHandle, SeqScrubStatus } from "./FrameScrubber";
import type { FrameSequence } from "./sequences";

gsap.registerPlugin(ScrollTrigger);

/**
 * SEQ.1 — pinned frame-scrub act.
 *
 * Pins its stage and makes scroll the playhead of a still sequence. The pin
 * grammar is the shipped one, unchanged: `start: "top top"`, `end: "+=300%"`,
 * `scrub: true`, `pin: true`, `anticipatePin: 1` — the same numbers the reel
 * (CinematicReel.tsx) and TitiLinks (CinematicTitiLinks.tsx) acts already use,
 * so an act built on frames costs the reader exactly as much scroll as an act
 * built on type.
 *
 * ## Dead zones
 *
 * Mapping raw pin progress straight onto the pack would start advancing frames
 * on the very first pixel of pin and finish on the very last, which reads as a
 * flinch at both ends — the sequence appears to be already moving when it
 * arrives and to still be moving when it leaves. `SEQ_LEAD_IN`/`SEQ_LEAD_OUT`
 * hold frame 0 while the act settles and hold the final frame before release.
 * Clamping is what produces the DEAD STOP: over-scrolling into either zone
 * cannot push the playhead past its end.
 *
 * ## Progress does not go through React
 *
 * GSAP writes to the scrubber's imperative handle. A `useState` here would
 * re-render this subtree at scrub rate to update a canvas React never touches.
 *
 * The trigger's resolved scroll bounds are published as `data-seq-start` /
 * `data-seq-end` so a spec can drive REAL page scroll to an exact progress
 * instead of guessing pixel offsets — the act is then measured through the same
 * ScrollTrigger the viewer gets, not through a test-only back door.
 */

/** Fraction of the pin held on the first frame before the sequence advances. */
export const SEQ_LEAD_IN = 0.08;
/** Fraction of the pin held on the final frame before release. */
export const SEQ_LEAD_OUT = 0.08;
/** Pin length, matching the shipped pinned acts. */
export const SEQ_PIN_DURATION = "+=300%";

/**
 * Raw pin progress → playhead. Both dead zones clamp, so the ends are stops
 * rather than edges.
 */
export function seqProgress(raw: number, leadIn = SEQ_LEAD_IN, leadOut = SEQ_LEAD_OUT): number {
  const span = 1 - leadIn - leadOut;
  if (span <= 0) return raw <= leadIn ? 0 : 1;
  return Math.min(1, Math.max(0, (raw - leadIn) / span));
}

interface Props {
  sequence: FrameSequence;
  reduced: boolean;
  framing?: HeroFraming | null;
  leadIn?: number;
  leadOut?: number;
  pinDuration?: string;
  backdrop?: string;
  /** Overlay content — type, scrims, CTAs. Painted above the canvas. */
  children?: ReactNode;
  onStatus?: (status: SeqScrubStatus) => void;
  /**
   * The playhead, pushed at scrub rate: `(mapped, raw)`, where `mapped` is the
   * dead-zone-corrected 0..1 the frames actually follow and `raw` is the pin's
   * own progress.
   *
   * IMPERATIVE, exactly like the scrubber handle above it — a consumer writes to
   * refs or straight to the DOM. Calling `setState` from here would re-render
   * the overlay sixty times a second, which is the one thing this whole act is
   * built to avoid. Overlay elements that need to react to the playhead should
   * latch on a THRESHOLD (crossed / not crossed) and hand the actual motion to
   * GSAP, so the work per frame stays a comparison.
   */
  onProgress?: (mapped: number, raw: number) => void;
}

const SeqAct = ({
  sequence,
  reduced,
  framing,
  leadIn = SEQ_LEAD_IN,
  leadOut = SEQ_LEAD_OUT,
  pinDuration = SEQ_PIN_DURATION,
  backdrop,
  children,
  onStatus,
  onProgress,
}: Props) => {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<FrameScrubberHandle>(null);

  // Read through a ref so a consumer's inline arrow does not become a reason to
  // tear down and rebuild the pin on every render.
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useLayoutEffect(() => {
    if (reduced) return; // no pin, no scrub binding — the scrubber holds frame 0
    const stage = pinRef.current;
    const section = sectionRef.current;
    if (!stage || !section) return;

    const ctx = gsap.context(() => {
      // A plain number tweened linearly across the pin, written out in
      // onUpdate — the same "tween a value, apply it yourself" shape the
      // TitiLinks iris uses. `scrub: true` smooths it exactly like the other
      // acts, so the frames inherit the page's existing scroll feel.
      const state = { p: 0 };
      const publishBounds = (self: ScrollTrigger) => {
        section.setAttribute("data-seq-start", String(Math.round(self.start)));
        section.setAttribute("data-seq-end", String(Math.round(self.end)));
      };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: pinDuration,
          scrub: true,
          pin: true,
          anticipatePin: 1,
          onRefresh: publishBounds,
          onUpdate: (self) => {
            state.p = self.progress;
            const mapped = seqProgress(state.p, leadIn, leadOut);
            scrubberRef.current?.setProgress(mapped);
            onProgressRef.current?.(mapped, state.p);
          },
        },
      });
      tl.to(state, { p: 1, duration: 1, ease: "none" });
      // Publish once at creation as well: `onRefresh` covers every LATER
      // measurement, but a reader that mounts and immediately looks for the
      // bounds should not have to race the first refresh.
      if (tl.scrollTrigger) publishBounds(tl.scrollTrigger);
    }, sectionRef);

    return () => ctx.revert();
  }, [reduced, leadIn, leadOut, pinDuration, sequence]);

  return (
    <section ref={sectionRef} data-qa="seq-act" data-seq-id={sequence.id} className="relative w-full">
      <div ref={pinRef} className="cine-h-full relative w-full overflow-hidden">
        <FrameScrubber
          ref={scrubberRef}
          sequence={sequence}
          reduced={reduced}
          framing={framing}
          backdrop={backdrop}
          onStatus={onStatus}
          // Fills the stage. NOT `absolute inset-0`: the scrubber sets
          // `position: relative` inline (it is the containing block for its own
          // canvas), and an inline position always beats a utility class.
          className="h-full w-full"
        />
        {children}
      </div>
    </section>
  );
};

export default SeqAct;
