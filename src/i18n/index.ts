import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';

/**
 * Language strategy
 * -----------------
 * 1. If the user previously picked a language, that choice (stored in
 *    localStorage under `i18nextLng`) ALWAYS wins on future loads.
 * 2. Otherwise we look at navigator.language / navigator.languages:
 *      - starts with "es"  -> Spanish
 *      - starts with "en"  -> English
 *      - anything else     -> Spanish (her primary market is Spanish-speaking
 *        South America; the browser's own translate UI handles other locales).
 * 3. Crawlers / no detectable preference -> Spanish (fallbackLng), so the
 *    indexed version of the site stays Spanish.
 * 4. The <html lang> attribute is kept in sync with the active language so
 *    assistive tech and search engines see the correct value.
 */

// Detection order: saved choice first, then browser, then the html tag.
// `caches: ['localStorage']` makes i18next persist the manual toggle choice.
// `supportedLngs` + `nonExplicitSupportedLngs` + `load: 'languageOnly'` map
// regional codes like `es-CO`, `en-US`, `pt-BR` down to the base language;
// anything not in supportedLngs falls through to fallbackLng ('es').
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    supportedLngs: ['en', 'es'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'es',
    interpolation: {
      // React already escapes values by default, but we enable this for defense in depth
      // All translation files contain static developer-controlled content only
      escapeValue: true,
    },
    detection: {
      // localStorage first so the manual toggle choice wins on return visits.
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

// Keep <html lang> in sync with the active language (es | en).
const syncHtmlLang = (lng: string) => {
  const base = (lng || 'es').split('-')[0];
  const normalized = base === 'en' ? 'en' : 'es';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
  }
};

syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
