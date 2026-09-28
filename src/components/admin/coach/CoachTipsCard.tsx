import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  CheckCircle,
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
 */

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

  const reset = () => {
    coach.resetAll();
    toast({ title: t("admin.coach.ui.resetDone"), description: t("admin.coach.ui.resetDoneDesc") });
  };

  return (
    <div data-qa="coach-tips" className="px-6 py-4 border-b border-border">
      <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
        {t("admin.coach.ui.title")}
      </h2>
      <p className="text-sm text-foreground max-w-[70ch]">{t("admin.coach.ui.intro")}</p>
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
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
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
                  <CheckCircle data-qa={`coach-seen-${id}`} className="h-5 w-5 shrink-0 text-green-500" aria-hidden />
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
  );
};

export default CoachTipsCard;
