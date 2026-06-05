import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import SmartFilmsCard from "./SmartFilmsCard";
import {
  EVENT_SETTINGS_DEFAULT,
  fetchEventSettings,
  setEventSettings,
  type EventSettings,
} from "./useEventSettings";

const EventsManager = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EventSettings>(EVENT_SETTINGS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEventSettings()
      .then(setForm)
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof EventSettings>(k: K, v: EventSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    try {
      await setEventSettings(form);
      toast({ title: t("admin.events.saved") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.events.saveError");
      toast({ title: t("admin.events.saveError"), description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-lg mb-10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left hover:bg-accent/5 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <div>
            <h2 className="font-serif text-base text-foreground leading-tight">
              {t("admin.events.sectionTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("admin.events.sectionSubtitle")}
            </p>
          </div>
        </div>
        {!loading && (
          <span className="text-xs uppercase tracking-wider text-accent shrink-0">
            {form.visible ? "ON" : "OFF"}
          </span>
        )}
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
            </div>
          ) : (
            <>
              {/* Visibility */}
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                <div className="space-y-1">
                  <Label htmlFor="events-visible" className="text-foreground">
                    {t("admin.events.visibleLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.events.visibleHelp")}
                  </p>
                </div>
                <Switch
                  id="events-visible"
                  checked={form.visible}
                  onCheckedChange={(v) => update("visible", v)}
                />
              </div>

              {/* Fields */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="events-filmTitle">{t("admin.events.filmTitleLabel")}</Label>
                  <Input
                    id="events-filmTitle"
                    value={form.filmTitle}
                    onChange={(e) => update("filmTitle", e.target.value)}
                    placeholder={t("admin.events.filmTitlePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="events-category">{t("admin.events.categoryLabel")}</Label>
                  <Input
                    id="events-category"
                    value={form.category}
                    onChange={(e) => update("category", e.target.value)}
                    placeholder={t("admin.events.categoryPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="events-watchUrl">{t("admin.events.watchUrlLabel")}</Label>
                  <Input
                    id="events-watchUrl"
                    type="url"
                    value={form.watchUrl}
                    onChange={(e) => update("watchUrl", e.target.value)}
                    placeholder={t("admin.events.urlPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="events-voteUrl">{t("admin.events.voteUrlLabel")}</Label>
                  <Input
                    id="events-voteUrl"
                    type="url"
                    value={form.voteUrl}
                    onChange={(e) => update("voteUrl", e.target.value)}
                    placeholder={t("admin.events.urlPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="events-festivalUrl">{t("admin.events.festivalUrlLabel")}</Label>
                  <Input
                    id="events-festivalUrl"
                    type="url"
                    value={form.festivalUrl}
                    onChange={(e) => update("festivalUrl", e.target.value)}
                    placeholder={t("admin.events.urlPlaceholder")}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={onSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("admin.events.saving")}
                    </>
                  ) : (
                    t("admin.events.save")
                  )}
                </Button>
              </div>

              {/* Live preview */}
              <div className="space-y-2 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {t("admin.events.previewLabel")}
                  </h3>
                  {!form.visible && (
                    <span className="text-xs italic text-muted-foreground">
                      {t("admin.events.previewHiddenNote")}
                    </span>
                  )}
                </div>
                <div
                  className="rounded-lg p-6 md:p-10"
                  style={{ backgroundColor: "#0e0c09" }}
                >
                  <SmartFilmsCard data={form} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default EventsManager;
