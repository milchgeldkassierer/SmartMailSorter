import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  type SupportedLanguage,
} from '../i18n';

interface UseLanguageReturn {
  currentLanguage: SupportedLanguage;
  changeLanguage: (lng: SupportedLanguage) => Promise<void>;
  availableLanguages: typeof SUPPORTED_LANGUAGES;
  languageLabels: typeof LANGUAGE_LABELS;
}

export const useLanguage = (): UseLanguageReturn => {
  const { i18n } = useTranslation();

  const currentLanguage = i18n.language as SupportedLanguage;

  const changeLanguage = async (lng: SupportedLanguage): Promise<void> => {
    await i18n.changeLanguage(lng);
  };

  return {
    currentLanguage,
    changeLanguage,
    availableLanguages: SUPPORTED_LANGUAGES,
    languageLabels: LANGUAGE_LABELS,
  };
};
