import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import EventCard from "@/components/events/EventCard";
import type { EventItem } from "@/hooks/useEventsBoard";

/**
 * EVENTS.ACT.CAROUSEL.1 — the event modal, a sibling of PhotoLightbox and
 * deliberately built out of the same parts.
 *
 * The gallery lightbox settled this site's modal grammar: the warm near-black
 * ground at 0.96, a bounded plate inside a fine gold hairline, minimal chrome
 * (close glyph top-right, an unobtrusive "n / total"), prev/next affordances
 * desktop-only because touch swipes instead, Esc/arrows/ground-click, a body
 * scroll lock, a focus trap that restores to the opener, and a reduced-motion
 * crossfade in place of the slide. Every one of those is ported here unchanged —
 * including the TitiLinks swipe thresholds, to the pixel — so opening an event
 * feels like opening a photo, because on this site it is the same gesture.
 *
 * PhotoLightbox itself is not touched by this brick. It is not generalised, not
 * parameterised, not refactored into a shared base: it ships, it is correct, and
 * the cost of the duplication below is a fraction of the cost of destabilising
 * the gallery to save it.
 *
 * ## What is NOT ported: the geometry
 *
 * The photo lightbox letterboxes its plate with `resolveHeroGeometry`, because a
 * photograph HAS an intrinsic aspect ratio and the resolver's contain box is the
 * honest answer for it. A card does not have one. An EventCard is a text-flowed
 * DOM box whose height is a function of the width it is given, so there is no
 * ratio to letterbox and the resolver has nothing to resolve.
 *
 * So the card is contained the only way a card can be: LAY OUT, MEASURE, SCALE.
 *
 *   1. it is laid out at its DESIGNED READING WIDTH — full-width on a phone,
 *      capped at the card's own max at tablet and up;
 *   2. the laid-out height and the stage height are measured (ResizeObserver, so
 *      a poster that decodes late re-measures rather than freezing a stale box);
 *   3. it is scaled down ONLY if it genuinely overflows.
 *
 * Scaling first and reading second would be the naive contain, and it is wrong:
 * a 768px card transform-scaled into a 390px phone stage lands at 0.51, which
 * turns the card's 14px body copy into 7px. The card is a thing to READ. It gets
 * its reading size first and gives up scale only under duress.
 *
 * Below SCALE_FLOOR the card stops shrinking and the stage scrolls instead. A
 * card long enough to reach that floor (bullets, a note, and several buttons, on
 * a short landscape phone) is better read by scrolling than by squinting.
 */

/** The w2 plate hairline — gold #C9A55C at the ratified frame opacity. */
const PLATE_HAIRLINE = "1px solid rgba(201,165,92,0.55)";
/** Warm near-black ground, high opacity — the site's brand-dark base. */
const GROUND = "rgba(11,10,8,0.96)";
/** TitiLinks swipe grammar: commit thresholds in px. */
const SWIPE_X_COMMIT = 48;
const SWIPE_DOWN_COMMIT = 72;

/**
 * The floor the card stops shrinking at; past it the stage scrolls instead.
 *
 * Moved from 0.72 to 0.65 when the poster-first ruling landed, for a reason
 * rather than to make a number pass: the floor exists to keep the card
 * READABLE, and under poster-first the poster IS the content — the date, the
 * hour and the message are inside the artwork, and an image stays legible at
 * any scale. A card whose text has become secondary can afford to shrink
 * further before scrolling is the better answer.
 *
 * It was 0.72 that made a 1280x800 window scroll a card needing 0.697 — twenty
 * pixels of overflow bought at the cost of showing the whole event at once.
 *
 * Exposed as `data-scale` on the dialog, so the evidence pack always reads the
 * value that actually applied rather than the one intended.
 */
const SCALE_FLOOR = 0.65;

/** Breathing room kept between a contained card and the stage edge. */
const CONTAIN_AIR_PX = 4;

