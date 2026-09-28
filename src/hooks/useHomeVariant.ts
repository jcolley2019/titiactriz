import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BUILT_HOME_VARIANT } from "@/generated/homeVariant";

export type HomeVariant = "editorial" | "classic" | "cinematic";
export const HOME_VARIANT_KEY = "home_variant";

/**
 * HOME.DEFAULT.1 — the default is the variant site_settings held when this build
 * was made (scripts/build-home-variant.mjs, at prebuild), not a fixed literal.
 * A first visitor with no cache renders it at once; only an admin flip made
 * after the build can differ, and that swaps live when the fetch answers.
 */
export const HOME_VARIANT_DEFAULT: HomeVariant = BUILT_HOME_VARIANT;

/**
 * localStorage key holding the last resolved variant. Lets a repeat visitor
 * render the variant they last saw — which outranks the built one, being newer
 * whenever the admin flipped after the build — without waiting on the async
 * site_settings fetch (TA.6c).
 */
export const HOME_VARIANT_CACHE_KEY = "ta_home_variant";

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
 * Warm the cinematic chunk so a swap to cinematic, or its Suspense fallback,
 * ends on the real page as early as possible. Same module specifier the lazy()
 * in Home.tsx uses, so it resolves to the same Vite chunk — the import is deduped.
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
 * Resolve the active home variant without a variant flash — and without a hold.
 *
 * - Repeat visitor (cache present): the cached variant is the initial render.
 * - First visit (no cache): the built variant (HOME_VARIANT_DEFAULT) is the
 *   initial render — the live one, unless the admin flipped since the build.
 *
 * Either way the fetch still runs and the realtime channel still subscribes:
 * a differing answer (only after an admin flip) swaps the page live and is
 * written to the cache. `variant` is never null, so nothing waits on the
 * network; Home.tsx's neutral hold survives only as the cinematic chunk's
 * Suspense fallback.
 */
export const useHomeVariant = (): { variant: HomeVariant; loading: boolean } => {
  const [variant, setVariant] = useState<HomeVariant>(() => readCachedVariant() ?? HOME_VARIANT_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Warm the cinematic bundle up front whenever cinematic is even plausible
    // (built or cached), so a render or a live swap lands on the real page.
    if (BUILT_HOME_VARIANT === "cinematic" || readCachedVariant() === "cinematic") preloadHomeCinematic();

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
        if (!cancelled) setLoading(false);
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
      supabase.removeChannel(channel);
    };
  }, []);

  return { variant, loading };
};
