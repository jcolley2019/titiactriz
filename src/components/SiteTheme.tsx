import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  SITE_THEME_DEFAULT,
  isSiteThemeRoute,
  resolveSiteTheme,
  usePrefersLight,
  useSiteThemePreference,
  type RoomTheme,
  type SiteTheme,
} from "@/hooks/useSiteTheme";

type SiteThemeState = {
  /** The preference as stored: dark | light | auto. */
  theme: SiteTheme;
  /** The preference resolved against the device (auto → its colour scheme). */
  resolved: RoomTheme;
  /** Adopt a new preference at once and cache it (the admin toggle's local half). */
  setTheme: (theme: SiteTheme) => void;
};

const SiteThemeContext = createContext<SiteThemeState | null>(null);

/**
 * SITE.THEME.1 — one owner for the site theme, mounted once in App, so the
 * header, the footer and the page under them can never disagree, and so the
 * site_settings channel is opened exactly once.
 */
export const SiteThemeProvider = ({ children }: { children: ReactNode }) => {
  const { theme, adopt } = useSiteThemePreference();
  const prefersLight = usePrefersLight();
  const value = useMemo(
    () => ({ theme, resolved: resolveSiteTheme(theme, prefersLight), setTheme: adopt }),
    [theme, prefersLight, adopt],
  );
  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
};

const FALLBACK: SiteThemeState = { theme: SITE_THEME_DEFAULT, resolved: "dark", setTheme: () => {} };

export const useSiteTheme = (): SiteThemeState => useContext(SiteThemeContext) ?? FALLBACK;

/** The theme the CURRENT route wears, or null where the setting does not reach. */
export const useRoomTheme = (): RoomTheme | null => {
  const { pathname } = useLocation();
  const { resolved } = useSiteTheme();
  return isSiteThemeRoute(pathname) ? resolved : null;
};

/**
 * The app's root wrapper. On a reading page it carries `data-site-theme`, and
 * index.css hangs the light set on that attribute — so the header, the page
 * and the footer below it all take the room's ink and gold together. Off the
 * reading pages there is no attribute at all, and nothing can change.
 */
export const SiteFrame = ({ children }: { children: ReactNode }) => {
  const room = useRoomTheme();
  return (
    <div className="flex flex-col min-h-screen" data-site-theme={room ?? undefined}>
      {children}
    </div>
  );
};
