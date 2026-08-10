import type { EventItem } from "@/hooks/useEventsBoard";

/**
 * SNAP.1-FIX-A2 — how the board PACKS, in one place, because there are two
 * rooms that stage it and they drifted apart.
 *
 * A Half card is ALONE on its row when the row it opens has no second Half to
 * fill it — it is the last item, or a Full card (which always takes a whole row
 * to itself) comes next. Walking the items in order is the only way to know:
 * "alone" is a property of the packing, not of the card.
 *
 * ## Why this is shared
 *
 * The same board is staged in two rooms — the /events grid (EventsGrid) and the
 * cinematic act's stage (CinematicEvents' CardField) — and only the first one
 * ever learned this rule. The live board (a Full, then a lone Half) therefore
 * centred on /events and hugged the left on the home page, from the same data,
 * on the same screen. Diagnosing it cost a whole pass: /events measured correct
 * at every width and DPR while Joey's screen plainly showed otherwise, because
 * the two of us were looking at different components.
 *
 * The WALK is shared. The class strings are NOT, and must not be: each room
 * keys its two-up on a different query — /events on `md:landscape:` (its
 * portrait rooms owe one card per screen, SNAP.1), the act on plain `md:` — and
 * Tailwind reads literal source text, so a prefix assembled from a variable
 * would never be generated. Each call site spells its own out, next to a
 * pointer back here.
 */
export const loneHalves = (items: EventItem[]): boolean[] => {
  const lone = items.map(() => false);
  let i = 0;
  while (i < items.length) {
    if (items[i].size === "full") {
      i += 1;
      continue;
    }
    if (items[i + 1] && items[i + 1].size === "half") {
      i += 2; // a pair fills the row
      continue;
    }
    lone[i] = true;
    i += 1;
  }
  return lone;
};
