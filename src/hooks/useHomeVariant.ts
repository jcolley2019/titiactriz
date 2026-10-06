import { useEffect, useState, useSyncExternalStore } from "react";
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
 * SITE.THEME.2 — the variant `/` shows, held once for everyone who asks.
 *
 * The site theme reaches `/` only while the home is editorial or classic, so
 * the room (SiteFrame, the header) must know the variant Home renders — the
 * same one, in the same render, or the page and its theme would disagree for a
 * frame. It cannot call useHomeVariant to find out: that hook owns the fetch
 * and the realtime channel, and a second channel on one topic errors
 * (BANNER.TOGGLE.1). So the value lives here: useHomeVariant, Home's, publishes
 * into it, and useShownHomeVariant reads it without touching the network.
 *
 * Read lazily, so the first read sees what Home's first render always saw —
 * the cache, else the built variant.
 */
let shownVariant: HomeVariant | null = null;
const shownListeners = new Set<() => void>();

const getShownVariant = (): HomeVariant => {
  if (shownVariant === null) shownVariant = readCachedVariant() ?? HOME_VARIANT_DEFAULT;
  return shownVariant;
};

const publishVariant = (v: HomeVariant) => {
  // Only a real change notifies, so a matching revalidation never re-renders.
  if (getShownVariant() === v) return;
  shownVariant = v;
  shownListeners.forEach((l) => l());
};

const subscribeShown = (listener: () => void) => {
  shownListeners.add(listener);
  return () => shownListeners.delete(listener);
};

/** The variant `/` renders, read-only: no fetch, no channel, safe in any number of places. */
export const useShownHomeVariant = (): HomeVariant =>
  useSyncExternalStore(subscribeShown, getShownVariant, getShownVariant);

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
 *
 * Call it from ONE place (Home): it opens the channel. Anything else that
 * needs the variant reads useShownHomeVariant.
 */
export const useHomeVariant = (): { variant: HomeVariant; loading: boolean } => {
  const variant = useShownHomeVariant();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Warm the cinematic bundle up front whenever cinematic is even plausible
    // (built or cached), so a render or a live swap lands on the real page.
    if (BUILT_HOME_VARIANT === "cinematic" || readCachedVariant() === "cinematic") preloadHomeCinematic();

    const applyVariant = (v: HomeVariant) => {
      writeCachedVariant(v);
      if (v === "cinematic") preloadHomeCinematic();
      publishVariant(v);
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
