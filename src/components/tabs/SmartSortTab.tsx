import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AISettings, LLMProvider, AVAILABLE_MODELS } from '../../types';
import { Bot, Key, Cpu, BrainCircuit, CheckCircle, AlertCircle, RefreshCw } from '../Icon';

interface SmartSortTabProps {
  aiSettings: AISettings;
  onSave: (settings: AISettings) => void;
  saveError?: string | null;
}

interface OllamaStatus {
  available: boolean;
  error?: string;
  checking?: boolean;
}

const SmartSortTab: React.FC<SmartSortTabProps> = ({ aiSettings, onSave, saveError }) => {
  const { t } = useTranslation();
  const [tempAISettings, setTempAISettings] = useState<AISettings>(aiSettings);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ available: false, checking: false });
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync prop changes to internal state
  useEffect(() => {
    setTempAISettings(aiSettings);
  }, [aiSettings]);

  // Detect Ollama connection status on mount and when provider changes to Ollama
  useEffect(() => {
    const detectOllama = async () => {
      // Only check if Ollama is selected or on initial mount
      if (tempAISettings.provider !== LLMProvider.OLLAMA) {
        return;
      }

      setOllamaStatus({ available: false, checking: true });

      try {
        if (window.electron) {
          const result = await window.electron.ollamaDetect();
          setOllamaStatus({
            available: result.available,
            error: result.error,
            checking: false,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to detect Ollama';
        setOllamaStatus({
          available: false,
          error: message,
          checking: false,
        });
      }
    };

    detectOllama();
  }, [tempAISettings.provider]);

  // Fetch available Ollama models when Ollama is available
  useEffect(() => {
    const fetchOllamaModels = async () => {
      if (tempAISettings.provider !== LLMProvider.OLLAMA || !ollamaStatus.available) {
        setOllamaModels([]);
        return;
      }

      setFetchingModels(true);

      try {
        if (window.electron) {
          const models = await window.electron.ollamaListModels();
          setOllamaModels(models);
          // Auto-select first real model if current model isn't installed
          if (models.length > 0) {
            setTempAISettings((prev) => {
              if (!models.includes(prev.model)) {
                return { ...prev, model: models[0] };
              }
              return prev;
            });
          }
        }
      } catch (error) {
        // Fall back to static models on error
        setOllamaModels([]);
      } finally {
        setFetchingModels(false);
      }
    };

    fetchOllamaModels();
  }, [tempAISettings.provider, ollamaStatus.available]);

  const handleSaveAI = () => {
    onSave(tempAISettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleProviderChange = (provider: LLMProvider) => {
    const defaultModel =
      provider === LLMProvider.OLLAMA && ollamaModels.length > 0
        ? ollamaModels[0]
        : AVAILABLE_MODELS[provider][0];
    setTempAISettings({
      ...tempAISettings,
      provider,
      model: defaultModel,
      // Keep existing apiKey when switching between cloud providers; clear only for Ollama
      apiKey: provider === LLMProvider.OLLAMA ? '' : tempAISettings.apiKey,
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

          {/* Ollama Connection Status */}
          {tempAISettings.provider === LLMProvider.OLLAMA && (
            <div className="mt-2 flex items-center gap-2">
              {ollamaStatus.checking ? (
                <>
                  <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-xs text-slate-600">{t('smartSortTab.ollamaDetecting')}</span>
                </>
              ) : ollamaStatus.available ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-700">{t('smartSortTab.ollamaAvailable')}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-700">
                    {t('smartSortTab.ollamaUnavailable')} {ollamaStatus.error && `- ${ollamaStatus.error}`}
                  </span>
                </>
              )}
            </div>
          )}
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
            disabled={fetchingModels}
          >
            {fetchingModels ? (
              <option>{t('smartSortTab.ollamaFetchingModels')}</option>
            ) : (
              (() => {
                // For Ollama: merge fetched models with static fallback
                const availableModels =
                  tempAISettings.provider === LLMProvider.OLLAMA && ollamaModels.length > 0
                    ? ollamaModels
                    : AVAILABLE_MODELS[tempAISettings.provider];

                return availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ));
              })()
            )}
          </select>
        </div>

        {/* API Key */}
        {tempAISettings.provider !== LLMProvider.OLLAMA ? (
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
        ) : (
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Key className="w-4 h-4 text-amber-500" />
              {t('smartSortTab.apiKey')}
            </label>
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <p className="text-sm text-green-700">
                {t('smartSortTab.ollamaNoApiKey')}
              </p>
            </div>
          </div>
        )}
      </div>

      {saveError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}
      {saved && !saveError && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          <p className="text-sm text-green-700">{t('smartSortTab.settingsSaved', 'Settings saved successfully')}</p>
        </div>
      )}
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
