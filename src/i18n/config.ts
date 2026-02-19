import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Supported languages
export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'de';

// Language labels for UI display
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
};

// i18next configuration
export const i18nConfig = {
  // Fallback language when translation is missing
  fallbackLng: DEFAULT_LANGUAGE,

  // Supported languages
  supportedLngs: SUPPORTED_LANGUAGES,

  // Default namespace
  defaultNS: 'translation',

  // Available namespaces
  ns: ['translation', 'categories'],

  // Language detection options
  detection: {
    // Order of language detection methods
    order: ['localStorage', 'navigator'],

    // Cache user language in localStorage
    caches: ['localStorage'],

    // LocalStorage key for language preference
    lookupLocalStorage: 'smartmail_language',
  },

  // Backend configuration for loading translation files
  backend: {
    // Path to translation files
    loadPath: '/locales/{{lng}}/{{ns}}.json',
  },

  // React-specific options
  react: {
    // Bind i18n instance to React's Suspense
    useSuspense: false,
  },

  // Interpolation options
  interpolation: {
    // React already escapes values, no need to escape again
    escapeValue: false,
  },

  // Debug mode (disable in production)
  debug: false,
};

// Initialize i18next
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init(i18nConfig);

export default i18n;
