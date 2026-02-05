import { useState, useEffect, useRef } from 'react';
import { AISettings, LLMProvider, AVAILABLE_MODELS } from '../types';

interface UseAISettingsReturn {
  aiSettings: AISettings;
  setAiSettings: (settings: AISettings) => void;
  isLoading: boolean;
}

const STORAGE_KEY = 'smartmail_ai_settings';

const getDefaultSettings = (): AISettings => ({
  provider: LLMProvider.GEMINI,
  model: AVAILABLE_MODELS[LLMProvider.GEMINI][0],
  apiKey: '',
});

export const useAISettings = (): UseAISettingsReturn => {
  const [aiSettings, setAiSettings] = useState<AISettings>(getDefaultSettings());
  const [isInitialized, setIsInitialized] = useState(false);
  const userModifiedDuringLoad = useRef(false);

  // Load settings from safeStorage on mount, with migration from localStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // First, check if there's existing data in localStorage (migration)
        const localStorageData = localStorage.getItem(STORAGE_KEY);
        if (localStorageData) {
          try {
            const parsedSettings = JSON.parse(localStorageData);
            // Migrate to safeStorage
            await window.electron.saveAISettings(parsedSettings);
            // Remove from localStorage after successful migration
            localStorage.removeItem(STORAGE_KEY);
            // Only apply if user hasn't modified settings during load
            if (!userModifiedDuringLoad.current) {
              setAiSettings(parsedSettings);
            }
            setIsInitialized(true);
            return;
          } catch (e) {
            console.error('Failed to migrate AI settings from localStorage', e);
          }
        }

        // Load from safeStorage
        const savedSettings = await window.electron.loadAISettings();
        // Only apply loaded settings if user hasn't modified them during loading
        if (savedSettings && !userModifiedDuringLoad.current) {
          setAiSettings(savedSettings);
        }
      } catch (error) {
        console.error('Failed to load AI settings', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadSettings();
  }, []);

  // Persist AI Settings to safeStorage whenever they change (after initialization)
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const saveSettings = async () => {
      try {
        await window.electron.saveAISettings(aiSettings);
      } catch (error) {
        console.error('Failed to save AI settings', error);
      }
    };

    saveSettings();
  }, [aiSettings, isInitialized]);

  // Wrapper for setAiSettings that tracks user modifications during load
  const handleSetAiSettings = (settings: AISettings) => {
    if (!isInitialized) {
      userModifiedDuringLoad.current = true;
    }
    setAiSettings(settings);
  };

  return {
    aiSettings,
    setAiSettings: handleSetAiSettings,
    isLoading: !isInitialized,
  };
};
