import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useEventsBoard } from "@/hooks/useEventsBoard";
import { EVENTS_ACT_ENABLED } from "@/lib/ventures";
import { CHAPTER_GROUND_1 } from "./FramedVideo";

/**
 * EVENTS.1 — the Events act, in the Book act's slot: position 5, after the
 * gallery and immediately before Green World.
 *
 * This file is SCAFFOLD. It holds the slot, the data line and the DOM contract
 * so the flow can be asserted; it does NOT hold a composition. The act's real
 * design — what an event tile says and how the act carries 1 to 4 of them —
 * comes from the EVENTS.2 bake-off, along with the uniform dwell wiring, which
 * a dark act has nothing to hold the frame for.
 *
 * ## The late-mount law (CinematicSocials:358-373)
 *
 * The section is in the DOM at EVERY paint — flag off, still loading, zero
 * cards, all of it. It empties rather than returning null, and that distinction
 * is load-bearing rather than stylistic. GSAP pins by WRAPPING an element in a
 * `pin-spacer` div, which moves it out from under React's feet: once a later act
 * has been pinned, React's record of this page's children no longer matches the
 * DOM's, and a section that arrives late is inserted before a sibling that is no
 * longer a child of the same parent — `NotFoundError: Failed to execute
 * 'insertBefore'`, measured on the first build of the Socials act, which took
 * the whole cinematic home down with it when its rows landed.
 *
 * So ScrollTrigger's DOM order holds no matter what this act knows yet, and
 * flipping EVENTS_ACT_ENABLED can never move another act.
 *
 * ## Honest emptiness
 *
 * Lit with zero cards, the act paints NOTHING — no room, no header, no "coming
 * soon", and no height. An act with nothing to show is not an act, and the flag
 * is not a content generator: it opens the door, the `events_board` row decides
 * whether anyone walks through it. Cards are the live realtime row (0-4, capped
 * by the board parser).
 *
 * The placeholder behind the flag is a single eyebrow/heading on the Book act's
 * own ground, reusing the existing `events.title` key — a marker that the slot
 * is wired, not a composition. EVENTS.2 replaces everything below the guard.
 */
const CinematicEvents = ({ reduced }: { reduced: boolean }) => {
  // Accepted for parity with every sibling act, unused in v1: this scaffold
  // builds no timeline and no pin, so reduced motion has nothing to skip yet.
  void reduced;

  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const { board, loading } = useEventsBoard();

  const cards = board.items;

  if (!EVENTS_ACT_ENABLED || loading || cards.length === 0) {
    return <section ref={sectionRef} data-qa="cinematic-events" data-empty="true" aria-hidden />;
  }

  return (
    <section ref={sectionRef} data-qa="cinematic-events" className="relative w-full">
      <div
        data-qa="events-stage"
        data-cards={cards.length}
        className="cine-act-vh relative flex w-full flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-24"
        style={{ backgroundColor: CHAPTER_GROUND_1 }}
      >
        <h2
          data-qa="events-heading"
          className="text-center"
          style={{ fontFamily: "var(--font-display)", color: "#f0e9da" }}
        >
          {t("events.title")}
        </h2>
      </div>
    </section>
  );
};

export default CinematicEvents;
