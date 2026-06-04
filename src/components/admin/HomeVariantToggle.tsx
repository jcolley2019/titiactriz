import { useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  fetchHomeVariant,
  setHomeVariant,
  type HomeVariant,
} from "@/hooks/useHomeVariant";

const OPTIONS: { value: HomeVariant; label: string; description: string }[] = [
  {
    value: "editorial",
    label: "Editorial",
    description: "New centered layout with animated gold frame.",
  },
  {
    value: "classic",
    label: "Classic",
    description: "Original landing page (HomeClassic).",
  },
];

const HomeVariantToggle = () => {
  const [variant, setVariantState] = useState<HomeVariant | null>(null);
  const [saving, setSaving] = useState<HomeVariant | null>(null);
  const [open, setOpen] = useState(false);

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
        title: "Home page updated",
        description: `Now showing the ${next} variant at /.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(null);
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
            <h2 className="font-serif text-xl text-foreground">Home page variant</h2>
            <p className="text-sm text-muted-foreground">
              Choose which landing page renders at <span className="font-mono">/</span>.
            </p>
          </div>
        </div>
        {variant && (
          <span className="text-xs uppercase tracking-wider text-accent shrink-0">
            {variant}
          </span>
        )}
      </button>

      {open && (
        <div className="px-6 pb-6 grid sm:grid-cols-2 gap-3">
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
                  <span className="text-xs uppercase tracking-wider text-accent">Active</span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </button>
          );
        })}
        </div>
      )}
    </section>
  );
};

export default HomeVariantToggle;
