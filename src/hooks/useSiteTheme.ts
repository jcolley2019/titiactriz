import { useEffect, useState } from "react";

/**
 * SITE.THEME.1 — the public reading pages' light/dark theme.
 *
 * `site_theme` is a preference: dark, light, or auto (the reader's
 * prefers-color-scheme). It reaches only the pages that paint from the room's
 * variables — /blog, /blog/<slug>, /events and /book — plus the header and
 * footer while one of them is open. The three homes are dark by DESIGN.md,
 * /green-world keeps its own bright grammar, and /admin has ADMIN.THEME.1.
 */
export type SiteTheme = "dark" | "light" | "auto";
/** What a page actually wears once auto has asked the device. */
export type RoomTheme = "dark" | "light";

export const SITE_THEME_DEFAULT: SiteTheme = "dark";

/** localStorage key holding the last resolved preference (the useHomeVariant model). */
export const SITE_THEME_CACHE_KEY = "ta_site_theme";

export const isSiteTheme = (v: unknown): v is SiteTheme => v === "dark" || v === "light" || v === "auto";

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

/** The routes the setting reaches. Everything else is untouched by it. */
export const isSiteThemeRoute = (pathname: string): boolean =>
  pathname === "/blog" ||
  pathname.startsWith("/blog/") ||
  pathname === "/events" ||
  pathname === "/book";

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
