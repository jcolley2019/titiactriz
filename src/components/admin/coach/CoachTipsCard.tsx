import { useId, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Circle,
  Clapperboard,
  Drama,
  Images,
  Inbox,
  Link2,
  PenLine,
  RotateCcw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCoach } from "./CoachProvider";
import { TOURS, TOUR_IDS, tourSection } from "./tours";

/**
 * ADMIN.COACH.1 — Guía › Consejos.
 *
 * ADMIN.COACH.1c — a card per tour, in tab-bar order (3 columns ≥1280, 2 at
 * 1024, 1 below): the tab's icon, its name, one line on what it is for, the
 * step count, and a check once the tour has been seen. The whole card replays
 * the tour (goes to its tab and starts it). "Reiniciar todos los consejos"
 * under the grid makes each one fire again on the next first visit.
 *
 * ADMIN.COACH.1d — the title row folds the grid and Reiniciar away under a
 * chevron. Open while any tour is unseen, collapsed once all are seen; a
 * manual toggle is remembered (localStorage admin.coach.tipsOpen) and wins
 * over that rule until Reiniciar forgets it. The row is one button: the
 * "Consejos" button inside the heading stretches over the whole row (::after),
 * so the heading stays a heading and a click anywhere on the row toggles.
 */

const TIPS_OPEN_KEY = "admin.coach.tipsOpen";

/** The remembered choice, or null when there is none (or storage is unavailable). */
const readTipsOpen = (): boolean | null => {
  try {
    const v = localStorage.getItem(TIPS_OPEN_KEY);
    return v === "true" ? true : v === "false" ? false : null;
  } catch {
    return null;
  }
};

/** null forgets the choice, so the seen-rule decides again. */
const writeTipsOpen = (open: boolean | null) => {
  try {
    if (open === null) localStorage.removeItem(TIPS_OPEN_KEY);
    else localStorage.setItem(TIPS_OPEN_KEY, String(open));
  } catch {
    /* storage unavailable — the rule decides on the next visit */
  }
};

/** The same lucide icon the tab uses (Admin.tsx adminSections); the editor gets the Blog's pen. */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  gallery: Images,
  media: Clapperboard,
  portfolio: Drama,
  links: Link2,
  events: CalendarDays,
  blog: PenLine,
  blogEditor: PenLine,
  studio: Sparkles,
  settings: Settings2,
  submissions: Inbox,
};

const CoachTipsCard = () => {
  const { t } = useTranslation();
  const coach = useCoach();
  const ids = useId();
  const introId = `${ids}-intro`;
  const bodyId = `${ids}-body`;
  const toggleId = `${ids}-toggle`;
  const [remembered, setRemembered] = useState<boolean | null>(readTipsOpen);

  const seenCount = TOUR_IDS.filter((id) => coach.seen(id)).length;
  const open = remembered ?? seenCount < TOUR_IDS.length;

  // Collapsed is out of reach at once, not when the fade ends (visibility only
  // flips after the transition). React 18 has no inert prop, so set it here.
  const bodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.inert = !open;
  }, [open]);

  const toggle = () => {
    setRemembered(!open);
    writeTipsOpen(!open);
  };

  const reset = () => {
    coach.resetAll();
    setRemembered(null);
    writeTipsOpen(null);
    toast({ title: t("admin.coach.ui.resetDone"), description: t("admin.coach.ui.resetDoneDesc") });
  };

  return (
    <div data-qa="coach-tips" data-open={open ? "true" : "false"} className="px-6 py-4 border-b border-border">
      <div className="group relative flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
            <button
              type="button"
              id={toggleId}
              data-qa="coach-tips-toggle"
              aria-expanded={open}
              aria-controls={bodyId}
              aria-describedby={introId}
              onClick={toggle}
              className="uppercase tracking-[inherit] transition-colors group-hover:text-foreground focus-visible:outline-none after:absolute after:-inset-2 after:rounded-md after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {t("admin.coach.ui.title")}
            </button>
          </h2>
          <p id={introId} className="text-sm text-foreground max-w-[70ch]">
            {t("admin.coach.ui.intro")}
          </p>
        </div>
        {!open && (
          <span data-qa="coach-tips-count" className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {t("admin.coach.ui.seenCount", { seen: seenCount, total: TOUR_IDS.length })}
          </span>
        )}
        <ChevronDown
          data-qa="coach-tips-chevron"
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:text-foreground motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </div>
      <div
        ref={bodyRef}
        id={bodyId}
        role="region"
        aria-labelledby={toggleId}
        data-qa="coach-tips-body"
        // Visibility transitions only on the way out (it holds until the fade ends);
        // on the way in it flips at once, so the cards are reachable immediately.
        className={cn(
          "grid duration-300 ease-out motion-reduce:transition-none",
          open
            ? "visible grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity]"
            : "invisible grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,visibility]",
        )}
      >
        {/* Room for the cards' and Reiniciar's focus rings, which the clip would cut. */}
        <div className="-mx-2 -mb-2 min-h-0 overflow-hidden px-2 pb-2">
          <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {TOUR_IDS.map((id) => {
              const Icon = ICONS[id] ?? ICONS[tourSection(id)] ?? Sparkles;
              const seen = coach.seen(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    data-qa={`coach-replay-${id}`}
                    data-seen={seen ? "true" : "false"}
                    onClick={() => coach.start(id, { force: true })}
                    className="flex h-full w-full items-center gap-3 rounded-md border border-border bg-background p-3 text-left transition-colors hover:border-accent/60 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-ink">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {t(TOURS[id].nameKey ?? `admin.shell.sections.${tourSection(id)}`)}
                      </span>
                      <span className="block text-xs text-muted-foreground">{t(`admin.coach.desc.${id}`)}</span>
                      <span data-qa={`coach-steps-${id}`} className="mt-1 block text-xs text-muted-foreground tabular-nums">
                        {t("admin.coach.ui.steps", { count: TOURS[id].steps.length })}
                      </span>
                    </span>
                    {seen ? (
                      <CheckCircle data-qa={`coach-seen-${id}`} className="h-5 w-5 shrink-0 text-success" aria-hidden />
                    ) : (
                      <Circle data-qa={`coach-unseen-${id}`} className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex sm:justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-qa="coach-reset"
              onClick={reset}
              className="w-full sm:w-auto border-destructive/60 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <RotateCcw aria-hidden />
              {t("admin.coach.ui.resetAll")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachTipsCard;
