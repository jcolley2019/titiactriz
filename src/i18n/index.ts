import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';

/**
 * Language strategy (TA.6f)
 * -------------------------
 * The initial language is resolved SYNCHRONOUSLY at module import — this file is
 * imported from main.tsx BEFORE ReactDOM renders and the EN/ES dictionaries are
 * bundled inline (not fetched), so the very first paint is already in the right
 * language. There is no effect-based detection and therefore no flash of the
 * wrong language.
 *
 * Priority:
 *   1. localStorage "ta_lang" ("es" | "en") — an explicit manual choice. It is
 *      written by the toggle (setLanguage) and ALWAYS outranks detection.
 *   2. else navigator.language (navigator.languages[0] as fallback): a value
 *      starting with "es" (case-insensitive: es, es-CO, es-MX, es-US, …) → ES;
 *      anything else → EN. Spanish-speaking followers and Titans creators land
 *      in Spanish; everyone else in English — neither needs the toggle.
 *   3. else (no navigator info at all) → ES (her primary market is Spanish-
 *      speaking South America, and crawlers get the indexed Spanish version).
 */

export const LANG_STORAGE_KEY = 'ta_lang';
export type AppLanguage = 'es' | 'en';

/** Collapse any i18next language value down to the two we support. */
const normalizeLang = (lng?: string | null): AppLanguage =>
  (lng ?? '').toLowerCase().startsWith('en') ? 'en' : 'es';

/** An explicit, previously-saved manual choice — the top priority. */
function readStoredLang(): AppLanguage | null {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    /* localStorage may be unavailable (privacy mode / SSR) */
  }
  return null;
}

/** es-* browser → ES, anything else → EN, no navigator info → ES. */
function detectBrowserLang(): AppLanguage {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const primary = nav?.language || nav?.languages?.[0];
  if (!primary) return 'es';
  return primary.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function resolveInitialLang(): AppLanguage {
  return readStoredLang() ?? detectBrowserLang();
}

// Keep <html lang> truthful (TA.6e) so the browser stops offering a
// wrong-direction auto-translate once the visitor is on the right language.
const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalizeLang(lng);
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    // Resolved synchronously from storage/navigator — see resolveInitialLang.
    lng: resolveInitialLang(),
    supportedLngs: ['en', 'es'],
    fallbackLng: 'es',
    interpolation: {
      // React already escapes values by default; this is defense in depth.
      // All translation files contain static developer-controlled content only.
      escapeValue: true,
    },
  });

// Initial load + every subsequent change keep <html lang> in sync.
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

/**
 * Switch the app language from a manual control (the ES/EN toggle).
 * Persists "ta_lang" so the choice outranks browser detection on every later
 * visit, then updates i18next (which syncs <html lang> via the listener above).
 * Call this instead of i18n.changeLanguage directly so persistence never drifts
 * from the switch.
 */
export function setLanguage(lng: AppLanguage) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    /* ignore storage failures; the in-memory switch still applies */
  }
  if (i18n.language?.startsWith(lng)) {
    // Already active (e.g. confirming the detected language): make sure the
    // html tag is right; no languageChanged event will fire on a no-op change.
    syncHtmlLang(lng);
  } else {
    i18n.changeLanguage(lng);
  }
}

export default i18n;
