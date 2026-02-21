import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AISettings, LLMProvider, AVAILABLE_MODELS } from '../../types';
import { Bot, Key, Cpu, BrainCircuit } from '../Icon';

interface SmartSortTabProps {
  aiSettings: AISettings;
  onSave: (settings: AISettings) => void;
}

const SmartSortTab: React.FC<SmartSortTabProps> = ({ aiSettings, onSave }) => {
  const { t } = useTranslation();
  const [tempAISettings, setTempAISettings] = useState<AISettings>(aiSettings);

  // Sync prop changes to internal state
  useEffect(() => {
    setTempAISettings(aiSettings);
  }, [aiSettings]);

  const handleSaveAI = () => {
    onSave(tempAISettings);
  };

  const handleProviderChange = (provider: LLMProvider) => {
    setTempAISettings({
      ...tempAISettings,
      provider,
      model: AVAILABLE_MODELS[provider][0], // Reset model to first available
      apiKey: '', // Reset API key on provider switch for safety/clarity
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">{t('smartSortTab.title')}</h3>
          <p className="text-sm text-slate-500">{t('smartSortTab.description')}</p>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-5">
        {/* Provider */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
            <Bot className="w-4 h-4 text-blue-500" />
            {t('smartSortTab.llmProvider')}
          </label>
          <select
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none"
            value={tempAISettings.provider}
            onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
          >
            {Object.values(LLMProvider).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
            <Cpu className="w-4 h-4 text-purple-500" />
            {t('smartSortTab.model')}
          </label>
          <select
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none"
            value={tempAISettings.model}
            onChange={(e) => setTempAISettings({ ...tempAISettings, model: e.target.value })}
          >
            {AVAILABLE_MODELS[tempAISettings.provider].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
            <Key className="w-4 h-4 text-amber-500" />
            {t('smartSortTab.apiKey')}
          </label>
          <input
            type="password"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none placeholder-slate-400"
            placeholder={
              tempAISettings.provider === LLMProvider.GEMINI
                ? t('smartSortTab.apiKeyPlaceholderOptional')
                : t('smartSortTab.apiKeyPlaceholder')
            }
            value={tempAISettings.apiKey}
            onChange={(e) => setTempAISettings({ ...tempAISettings, apiKey: e.target.value })}
          />
          <p className="text-xs text-slate-500 mt-1">
            {tempAISettings.provider === LLMProvider.GEMINI
              ? t('smartSortTab.geminiKeyInfo')
              : t('smartSortTab.apiKeyInfo')}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveAI}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          {t('smartSortTab.saveSettings')}
        </button>
      </div>
    </div>
  );
};

export default SmartSortTab;
