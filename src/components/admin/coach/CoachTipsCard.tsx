import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useCoach } from "./CoachProvider";
import { TOURS, TOUR_IDS, tourSection } from "./tours";

/**
 * ADMIN.COACH.1 — Guía › Consejos: every tour with "Ver de nuevo" (goes to its
 * tab and starts it), and "Reiniciar todos los consejos" so each one fires
 * again on the next first visit.
 */
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
      <ul className="mt-3 flex flex-wrap gap-2">
        {TOUR_IDS.map((id) => (
          <li key={id} className="flex items-center gap-1 rounded-md border border-border py-1 pl-3 pr-1">
            <span className="text-sm text-foreground">
              {t(TOURS[id].nameKey ?? `admin.shell.sections.${tourSection(id)}`)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              data-qa={`coach-replay-${id}`}
              onClick={() => coach.start(id, { force: true })}
              className="h-7 px-2 text-accent hover:text-accent"
            >
              {t("admin.coach.ui.replay")}
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="link"
        data-qa="coach-reset"
        onClick={reset}
        className="mt-2 h-auto px-0 text-muted-foreground hover:text-foreground"
      >
        {t("admin.coach.ui.resetAll")}
      </Button>
    </div>
  );
};

export default CoachTipsCard;
