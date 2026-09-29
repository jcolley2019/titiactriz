import { createContext, useContext } from "react";

/**
 * ADMIN.THEME.1 — the whole admin is light (the Studio's Luxe, the default) or
 * dark (the admin as it always was). The /admin page's root wrapper carries
 * `data-admin-theme`; the light tokens live in src/index.css. Remembered in
 * localStorage `admin.theme`, read synchronously on the first render so the
 * page never flashes the other theme.
 */
export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_KEY = "admin.theme";

/** Where the Studio kept its own theme before ADMIN.THEME.1 — adopted once, then removed. */
export const LEGACY_STUDIO_THEME_KEY = "studio.theme";

export function readAdminTheme(): AdminTheme {
  try {
    let stored = localStorage.getItem(ADMIN_THEME_KEY);
    const legacy = localStorage.getItem(LEGACY_STUDIO_THEME_KEY);
    if (stored === null && legacy !== null) {
      stored = legacy === "dark" ? "dark" : "light";
      localStorage.setItem(ADMIN_THEME_KEY, stored);
      localStorage.removeItem(LEGACY_STUDIO_THEME_KEY);
    }
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light"; // storage unavailable — the default
  }
}

export function saveAdminTheme(theme: AdminTheme) {
  try {
    localStorage.setItem(ADMIN_THEME_KEY, theme);
  } catch {
    /* storage unavailable — the choice lasts for this visit */
  }
}

type AdminThemeState = { theme: AdminTheme; flip: () => void };

export const AdminThemeContext = createContext<AdminThemeState>({ theme: "light", flip: () => {} });

export const useAdminTheme = () => useContext(AdminThemeContext);
