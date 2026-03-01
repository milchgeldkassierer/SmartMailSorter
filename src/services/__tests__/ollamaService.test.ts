import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { categorizeEmailWithAI, categorizeBatchWithAI, parseNaturalLanguageQuery } from '../geminiService';
import { LLMProvider, DefaultEmailCategory, Email, AISettings, INBOX_FOLDER } from '../../types';

// Mock window.electron.aiCall (Ollama/OpenAI/Anthropic now route through IPC)
const mockAiCall = vi.fn();

// Keep fetch mock for backward compat tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

Object.defineProperty(global, 'window', {
  value: {
    electron: {
      aiCall: mockAiCall,
    },
  },
  writable: true,
});

describe('Ollama Integration Tests', () => {
  const mockSettings: AISettings = {
    provider: LLMProvider.OLLAMA,
    model: 'llama3',
    apiKey: '', // Ollama doesn't need an API key
  };

  const mockEmail: Email = {
    id: 'test-email-1',
    sender: 'Amazon',
    senderEmail: 'noreply@amazon.com',
    subject: 'Your Order Confirmation',
    body: 'Thank you for your order. Your package will arrive soon.',
    date: new Date().toISOString(),
    category: DefaultEmailCategory.INBOX,
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: false,
  };

  beforeEach(() => {
    mockAiCall.mockClear();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('callLLM with Ollama Provider (via IPC)', () => {
    it('should successfully call AI via IPC for email categorization', async () => {
      mockAiCall.mockResolvedValue([
        {
          id: 'test-email-1',
          category: 'Bestellungen',
          summary: 'Amazon Bestellbestätigung',
        },
      ]);

      const result = await categorizeEmailWithAI(mockEmail, ['Bestellungen', 'Newsletter'], mockSettings);

      expect(mockAiCall).toHaveBeenCalledWith({
        systemInstruction: expect.any(String),
        userPrompt: expect.stringContaining('Sortiere'),
      });

      expect(result.categoryId).toBe('Bestellungen');
      expect(result.summary).toBe('Amazon Bestellbestätigung');
    });

    it('should handle API error responses gracefully', async () => {
      mockAiCall.mockRejectedValue(new Error('Ollama API error (500): Internal Server Error'));

      const result = await categorizeEmailWithAI(mockEmail, ['Bestellungen'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
      expect(result.reasoning).toContain('Batch API Error');
    });

    it('should handle network errors when Ollama is unavailable', async () => {
      mockAiCall.mockRejectedValue(new Error('fetch failed'));

      const result = await categorizeEmailWithAI(mockEmail, ['Bestellungen'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
      expect(result.reasoning).toContain('Batch API Error');
    });

    it('should handle empty response from IPC', async () => {
      mockAiCall.mockResolvedValue(null);

      const result = await categorizeEmailWithAI(mockEmail, ['Bestellungen'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });

    it('should handle malformed JSON response', async () => {
      mockAiCall.mockResolvedValue('This is not an array or object');

      const result = await categorizeEmailWithAI(mockEmail, ['Bestellungen'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });
  });

  describe('Batch Processing with Ollama', () => {
    const mockEmails: Email[] = [
      {
        id: 'email-1',
        sender: 'Amazon',
        senderEmail: 'noreply@amazon.com',
        subject: 'Order Confirmation',
        body: 'Your order has been confirmed.',
        date: new Date().toISOString(),
        category: DefaultEmailCategory.INBOX,
        folder: INBOX_FOLDER,
        isRead: false,
        isFlagged: false,
      },
      {
        id: 'email-2',
        sender: 'LinkedIn',
        senderEmail: 'noreply@linkedin.com',
        subject: 'New Job Opportunities',
        body: 'Check out these new job postings.',
        date: new Date().toISOString(),
        category: DefaultEmailCategory.INBOX,
        folder: INBOX_FOLDER,
        isRead: false,
        isFlagged: false,
      },
    ];

    it('should process multiple emails in batch', async () => {
      mockAiCall.mockResolvedValue({
        results: [
          { id: 'email-1', category: 'Bestellungen', summary: 'Amazon Order' },
          { id: 'email-2', category: 'Jobs', summary: 'LinkedIn Job Alert' },
        ],
      });

      const results = await categorizeBatchWithAI(mockEmails, ['Bestellungen', 'Jobs'], mockSettings);

      expect(results).toHaveLength(2);
      expect(results[0].categoryId).toBe('Bestellungen');
      expect(results[1].categoryId).toBe('Jobs');
    });

    it('should handle wrapped object response with results array', async () => {
      mockAiCall.mockResolvedValue({
        results: [
          { id: 'email-1', category: 'Bestellungen', summary: 'Amazon Order' },
          { id: 'email-2', category: 'Jobs', summary: 'LinkedIn Job Alert' },
        ],
      });

      const results = await categorizeBatchWithAI(mockEmails, ['Bestellungen', 'Jobs'], mockSettings);

      expect(results).toHaveLength(2);
      expect(results[0].categoryId).toBe('Bestellungen');
      expect(results[1].categoryId).toBe('Jobs');
    });

    it('should fall back to index matching when IDs differ', async () => {
      mockAiCall.mockResolvedValue({
        results: [
          { id: 'wrong-id-1', category: 'Bestellungen', summary: 'Amazon Order' },
          { id: 'wrong-id-2', category: 'Jobs', summary: 'LinkedIn Job Alert' },
        ],
      });

      const results = await categorizeBatchWithAI(mockEmails, ['Bestellungen', 'Jobs'], mockSettings);

      expect(results).toHaveLength(2);
      // Index-based fallback should still match
      expect(results[0].categoryId).toBe('Bestellungen');
      expect(results[1].categoryId).toBe('Jobs');
    });

    it('should handle partial batch responses gracefully', async () => {
      mockAiCall.mockResolvedValue({
        results: [
          { id: 'email-1', category: 'Bestellungen', summary: 'Amazon Order' },
          // email-2 missing from response
        ],
      });

      const results = await categorizeBatchWithAI(mockEmails, ['Bestellungen'], mockSettings);

      expect(results).toHaveLength(2);
      expect(results[0].categoryId).toBe('Bestellungen');
      // Missing email should fallback to OTHER
      expect(results[1].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[1].summary).toBe('Fehler');
    });

    it('should return empty array for empty input', async () => {
      const results = await categorizeBatchWithAI([], ['Test'], mockSettings);

      expect(results).toEqual([]);
      expect(mockAiCall).not.toHaveBeenCalled();
    });
  });

  describe('Natural Language Query with Ollama', () => {
    it('should convert natural language to search operators', async () => {
      mockAiCall.mockResolvedValue({
        query: 'category:Rechnungen after:2026-01-01',
      });

      const result = await parseNaturalLanguageQuery('Rechnungen von letztem Monat', mockSettings);

      expect(result).toContain('category:Rechnungen');
      expect(result).toContain('after:');
    });

    it('should handle empty query', async () => {
      const result = await parseNaturalLanguageQuery('', mockSettings);

      expect(result).toBe('');
      expect(mockAiCall).not.toHaveBeenCalled();
    });

    it('should preserve free text when no operators match', async () => {
      mockAiCall.mockResolvedValue({
        query: 'meeting notes',
      });

      const result = await parseNaturalLanguageQuery('meeting notes', mockSettings);

      expect(result).toBe('meeting notes');
    });

    it('should handle complex queries with multiple operators', async () => {
      mockAiCall.mockResolvedValue({
        query: 'from:amazon category:Rechnungen after:2026-01-01 has:attachment',
      });

      const result = await parseNaturalLanguageQuery(
        'Rechnungen von Amazon aus diesem Jahr mit Anhängen',
        mockSettings
      );

      expect(result).toContain('from:amazon');
      expect(result).toContain('category:Rechnungen');
      expect(result).toContain('has:attachment');
    });

    it('should handle API errors gracefully', async () => {
      mockAiCall.mockRejectedValue(new Error('Network error'));

      await expect(parseNaturalLanguageQuery('test query', mockSettings)).rejects.toThrow();
    });

    it('should handle missing query field in response', async () => {
      mockAiCall.mockResolvedValue({
        // missing 'query' field
      });

      const result = await parseNaturalLanguageQuery('test query', mockSettings);

      expect(result).toBe('');
    });
  });

  describe('Ollama-specific Error Handling', () => {
    it('should provide descriptive error when Ollama returns 404', async () => {
      mockAiCall.mockRejectedValue(new Error('Ollama API error (404): Model not found'));

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.reasoning).toContain('Batch API Error');
    });

    it('should handle connection refused (Ollama not running)', async () => {
      mockAiCall.mockRejectedValue(new Error('Failed to fetch'));

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });

    it('should handle timeout errors', async () => {
      mockAiCall.mockRejectedValue(new Error('Request timeout'));

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });
  });

  describe('Response Format Handling', () => {
    it('should handle bare array response', async () => {
      mockAiCall.mockResolvedValue([
        {
          id: 'test-email-1',
          category: 'Test',
          summary: 'Test Summary',
        },
      ]);

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe('Test');
      expect(result.summary).toBe('Test Summary');
    });

    it('should handle null IPC response', async () => {
      mockAiCall.mockResolvedValue(null);

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });
  });

  describe('API Key Handling', () => {
    it('should not require API key for Ollama provider', async () => {
      const settingsWithoutKey = {
        ...mockSettings,
        apiKey: '',
      };

      mockAiCall.mockResolvedValue([
        {
          id: 'test-email-1',
          category: 'Test',
          summary: 'Test',
        },
      ]);

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], settingsWithoutKey);

      expect(result.categoryId).toBe('Test');
      expect(mockAiCall).toHaveBeenCalled();
    });

    it('should route through IPC without Authorization header', async () => {
      const settingsWithKey = {
        ...mockSettings,
        apiKey: 'this-should-be-ignored',
      };

      mockAiCall.mockResolvedValue([
        {
          id: 'test-email-1',
          category: 'Test',
          summary: 'Test',
        },
      ]);

      await categorizeEmailWithAI(mockEmail, ['Test'], settingsWithKey);

      // IPC call should use systemInstruction/userPrompt, not raw HTTP
      expect(mockAiCall).toHaveBeenCalledWith({
        systemInstruction: expect.any(String),
        userPrompt: expect.any(String),
      });
    });
  });
});
