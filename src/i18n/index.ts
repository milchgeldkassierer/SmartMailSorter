import i18n from './config';

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_LABELS, type SupportedLanguage } from './config';

// Export i18n instance as default and named export for initialization in app entry point
export { i18n };
export default i18n;
