import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { CSSProperties } from "react";

import { resolveHeroGeometry } from "@/lib/hero-framing";
import type { HeroFraming } from "@/lib/hero-framing";
import { FrameCache, frameSize } from "./frameCache";
import type { DecodedFrame } from "./frameCache";
import { frameIndexAt, frameUrls } from "./sequences";
import type { FrameSequence } from "./sequences";

/**
 * SEQ.1 — the frame-scrub engine.
 *
 * Paints one frame of a still sequence to a `<canvas>`, chosen by a progress
 * value in 0..1. Nothing here knows about scroll: the component is a pure
 * function of progress, which is what makes it testable at exact stops and
 * reusable for anything that can produce a 0..1 (scroll, a slider, a timeline).
 *
 * ## Framing is not re-derived
 *
 * The cover/focal maths comes from `resolveHeroGeometry` — the same function
 * that defines hero framing everywhere else on this site. It returns the media
 * rectangle as PERCENTAGES of the container, which converts to canvas pixels by
 * multiplication and nothing else, so a frame pack crops and pans by exactly
 * the law the photographs obey. Re-deriving cover-fit here would have been four
 * lines and would have quietly forked the contract; it does not, and must not.
 *
 * ## Why a canvas rather than a stack of image elements
 *
 * A canvas draws exactly one frame at exactly one size, so there is no layout,
 * no compositor layer per frame, and no chance of two frames being visible at
 * once during a fast scrub. It is also `devicePixelRatio`-aware by explicit
 * arithmetic rather than by hope, which is the whole point of the exercise:
 * stills are only sharper than video if they are actually painted at device
 * resolution.
 *
 * ## Tearing
 *
 * Progress arrives far faster than frames can be painted (a wheel event storm,
 * or GSAP's scrub lerp, both fire well above 60 Hz). Every update therefore
 * only records the LATEST requested progress and schedules a single animation
 * frame; the callback reads that latest value at paint time. Intermediate
 * values are dropped by construction, so a stale draw cannot land after a newer
 * one — there is never more than one draw in flight.
 */

export interface SeqScrubStatus {
  /** Frame index actually painted. */
  index: number;
  total: number;
  /** Distinct frames decoded since mount. */
  loaded: number;
  /** Frames currently held in the decode cache. */
  cached: number;
}

export interface FrameScrubberHandle {
  /**
   * Set the playhead, 0..1. Imperative on purpose: a pinned act updates this
   * at animation-frame rate, and routing that through React state would
   * re-render the tree sixty times a second to paint a canvas React does not
   * own anyway.
   */
  setProgress: (progress: number) => void;
}

interface Props {
  sequence: FrameSequence;
  /**
   * Controlled playhead. Applied on mount and whenever it changes; imperative
   * `setProgress` calls take over between changes.
   */
  progress?: number;
  /** Reduced motion: paint the first frame and never bind a scrub. */
  reduced?: boolean;
  /** Focal/zoom framing, resolved by the shared hero-framing law. */
  framing?: HeroFraming | null;
  /** Painted behind the frame — matters at scale < 1 and in 'fit'. */
  backdrop?: string;
  /**
   * A CSS `filter` applied to the canvas alone, for acts whose plate needs a
   * grade the packs themselves should not be re-encoded to carry. Undefined by
   * default, so a consumer that does not ask for one is painted exactly as its
   * frames were authored. It sits on the CANVAS rather than the host so that
   * overlay children — type, scrims, logos — are never graded with the plate.
   */
  canvasFilter?: string;
  className?: string;
  style?: CSSProperties;
  onStatus?: (status: SeqScrubStatus) => void;
}

const NEAR_BLACK = "#0b0a08";

