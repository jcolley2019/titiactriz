import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import EventCard from "./EventCard";
import { useCardTap } from "./useCardTap";
import type { EventItem } from "@/hooks/useEventsBoard";

/**
 * EVENTS.ACT.CAROUSEL.1 — the act's card STRIP, ported from the TitiLinks
 * CarouselBlock (jcolley2019/titilinks, src/components/blocks/CarouselBlock.tsx).
 *
 * What comes across from that engine, unchanged in mechanism: a `overflow-x-auto`
 * flex strip with the scrollbar suppressed; `snap-center snap-always` cells at a
 * width fraction; the strip rendered TWICE and advanced by a rAF that wraps at
 * exactly one copy's width; the pause-on-seizure ref; and the reduced-motion bail
 * before the loop is ever started.
 *
 * The gallery act's marquee is deliberately NOT the model here. That one is a
 * GSAP xPercent tween on a track, which cannot be scrolled by a reader — it is a
 * film that plays. This strip has to be BOTH: it plays on its own and it yields
 * to a finger. What does carry over from the gallery is behavioral, and it is
 * load-bearing: the motion is TIME-driven, so it keeps running through the act's
 * `+=120%` GSAP pin, and taps keep working while pinned, because pinning fixes a
 * section's place on the page and never touches its pointer events
 * (CinematicGallery.tsx:22-26 states this precedent).
 *
 * ## The one thing that could not be ported verbatim
 *
 * TitiLinks never has drift and snap at the same time — look at its `:105` and
 * `:115`: the snap classes are applied ONLY when `loop` is false. That is not an
 * oversight, it is the whole reason the block reads that way. `scroll-snap-type:
 * mandatory` makes the browser re-snap the container, and a rAF writing
 * `scrollLeft` every frame gives it something to fight; the drift stalls or
 * judders. This act needs both behaviours from one strip, so snap is ARMED AND
 * DISARMED WITH THE MODE instead of being decided once:
 *
 *   drift  — snap `none`, rAF advancing. There is nothing to fight.
 *   user   — entered on pointerdown/touchstart/wheel. The rAF stops writing, and
 *            snap STAYS `none` for the duration of the gesture. It is armed to
 *            `x mandatory` only when the gesture ENDS.
 *
 * Arming at the end rather than the start is the load-bearing half. Switching a
 * container to `mandatory` makes it re-snap immediately, so arming on touch-DOWN
 * would jerk the strip out from under the finger that just grabbed it. Armed at
 * lift-off instead, the snap lands inside the platform's own momentum handling,
 * which is exactly where a reader expects a settle. Disarming is free in both
 * directions: turning snap OFF never scrolls anything, so the return to drift
 * after the idle window is silent.
 *
 * Snap is driven imperatively rather than through React state on purpose: the
 * rAF reads and writes the same element every frame, and a batched state update
 * could leave one frame where the strip is still `mandatory` while the drift has
 * already resumed — one frame of exactly the fight this design exists to avoid.
 *
 * ## Two additions that are ours, not TitiLinks'
 *
 * RUNWAY. The doubled strip gives the drift somewhere to go, but a reader who
 * swipes BACKWARD in the first copy hits `scrollLeft: 0` and stops dead.
 * TitiLinks has that dead end too; here it would be a defect, because the strip
 * invites the gesture. So on seizure the strip is normalised into the second
 * copy — a shift of exactly one copy's width, which is visually a no-op because
 * the two copies are identical, and which leaves a full copy of runway in BOTH
 * directions.
 *
 * OVERSCROLL. `overscroll-behavior-x: contain`, so a horizontal swipe that runs
 * out of strip cannot hand the gesture to iOS's back-navigation.
 *
 * ## Lenis
 *
 * Nothing here is marked `data-lenis-prevent`, and that is a decision. The
 * cinematic page's Lenis owns the wheel (`HomeCinematic.tsx:87`), and this strip
 * only ever LISTENS for wheel — it never calls preventDefault — so a vertical
 * wheel over the strip still scrolls the page through Lenis and a reader can
 * never be trapped inside a pinned act. Marking the strip prevented would hand
 * vertical wheel back to the platform and put two authorities on one scrollTop,
 * which is the exact failure src/lib/smoothScroll.ts exists to prevent. Touch is
 * untouched either way: Lenis is constructed without `syncTouch`, so the swipe
 * this strip lives on is the platform's own.
 */

