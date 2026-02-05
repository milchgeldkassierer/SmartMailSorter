import { useState, useEffect, useRef } from 'react';
import { AISettings, LLMProvider, AVAILABLE_MODELS } from '../types';

interface SaveStatus {
  encrypted?: boolean;
  warning?: string;
}

interface UseAISettingsReturn {
  aiSettings: AISettings;
  setAiSettings: (settings: AISettings) => void;
  isLoading: boolean;
  saveError: string | null;
  saveStatus: SaveStatus | null;
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const userModifiedDuringLoad = useRef(false);
  const migratedDuringLoad = useRef(false);

  // Load settings from safeStorage on mount, with migration from localStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // First, check if there's existing data in localStorage (migration)
        const localStorageData = localStorage.getItem(STORAGE_KEY);
        if (localStorageData) {
          let parsedSettings: AISettings | null = null;
          try {
            parsedSettings = JSON.parse(localStorageData);
          } catch (e) {
            console.error('Failed to parse localStorage AI settings', e);
            // Clear corrupted localStorage entry to prevent repeated errors
            localStorage.removeItem(STORAGE_KEY);
          }

          if (parsedSettings) {
            // Migrate to safeStorage
            if (window.electron) {
              try {
                await window.electron.saveAISettings(parsedSettings);
                // Only remove from localStorage after successful migration
                localStorage.removeItem(STORAGE_KEY);
                migratedDuringLoad.current = true;
              } catch (e) {
                console.error('Failed to migrate AI settings to safeStorage', e);
                // Preserve localStorage - don't remove it since safeStorage save failed
              }
            }
            // Only apply if user hasn't modified settings during load
            if (!userModifiedDuringLoad.current) {
              setAiSettings(parsedSettings);
            }
            setIsInitialized(true);
            return;
          }
        }

        // Load from safeStorage
        if (window.electron) {
          const savedSettings = await window.electron.loadAISettings();
          // Only apply loaded settings if user hasn't modified them during loading
          if (savedSettings && !userModifiedDuringLoad.current) {
            setAiSettings(savedSettings);
          }
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

    // Skip redundant save if we just migrated (data is already saved)
    if (migratedDuringLoad.current) {
      migratedDuringLoad.current = false;
      return;
    }

    const saveSettings = async () => {
      try {
        if (window.electron) {
          const result = await window.electron.saveAISettings(aiSettings);
          setSaveError(null);
          setSaveStatus({
            encrypted: result?.encrypted,
            warning: result?.warning,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save AI settings';
        console.error('Failed to save AI settings', error);
        setSaveError(message);
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
    saveError,
    saveStatus,
  };
};
