import { useTranslation } from "react-i18next";
import { Inbox } from "lucide-react";

/**
 * ADMIN.MEDIA.1 (ITEM 0) — Submissions section placeholder.
 *
 * There is no submissions-management UI on main yet (the public contact forms
 * post to the send-contact edge function; nothing surfaces them in the admin).
 * The shell reserves the section with an honest empty state; a later sprint can
 * drop the real list in here without touching the shell.
 */
const AdminSubmissionsSection = () => {
  const { t } = useTranslation();
  return (
    <div
      data-qa="admin-submissions-empty"
      className="bg-card border border-border rounded-lg px-6 py-14 text-center"
    >
      <Inbox className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="font-serif text-lg text-foreground">
        {t("admin.shell.submissionsEmptyTitle")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {t("admin.shell.submissionsEmptyBody")}
      </p>
    </div>
  );
};

export default AdminSubmissionsSection;
