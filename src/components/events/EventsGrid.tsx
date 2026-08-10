import type { EventItem } from "@/hooks/useEventsBoard";
import EventCard from "./EventCard";
import { loneHalves } from "./packing";

/**
 * EVENTS.SNAP.1 — the layout matrix, in one place.
 *
 * Ratified:
 *
 *   PORTRAIT  (phone, portrait tablet)   one column, one card per screen, and
 *                                        the scroll rests each card in the frame
 *                                        the first card arrives in.
 *   LANDSCAPE (landscape tablet, desktop) the admin's Full/Half control decides:
 *                                        Full spans the row, Half pairs two to a
 *                                        row, and a Half left alone on its row
 *                                        centres instead of hugging the left.
 *
 * The old rule keyed the two-up grid on `md:` ALONE, so a portrait tablet split
 * Half cards side by side — measured at 820x1180, two 320px-wide cards on one
 * row, which is the opposite of one-per-screen. Every two-up class below is now
 * `md:landscape:`, so the same board stacks in portrait and pairs in landscape
 * without either room knowing about the other.
 *
 * `snap` is opt-in and the public /events page is the only caller that sets it:
 * the admin's board preview renders the same grammar inside a panel, where a
 * screen-tall card would be nonsense, and the cinematic act never comes through
 * here at all (CinematicEvents imports EventCard directly).
 */

type Props = {
  items: EventItem[];
  lang?: "es" | "en";
  /**
   * EVENTS.NAV.1 — passed straight through to the card: on a portrait tablet
   * the poster is allowed the vertical room the screen actually has. Opt-in,
   * so the cinematic act's rooms keep the geometry they were judged at.
   */
  fillPortrait?: boolean;
  /**
   * EVENTS.VIDEO.1 — the admin's own preview. Passed straight to the card so a
   * medium that could not be rendered names itself where the owner can fix it.
   * The public grid never sets it.
   */
  admin?: boolean;
  /**
   * EVENTS.SNAP.1 — give each card a portrait screen of its own and let the
   * scroll rest on it. Ignored for a single-card board, which is already
   * one-per-screen and whose geometry is ratified to the pixel.
   */
  snap?: boolean;
};

/**
 * The one-per-screen cell. `scroll-mt` is the height of everything above the
 * first card (the page measures it and publishes `--events-snap-top`), so a
 * card snapped to `start` comes to rest exactly where the FIRST card sits at
 * scroll 0 — the dialled-in frame, repeated. `min-h` gives every card the rest
 * of that screen so the next one waits below the fold.
 *
 * `svh`, not `dvh`: the dynamic unit changes as mobile Safari's bars collapse,
 * which would re-lay every cell mid-scroll and drag the snap points around
 * under the reader's thumb. The small viewport is the one that is always true.
 *
 * Written as one literal string because Tailwind reads source text — a class
 * assembled from template pieces would never be generated.
 */
const SNAP_CELL =
  "portrait:snap-start portrait:scroll-mt-[var(--events-snap-top,0px)] " +
  "portrait:min-h-[calc(100svh-var(--events-snap-top,0px))]";

/**
 * Half, alone on its row: hold the row, then take one column's width in it.
 * `md:landscape:` because THIS room's portrait screens owe one card each — see
 * packing.ts on why the walk is shared and these strings are not.
 */
const LONE_HALF = "md:landscape:col-span-2 md:landscape:mx-auto md:landscape:w-[calc(50%-1rem)]";

const EventsGrid = ({ items, lang, fillPortrait, admin, snap }: Props) => {
  // One card is already one-per-screen, and its geometry is ratified to the
  // pixel by events-nav.spec.ts. Nothing is added to that page.
  const snapping = !!snap && items.length > 1;
  const lone = loneHalves(items);

  return (
    <div className="grid grid-cols-1 md:landscape:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
      {items.map((item, i) => {
        const span =
          item.size === "full"
            ? "md:landscape:col-span-2"
            : lone[i]
              ? LONE_HALF
              : "md:landscape:col-span-1";
        const cardEl = (
          <EventCard
            item={item}
            lang={lang}
            fillPortrait={fillPortrait}
            fillCell={snapping}
            admin={admin}
          />
        );
        return (
          <div
            key={item.id}
            data-qa="event-cell"
            className={snapping ? `${span} ${SNAP_CELL}` : span}
          >
            {/*
              EVENTS.SNAP.2 — the card FILLS its cell, gold frame and all.
              EventCard carries `h-full`, so it takes the whole screen-tall cell
              in portrait and matches its neighbour's height on a stretched
              landscape row. Both are wanted.

              SNAP.1 put a plain auto-height div here on purpose, to resolve that
              `100%` back to `auto` and keep the frame exactly the height it has
              on a one-card board — leaving the spare screen empty BELOW the
              frame. The phone gate overruled it: measured on WebKit at Joey's
              440x792 device truth, that left the frame 81px short of the screen
              on card 1 and 116px short on card 2, so no two cards were the same
              height and none of them filled. Joey's ruling is one screen, one
              card, border and all — so the wrapper is gone.
            */}
            {cardEl}
          </div>
        );
      })}
    </div>
  );
};

export default EventsGrid;
