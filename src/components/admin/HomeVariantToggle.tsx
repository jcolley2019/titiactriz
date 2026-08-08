import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  fetchHomeVariant,
  setHomeVariant,
  type HomeVariant,
} from "@/hooks/useHomeVariant";

const HomeVariantToggle = () => {
  const { t } = useTranslation();
  const [variant, setVariantState] = useState<HomeVariant | null>(null);
  const [saving, setSaving] = useState<HomeVariant | null>(null);

  const OPTIONS: { value: HomeVariant; label: string; description: string }[] = [
    {
      value: "editorial",
      label: t("admin.homeVariant.editorialLabel"),
      description: t("admin.homeVariant.editorialDesc"),
    },
    {
      value: "classic",
      label: t("admin.homeVariant.classicLabel"),
      description: t("admin.homeVariant.classicDesc"),
    },
    {
      value: "cinematic",
      label: t("admin.homeVariant.cinematicLabel"),
      description: t("admin.homeVariant.cinematicDesc"),
    },
  ];

  useEffect(() => {
    fetchHomeVariant().then(setVariantState);
  }, []);

  const handleSelect = async (next: HomeVariant) => {
    if (next === variant || saving) return;
    setSaving(next);
    try {
      await setHomeVariant(next);
      setVariantState(next);
      toast({
        title: t("admin.homeVariant.updated"),
        description: t("admin.homeVariant.updatedDesc", { variant: next }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.homeVariant.failedFallback");
      toast({ title: t("admin.homeVariant.updateFailed"), description: msg, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="bg-card border border-border rounded-lg mb-10 overflow-hidden">
      <div className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left">
        <div>
          <h2 className="font-serif text-base text-foreground leading-tight">{t("admin.homeVariant.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("admin.homeVariant.subtitle")} <span className="font-mono">/</span>.
          </p>
        </div>
        {variant && (
          <span className="text-xs uppercase tracking-wider text-accent shrink-0">
            {variant}
          </span>
        )}
      </div>

      <div className="px-6 pb-4 grid sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const active = variant === opt.value;
          const isSaving = saving === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              disabled={saving !== null || variant === null}
              className={`text-left rounded-lg border p-4 transition-all ${
                active
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border hover:border-accent/60 hover:bg-accent/5"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between mb-1">
                <Label className="text-foreground text-base cursor-pointer">{opt.label}</Label>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                ) : active ? (
                  <span className="text-xs uppercase tracking-wider text-accent">{t("admin.homeVariant.active")}</span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default HomeVariantToggle;
