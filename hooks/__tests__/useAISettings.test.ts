import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAISettings } from '../useAISettings';
import { AISettings, LLMProvider, AVAILABLE_MODELS } from '../../types';

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
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial State', () => {
    it('should initialize with default Gemini settings when no localStorage data exists', () => {
      const { result } = renderHook(() => useAISettings());

      expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      expect(result.current.aiSettings.model).toBe(AVAILABLE_MODELS[LLMProvider.GEMINI][0]);
      expect(result.current.aiSettings.apiKey).toBe('');
    });

    it('should load settings from localStorage when available', () => {
      localStorage.setItem('smartmail_ai_settings', JSON.stringify(mockOpenAISettings));

      const { result } = renderHook(() => useAISettings());

      expect(result.current.aiSettings).toEqual(mockOpenAISettings);
    });

    it('should provide all required properties and functions', () => {
      const { result } = renderHook(() => useAISettings());

      expect(result.current).toHaveProperty('aiSettings');
      expect(result.current).toHaveProperty('setAiSettings');
      expect(typeof result.current.setAiSettings).toBe('function');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('smartmail_ai_settings', 'invalid-json{{{');

      const { result } = renderHook(() => useAISettings());

      expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      expect(result.current.aiSettings.model).toBe(AVAILABLE_MODELS[LLMProvider.GEMINI][0]);
      expect(result.current.aiSettings.apiKey).toBe('');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to parse AI settings', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty object in localStorage', () => {
      localStorage.setItem('smartmail_ai_settings', '{}');

      const { result } = renderHook(() => useAISettings());

      // Should load the empty object from localStorage (not defaults)
      // This tests that localStorage takes precedence
      expect(result.current.aiSettings).toEqual({});
    });
  });

  describe('setAiSettings', () => {
    it('should update AI settings to OpenAI', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings(mockOpenAISettings);
      });

      expect(result.current.aiSettings).toEqual(mockOpenAISettings);
    });

    it('should update AI settings to Anthropic', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings(mockAnthropicSettings);
      });

      expect(result.current.aiSettings).toEqual(mockAnthropicSettings);
    });

    it('should allow updating individual properties', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings({
          ...result.current.aiSettings,
          apiKey: 'new-api-key',
        });
      });

      expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
      expect(result.current.aiSettings.apiKey).toBe('new-api-key');
    });

    it('should allow switching providers', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings(mockGeminiSettings);
      });
      expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);

      act(() => {
        result.current.setAiSettings(mockOpenAISettings);
      });
      expect(result.current.aiSettings.provider).toBe(LLMProvider.OPENAI);

      act(() => {
        result.current.setAiSettings(mockAnthropicSettings);
      });
      expect(result.current.aiSettings.provider).toBe(LLMProvider.ANTHROPIC);
    });

    it('should allow switching models within same provider', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings({
          provider: LLMProvider.GEMINI,
          model: AVAILABLE_MODELS[LLMProvider.GEMINI][0],
          apiKey: 'test-key',
        });
      });
      expect(result.current.aiSettings.model).toBe(AVAILABLE_MODELS[LLMProvider.GEMINI][0]);

      act(() => {
        result.current.setAiSettings({
          provider: LLMProvider.GEMINI,
          model: AVAILABLE_MODELS[LLMProvider.GEMINI][1],
          apiKey: 'test-key',
        });
      });
      expect(result.current.aiSettings.model).toBe(AVAILABLE_MODELS[LLMProvider.GEMINI][1]);
    });

    it('should allow multiple state changes', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings(mockGeminiSettings);
      });
      expect(result.current.aiSettings).toEqual(mockGeminiSettings);

      act(() => {
        result.current.setAiSettings(mockOpenAISettings);
      });
      expect(result.current.aiSettings).toEqual(mockOpenAISettings);

      act(() => {
        result.current.setAiSettings(mockAnthropicSettings);
      });
      expect(result.current.aiSettings).toEqual(mockAnthropicSettings);
    });
  });

  describe('localStorage Persistence', () => {
    it('should persist settings to localStorage when changed', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings(mockOpenAISettings);
      });

      const stored = localStorage.getItem('smartmail_ai_settings');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(mockOpenAISettings);
    });

    it('should update localStorage on subsequent changes', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings(mockGeminiSettings);
      });

      let stored = localStorage.getItem('smartmail_ai_settings');
      expect(JSON.parse(stored!)).toEqual(mockGeminiSettings);

      act(() => {
        result.current.setAiSettings(mockOpenAISettings);
      });

      stored = localStorage.getItem('smartmail_ai_settings');
      expect(JSON.parse(stored!)).toEqual(mockOpenAISettings);
    });

    it('should persist API key changes', () => {
      const { result } = renderHook(() => useAISettings());

      const updatedSettings = {
        ...result.current.aiSettings,
        apiKey: 'updated-api-key',
      };

      act(() => {
        result.current.setAiSettings(updatedSettings);
      });

      const stored = localStorage.getItem('smartmail_ai_settings');
      expect(JSON.parse(stored!).apiKey).toBe('updated-api-key');
    });

    it('should persist on unmount', () => {
      const { result, unmount } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings(mockAnthropicSettings);
      });

      unmount();

      const stored = localStorage.getItem('smartmail_ai_settings');
      expect(JSON.parse(stored!)).toEqual(mockAnthropicSettings);
    });
  });

  describe('Hook Stability', () => {
    it('should maintain setter function reference across renders', () => {
      const { result, rerender } = renderHook(() => useAISettings());

      const firstSetAiSettings = result.current.setAiSettings;

      rerender();

      expect(result.current.setAiSettings).toBe(firstSetAiSettings);
    });

    it('should maintain setter function reference after state changes', () => {
      const { result } = renderHook(() => useAISettings());

      const setAiSettingsRef = result.current.setAiSettings;

      act(() => {
        result.current.setAiSettings(mockOpenAISettings);
      });

      expect(result.current.setAiSettings).toBe(setAiSettingsRef);
    });
  });

  describe('Provider-specific Settings', () => {
    it('should handle Gemini provider with all available models', () => {
      const { result } = renderHook(() => useAISettings());

      AVAILABLE_MODELS[LLMProvider.GEMINI].forEach((model) => {
        act(() => {
          result.current.setAiSettings({
            provider: LLMProvider.GEMINI,
            model,
            apiKey: 'test-key',
          });
        });

        expect(result.current.aiSettings.provider).toBe(LLMProvider.GEMINI);
        expect(result.current.aiSettings.model).toBe(model);
      });
    });

    it('should handle OpenAI provider with all available models', () => {
      const { result } = renderHook(() => useAISettings());

      AVAILABLE_MODELS[LLMProvider.OPENAI].forEach((model) => {
        act(() => {
          result.current.setAiSettings({
            provider: LLMProvider.OPENAI,
            model,
            apiKey: 'test-key',
          });
        });

        expect(result.current.aiSettings.provider).toBe(LLMProvider.OPENAI);
        expect(result.current.aiSettings.model).toBe(model);
      });
    });

    it('should handle Anthropic provider with all available models', () => {
      const { result } = renderHook(() => useAISettings());

      AVAILABLE_MODELS[LLMProvider.ANTHROPIC].forEach((model) => {
        act(() => {
          result.current.setAiSettings({
            provider: LLMProvider.ANTHROPIC,
            model,
            apiKey: 'test-key',
          });
        });

        expect(result.current.aiSettings.provider).toBe(LLMProvider.ANTHROPIC);
        expect(result.current.aiSettings.model).toBe(model);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string API key', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings({
          provider: LLMProvider.GEMINI,
          model: AVAILABLE_MODELS[LLMProvider.GEMINI][0],
          apiKey: '',
        });
      });

      expect(result.current.aiSettings.apiKey).toBe('');
    });

    it('should handle very long API key', () => {
      const { result } = renderHook(() => useAISettings());
      const longKey = 'a'.repeat(1000);

      act(() => {
        result.current.setAiSettings({
          provider: LLMProvider.OPENAI,
          model: AVAILABLE_MODELS[LLMProvider.OPENAI][0],
          apiKey: longKey,
        });
      });

      expect(result.current.aiSettings.apiKey).toBe(longKey);
    });

    it('should restore from localStorage on new hook instance', () => {
      const { result: firstHook } = renderHook(() => useAISettings());

      act(() => {
        firstHook.current.setAiSettings(mockOpenAISettings);
      });

      const { result: secondHook } = renderHook(() => useAISettings());

      expect(secondHook.current.aiSettings).toEqual(mockOpenAISettings);
    });

    it('should handle rapid successive updates', () => {
      const { result } = renderHook(() => useAISettings());

      act(() => {
        result.current.setAiSettings(mockGeminiSettings);
        result.current.setAiSettings(mockOpenAISettings);
        result.current.setAiSettings(mockAnthropicSettings);
      });

      expect(result.current.aiSettings).toEqual(mockAnthropicSettings);
    });
  });
});
