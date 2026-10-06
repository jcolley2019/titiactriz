import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useSiteTheme } from "@/components/SiteTheme";
import { fetchSiteTheme, setSiteTheme, type SiteTheme } from "@/hooks/useSiteTheme";

const OPTIONS: SiteTheme[] = ["dark", "light", "auto"];

/**
 * SITE.THEME.1 — the reading pages' theme, beside the home variant in Ajustes.
 * A segmented Oscuro | Claro | Automático. A pick writes site_settings
 * `site_theme` and, at once, this browser's cache through the site theme's own
 * `setTheme`, so the next page Titi opens already wears it — no reload, no
 * wait on the realtime echo. Visitors follow on their next fetch or live.
 * SITE.THEME.2 — it reaches the editorial and classic homes too, never the
 * cinematic one, and the copy says so.
 */
const SiteThemeToggle = () => {
  const { t } = useTranslation();
  const { setTheme } = useSiteTheme();
  const [theme, setThemeState] = useState<SiteTheme | null>(null);
  const [saving, setSaving] = useState<SiteTheme | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSiteTheme().then((v) => {
      if (!cancelled) setThemeState(v ?? "dark");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = async (next: SiteTheme) => {
    if (next === theme || saving) return;
    setSaving(next);
    try {
      await setSiteTheme(next);
      setTheme(next);
      setThemeState(next);
      toast({
        title: t("admin.siteTheme.updated"),
        description: t("admin.siteTheme.updatedDesc", { theme: t(`admin.siteTheme.${next}`) }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.siteTheme.failedFallback");
      toast({ title: t("admin.siteTheme.updateFailed"), description: msg, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <section data-qa="site-theme-toggle" className="bg-card border border-border rounded-lg mb-10 overflow-hidden">
      <div className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left">
        <div>
          <h2 id="site-theme-title" className="font-serif text-base text-foreground leading-tight">
            {t("admin.siteTheme.title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("admin.siteTheme.subtitle")}</p>
          {/* SITE.THEME.2 — the setting reaches two of the three homes. */}
          <p data-qa="site-theme-homes" className="text-xs text-muted-foreground">
            {t("admin.siteTheme.homes")}
          </p>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-accent-ink shrink-0" aria-hidden />}
      </div>

      <div className="px-6 pb-4">
        <div
          role="group"
          aria-labelledby="site-theme-title"
          className="flex max-w-md rounded-md border border-border overflow-hidden"
        >
          {OPTIONS.map((opt) => {
            const active = theme === opt;
            return (
              <button
                key={opt}
                type="button"
                data-qa={`site-theme-${opt}`}
                aria-pressed={active}
                onClick={() => handleSelect(opt)}
                disabled={saving !== null || theme === null}
                className={`flex-1 min-h-11 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed ${
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/10 disabled:opacity-60"
                }`}
              >
                {t(`admin.siteTheme.${opt}`)}
              </button>
            );
          })}
        </div>
        {theme && (
          <p data-qa="site-theme-hint" className="mt-2 text-xs text-muted-foreground">
            {t(`admin.siteTheme.${theme}Desc`)}
          </p>
        )}
      </div>
    </section>
  );
};

export default SiteThemeToggle;