/**
 * The strip is SHORT by construction: `useEventsBoard` caps a board at four
 * items (:332), so the doubled strip is at most eight cells and the whole loop
 * is a handful of cards. Nothing here needs virtualising, and the rAF's
 * per-frame `scrollWidth` read is measuring a strip that small.
 */

/** TitiLinks' own idle window before the drift takes the strip back. */
const IDLE_MS = 8000;
/** One card-width per this many ms — TitiLinks' default pace, ported. */
const SPEED_MS = 5000;
/** Wheel has no "end" event; this much quiet stands in for one. */
const WHEEL_IDLE_MS = 120;

type Props = {
  cards: EventItem[];
  /** Room A stages a narrower field than rooms B/C — the strip takes the same room. */
  wide?: boolean;
  /** Tap/Enter on a card. */
  onOpenCard: (index: number) => void;
  /** The modal is up: the drift holds, whatever the idle timer thinks. */
  modalOpen: boolean;
  reduced: boolean;
};

const EventsCarousel = ({ cards, wide = true, onOpenCard, modalOpen, reduced }: Props) => {
  const { t, i18n } = useTranslation();
  // The cell's accessible name carries the card's own title, so it is read in
  // the language the card is rendered in — EventCard's own `useLang` rule.
  const lang = (i18n.language || "es").startsWith("es") ? "es" : "en";
  const stripRef = useRef<HTMLDivElement>(null);
  /** TitiLinks' pause mechanism, unchanged: a timestamp the tick checks. */
  const pausedUntil = useRef(0);
  const resumeTimer = useRef<number | undefined>(undefined);
  const wheelTimer = useRef<number | undefined>(undefined);
  const settleRaf = useRef<number | undefined>(undefined);
  const cellProps = useCardTap(onOpenCard);

  const count = cards.length;
  const loop = !reduced && count >= 2;
  const stripItems = loop ? [...cards, ...cards] : cards;

  /** Imperative on purpose — see the header note on the one-frame fight. */
  const setSnap = useCallback((on: boolean) => {
    const el = stripRef.current;
    if (!el) return;
    el.style.scrollSnapType = on ? "x mandatory" : "none";
    el.dataset.snap = on ? "on" : "off";
  }, []);

  const markDrift = useCallback((running: boolean) => {
    const el = stripRef.current;
    if (el) el.dataset.drift = running ? "running" : "paused";
  }, []);

  /**
   * The reader takes the strip: the drift halts and snap disarms. It writes NO
   * scroll position, and that restraint is load-bearing.
   *
   * The first cut of this normalised the runway here, on pointerdown. It was
   * measured wrong: moving the strip between mousedown and mouseup changes which
   * element is under the pointer, so the browser resolves `click` against the
   * common ancestor of the two — the strip — and the CELL's own handler never
   * fires. A tap on a card did nothing at all. The runway is the drift's job
   * instead (see the band in the tick below), where nothing is touching the
   * strip and a shift cannot land in the middle of somebody's gesture.
   */
  const seize = useCallback(() => {
    window.clearTimeout(resumeTimer.current);
    cancelAnimationFrame(settleRaf.current ?? 0);
    pausedUntil.current = Number.POSITIVE_INFINITY;
    markDrift(false);
    setSnap(false);
  }, [markDrift, setSnap]);

  /**
   * Bring the strip to the nearest card centre ourselves, once it has stopped.
   *
   * Arming `scroll-snap-type` is NOT enough on its own, and the evidence pack is
   * what proved it: on a real board at 1280 the strip came to rest 160px off a
   * card after a gesture, because a container only re-snaps when a scroll
   * FOLLOWS the style change. Momentum supplies one — so a flung swipe settles
   * centred all by itself — but a slow drag that stops before the finger lifts
   * supplies nothing, and the strip simply stayed mid-card.
   *
   * So the rest is computed rather than hoped for: wait for the scroll position
   * to go quiet (momentum, if there is any, gets to finish and land its own
   * snap), then, if the strip is not already on a card centre, scroll to the
   * nearest one. Snap is armed throughout, so the browser holds it there.
   */
  const restToNearest = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const mid = b.left + el.clientWidth / 2;
    const maxScroll = el.scrollWidth - el.clientWidth;

    // Only positions the scroller can actually REACH are candidates. At either
    // end of the strip the outermost card cannot be centred at all — centring
    // it would need a scroll past 0 or past maximum — and a naive "nearest
    // centre" picks exactly that impossible target, scrolls nowhere, and leaves
    // the strip resting off-centre with nothing to show for it. Measured at the
    // head of the strip, where the answer came back 184px out.
    let target = el.scrollLeft;
    let best = Number.POSITIVE_INFINITY;
    for (const cell of Array.from(
      el.querySelectorAll<HTMLElement>('[data-qa="events-card-cell"]'),
    )) {
      const r = cell.getBoundingClientRect();
      const want = el.scrollLeft + (r.left + r.width / 2 - mid);
      if (want < -0.5 || want > maxScroll + 0.5) continue;
      const d = Math.abs(want - el.scrollLeft);
      if (d < best) {
        best = d;
        target = want;
      }
    }
    if (best !== Number.POSITIVE_INFINITY && best > 1) {
      el.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" });
    }
  }, [reduced]);

  /** Watch the strip until it stops moving, then settle it onto a card. */
  const settleThenRest = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    cancelAnimationFrame(settleRaf.current ?? 0);
    let last = Number.NaN;
    let stable = 0;
    const step = () => {
      const now = el.scrollLeft;
      stable = Math.abs(now - last) < 0.5 ? stable + 1 : 0;
      last = now;
      if (stable >= 3) {
        restToNearest();
        return;
      }
      settleRaf.current = requestAnimationFrame(step);
    };
    settleRaf.current = requestAnimationFrame(step);
  }, [restToNearest]);

  /** The gesture ended: snap arms so the strip RESTS centred, then the clock runs. */
  const release = useCallback(() => {
    if (count < 2) return;
    setSnap(true);
    settleThenRest();
    window.clearTimeout(resumeTimer.current);
    if (reduced) return; // no drift to return to — the strip simply stays snapped
    resumeTimer.current = window.setTimeout(() => {
      // Disarm BEFORE handing the strip back: turning snap off never scrolls,
      // so this ordering makes the resume silent.
      setSnap(false);
      pausedUntil.current = 0;
      markDrift(true);
    }, IDLE_MS);
  }, [count, reduced, markDrift, setSnap, settleThenRest]);

  const onWheel = useCallback(() => {
    seize();
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(release, WHEEL_IDLE_MS);
  }, [seize, release]);

  /**
   * Reduced motion still snaps — there is no drift to fight, so the strip is
   * simply a snapping scroller from its first frame.
   */
  useEffect(() => {
    if (reduced && count >= 2) setSnap(true);
  }, [reduced, count, setSnap]);

  /** The modal holds the drift for as long as it is up, idle timer or not. */
  useEffect(() => {
    if (!modalOpen) return;
    window.clearTimeout(resumeTimer.current);
    pausedUntil.current = Number.POSITIVE_INFINITY;
    markDrift(false);
    return () => {
      // Closing lands back on the strip exactly where it was — scrollLeft was
      // never touched — and the reader gets the same quiet window a gesture
      // earns before the drift takes over again. They have just been reading a
      // card; the strip sliding out from under the next tap would be rude.
      //
      // The countdown is a real timer rather than a future `pausedUntil`
      // timestamp, so `data-drift` cannot claim to be running while the tick is
      // still holding. An attribute that lies for eight seconds is worse than no
      // attribute, and the specs read this one.
      if (reduced) return;
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => {
        setSnap(false);
        pausedUntil.current = 0;
        markDrift(true);
      }, IDLE_MS);
    };
  }, [modalOpen, reduced, markDrift, setSnap]);

  /**
   * The drift itself — CarouselBlock.tsx:61-82, ported.
   *
   * The pace is measured rather than assumed: TitiLinks multiplies clientWidth
   * by the same fraction its width class uses, which works because that block has
   * exactly one card width. This strip is responsive, so the fraction is read
   * back off the first cell — the same formula, with the DOM as the single source
   * of truth instead of a constant that has to be kept in sync with a class.
   */
  useEffect(() => {
    if (!loop) return;
    const el = stripRef.current;
    if (!el) return;

    markDrift(true);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (el.scrollWidth > 0 && Date.now() >= pausedUntil.current) {
        const oneCopy = el.scrollWidth / 2;
        const cell = el.firstElementChild as HTMLElement | null;
        const cardW = cell?.getBoundingClientRect().width ?? el.clientWidth;
        const pxPerSec = (cardW * 1000) / SPEED_MS;
        let next = el.scrollLeft + pxPerSec * dt;

        // The wrap is TitiLinks', unchanged, and it has to be: `scrollLeft`
        // saturates at `scrollWidth - clientWidth`, so ONE COPY is the only
        // wrap point a scroller can actually reach.
        //
        // A draft of this wrapped into the SECOND copy's band instead
        // ([oneCopy, 2*oneCopy)), to leave a reader a full copy of backward
        // runway. It is a real improvement that cannot be had this way: the top
        // of that band is past maximum scroll, so the drift climbed to the end
        // of the strip and STOPPED there, permanently. Caught on the evidence
        // run, where the strip sat pinned at 2619 — its exact maximum — while
        // every spec still passed, because they all measure within a second or
        // two of arrival and the stall takes fifteen.
        //
        // So backward runway is bounded by where the drift currently is, which
        // is what the ported engine has always done.
        if (next >= oneCopy) next -= oneCopy;

        el.scrollLeft = next;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, count, markDrift]);

  useEffect(
    () => () => {
      window.clearTimeout(resumeTimer.current);
      window.clearTimeout(wheelTimer.current);
      cancelAnimationFrame(settleRaf.current ?? 0);
    },
    [],
  );

  return (
    <div
      ref={stripRef}
      data-qa="events-cards"
      data-carousel="true"
      data-cards={count}
      data-copies={loop ? 2 : 1}
      data-events-line
      role="group"
      aria-label={t("events.carousel.region")}
      onPointerDown={seize}
      onTouchStart={seize}
      onPointerUp={release}
      onPointerCancel={release}
      onTouchEnd={release}
      onTouchCancel={release}
      onWheel={onWheel}
      className={`flex w-full overflow-x-auto ${loop ? "" : "gap-6"} ${
        wide ? "max-w-4xl" : "max-w-3xl"
      }`}
      // `scroll-snap-type` is deliberately ABSENT here. It is owned imperatively
      // by `setSnap`, and a declared value would be re-asserted by React on any
      // re-render — disarming a snap the reader's gesture had just armed. A div
      // defaults to no snapping, which is what the drift wants on frame one.
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        overscrollBehaviorX: "contain",
      }}
    >
      {stripItems.map((item, i) => {
        const index = i % count;
        return (
          <div
            key={`${item.id}-${i}`}
            data-qa="events-card-cell"
            data-index={index}
            data-copy={i >= count ? 1 : 0}
            className={`flex-shrink-0 snap-center snap-always cursor-pointer outline-none ${
              loop ? "mr-6" : ""
            } w-[86%] md:w-[60%] lg:w-[52%]`}
            {...cellProps(
              index,
              t("events.carousel.open", { title: (item.title?.[lang] || item.title?.es) ?? "" }),
            )}
          >
            <EventCard item={item} />
          </div>
        );
      })}
    </div>
  );
};

export default EventsCarousel;
