import { useTranslation } from "react-i18next";
import { Clapperboard } from "lucide-react";

/**
 * ADMIN.MEDIA.1 — Cinematic media manager.
 *
 * ITEM 0 ships this as the section scaffold so the shell has a real Media tab;
 * ITEM 3 replaces the body with the slot cards, image picker, framing editor,
 * and device-preview tabs. Kept as its own file so wiring in Admin.tsx is stable
 * across the two commits.
 */
const CinematicMediaManager = () => {
  const { t } = useTranslation();
  return (
    <div data-qa="admin-media" className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-foreground">{t("admin.media.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.media.subtitle")}</p>
      </div>
      <div className="bg-card border border-border rounded-lg px-6 py-14 text-center">
        <Clapperboard className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("admin.media.scaffoldNote")}</p>
      </div>
    </div>
  );
};

export default CinematicMediaManager;
