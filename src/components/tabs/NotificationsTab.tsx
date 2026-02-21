import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImapAccount, DefaultEmailCategory, CategoryTranslationKey } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';
import { Bell, BellOff } from '../Icon';

const accountColorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
  cyan: 'bg-cyan-500',
  indigo: 'bg-indigo-500',
};

interface NotificationsTabProps {
  accounts: ImapAccount[];
}

const NotificationsTab: React.FC<NotificationsTabProps> = ({ accounts }) => {
  const { t } = useTranslation();
  const { notificationSettings, setNotificationSettings, isLoading } = useNotifications();

  const handleGlobalToggle = () => {
    setNotificationSettings({
      ...notificationSettings,
      enabled: !notificationSettings.enabled,
    });
  };

  const handleAccountToggle = (accountId: string) => {
    const currentValue = notificationSettings.accountSettings[accountId] ?? true;
    setNotificationSettings({
      ...notificationSettings,
      accountSettings: {
        ...notificationSettings.accountSettings,
        [accountId]: !currentValue,
      },
    });
  };

  const handleCategoryToggle = (categoryName: string) => {
    const currentValue = notificationSettings.categorySettings[categoryName] ?? true;
    setNotificationSettings({
      ...notificationSettings,
      categorySettings: {
        ...notificationSettings.categorySettings,
        [categoryName]: !currentValue,
      },
    });
  };

  const getCategoryDisplayName = (category: DefaultEmailCategory): string => {
    const key = CategoryTranslationKey[category];
    return t(`categories.${key}`, { ns: 'categories', defaultValue: category });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="text-slate-500">{t('notificationsTab.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Toggle */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {notificationSettings.enabled ? (
              <Bell className="w-5 h-5 text-blue-600" />
            ) : (
              <BellOff className="w-5 h-5 text-slate-400" />
            )}
            <div>
              <h3 className="font-semibold text-slate-800">{t('notificationsTab.title')}</h3>
              <p className="text-xs text-slate-500 mt-1">{t('notificationsTab.description')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGlobalToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              notificationSettings.enabled ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notificationSettings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Per-Account Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-700">{t('notificationsTab.perAccount')}</h4>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500">{t('notificationsTab.noAccounts')}</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => {
              const isEnabled = notificationSettings.accountSettings[account.id] ?? true;
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${accountColorMap[account.color] || 'bg-slate-500'}`} />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{account.name}</div>
                      <div className="text-xs text-slate-500">{account.email}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAccountToggle(account.id)}
                    disabled={!notificationSettings.enabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      !notificationSettings.enabled
                        ? 'bg-slate-200 cursor-not-allowed'
                        : isEnabled
                          ? 'bg-blue-600'
                          : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Per-Category Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-700">{t('notificationsTab.perCategory')}</h4>
        <p className="text-xs text-slate-500">
          {t('notificationsTab.perCategoryDescription')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(DefaultEmailCategory).map((category) => {
            const isEnabled = notificationSettings.categorySettings[category] ?? true;
            return (
              <label
                key={category}
                className={`flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors ${
                  !notificationSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleCategoryToggle(category)}
                  disabled={!notificationSettings.enabled}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">{getCategoryDisplayName(category)}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-800">
          <strong>{t('common.note')}:</strong> {t('notificationsTab.infoNote')}
        </p>
      </div>
    </div>
  );
};

export default NotificationsTab;
