import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImapAccount, AISettings } from '../types';
import { X, Sparkles } from './Icon';
import AccountsTab from './tabs/AccountsTab';
import SmartSortTab from './tabs/SmartSortTab';
import GeneralTab from './tabs/GeneralTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: ImapAccount[];
  onAddAccount: (account: ImapAccount) => void;
  onRemoveAccount: (id: string) => void;
  // AI Settings
  aiSettings: AISettings;
  onSaveAISettings: (settings: AISettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onAddAccount,
  onRemoveAccount,
  aiSettings,
  onSaveAISettings,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'accounts' | 'smartsort' | 'general'>('accounts');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">{t('settingsModal.title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-slate-50 border-r border-slate-100 p-4 space-y-2">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'accounts' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t('settingsModal.tabs.accounts')}
            </button>
            <button
              onClick={() => setActiveTab('smartsort')}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'smartsort' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {t('settingsModal.tabs.smartSort')}
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'general' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t('settingsModal.tabs.general')}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'accounts' && (
              <AccountsTab accounts={accounts} onAddAccount={onAddAccount} onRemoveAccount={onRemoveAccount} />
            )}

            {activeTab === 'smartsort' && <SmartSortTab aiSettings={aiSettings} onSave={onSaveAISettings} />}

            {activeTab === 'general' && <GeneralTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
