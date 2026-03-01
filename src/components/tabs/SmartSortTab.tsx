import React, { useState, useEffect, useRef } from 'react';
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
  models: string[];
}

/** Settings tab for configuring AI provider, model, and API key for smart email sorting. */
const SmartSortTab: React.FC<SmartSortTabProps> = ({ aiSettings, onSave, saveError }) => {
  const { t } = useTranslation();
  const [tempAISettings, setTempAISettings] = useState<AISettings>(aiSettings);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ available: false, checking: false, models: [] });
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const saveTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Show success feedback only after async save completes without error
  useEffect(() => {
    const token = saveTokenRef.current;
    if (token === 0) return; // no save attempted yet
    if (saveError) {
      setSaved(false);
      return;
    }
    // Save succeeded — show confirmation and start hide timer
    setSaved(true);
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      setSaved(false);
      saveTimerRef.current = null;
    }, 3000);
  }, [saveError, aiSettings]); // aiSettings changes after successful save propagation

  // Store API keys per provider so switching doesn't lose them
  const [apiKeysByProvider, setApiKeysByProvider] = useState<Partial<Record<LLMProvider, string>>>(() => {
    const keys: Partial<Record<LLMProvider, string>> = {};
    if (aiSettings.apiKey) {
      keys[aiSettings.provider] = aiSettings.apiKey;
    }
    return keys;
  });

  // Sync prop changes to internal state
  useEffect(() => {
    setTempAISettings(aiSettings);
    setApiKeysByProvider((prev) => ({ ...prev, [aiSettings.provider]: aiSettings.apiKey || '' }));
  }, [aiSettings]);

  // Detect Ollama and fetch models in a single call
  useEffect(() => {
    if (tempAISettings.provider !== LLMProvider.OLLAMA) {
      setOllamaStatus((prev) => ({ ...prev, models: [], checking: false }));
      return;
    }

    let cancelled = false;
    setOllamaStatus({ available: false, checking: true, models: [] });

    const detectAndFetchModels = async () => {
      try {
        if (!window.electron) {
          setOllamaStatus((prev) => ({ ...prev, checking: false }));
          return;
        }
        const result = await window.electron.ollamaDetect();
        if (cancelled) return;

        const models = result.available ? result.models : [];
        setOllamaStatus({
          available: result.available,
          error: result.error,
          checking: false,
          models,
        });

        // Auto-select first real model if current model isn't installed
        if (models.length > 0) {
          setTempAISettings((prev) => {
            if (!models.includes(prev.model)) {
              return { ...prev, model: models[0] };
            }
            return prev;
          });
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to detect Ollama';
        setOllamaStatus({ available: false, error: message, checking: false, models: [] });
      }
    };

    detectAndFetchModels();
    return () => {
      cancelled = true;
    };
  }, [tempAISettings.provider]);

  const handleSaveAI = () => {
    saveTokenRef.current++;
    setSaved(false);
    onSave(tempAISettings);
  };

  const handleProviderChange = (provider: LLMProvider) => {
    // Save current API key before switching
    if (tempAISettings.provider !== LLMProvider.OLLAMA && tempAISettings.apiKey) {
      setApiKeysByProvider((prev) => ({ ...prev, [tempAISettings.provider]: tempAISettings.apiKey }));
    }
    const defaultModel =
      provider === LLMProvider.OLLAMA && ollamaStatus.models.length > 0
        ? ollamaStatus.models[0]
        : AVAILABLE_MODELS[provider][0];
    setTempAISettings({
      ...tempAISettings,
      provider,
      model: defaultModel,
      apiKey: apiKeysByProvider[provider] || '',
    });
  };

  const availableModels =
    tempAISettings.provider === LLMProvider.OLLAMA && ollamaStatus.models.length > 0
      ? ollamaStatus.models
      : AVAILABLE_MODELS[tempAISettings.provider];

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
            disabled={ollamaStatus.checking}
          >
            {ollamaStatus.checking ? (
              <option>{t('smartSortTab.ollamaFetchingModels')}</option>
            ) : (
              availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            )}
          </select>
        </div>

        {/* API Key */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
            <Key className="w-4 h-4 text-amber-500" />
            {t('smartSortTab.apiKey')}
          </label>
          {tempAISettings.provider === LLMProvider.OLLAMA ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <p className="text-sm text-green-700">{t('smartSortTab.ollamaNoApiKey')}</p>
            </div>
          ) : (
            <>
              <input
                type="password"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none placeholder-slate-400"
                placeholder={
                  tempAISettings.provider === LLMProvider.GEMINI
                    ? 'gen-lang-client-...'
                    : tempAISettings.provider === LLMProvider.ANTHROPIC
                      ? 'sk-ant-...'
                      : 'sk-...'
                }
                value={tempAISettings.apiKey}
                data-testid="api-key-input"
                onChange={(e) => {
                  const newKey = e.target.value;
                  setTempAISettings({ ...tempAISettings, apiKey: newKey });
                  setApiKeysByProvider((prev) => ({ ...prev, [tempAISettings.provider]: newKey }));
                }}
              />
              <p className="text-xs text-slate-500 mt-1">{t('smartSortTab.apiKeyInfo')}</p>
            </>
          )}
        </div>
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
