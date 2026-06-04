import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HomeVariant = "editorial" | "classic";
export const HOME_VARIANT_KEY = "home_variant";
export const HOME_VARIANT_DEFAULT: HomeVariant = "editorial";

const parseVariant = (v: unknown): HomeVariant =>
  v === "classic" || v === "editorial" ? v : HOME_VARIANT_DEFAULT;

export const fetchHomeVariant = async (): Promise<HomeVariant> => {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", HOME_VARIANT_KEY)
    .maybeSingle();
  return parseVariant(data?.value);
};

export const setHomeVariant = async (variant: HomeVariant): Promise<void> => {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: HOME_VARIANT_KEY, value: variant, updated_at: new Date().toISOString() });
  if (error) throw error;
};

export const useHomeVariant = (): { variant: HomeVariant; loading: boolean } => {
  const [variant, setVariant] = useState<HomeVariant>(HOME_VARIANT_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchHomeVariant()
      .then((v) => {
        if (!cancelled) setVariant(v);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const channel = supabase
      .channel("site_settings_home_variant")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: `key=eq.${HOME_VARIANT_KEY}` },
        (payload) => {
          const next = (payload.new as { value?: unknown } | null)?.value;
          if (next !== undefined) setVariant(parseVariant(next));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { variant, loading };
};
