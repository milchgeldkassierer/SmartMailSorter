import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { categorizeEmailWithAI, categorizeBatchWithAI, parseNaturalLanguageQuery } from '../geminiService';
import { LLMProvider, DefaultEmailCategory, Email, AISettings, INBOX_FOLDER } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('callLLM with Ollama Provider', () => {
    it('should successfully call Ollama API for email categorization', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              {
                id: 'test-email-1',
                category: 'Bestellungen',
                summary: 'Amazon Bestellbestätigung',
              },
            ]),
          },
        }),
      });

      const result = await categorizeEmailWithAI(mockEmail, ['Bestellungen', 'Newsletter'], mockSettings);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"model":"llama3"'),
      });

      expect(result.categoryId).toBe('Bestellungen');
      expect(result.summary).toBe('Amazon Bestellbestätigung');
    });

    it('should send correct request format to Ollama API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              {
                id: 'test-email-1',
                category: 'Bestellungen',
                summary: 'Test',
              },
            ]),
          },
        }),
      });

      await categorizeEmailWithAI(mockEmail, ['Bestellungen'], mockSettings);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:11434/api/chat');

      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody).toMatchObject({
        model: 'llama3',
        format: 'json',
        stream: false,
      });
      expect(requestBody.messages).toHaveLength(2);
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[1].role).toBe('user');
    });

    it('should handle API error responses gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await categorizeEmailWithAI(mockEmail, ['Bestellungen'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
      expect(result.reasoning).toContain('Batch API Error');
    });

    it('should handle network errors when Ollama is unavailable', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed'));

      const result = await categorizeEmailWithAI(mockEmail, ['Bestellungen'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
      expect(result.reasoning).toContain('Batch API Error');
    });

    it('should handle empty response from Ollama', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {},
        }),
      });

      const result = await categorizeEmailWithAI(mockEmail, ['Bestellungen'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: 'This is not valid JSON',
          },
        }),
      });

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
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              { id: 'email-1', category: 'Bestellungen', summary: 'Amazon Order' },
              { id: 'email-2', category: 'Jobs', summary: 'LinkedIn Job Alert' },
            ]),
          },
        }),
      });

      const results = await categorizeBatchWithAI(mockEmails, ['Bestellungen', 'Jobs'], mockSettings);

      expect(results).toHaveLength(2);
      expect(results[0].categoryId).toBe('Bestellungen');
      expect(results[1].categoryId).toBe('Jobs');
    });

    it('should use shorter body preview for Ollama (500 chars)', async () => {
      const longBodyEmail: Email = {
        ...mockEmail,
        body: 'A'.repeat(2000),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              {
                id: longBodyEmail.id,
                category: 'Test',
                summary: 'Test',
              },
            ]),
          },
        }),
      });

      await categorizeEmailWithAI(longBodyEmail, ['Test'], mockSettings);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const userMessage = requestBody.messages[1].content;

      // Check that body_preview is truncated to 500 chars for Ollama
      expect(userMessage).toContain('"body_preview":"' + 'A'.repeat(500) + '"');
      expect(userMessage).not.toContain('A'.repeat(501));
    });

    it('should use shorter prompt for Ollama', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              {
                id: mockEmail.id,
                category: 'Test',
                summary: 'Test',
              },
            ]),
          },
        }),
      });

      await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const userMessage = requestBody.messages[1].content;

      // Ollama should get the shorter prompt
      expect(userMessage).toContain('Sortiere diese');
      expect(userMessage).not.toContain('Du bist ein strenger Email-Sortierer');
    });

    it('should handle partial batch responses gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              { id: 'email-1', category: 'Bestellungen', summary: 'Amazon Order' },
              // email-2 missing from response
            ]),
          },
        }),
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
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Natural Language Query with Ollama', () => {
    it('should convert natural language to search operators', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              query: 'category:Rechnungen after:2026-01-01',
            }),
          },
        }),
      });

      const result = await parseNaturalLanguageQuery('Rechnungen von letztem Monat', mockSettings);

      expect(result).toContain('category:Rechnungen');
      expect(result).toContain('after:');
    });

    it('should handle empty query', async () => {
      const result = await parseNaturalLanguageQuery('', mockSettings);

      expect(result).toBe('');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should preserve free text when no operators match', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              query: 'meeting notes',
            }),
          },
        }),
      });

      const result = await parseNaturalLanguageQuery('meeting notes', mockSettings);

      expect(result).toBe('meeting notes');
    });

    it('should handle complex queries with multiple operators', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              query: 'from:amazon category:Rechnungen after:2026-01-01 has:attachment',
            }),
          },
        }),
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
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(parseNaturalLanguageQuery('test query', mockSettings)).rejects.toThrow();
    });

    it('should handle malformed response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: 'not valid json',
          },
        }),
      });

      await expect(parseNaturalLanguageQuery('test query', mockSettings)).rejects.toThrow();
    });

    it('should handle missing query field in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              // missing 'query' field
            }),
          },
        }),
      });

      const result = await parseNaturalLanguageQuery('test query', mockSettings);

      expect(result).toBe('');
    });
  });

  describe('Ollama-specific Error Handling', () => {
    it('should provide descriptive error when Ollama returns 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Model not found',
      });

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.reasoning).toContain('Batch API Error');
    });

    it('should handle connection refused (Ollama not running)', async () => {
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });
  });

  describe('Response Format Handling', () => {
    it('should handle response with nested message.content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              {
                id: 'test-email-1',
                category: 'Test',
                summary: 'Test Summary',
              },
            ]),
          },
        }),
      });

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe('Test');
      expect(result.summary).toBe('Test Summary');
    });

    it('should handle response with missing message field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });

    it('should handle response with null content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: null,
          },
        }),
      });

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], mockSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });
  });

  describe('Model Configuration', () => {
    it('should use the specified model in the request', async () => {
      const customSettings = {
        ...mockSettings,
        model: 'mistral',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              {
                id: 'test-email-1',
                category: 'Test',
                summary: 'Test',
              },
            ]),
          },
        }),
      });

      await categorizeEmailWithAI(mockEmail, ['Test'], customSettings);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.model).toBe('mistral');
    });

    it('should work with different Ollama models', async () => {
      const models = ['llama3', 'mistral', 'phi3', 'gemma2'];

      for (const model of models) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            message: {
              content: JSON.stringify([
                {
                  id: 'test-email-1',
                  category: 'Test',
                  summary: 'Test',
                },
              ]),
            },
          }),
        });

        await categorizeEmailWithAI(mockEmail, ['Test'], { ...mockSettings, model });

        const callArgs = mockFetch.mock.calls[0];
        const requestBody = JSON.parse(callArgs[1].body);
        expect(requestBody.model).toBe(model);
      }
    });
  });

  describe('API Key Handling', () => {
    it('should not require API key for Ollama provider', async () => {
      const settingsWithoutKey = {
        ...mockSettings,
        apiKey: '',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              {
                id: 'test-email-1',
                category: 'Test',
                summary: 'Test',
              },
            ]),
          },
        }),
      });

      const result = await categorizeEmailWithAI(mockEmail, ['Test'], settingsWithoutKey);

      expect(result.categoryId).toBe('Test');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should ignore API key even if provided', async () => {
      const settingsWithKey = {
        ...mockSettings,
        apiKey: 'this-should-be-ignored',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify([
              {
                id: 'test-email-1',
                category: 'Test',
                summary: 'Test',
              },
            ]),
          },
        }),
      });

      await categorizeEmailWithAI(mockEmail, ['Test'], settingsWithKey);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).not.toHaveProperty('Authorization');
    });
  });
});
