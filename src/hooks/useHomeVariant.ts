import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HomeVariant = "editorial" | "classic" | "cinematic";
export const HOME_VARIANT_KEY = "home_variant";
export const HOME_VARIANT_DEFAULT: HomeVariant = "editorial";

/**
 * localStorage key holding the last resolved variant. Lets a repeat visitor
 * render the correct home immediately on first paint instead of flashing the
 * default while the async site_settings fetch is in flight (TA.6c).
 */
export const HOME_VARIANT_CACHE_KEY = "ta_home_variant";

/** How long a true first visit holds on the neutral screen before falling back
 *  to the default, so a network hiccup can never blank the site indefinitely. */
const HOLD_TIMEOUT_MS = 3000;

const parseVariant = (v: unknown): HomeVariant =>
  v === "classic" || v === "editorial" || v === "cinematic" ? v : HOME_VARIANT_DEFAULT;

/** Read the cached variant synchronously; null when absent/invalid/unavailable. */
const readCachedVariant = (): HomeVariant | null => {
  try {
    const v = localStorage.getItem(HOME_VARIANT_CACHE_KEY);
    return v === "classic" || v === "editorial" || v === "cinematic" ? v : null;
  } catch {
    return null;
  }
};

const writeCachedVariant = (v: HomeVariant): void => {
  try {
    localStorage.setItem(HOME_VARIANT_CACHE_KEY, v);
  } catch {
    /* private mode / disabled storage — cache is best-effort */
  }
};

/**
 * Warm the cinematic chunk so a hold ends with the real page instead of a
 * second (blank) Suspense state. Same module specifier the lazy() in Home.tsx
 * uses, so it resolves to the same Vite chunk — the import is deduped.
 */
export const preloadHomeCinematic = (): void => {
  void import("@/pages/HomeCinematic");
};

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

/**
 * Resolve the active home variant without a variant flash.
 *
 * - Repeat visitor (cache present): the cached variant is the initial render —
 *   no hold, no flash — while the fetch revalidates in the background. A
 *   differing result (only right after an admin flip) swaps it live.
 * - True first visit (no cache): `variant` is `null` — the caller shows a
 *   neutral hold — until the fetch resolves to the real variant, or the
 *   HOLD_TIMEOUT_MS fallback fires so a network stall can't blank the site.
 *
 * `variant === null` is the caller's signal to render the neutral hold.
 */
export const useHomeVariant = (): { variant: HomeVariant | null; loading: boolean } => {
  const [variant, setVariant] = useState<HomeVariant | null>(() => readCachedVariant());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const hadCache = readCachedVariant() !== null;

    // Warm the cinematic bundle up front whenever cinematic is even plausible
    // (already cached), so the hold/Suspense resolves straight to the real page.
    if (readCachedVariant() === "cinematic") preloadHomeCinematic();

    // First-visit safety net: if the fetch hasn't answered by HOLD_TIMEOUT_MS,
    // stop holding and fall back to the default. Only armed when there's no
    // cache (a cached visitor is already showing real content, never holding).
    const timer = hadCache
      ? undefined
      : setTimeout(() => {
          if (cancelled) return;
          setVariant((cur) => (cur === null ? HOME_VARIANT_DEFAULT : cur));
          setLoading(false);
        }, HOLD_TIMEOUT_MS);

    const applyVariant = (v: HomeVariant) => {
      writeCachedVariant(v);
      if (v === "cinematic") preloadHomeCinematic();
      // Update only on a real change so a matching revalidation never re-renders.
      setVariant((cur) => (cur === v ? cur : v));
    };

    fetchHomeVariant()
      .then((v) => {
        if (!cancelled) applyVariant(v);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        if (timer) clearTimeout(timer);
      });

    const channel = supabase
      .channel("site_settings_home_variant")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: `key=eq.${HOME_VARIANT_KEY}` },
        (payload) => {
          const next = (payload.new as { value?: unknown } | null)?.value;
          if (next !== undefined && !cancelled) applyVariant(parseVariant(next));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  return { variant, loading };
};
