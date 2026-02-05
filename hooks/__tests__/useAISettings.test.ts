import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAISettings } from '../useAISettings';
import { AISettings, LLMProvider, AVAILABLE_MODELS } from '../../types';

// Mock window.electron
const mockLoadAISettings = vi.fn();
const mockSaveAISettings = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).window = {
  ...global.window,
  electron: {
    loadAISettings: mockLoadAISettings,
    saveAISettings: mockSaveAISettings,
  },
};

describe('useAISettings', () => {
  const mockGeminiSettings: AISettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3-flash-preview',
    apiKey: 'test-gemini-key',
  };

  const mockOpenAISettings: AISettings = {
    provider: LLMProvider.OPENAI,
    model: 'gpt-4o',
    apiKey: 'test-openai-key',
  };

  const mockAnthropicSettings: AISettings = {
    provider: LLMProvider.ANTHROPIC,
    model: 'claude-3-5-sonnet-20240620',
    apiKey: 'test-anthropic-key',
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockLoadAISettings.mockResolvedValue(null);
    mockSaveAISettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial State', () => {
    it('should initialize with default Gemini settings when no saved data exists', async () => {
      mockLoadAISettings.mockResolvedValue(null);

      const { result } = renderHook(() => useAISettings());

      // Wait for the async load to complete
      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      expect(result.current.aiSettings.model).toBe(AVAILABLE_MODELS[LLMProvider.GEMINI][0]);
      expect(result.current.aiSettings.apiKey).toBe('');
      expect(mockLoadAISettings).toHaveBeenCalledTimes(1);
    });

    it('should load settings from IPC when available', async () => {
      mockLoadAISettings.mockResolvedValue(mockOpenAISettings);

      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings).toEqual(mockOpenAISettings);
      });

      expect(mockLoadAISettings).toHaveBeenCalledTimes(1);
    });

    it('should provide all required properties and functions', () => {
      const { result } = renderHook(() => useAISettings());

      expect(result.current).toHaveProperty('aiSettings');
      expect(result.current).toHaveProperty('setAiSettings');
      expect(result.current).toHaveProperty('isLoading');
      expect(typeof result.current.setAiSettings).toBe('function');
      expect(typeof result.current.isLoading).toBe('boolean');
    });

    it('should expose loading state correctly', async () => {
      mockLoadAISettings.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(null), 50)));

      const { result } = renderHook(() => useAISettings());

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);

      // After load completes, should not be loading
      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not overwrite user changes made during async load', async () => {
      // Simulate a slow async load
      mockLoadAISettings.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockGeminiSettings), 100))
      );

      const { result } = renderHook(() => useAISettings());

      // User makes a change before load completes
      await act(async () => {
        result.current.setAiSettings(mockOpenAISettings);
      });

      // Wait for async load to complete
      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // User's OpenAI settings should still be there, not overwritten by loaded Gemini settings
      expect(result.current.aiSettings).toEqual(mockOpenAISettings);
      expect(result.current.aiSettings.provider).toBe(LLMProvider.OPENAI);
    });

    it('should handle IPC load errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadAISettings.mockRejectedValue(new Error('IPC error'));

      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      expect(result.current.aiSettings.model).toBe(AVAILABLE_MODELS[LLMProvider.GEMINI][0]);
      expect(result.current.aiSettings.apiKey).toBe('');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load AI settings', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should migrate from localStorage to IPC on first load', async () => {
      localStorage.setItem('smartmail_ai_settings', JSON.stringify(mockOpenAISettings));
      mockLoadAISettings.mockResolvedValue(null);

      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings).toEqual(mockOpenAISettings);
      });

      expect(mockSaveAISettings).toHaveBeenCalledWith(mockOpenAISettings);
      expect(localStorage.getItem('smartmail_ai_settings')).toBeNull();
    });

    it('should handle corrupted localStorage data during migration', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('smartmail_ai_settings', 'invalid-json{{{');
      mockLoadAISettings.mockResolvedValue(null);

      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to migrate AI settings from localStorage',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('setAiSettings', () => {
    it('should update AI settings to OpenAI', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      await act(async () => {
        result.current.setAiSettings(mockOpenAISettings);
      });

      expect(result.current.aiSettings).toEqual(mockOpenAISettings);

      await vi.waitFor(() => {
        expect(mockSaveAISettings).toHaveBeenCalledWith(mockOpenAISettings);
      });
    });

    it('should update AI settings to Anthropic', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      await act(async () => {
        result.current.setAiSettings(mockAnthropicSettings);
      });

      expect(result.current.aiSettings).toEqual(mockAnthropicSettings);

      await vi.waitFor(() => {
        expect(mockSaveAISettings).toHaveBeenCalledWith(mockAnthropicSettings);
      });
    });

    it('should allow updating individual properties', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      const updatedSettings = {
        ...result.current.aiSettings,
        apiKey: 'new-api-key',
      };

      await act(async () => {
        result.current.setAiSettings(updatedSettings);
      });

      expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      expect(result.current.aiSettings.apiKey).toBe('new-api-key');

      await vi.waitFor(() => {
        expect(mockSaveAISettings).toHaveBeenCalledWith(updatedSettings);
      });
    });

    it('should allow switching providers', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      await act(async () => {
        result.current.setAiSettings(mockGeminiSettings);
      });
      expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);

      await act(async () => {
        result.current.setAiSettings(mockOpenAISettings);
      });
      expect(result.current.aiSettings.provider).toBe(LLMProvider.OPENAI);

      await act(async () => {
        result.current.setAiSettings(mockAnthropicSettings);
      });
      expect(result.current.aiSettings.provider).toBe(LLMProvider.ANTHROPIC);
    });

    it('should allow switching models within same provider', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      const settings1 = {
        provider: LLMProvider.GEMINI,
        model: AVAILABLE_MODELS[LLMProvider.GEMINI][0],
        apiKey: 'test-key',
      };

      await act(async () => {
        result.current.setAiSettings(settings1);
      });
      expect(result.current.aiSettings.model).toBe(AVAILABLE_MODELS[LLMProvider.GEMINI][0]);

      const settings2 = {
        provider: LLMProvider.GEMINI,
        model: AVAILABLE_MODELS[LLMProvider.GEMINI][1],
        apiKey: 'test-key',
      };

      await act(async () => {
        result.current.setAiSettings(settings2);
      });
      expect(result.current.aiSettings.model).toBe(AVAILABLE_MODELS[LLMProvider.GEMINI][1]);
    });

    it('should allow multiple state changes', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      await act(async () => {
        result.current.setAiSettings(mockGeminiSettings);
      });
      expect(result.current.aiSettings).toEqual(mockGeminiSettings);

      await act(async () => {
        result.current.setAiSettings(mockOpenAISettings);
      });
      expect(result.current.aiSettings).toEqual(mockOpenAISettings);

      await act(async () => {
        result.current.setAiSettings(mockAnthropicSettings);
      });
      expect(result.current.aiSettings).toEqual(mockAnthropicSettings);
    });

    it('should handle IPC save errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadAISettings.mockResolvedValue(null);
      mockSaveAISettings.mockRejectedValue(new Error('IPC save error'));

      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      await act(async () => {
        result.current.setAiSettings(mockOpenAISettings);
      });

      expect(result.current.aiSettings).toEqual(mockOpenAISettings);

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save AI settings', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('IPC Persistence', () => {
    it('should persist settings via IPC when changed', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      await act(async () => {
        result.current.setAiSettings(mockOpenAISettings);
      });

      await vi.waitFor(() => {
        expect(mockSaveAISettings).toHaveBeenCalledWith(mockOpenAISettings);
      });
    });

    it('should call IPC save on subsequent changes', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      await act(async () => {
        result.current.setAiSettings(mockGeminiSettings);
      });

      await vi.waitFor(() => {
        expect(mockSaveAISettings).toHaveBeenCalledWith(mockGeminiSettings);
      });

      vi.clearAllMocks();

      await act(async () => {
        result.current.setAiSettings(mockOpenAISettings);
      });

      await vi.waitFor(() => {
        expect(mockSaveAISettings).toHaveBeenCalledWith(mockOpenAISettings);
      });
    });

    it('should not save before initialization completes', async () => {
      mockLoadAISettings.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(null), 100)));

      const { result } = renderHook(() => useAISettings());

      // Should not have called save yet (still loading)
      expect(mockSaveAISettings).not.toHaveBeenCalled();

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      // Still should not have saved (initial load with null doesn't trigger save)
      expect(mockSaveAISettings).not.toHaveBeenCalled();
    });
  });

  describe('Provider and Model Validation', () => {
    it('should accept valid Gemini models', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      for (const model of AVAILABLE_MODELS[LLMProvider.GEMINI]) {
        await act(async () => {
          result.current.setAiSettings({
            provider: LLMProvider.GEMINI,
            model,
            apiKey: 'test-key',
          });
        });

        expect(result.current.aiSettings.model).toBe(model);
      }
    });

    it('should accept valid OpenAI models', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      for (const model of AVAILABLE_MODELS[LLMProvider.OPENAI]) {
        await act(async () => {
          result.current.setAiSettings({
            provider: LLMProvider.OPENAI,
            model,
            apiKey: 'test-key',
          });
        });

        expect(result.current.aiSettings.model).toBe(model);
      }
    });

    it('should accept valid Anthropic models', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      for (const model of AVAILABLE_MODELS[LLMProvider.ANTHROPIC]) {
        await act(async () => {
          result.current.setAiSettings({
            provider: LLMProvider.ANTHROPIC,
            model,
            apiKey: 'test-key',
          });
        });

        expect(result.current.aiSettings.model).toBe(model);
      }
    });
  });

  describe('API Key Handling', () => {
    it('should store and retrieve API keys securely via IPC', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      const settingsWithKey = {
        ...mockGeminiSettings,
        apiKey: 'secure-api-key-123',
      };

      await act(async () => {
        result.current.setAiSettings(settingsWithKey);
      });

      expect(result.current.aiSettings.apiKey).toBe('secure-api-key-123');

      await vi.waitFor(() => {
        expect(mockSaveAISettings).toHaveBeenCalledWith(settingsWithKey);
      });
    });

    it('should handle empty API keys', async () => {
      mockLoadAISettings.mockResolvedValue(null);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      });

      const settingsWithoutKey = {
        ...mockGeminiSettings,
        apiKey: '',
      };

      await act(async () => {
        result.current.setAiSettings(settingsWithoutKey);
      });

      expect(result.current.aiSettings.apiKey).toBe('');
    });

    it('should update API key independently', async () => {
      mockLoadAISettings.mockResolvedValue(mockGeminiSettings);
      const { result } = renderHook(() => useAISettings());

      await vi.waitFor(() => {
        expect(result.current.aiSettings.apiKey).toBe('test-gemini-key');
      });

      const updatedSettings = {
        ...result.current.aiSettings,
        apiKey: 'updated-key',
      };

      await act(async () => {
        result.current.setAiSettings(updatedSettings);
      });

      expect(result.current.aiSettings.apiKey).toBe('updated-key');
      expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      expect(result.current.aiSettings.model).toBe(mockGeminiSettings.model);
    });
  });
});
