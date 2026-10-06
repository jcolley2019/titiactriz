import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
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
  /** The path of the page on screen — the URL's, once the outgoing page has left. */
  shownPath: string | null;
  /** Hand the room to the URL's page: AnimatedRoutes calls it when an exit completes. */
  settle: () => void;
};

const SiteThemeContext = createContext<SiteThemeState | null>(null);

/**
 * SITE.THEME.1 — one owner for the site theme, mounted once in App, so the
 * header, the footer and the page under them can never disagree, and so the
 * site_settings channel is opened exactly once.
 *
 * SITE.THEME.1a — the room follows the page on screen, not the URL. The
 * routes' AnimatePresence (mode "wait") keeps the outgoing page mounted
 * through its 300ms fade-out after the URL has already moved, and a room
 * keyed to the URL dropped the paper from under a /blog still fading out (and
 * laid it under a home still fading out, the other way). `shownPath` moves
 * only on `settle`, so the outgoing page leaves in its own theme, header and
 * footer with it, and the next page arrives in its own.
 */
export const SiteThemeProvider = ({ children }: { children: ReactNode }) => {
  const { theme, adopt } = useSiteThemePreference();
  const prefersLight = usePrefersLight();
  const { pathname } = useLocation();
  const [shownPath, setShownPath] = useState(pathname);
  // The URL as of the latest render: an exit that began on one navigation can
  // complete after a second, and the page shown then is the second's.
  const latestPath = useRef(pathname);
  latestPath.current = pathname;
  const settle = useCallback(() => setShownPath(latestPath.current), []);
  const value = useMemo(
    () => ({ theme, resolved: resolveSiteTheme(theme, prefersLight), setTheme: adopt, shownPath, settle }),
    [theme, prefersLight, adopt, shownPath, settle],
  );
  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
};

const FALLBACK: SiteThemeState = {
  theme: SITE_THEME_DEFAULT,
  resolved: "dark",
  setTheme: () => {},
  shownPath: null,
  settle: () => {},
};

export const useSiteTheme = (): SiteThemeState => useContext(SiteThemeContext) ?? FALLBACK;

/** The theme the page ON SCREEN wears, or null where the setting does not reach. */
export const useRoomTheme = (): RoomTheme | null => {
  const { pathname } = useLocation();
  const { resolved, shownPath } = useSiteTheme();
  return isSiteThemeRoute(shownPath ?? pathname) ? resolved : null;
};

/**
 * The app's root wrapper. On a reading page it carries `data-site-theme`, and
 * index.css hangs the light set on that attribute — so the header, the page
 * and the footer below it all take the room's ink and gold together. Off the
 * reading pages there is no attribute at all, and nothing can change. It
 * changes hands only once the outgoing page has faded out (useRoomTheme).
 */
export const SiteFrame = ({ children }: { children: ReactNode }) => {
  const room = useRoomTheme();
  return (
    <div className="flex flex-col min-h-screen" data-site-theme={room ?? undefined}>
      {children}
    </div>
  );
};