const FrameScrubber = forwardRef<FrameScrubberHandle, Props>(function FrameScrubber(
  {
    sequence,
    progress = 0,
    reduced = false,
    framing,
    backdrop = NEAR_BLACK,
    canvasFilter,
    className,
    style,
    onStatus,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<FrameCache | null>(null);

  const targetRef = useRef(progress);
  const rafRef = useRef<number | null>(null);
  const requestedIndexRef = useRef(-1);
  const paintedIndexRef = useRef(-1);
  const statusRef = useRef("");

  // Props the draw loop reads without wanting to be a dependency of it.
  const framingRef = useRef(framing);
  const backdropRef = useRef(backdrop);
  const onStatusRef = useRef(onStatus);
  framingRef.current = framing;
  backdropRef.current = backdrop;
  onStatusRef.current = onStatus;

  const emitStatus = useCallback(
    (index: number) => {
      const cache = cacheRef.current;
      if (!cache) return;
      const { cached, loaded } = cache.stats;
      // Emitting on every animation frame would churn React for no visible
      // gain — the HUD only changes when one of these four numbers does.
      const key = `${index}|${cached}|${loaded}`;
      if (key === statusRef.current) return;
      statusRef.current = key;
      onStatusRef.current?.({ index, total: sequence.count, loaded, cached });
    },
    [sequence.count],
  );

  const paint = useCallback(
    (frame: DecodedFrame, index: number) => {
      const canvas = canvasRef.current;
      const host = hostRef.current;
      if (!canvas || !host) return;

      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const pxW = Math.round(rect.width * dpr);
      const pxH = Math.round(rect.height * dpr);
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = backdropRef.current;
      ctx.fillRect(0, 0, rect.width, rect.height);

      const { w, h } = frameSize(frame);
      const geo = resolveHeroGeometry(w / h, rect.width / rect.height, framingRef.current);
      if (!geo) return;
      ctx.drawImage(
        frame,
        (geo.leftPct / 100) * rect.width,
        (geo.topPct / 100) * rect.height,
        (geo.widthPct / 100) * rect.width,
        (geo.heightPct / 100) * rect.height,
      );

      paintedIndexRef.current = index;
      // The drawn frame, asserted straight from the paint that drew it — the
      // only signal that cannot drift from what is actually on screen.
      canvas.setAttribute("data-seq-frame", String(index));
      emitStatus(index);
    },
    [emitStatus],
  );

  const draw = useCallback(() => {
    const cache = cacheRef.current;
    if (!cache) return;
    const wanted = frameIndexAt(targetRef.current, sequence.count);

    if (wanted !== requestedIndexRef.current) {
      requestedIndexRef.current = wanted;
      cache.request(wanted);
    }

    // Exact frame if held; otherwise the closest held frame, so a fast scrub
    // degrades to a coarser flipbook instead of to a blank act. `hit.index` is
    // what gets reported — during a load the act truthfully says it is still
    // showing the neighbour, and settles to `wanted` when that frame arrives.
    const hit = cache.nearest(wanted);
    if (!hit) return;
    paint(hit.frame, hit.index);
  }, [paint, sequence.count]);

  const schedule = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  useImperativeHandle(
    ref,
    () => ({
      setProgress: (next: number) => {
        targetRef.current = Math.min(1, Math.max(0, next));
        schedule();
      },
    }),
    [schedule],
  );

  // One cache per pack. Rebuilt if the pack changes; disposed on unmount so the
  // ImageBitmaps release their GPU memory rather than waiting on GC.
  useEffect(() => {
    const cache = new FrameCache(frameUrls(sequence), () => schedule());
    cacheRef.current = cache;
    requestedIndexRef.current = -1;
    paintedIndexRef.current = -1;
    statusRef.current = "";
    // Reduced motion never scrubs: the playhead is parked on the first frame
    // and no scroll binding is ever attached by the act above.
    targetRef.current = reduced ? 0 : Math.min(1, Math.max(0, progress));
    schedule();
    return () => {
      cache.dispose();
      cacheRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // `progress` is the initial playhead here; later changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence, reduced, schedule]);

  // Controlled updates. Ignored under reduced motion, which stays on frame 0.
  useEffect(() => {
    if (reduced) return;
    targetRef.current = Math.min(1, Math.max(0, progress));
    schedule();
  }, [progress, reduced, schedule]);

  // The canvas must be re-rasterised at the new size, not stretched: a resize
  // changes both the backing-store dimensions and the resolved geometry.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => schedule());
    ro.observe(host);
    return () => ro.disconnect();
  }, [schedule]);

  // A framing change repaints the same frame through new geometry.
  useEffect(() => {
    schedule();
  }, [framing, schedule]);

  return (
    <div
      ref={hostRef}
      data-qa="seq-scrubber"
      data-seq-id={sequence.id}
      className={className}
      style={{ position: "relative", overflow: "hidden", backgroundColor: backdrop, ...style }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        data-qa="seq-canvas"
        data-seq-id={sequence.id}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          filter: canvasFilter,
        }}
      />
    </div>
  );
});

export default FrameScrubber;