/**
 * How far the card may be enlarged to meet the stage.
 *
 * A judgment call, like the floor. Pure contain would let a short card on a tall
 * monitor blow its type up until it read as a poster of a card rather than a
 * card; this stops well short of that while still making "open" mean "bigger".
 */
const SCALE_CEIL = 1.6;

type Props = {
  items: EventItem[];
  open: boolean;
  initialIndex: number;
  onClose: () => void;
};

const EventLightbox = ({ items, open, initialIndex, onClose }: Props) => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(initialIndex);
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const [reduced, setReduced] = useState(false);
  /**
   * The contain, as a pair: the scale applied, and the card's UNSCALED height.
   *
   * Both are needed because a transform does not change layout. Scaling the card
   * alone leaves a layout box of the ORIGINAL height in the flow, so the stage's
   * centring maths keeps using a height that is no longer on screen: measured at
   * 1280, an 839px box scaled to 632px was still centred as 839, which pushed the
   * painted card 83px below the stage's middle and hung its bottom edge outside.
   * Giving the wrapper `h * scale` puts the layout box back in agreement with
   * what is drawn — so `safe center` centres what the eye sees, and the scroll
   * fallback at the floor measures the real overflow.
   */
  const [fit, setFit] = useState({ scale: 1, height: 0 });
  const { scale } = fit;

  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardBoxRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  // Re-arm the index each time the lightbox opens at a new card.
  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      setDir(null);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Body scroll lock while open; focus moves in and returns to the opener.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlayRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      // `preventScroll` is the one place this departs from the photo lightbox's
      // restore, and it is a PRECAUTION rather than a fix for a measured
      // defect — said plainly because the first draft of this comment claimed
      // otherwise and was wrong. The opener here lives inside a HORIZONTAL
      // SCROLLER, and a default focus() is specified to scroll its element into
      // view, which would drag the strip away from wherever the reader left it.
      // Chromium does not currently do so from this state (the spec passes with
      // and without the flag, so it does not falsify this line), but the
      // behaviour is the platform's to change and iOS is not Chromium. The
      // photo lightbox never needed it: its opener sits in a static grid.
      (openerRef.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const count = items.length;
  const step = useCallback(
    (direction: "next" | "prev") => {
      if (count === 0) return;
      setDir(direction);
      setIndex((i) => (direction === "next" ? (i + 1) % count : (i - 1 + count) % count));
    },
    [count],
  );

  /**
   * Step 2 of the contain: measure the laid-out card against the stage.
   *
   * `offsetHeight` and ResizeObserver both report the UNTRANSFORMED border box,
   * so writing a transform back onto the measured element cannot feed back into
   * its own measurement — the loop this would otherwise be is closed by the
   * platform, not by a guard.
   *
   * Both boxes are observed: the stage because the viewport can rotate or
   * resize, and the card because its medium decodes late (a poster arriving
   * after first paint is the same hazard the act's own artReady gate exists for
   * — here it simply re-measures instead of freezing a wrong height).
   */
  useLayoutEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    const box = cardBoxRef.current;
    if (!stage || !box) return;

    const measure = () => {
      const stageH = stage.clientHeight;
      const stageW = stage.clientWidth;
      const cardH = box.offsetHeight;
      const cardW = box.offsetWidth;
      if (!stageH || !cardH || !cardW) return;
      // AIR. Scaling to exactly `stageH / cardH` makes the card's edges land on
      // the stage's edges, and the sub-pixel rounding of a fractional transform
      // then puts them a fraction OUTSIDE it — measured on the evidence run at
      // 1280, where a card scaled to a 672px box inside a 672px stage read as
      // not-contained. A couple of pixels of margin cost nothing visually and
      // make "the whole card is inside the stage" true by construction rather
      // than by rounding luck. A card that already fits keeps scale 1 exactly.
      // CONTAIN GOES BOTH WAYS. The first cut capped this at 1, so the modal
      // could only ever shrink a card — which made opening one a downgrade:
      // Joey's desktop showed the same poster at the same size as the strip,
      // inside a wider frame with more empty ground. "Contained in the stage"
      // means the card grows to meet the stage as readily as it gives way to it.
      //
      // Bounded on BOTH axes, or a tall stage would scale the card wider than
      // the room it is standing in.
      const fitted = Math.min(
        (stageH - CONTAIN_AIR_PX) / cardH,
        (stageW - CONTAIN_AIR_PX) / cardW,
        SCALE_CEIL,
      );
      setFit({ scale: Math.max(SCALE_FLOOR, fitted), height: cardH });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(box);
    return () => ro.disconnect();
  }, [open, index, count]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "ArrowRight") step("next");
    if (e.key === "ArrowLeft") step("prev");
    if (e.key === "Tab") {
      // Focus trap: cycle within the dialog. Unlike the photo lightbox, the
      // trapped set includes ANCHORS — the card's own CTAs are real links, and
      // a trap that saw only <button> would put the whole point of the card
      // (its buttons) out of a keyboard reader's reach.
      const focusables = overlayRef.current?.querySelectorAll<HTMLElement>("a[href], button");
      if (!focusables || focusables.length === 0) return;
      const list = Array.from(focusables);
      const active = document.activeElement as HTMLElement | null;
      const at = active ? list.indexOf(active) : -1;
      const next = e.shiftKey
        ? at <= 0
          ? list[list.length - 1]
          : list[at - 1]
        : at === list.length - 1
          ? list[0]
          : list[at + 1] ?? list[0];
      e.preventDefault();
      next.focus();
    }
  };

  // TitiLinks touch grammar, unchanged: dominant-axis swipe. Horizontal commits
  // a step, a downward swipe closes. Taps fall through untouched, which is what
  // keeps the card's own CTAs tappable inside the modal.
  const onTouchStart = (e: React.TouchEvent) => {
    const tch = e.touches[0];
    touchRef.current = { x: tch.clientX, y: tch.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const tch = e.changedTouches[0];
    const dx = tch.clientX - start.x;
    const dy = tch.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx <= -SWIPE_X_COMMIT) step("next");
      else if (dx >= SWIPE_X_COMMIT) step("prev");
    } else if (dy >= SWIPE_DOWN_COMMIT) {
      onClose();
    }
  };

  if (!open || count === 0) return null;

  const at = ((index % count) + count) % count;
  const item = items[at];

  const entrance = reduced
    ? "lightbox-fade-in 220ms ease-out"
    : dir === "prev"
      ? "lightbox-slide-in-prev 260ms ease-out"
      : dir === "next"
        ? "lightbox-slide-in-next 260ms ease-out"
        : "lightbox-fade-in 220ms ease-out";

  return (
    <div
      ref={overlayRef}
      data-qa="event-lightbox"
      data-index={at}
      data-scale={scale.toFixed(3)}
      role="dialog"
      aria-modal="true"
      aria-label={t("events.lightbox.title")}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 z-[100] outline-none"
      style={{ backgroundColor: GROUND }}
    >
      {/* Click on the dark ground closes; clicks on the card/chrome do not. */}
      <div data-qa="event-lightbox-ground" className="absolute inset-0" onClick={onClose} />

      {/* The stage: the box the card is contained into. `safe center` is the
          overflow insurance the act's own stage carries — when a card is long
          enough to reach the scale floor, the leftover clips at the BOTTOM and
          scrolls, instead of centring the card's heading out through the top. */}
      <div
        ref={stageRef}
        data-qa="event-lightbox-stage"
        // `overflow-x-clip` because an ENLARGED card paints wider than its own
        // layout box, and transformed paint still counts toward scrollable
        // overflow — without it the stage can grow a horizontal scrollbar around
        // a card that visibly fits. The scale is bounded on the width axis too,
        // so this clips nothing that should be seen.
        className="absolute inset-x-4 inset-y-14 flex overflow-y-auto overflow-x-clip md:inset-x-20 md:inset-y-16"
        style={{ alignItems: "safe center", justifyContent: "safe center" }}
      >
        {/* The layout box: exactly as tall as the SCALED card, so the stage
            centres (and, at the floor, scrolls) the thing that is actually
            painted rather than the pre-scale ghost of it. */}
        <div
          className="w-full max-w-3xl"
          style={{ height: fit.height ? fit.height * scale : undefined }}
        >
          {/* The plate hairline is a TABLET+ device, exactly like Room A's
              proscenium and cut on the phone for the same measured reason: the
              phone stage has no gutter to spend on a second frame outside the
              card's own gold border. Above it, the hairline gives the card a
              room to stand in instead of floating on bare ground.
              `relative` is load-bearing: the hairline is absolutely positioned
              and would otherwise frame the nearest positioned ancestor, which is
              the full-screen overlay. */}
          {/* MEASURED HERE, not on the card inside. This box carries the plate's
              own `md:p-6` gutter, and the first cut measured the inner card
              instead — so at tablet and up the contain solved for the card and
              then added 48px of padding back on top, and the result overflowed
              the stage by exactly that much. The thing being fitted has to be
              the thing that is actually drawn. */}
          <div
            ref={cardBoxRef}
            className="relative md:p-6"
            // Scaled from its TOP so the painted card starts where its layout
            // box starts and fills exactly `height` above.
            style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
          >
            <div
              aria-hidden
              data-qa="event-lightbox-plate"
              className="pointer-events-none absolute inset-0 hidden md:block"
              style={{ border: PLATE_HAIRLINE }}
            />
            {/* The entrance lives on its OWN element: the slide keyframes animate
                `transform`, and the contain scale above is also a transform, so
                one element cannot carry both without the animation clobbering the
                fit on every step. */}
            <div key={`${item.id}-${at}`} style={{ animation: entrance }}>
              {/* The full ratified card, in the LIGHTBOX'S room.
                  `roomy` replaces `fillPortrait` here rather than joining it:
                  that prop's job is to fit a card into a page (56vh on a phone,
                  60vh on a portrait tablet), and those caps would win on exactly
                  the screens where the modal has the most room to give. The
                  medium therefore asks for far more height than the act allows,
                  the card overflows the stage, and the contain above scales the
                  whole thing back to fit — poster near the stage's full height,
                  card whole, proportions untouched. */}
              <EventCard item={item} roomy />
            </div>
          </div>
        </div>
      </div>

      {/* Chrome — minimal, in the ivory/gold vocabulary. */}
      <button
        type="button"
        data-qa="event-lightbox-close"
        onClick={onClose}
        aria-label={t("events.lightbox.close")}
        className="absolute right-4 top-4 z-10 p-2 text-[#f4ecdb]/70 transition-colors hover:text-[#C9A55C]"
      >
        <X className="h-6 w-6" strokeWidth={1.25} />
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            data-qa="event-lightbox-prev"
            onClick={() => step("prev")}
            aria-label={t("events.lightbox.prev")}
            className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 p-3 text-[#f4ecdb]/60 transition-colors hover:text-[#C9A55C] md:block"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={1.25} />
          </button>
          <button
            type="button"
            data-qa="event-lightbox-next"
            onClick={() => step("next")}
            aria-label={t("events.lightbox.next")}
            className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 p-3 text-[#f4ecdb]/60 transition-colors hover:text-[#C9A55C] md:block"
          >
            <ChevronRight className="h-8 w-8" strokeWidth={1.25} />
          </button>

          <p
            data-qa="event-lightbox-counter"
            className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-caps"
            style={{ color: "rgba(240,233,218,0.7)", fontSize: "0.7rem", letterSpacing: "0.3em" }}
          >
            {at + 1} / {count}
          </p>
        </>
      )}
    </div>
  );
};

export default EventLightbox;
