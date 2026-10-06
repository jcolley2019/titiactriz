import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BUILT_SITE_THEME } from "@/generated/siteTheme";
import type { HomeVariant } from "@/hooks/useHomeVariant";

/**
 * SITE.THEME.1 — the public reading pages' light/dark theme.
 *
 * `site_theme` is a preference: dark, light, or auto (the reader's
 * prefers-color-scheme). It reaches only the pages that paint from the room's
 * variables — /blog, /blog/<slug>, /events and /book — plus the header and
 * footer while one of them is open. /green-world keeps its own bright grammar,
 * and /admin has ADMIN.THEME.1.
 *
 * SITE.THEME.2 — and `/` while it shows the editorial or classic home. The
 * cinematic home is dark-only (DESIGN.md), whatever the setting says.
 */
export type SiteTheme = "dark" | "light" | "auto";
/** What a page actually wears once auto has asked the device. */
export type RoomTheme = "dark" | "light";

export const SITE_THEME_KEY = "site_theme";

/**
 * The preference site_settings held when this build was made
 * (scripts/build-home-variant.mjs, at prebuild) — "dark" while no row exists.
 * Exactly HOME.DEFAULT.1's model: a first visitor with no cache renders it at
 * once, and only an admin flip made after the build can differ.
 */
export const SITE_THEME_DEFAULT: SiteTheme = BUILT_SITE_THEME;

/**
 * localStorage key holding the last resolved preference. It outranks the built
 * one, being newer whenever the admin flipped after the build, and needs no
 * network: nothing on the page waits on the site_settings fetch.
 */
export const SITE_THEME_CACHE_KEY = "ta_site_theme";

export const isSiteTheme = (v: unknown): v is SiteTheme => v === "dark" || v === "light" || v === "auto";

const parseSiteTheme = (v: unknown): SiteTheme => (isSiteTheme(v) ? v : SITE_THEME_DEFAULT);

/** Read the cached preference synchronously; null when absent/invalid/unavailable. */
export const readCachedSiteTheme = (): SiteTheme | null => {
  try {
    const v = localStorage.getItem(SITE_THEME_CACHE_KEY);
    return isSiteTheme(v) ? v : null;
  } catch {
    return null;
  }
};

export const writeCachedSiteTheme = (v: SiteTheme): void => {
  try {
    localStorage.setItem(SITE_THEME_CACHE_KEY, v);
  } catch {
    /* private mode / disabled storage — cache is best-effort */
  }
};

/**
 * The stored preference, or null when the read itself failed. An absent row is
 * an answer ("never flipped" — the default); a failed read is not, so it must
 * not overwrite the cached preference of a reader whose network hiccuped.
 */
export const fetchSiteTheme = async (): Promise<SiteTheme | null> => {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", SITE_THEME_KEY)
    .maybeSingle();
  if (error) return null;
  return parseSiteTheme(data?.value);
};

export const setSiteTheme = async (theme: SiteTheme): Promise<void> => {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: SITE_THEME_KEY, value: theme, updated_at: new Date().toISOString() });
  if (error) throw error;
};

/**
 * The preference, without a hold — useHomeVariant's model exactly:
 *
 * - Repeat visitor (cache present): the cached preference is the first render.
 * - First visit (no cache): the built preference (SITE_THEME_DEFAULT).
 *
 * Either way the fetch still runs and the realtime channel still subscribes: a
 * differing answer (only after an admin flip) is adopted live and cached.
 * `adopt` is also how the admin toggle applies its own write at once.
 *
 * Call it from ONE place (SiteThemeProvider): a second channel on the same
 * topic errors.
 */
export const useSiteThemePreference = (): { theme: SiteTheme; adopt: (theme: SiteTheme) => void } => {
  const [theme, setTheme] = useState<SiteTheme>(() => readCachedSiteTheme() ?? SITE_THEME_DEFAULT);

  const adopt = useCallback((next: SiteTheme) => {
    writeCachedSiteTheme(next);
    // Update only on a real change so a matching revalidation never re-renders.
    setTheme((cur) => (cur === next ? cur : next));
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchSiteTheme().then((v) => {
      if (!cancelled && v) adopt(v);
    });

    const channel = supabase
      .channel("site_settings_site_theme")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: `key=eq.${SITE_THEME_KEY}` },
        (payload) => {
          const next = (payload.new as { value?: unknown } | null)?.value;
          if (next !== undefined && !cancelled) adopt(parseSiteTheme(next));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [adopt]);

  return { theme, adopt };
};

/**
 * The routes the setting reaches. Everything else is untouched by it.
 *
 * SITE.THEME.2 — `/` is one of them only while the home it shows is editorial
 * or classic (`homeVariant`, the variant Home is rendering): never cinematic.
 */
export const isSiteThemeRoute = (pathname: string, homeVariant: HomeVariant): boolean =>
  pathname === "/blog" ||
  pathname.startsWith("/blog/") ||
  pathname === "/events" ||
  pathname === "/book" ||
  (pathname === "/" && (homeVariant === "editorial" || homeVariant === "classic"));

const LIGHT_QUERY = "(prefers-color-scheme: light)";

const prefersLightNow = (): boolean => {
  try {
    return window.matchMedia(LIGHT_QUERY).matches;
  } catch {
    return false;
  }
};

/** The device's colour scheme, live: a reader who flips it mid-visit sees auto follow. */
export const usePrefersLight = (): boolean => {
  const [light, setLight] = useState(prefersLightNow);
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(LIGHT_QUERY);
    } catch {
      return;
    }
    const onChange = () => setLight(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return light;
};

export const resolveSiteTheme = (theme: SiteTheme, prefersLight: boolean): RoomTheme =>
  theme === "auto" ? (prefersLight ? "light" : "dark") : theme;
