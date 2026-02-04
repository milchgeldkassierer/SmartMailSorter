import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SmartSortTab from '../SmartSortTab';
import { AISettings, LLMProvider, AVAILABLE_MODELS } from '../../../types';

describe('SmartSortTab', () => {
  const mockAISettings: AISettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3-flash-preview',
    apiKey: '',
  };

  const defaultProps = {
    aiSettings: mockAISettings,
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the component title and description', () => {
      render(<SmartSortTab {...defaultProps} />);
      expect(screen.getByText('Smart Sort Konfiguration')).toBeInTheDocument();
      expect(screen.getByText('Wähle die KI, die deine Emails sortiert.')).toBeInTheDocument();
    });

    it('should render provider select with current value', () => {
      render(<SmartSortTab {...defaultProps} />);
      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);
      expect(providerSelect).toBeInTheDocument();
    });

    it('should render all available providers as options', () => {
      render(<SmartSortTab {...defaultProps} />);
      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);
      const options = providerSelect.querySelectorAll('option');

      expect(options).toHaveLength(Object.values(LLMProvider).length);
      expect(options[0]).toHaveTextContent(LLMProvider.GEMINI);
      expect(options[1]).toHaveTextContent(LLMProvider.OPENAI);
      expect(options[2]).toHaveTextContent(LLMProvider.ANTHROPIC);
    });

    it('should render model select with current value', () => {
      render(<SmartSortTab {...defaultProps} />);
      const modelSelect = screen.getByDisplayValue('gemini-3-flash-preview');
      expect(modelSelect).toBeInTheDocument();
    });

    it('should render available models for current provider', () => {
      render(<SmartSortTab {...defaultProps} />);
      const modelSelect = screen.getByDisplayValue('gemini-3-flash-preview');
      const options = modelSelect.querySelectorAll('option');

      expect(options).toHaveLength(AVAILABLE_MODELS[LLMProvider.GEMINI].length);
      expect(options[0]).toHaveTextContent('gemini-3-flash-preview');
      expect(options[1]).toHaveTextContent('gemini-3-pro-preview');
    });

    it('should render API key input with correct placeholder for Gemini', () => {
      render(<SmartSortTab {...defaultProps} />);
      const apiKeyInput = screen.getByPlaceholderText('Optional (verwendet Standard-Key)');
      expect(apiKeyInput).toBeInTheDocument();
      expect(apiKeyInput).toHaveAttribute('type', 'password');
    });

    it('should render API key input with correct placeholder for OpenAI', () => {
      const openAISettings: AISettings = {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o',
        apiKey: '',
      };
      render(<SmartSortTab aiSettings={openAISettings} onSave={vi.fn()} />);
      const apiKeyInput = screen.getByPlaceholderText('sk-...');
      expect(apiKeyInput).toBeInTheDocument();
    });

    it('should render Gemini-specific help text', () => {
      render(<SmartSortTab {...defaultProps} />);
      expect(
        screen.getByText('Für Google Gemini ist bereits ein Demo-Key hinterlegt. Du kannst ihn überschreiben.')
      ).toBeInTheDocument();
    });

    it('should render non-Gemini help text for other providers', () => {
      const openAISettings: AISettings = {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o',
        apiKey: '',
      };
      render(<SmartSortTab aiSettings={openAISettings} onSave={vi.fn()} />);
      expect(
        screen.getByText('Der API Key wird nur lokal im Browser für die Simulation verwendet.')
      ).toBeInTheDocument();
    });

    it('should render save button', () => {
      render(<SmartSortTab {...defaultProps} />);
      expect(screen.getByText('Einstellungen speichern')).toBeInTheDocument();
    });

    it('should render field labels', () => {
      render(<SmartSortTab {...defaultProps} />);
      expect(screen.getByText('LLM Anbieter')).toBeInTheDocument();
      expect(screen.getByText('Modell')).toBeInTheDocument();
      expect(screen.getByText('API Key')).toBeInTheDocument();
    });
  });

  describe('Provider Selection', () => {
    it('should change provider when selected', () => {
      render(<SmartSortTab {...defaultProps} />);
      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);

      fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });

      expect(providerSelect).toHaveValue(LLMProvider.OPENAI);
    });

    it('should reset model to first available when provider changes', () => {
      render(<SmartSortTab {...defaultProps} />);
      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);

      fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });

      const modelSelect = screen.getByDisplayValue(AVAILABLE_MODELS[LLMProvider.OPENAI][0]);
      expect(modelSelect).toBeInTheDocument();
    });

    it('should reset API key when provider changes', () => {
      const settingsWithKey: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-flash-preview',
        apiKey: 'my-api-key-123',
      };
      render(<SmartSortTab aiSettings={settingsWithKey} onSave={vi.fn()} />);

      const apiKeyInput = screen.getByDisplayValue('my-api-key-123') as HTMLInputElement;
      expect(apiKeyInput.value).toBe('my-api-key-123');

      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);
      fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });

      // API key should be reset
      expect(apiKeyInput.value).toBe('');
    });

    it('should update available models when provider changes', () => {
      render(<SmartSortTab {...defaultProps} />);
      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);

      // Initially showing Gemini models
      expect(screen.getByDisplayValue('gemini-3-flash-preview')).toBeInTheDocument();

      // Change to Anthropic
      fireEvent.change(providerSelect, { target: { value: LLMProvider.ANTHROPIC } });

      // Should show Anthropic models
      const modelSelect = screen.getByDisplayValue(AVAILABLE_MODELS[LLMProvider.ANTHROPIC][0]);
      const options = modelSelect.querySelectorAll('option');
      expect(options).toHaveLength(AVAILABLE_MODELS[LLMProvider.ANTHROPIC].length);
    });

    it('should update placeholder and help text when switching from Gemini', () => {
      render(<SmartSortTab {...defaultProps} />);

      // Initially Gemini
      expect(screen.getByPlaceholderText('Optional (verwendet Standard-Key)')).toBeInTheDocument();
      expect(
        screen.getByText('Für Google Gemini ist bereits ein Demo-Key hinterlegt. Du kannst ihn überschreiben.')
      ).toBeInTheDocument();

      // Switch to OpenAI
      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);
      fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });

      // Should show OpenAI placeholder and help text
      expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
      expect(
        screen.getByText('Der API Key wird nur lokal im Browser für die Simulation verwendet.')
      ).toBeInTheDocument();
    });
  });

  describe('Model Selection', () => {
    it('should change model when selected', () => {
      render(<SmartSortTab {...defaultProps} />);
      const modelSelect = screen.getByDisplayValue('gemini-3-flash-preview');

      fireEvent.change(modelSelect, { target: { value: 'gemini-3-pro-preview' } });

      expect(modelSelect).toHaveValue('gemini-3-pro-preview');
    });

    it('should maintain provider when model changes', () => {
      render(<SmartSortTab {...defaultProps} />);
      const modelSelect = screen.getByDisplayValue('gemini-3-flash-preview');

      fireEvent.change(modelSelect, { target: { value: 'gemini-3-pro-preview' } });

      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);
      expect(providerSelect).toHaveValue(LLMProvider.GEMINI);
    });

    it('should show correct models for OpenAI provider', () => {
      const openAISettings: AISettings = {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o',
        apiKey: '',
      };
      render(<SmartSortTab aiSettings={openAISettings} onSave={vi.fn()} />);

      const modelSelect = screen.getByDisplayValue('gpt-4o');
      const options = modelSelect.querySelectorAll('option');

      expect(options).toHaveLength(AVAILABLE_MODELS[LLMProvider.OPENAI].length);
      expect(options[0]).toHaveTextContent('gpt-4o');
      expect(options[1]).toHaveTextContent('gpt-4o-mini');
      expect(options[2]).toHaveTextContent('gpt-4-turbo');
    });

    it('should show correct models for Anthropic provider', () => {
      const anthropicSettings: AISettings = {
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-5-sonnet-20240620',
        apiKey: '',
      };
      render(<SmartSortTab aiSettings={anthropicSettings} onSave={vi.fn()} />);

      const modelSelect = screen.getByDisplayValue('claude-3-5-sonnet-20240620');
      const options = modelSelect.querySelectorAll('option');

      expect(options).toHaveLength(AVAILABLE_MODELS[LLMProvider.ANTHROPIC].length);
      expect(options[0]).toHaveTextContent('claude-3-5-sonnet-20240620');
      expect(options[1]).toHaveTextContent('claude-3-haiku-20240307');
    });
  });

  describe('API Key Input', () => {
    it('should update API key when typing', () => {
      render(<SmartSortTab {...defaultProps} />);
      const apiKeyInput = screen.getByPlaceholderText('Optional (verwendet Standard-Key)') as HTMLInputElement;

      fireEvent.change(apiKeyInput, { target: { value: 'new-api-key-456' } });

      expect(apiKeyInput.value).toBe('new-api-key-456');
    });

    it('should display existing API key value', () => {
      const settingsWithKey: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-flash-preview',
        apiKey: 'existing-key-789',
      };
      render(<SmartSortTab aiSettings={settingsWithKey} onSave={vi.fn()} />);

      const apiKeyInput = screen.getByDisplayValue('existing-key-789');
      expect(apiKeyInput).toBeInTheDocument();
    });

    it('should be password type for security', () => {
      render(<SmartSortTab {...defaultProps} />);
      const apiKeyInput = screen.getByPlaceholderText('Optional (verwendet Standard-Key)');

      expect(apiKeyInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Save Functionality', () => {
    it('should call onSave with current settings when save button clicked', () => {
      const onSave = vi.fn();
      render(<SmartSortTab {...defaultProps} onSave={onSave} />);

      const saveButton = screen.getByText('Einstellungen speichern');
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(mockAISettings);
    });

    it('should call onSave with updated settings after changes', () => {
      const onSave = vi.fn();
      render(<SmartSortTab {...defaultProps} onSave={onSave} />);

      // Make some changes
      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);
      fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });

      const modelSelect = screen.getByDisplayValue(AVAILABLE_MODELS[LLMProvider.OPENAI][0]);
      fireEvent.change(modelSelect, { target: { value: 'gpt-4o-mini' } });

      const apiKeyInput = screen.getByPlaceholderText('sk-...');
      fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key' } });

      // Click save
      const saveButton = screen.getByText('Einstellungen speichern');
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith({
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o-mini',
        apiKey: 'sk-test-key',
      });
    });

    it('should call onSave with correct settings after provider change', () => {
      const onSave = vi.fn();
      render(<SmartSortTab {...defaultProps} onSave={onSave} />);

      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);
      fireEvent.change(providerSelect, { target: { value: LLMProvider.ANTHROPIC } });

      const saveButton = screen.getByText('Einstellungen speichern');
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith({
        provider: LLMProvider.ANTHROPIC,
        model: AVAILABLE_MODELS[LLMProvider.ANTHROPIC][0],
        apiKey: '', // Reset after provider change
      });
    });

    it('should save only model change without affecting other fields', () => {
      const onSave = vi.fn();
      const settingsWithKey: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-flash-preview',
        apiKey: 'my-key-123',
      };
      render(<SmartSortTab aiSettings={settingsWithKey} onSave={onSave} />);

      // Only change model
      const modelSelect = screen.getByDisplayValue('gemini-3-flash-preview');
      fireEvent.change(modelSelect, { target: { value: 'gemini-3-pro-preview' } });

      const saveButton = screen.getByText('Einstellungen speichern');
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith({
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-pro-preview',
        apiKey: 'my-key-123', // Preserved
      });
    });
  });

  describe('Props Synchronization', () => {
    it('should update internal state when aiSettings prop changes', () => {
      const { rerender } = render(<SmartSortTab {...defaultProps} />);

      expect(screen.getByDisplayValue(LLMProvider.GEMINI)).toBeInTheDocument();
      expect(screen.getByDisplayValue('gemini-3-flash-preview')).toBeInTheDocument();

      // Update props
      const newSettings: AISettings = {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o',
        apiKey: 'new-key',
      };
      rerender(<SmartSortTab aiSettings={newSettings} onSave={vi.fn()} />);

      expect(screen.getByDisplayValue(LLMProvider.OPENAI)).toBeInTheDocument();
      expect(screen.getByDisplayValue('gpt-4o')).toBeInTheDocument();
      expect(screen.getByDisplayValue('new-key')).toBeInTheDocument();
    });

    it('should override local changes when props update', () => {
      const { rerender } = render(<SmartSortTab {...defaultProps} />);

      // Make local changes
      const apiKeyInput = screen.getByPlaceholderText('Optional (verwendet Standard-Key)');
      fireEvent.change(apiKeyInput, { target: { value: 'local-change' } });
      expect(screen.getByDisplayValue('local-change')).toBeInTheDocument();

      // Update props (simulating external change)
      const newSettings: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-flash-preview',
        apiKey: 'external-key',
      };
      rerender(<SmartSortTab aiSettings={newSettings} onSave={vi.fn()} />);

      // Local changes should be overridden
      expect(screen.getByDisplayValue('external-key')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('local-change')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty API key', () => {
      render(<SmartSortTab {...defaultProps} />);
      const apiKeyInput = screen.getByPlaceholderText('Optional (verwendet Standard-Key)') as HTMLInputElement;

      expect(apiKeyInput.value).toBe('');

      const saveButton = screen.getByText('Einstellungen speichern');
      fireEvent.click(saveButton);

      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: '' })
      );
    });

    it('should handle rapid provider switches', () => {
      render(<SmartSortTab {...defaultProps} />);
      const providerSelect = screen.getByDisplayValue(LLMProvider.GEMINI);

      // Rapidly switch providers
      fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });
      fireEvent.change(providerSelect, { target: { value: LLMProvider.ANTHROPIC } });
      fireEvent.change(providerSelect, { target: { value: LLMProvider.GEMINI } });

      expect(providerSelect).toHaveValue(LLMProvider.GEMINI);
      expect(screen.getByDisplayValue('gemini-3-flash-preview')).toBeInTheDocument();
    });

    it('should handle special characters in API key', () => {
      const onSave = vi.fn();
      render(<SmartSortTab {...defaultProps} onSave={onSave} />);

      const apiKeyInput = screen.getByPlaceholderText('Optional (verwendet Standard-Key)');
      const specialKey = 'sk-proj-!@#$%^&*()_+-=[]{}|;:,.<>?';
      fireEvent.change(apiKeyInput, { target: { value: specialKey } });

      const saveButton = screen.getByText('Einstellungen speichern');
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: specialKey })
      );
    });
  });
});
