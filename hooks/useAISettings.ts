import { useState, useEffect } from 'react';
import { AISettings, LLMProvider, AVAILABLE_MODELS } from '../types';

interface UseAISettingsReturn {
  aiSettings: AISettings;
  setAiSettings: (settings: AISettings) => void;
}

const STORAGE_KEY = 'smartmail_ai_settings';

const getDefaultSettings = (): AISettings => ({
  provider: LLMProvider.GEMINI,
  model: AVAILABLE_MODELS[LLMProvider.GEMINI][0],
  apiKey: '',
});

const loadSettingsFromStorage = (): AISettings => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse AI settings', e);
    }
  }
  return getDefaultSettings();
};

export const useAISettings = (): UseAISettingsReturn => {
  const [aiSettings, setAiSettings] = useState<AISettings>(loadSettingsFromStorage);

  // Persist AI Settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(aiSettings));
  }, [aiSettings]);

  return {
    aiSettings,
    setAiSettings,
  };
};
