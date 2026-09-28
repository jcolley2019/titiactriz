import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { markSeen, readSeen, resetAll as forgetAll } from "@/lib/coachState";
import CoachOverlay from "./CoachOverlay";
import { hasTarget } from "./targets";
import { TOURS, TOUR_IDS, tourSection } from "./tours";

/**
 * ADMIN.COACH.1 — coaching tips: the first time Titi opens a tab, it walks
 * her through its buttons in order.
 *
 * Mounted inside AdminShell, which hands it the active section and goTo. When
 * a tour of that section is unseen, it starts as soon as its first target is
 * on the page — a MutationObserver watches while the section is active, as the
 * Blog's editor tour waits for an entry to open, not for the tab. One tour at
 * a time; never on the Guía. Finishing or skipping marks the tour seen.
 *
 * `start(id, { force: true })` is "Ver de nuevo": it goes to the tour's
 * section (with the tour's replay intent), waits up to 3 s for the first
 * target, and gives up silently if it never comes.
 *
 * A section can hold the coach (`useCoachHold`): while held, no tour starts,
 * automatic or asked for — the Studio holds it while a generation runs.
 */

type CoachApi = {
  start: (tourId: string, opts?: { force?: boolean }) => boolean;
  skip: () => void;
  next: () => void;
  back: () => void;
  seen: (tourId: string) => boolean;
  resetAll: () => void;
  hold: () => () => void;
};

const CoachContext = createContext<CoachApi>({
  start: () => false,
  skip: () => {},
  next: () => {},
  back: () => {},
  seen: () => false,
  resetAll: () => {},
  hold: () => () => {},
});

export const useCoach = () => useContext(CoachContext);

/** While `active`, no tour may start (the Studio passes `generating`). */
export function useCoachHold(active: boolean) {
  const { hold } = useCoach();
  useEffect(() => (active ? hold() : undefined), [active, hold]);
}

const REPLAY_WAIT_MS = 3000;

type Running = { id: string; index: number };

type Props = {
  userId: string | null;
  section: string;
  goTo: (sectionId: string, data?: unknown) => void;
  children: ReactNode;
};

export const CoachProvider = ({ userId, section, goTo, children }: Props) => {
  const [running, setRunning] = useState<Running | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [holds, setHolds] = useState(0);
  const [version, setVersion] = useState(0);
  const holdsRef = useRef(0);

  const hold = useCallback(() => {
    holdsRef.current += 1;
    setHolds(holdsRef.current);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holdsRef.current -= 1;
      setHolds(holdsRef.current);
    };
  }, []);

  const seen = useCallback((id: string) => !!userId && readSeen(userId).has(id), [userId]);

  /** Show the tour from its first step, if that step's target is on the page. */
  const begin = useCallback((id: string) => {
    if (holdsRef.current > 0 || !hasTarget(TOURS[id].steps[0].target)) return false;
    setRunning({ id, index: 0 });
    return true;
  }, []);

  const close = useCallback(() => {
    if (running && userId) markSeen(userId, running.id);
    setRunning(null);
    setVersion((v) => v + 1);
  }, [running, userId]);

  const next = useCallback(() => {
    if (!running) return;
    const steps = TOURS[running.id].steps;
    for (let j = running.index + 1; j < steps.length; j++) {
      if (hasTarget(steps[j].target)) {
        setRunning({ id: running.id, index: j });
        return;
      }
    }
    close();
  }, [running, close]);

  const back = useCallback(() => {
    if (!running) return;
    const steps = TOURS[running.id].steps;
    for (let j = running.index - 1; j >= 0; j--) {
      if (hasTarget(steps[j].target)) {
        setRunning({ id: running.id, index: j });
        return;
      }
    }
  }, [running]);

  const start = useCallback(
    (id: string, opts: { force?: boolean } = {}) => {
      const tour = TOURS[id];
      if (!tour || running || holdsRef.current > 0) return false;
      if (!opts.force && seen(id)) return false;
      const target = tourSection(id);
      if (target !== section) goTo(target, tour.replay);
      setPending(id);
      return true;
    },
    [running, seen, section, goTo],
  );

  const resetAll = useCallback(() => {
    if (userId) forgetAll(userId);
    setVersion((v) => v + 1);
  }, [userId]);

  // "Ver de nuevo": wait for the tour's section and first target, up to 3 s.
  useEffect(() => {
    if (!pending) return;
    const until = Date.now() + REPLAY_WAIT_MS;
    const timer = window.setInterval(() => {
      if (tourSection(pending) === section && begin(pending)) setPending(null);
      else if (Date.now() > until || holdsRef.current > 0) setPending(null);
    }, 100);
    return () => window.clearInterval(timer);
  }, [pending, section, begin]);

  // First visits: start an unseen tour of this section when its first target shows up.
  useEffect(() => {
    if (!userId || running || pending || holds > 0 || section === "guide") return;
    const done = readSeen(userId);
    const candidates = TOUR_IDS.filter((id) => tourSection(id) === section && !done.has(id));
    if (candidates.length === 0) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      candidates.some((id) => begin(id));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-coach"] });
    schedule();
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [userId, section, running, pending, holds, version, begin]);

  // Leaving the section ends its tour without marking it seen.
  useEffect(() => {
    if (running && tourSection(running.id) !== section) setRunning(null);
  }, [running, section]);

  const api = useMemo<CoachApi>(
    () => ({ start, skip: close, next, back, seen, resetAll, hold }),
    [start, close, next, back, seen, resetAll, hold],
  );

  return (
    <CoachContext.Provider value={api}>
      {children}
      {running && (
        <CoachOverlay
          key={running.id}
          tourId={running.id}
          tour={TOURS[running.id]}
          index={running.index}
          onNext={next}
          onBack={back}
          onSkip={close}
        />
      )}
    </CoachContext.Provider>
  );
};
