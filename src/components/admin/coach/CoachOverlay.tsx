import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { hasTarget, targetRect, type Rect } from "./targets";
import type { CoachTour } from "./tours";

/**
 * ADMIN.COACH.1 — one tip on screen: everything dimmed except the target
 * (a box-shadow cut-out around its rect), and a card beside it with the step's
 * emoji, title, body, "Paso 2 de 5", Atrás / Siguiente (Listo on the last
 * step) and a quiet Saltar.
 *
 * The overlay takes every click while it is open, so nothing on the page moves
 * underneath a tip. Keys: Esc = Saltar, → / Enter = Siguiente, ← = Atrás.
 * The rect is recomputed on resize, scroll and page changes (a list that loads
 * under the tip; rAF-throttled), and each step scrolls its target into view
 * before it shows.
 */

const PAD = 8; // around the target
const GAP = 12; // between the cut-out and the card
const EDGE = 16; // the card never comes closer to the viewport edge
const HEADER = 112; // the site header is fixed; the admin shell clears it with pt-28
const CARD_W = 360;

/** The viewport without its scrollbar (the site reserves a scrollbar gutter). */
const viewport = () => ({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight });

type Props = {
  tourId: string;
  tour: CoachTour;
  index: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a &&
    !!b &&
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height));

/** The steps whose targets are on the page now, plus the one showing. */
const shownSteps = (tour: CoachTour, index: number) =>
  tour.steps.map((_, i) => i).filter((i) => i === index || hasTarget(tour.steps[i].target));

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Scroll so the target sits clear of the header with room for the card, unless it already does. */
function reveal(id: string, cardH: number) {
  const r = targetRect(id);
  if (!r) return;
  const vh = viewport().h;
  const top = HEADER + PAD;
  const bottom = vh - EDGE - PAD;
  const inView = r.top >= top && r.top + r.height <= bottom;
  const cardFits = r.top + r.height + PAD + GAP + cardH <= vh - EDGE || r.top - PAD - GAP - cardH >= EDGE;
  if (inView && cardFits) return;
  const room = bottom - top;
  const dy =
    r.height + PAD + GAP + cardH <= room
      ? r.top - top // under the header, the card below it
      : r.height <= room
        ? r.top - top - (room - r.height) / 2 // centred
        : r.top - top; // taller than the view: its top under the header
  window.scrollBy({ top: dy, behavior: "instant" });
}

const CoachOverlay = ({ tourId, tour, index, onNext, onBack, onSkip }: Props) => {
  const { t } = useTranslation();
  const step = tour.steps[index];
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(0);
  const [view, setView] = useState(viewport);
  // "Paso n de N" counts the steps whose targets are on the page right now; a
  // list that finishes loading under an open tip grows it.
  const [shown, setShown] = useState(() => shownSteps(tour, index));

  const measure = useCallback(() => {
    const r = targetRect(step.target);
    setRect((prev) => (sameRect(prev, r) ? prev : r));
    const s = shownSteps(tour, index);
    setShown((prev) => (sameList(prev, s) ? prev : s));
    const now = viewport();
    setView((v) => (v.w === now.w && v.h === now.h ? v : now));
  }, [step.target, tour, index]);

  // Each step: bring the target into view, then measure it.
  useLayoutEffect(() => {
    reveal(step.target, cardRef.current?.offsetHeight || 200);
    measure();
  }, [step.target, measure]);

  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          measure();
        });
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-coach"] });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure]);

  // The card's own height decides above or below.
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight ?? 0;
    if (h !== cardH) setCardH(h);
  });

  // Focus the primary button on every step; give focus back when the tip closes.
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [index]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => before?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const card = cardRef.current;
      const take = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === "Escape") {
        take();
        onSkip();
      } else if (e.key === "ArrowRight") {
        take();
        onNext();
      } else if (e.key === "ArrowLeft") {
        take();
        onBack();
      } else if (e.key === "Enter") {
        // A focused card button answers Enter itself (Atrás stays Atrás).
        if (document.activeElement instanceof HTMLButtonElement && card?.contains(document.activeElement)) return;
        take();
        onNext();
      } else if (e.key === "Tab" && card) {
        const items = [...card.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (items.length === 0) return;
        const i = items.indexOf(document.activeElement as HTMLElement);
        take();
        items[e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1].focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onNext, onBack, onSkip]);

  const n = shown.indexOf(index) + 1;
  const first = n === 1;
  const last = n === shown.length;

  const w = Math.min(CARD_W, view.w - 2 * EDGE);
  const hole = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + 2 * PAD,
    height: rect.height + 2 * PAD,
  };
  let top: number;
  if (!hole) top = (view.h - cardH) / 2;
  else if (hole.top + hole.height + GAP + cardH <= view.h - EDGE) top = hole.top + hole.height + GAP;
  else if (hole.top - GAP - cardH >= EDGE) top = hole.top - GAP - cardH;
  else top = view.h - EDGE - cardH;
  top = Math.max(EDGE, Math.min(top, view.h - EDGE - cardH));
  const left = Math.max(EDGE, Math.min(hole ? hole.left : (view.w - w) / 2, view.w - EDGE - w));

  return createPortal(
    <div data-qa="coach-overlay" data-tour={tourId} data-step={step.target} className="fixed inset-0 z-[70]">
      {/* Takes every click while the tip is open. */}
      <div aria-hidden className="absolute inset-0" onMouseDown={(e) => e.preventDefault()} />
      {hole ? (
        <div
          aria-hidden
          data-qa="coach-spotlight"
          className="fixed rounded-lg ring-2 ring-accent/80 pointer-events-none motion-safe:transition-[top,left,width,height] motion-safe:duration-200"
          style={{ ...hole, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.62)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/60 pointer-events-none" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-qa="coach-card"
        className="fixed bg-card text-card-foreground border border-border rounded-lg shadow-2xl p-5 max-h-[calc(100vh-2rem)] overflow-auto"
        style={{ top, left, width: w }}
      >
        <p data-qa="coach-progress" className="text-xs text-muted-foreground tabular-nums">
          {t("admin.coach.ui.progress", { n, total: shown.length })}
        </p>
        <div className="mt-2 flex items-start gap-3">
          <span aria-hidden className="text-2xl leading-none select-none">
            {step.emoji}
          </span>
          <div className="min-w-0">
            <h2 id={titleId} data-qa="coach-title" className="font-serif text-lg leading-snug text-foreground">
              {t(step.titleKey)}
            </h2>
            <p id={bodyId} data-qa="coach-body" className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t(step.bodyKey)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            data-qa="coach-skip"
            onClick={onSkip}
            className="mr-auto text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("admin.coach.ui.skip")}
          </button>
          <Button type="button" variant="ghost" size="sm" data-qa="coach-back" onClick={onBack} disabled={first}>
            {t("admin.coach.ui.back")}
          </Button>
          <Button
            ref={nextRef}
            type="button"
            size="sm"
            data-qa="coach-next"
            onClick={onNext}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {last ? t("admin.coach.ui.done") : t("admin.coach.ui.next")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CoachOverlay;
