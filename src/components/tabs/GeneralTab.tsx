import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from '../Icon';
import { useOptionalDialogContext } from '../../contexts/DialogContext';
import { useLanguage } from '../../hooks/useLanguage';

const GeneralTab: React.FC = () => {
  const { t } = useTranslation();
  const dialog = useOptionalDialogContext();
  const { currentLanguage, changeLanguage, availableLanguages, languageLabels } = useLanguage();

  const handleResetDatabase = async () => {
    let confirmed = false;

    if (dialog) {
      confirmed = await dialog.confirm({
        title: t('generalTab.resetDatabaseTitle'),
        message: t('generalTab.resetDatabaseConfirm'),
        confirmText: t('generalTab.resetButton'),
        cancelText: t('common.cancel'),
        variant: 'danger',
      });
    } else {
      confirmed = window.confirm(t('generalTab.resetDatabaseConfirm'));
    }

    if (confirmed) {
      try {
        if (window.electron) await window.electron.resetDb();
        window.location.reload();
      } catch (error) {
        console.error('Failed to reset database:', error);
        const errorMessage = `${t('generalTab.resetError')} ${error instanceof Error ? error.message : t('generalTab.unknownError')}`;
        if (dialog) {
          await dialog.alert({
            title: t('common.error'),
            message: errorMessage,
            variant: 'danger',
          });
        } else {
          alert(errorMessage);
        }
      }
    }
  };

  return (
    <div className="py-10 space-y-8">
      {/* Language Selection */}
      <div className="text-center space-y-4">
        <h3 className="text-lg font-medium text-slate-800">{t('generalTab.language')}</h3>
        <div className="flex justify-center">
          <select
            value={currentLanguage}
            onChange={(e) => changeLanguage(e.target.value as typeof currentLanguage)}
            className="px-4 py-2 border border-slate-300 rounded-md bg-white text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            aria-label={t('generalTab.selectLanguage')}
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {languageLabels[lang]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Management */}
      <div className="text-center space-y-4">
        <h3 className="text-lg font-medium text-slate-800">{t('generalTab.dataManagement')}</h3>
        <button
          onClick={handleResetDatabase}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          {t('generalTab.resetDatabase')}
        </button>
      </div>
    </div>
  );
};

export default GeneralTab;
