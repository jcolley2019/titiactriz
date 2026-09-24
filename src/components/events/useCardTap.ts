import { useCallback, useRef } from "react";

/**
 * EVENTS.ACT.CAROUSEL.1 — the tap grammar for an event card, shared by the
 * carousel's cells and by the single-card board.
 *
 * It lives in its own module, apart from the carousel it was written for, for a
 * load reason rather than a taste one: the act keeps its card grammar behind a
 * lazy import so a DARK act costs the home page nothing (CinematicEvents' own
 * note — the Socials act measured what happens otherwise). The stage has to
 * reach this hook from the eager path, and a static import of the carousel would
 * drag EventCard back onto every page load with it.
 *
 * ## Why a card cannot simply BE a button
 *
 * An EventCard contains anchors — its CTAs — and, for a social medium, a play
 * button. Nesting interactive elements inside a button is invalid HTML and
 * unusable with a screen reader or a keyboard. So the CELL is the control: a
 * `role="button"` div with a real accessible name, Enter/Space handling, and two
 * filters on its click:
 *
 *   - anything originating inside a link or button is left alone, so a CTA still
 *     follows its own href instead of opening a modal on top of it;
 *   - anything that moved too far or dwelt too long is not a tap, so the end of a
 *     swipe on the carousel is never mistaken for a decision to open a card.
 */

/** A click is a TAP, not the end of a swipe, only within these bounds. */
const TAP_SLOP_PX = 10;
const TAP_MS = 500;

export const useCardTap = (onOpen: (index: number) => void) => {
  const down = useRef<{ x: number; y: number; t: number } | null>(null);

  return useCallback(
    (index: number, label: string) => ({
      role: "button" as const,
      tabIndex: 0,
      "aria-label": label,
      onPointerDown: (e: React.PointerEvent) => {
        down.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      },
      onClick: (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        const d = down.current;
        if (d) {
          const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
          if (moved > TAP_SLOP_PX || Date.now() - d.t > TAP_MS) return;
        }
        onOpen(index);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if ((e.target as HTMLElement).closest("a,button")) return;
        e.preventDefault();
        onOpen(index);
      },
    }),
    [onOpen],
  );
};
