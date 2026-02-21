import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseNaturalLanguageQuery } from '../geminiService';
import { LLMProvider } from '../../types';

// Create a mock function that will be shared across all tests
const mockGenerateContent = vi.fn();

// Mock the Google GenAI SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      constructor() {
        return {
          models: {
            generateContent: mockGenerateContent,
          },
        };
      }
    },
    Type: {
      STRING: 'string',
      NUMBER: 'number',
      BOOLEAN: 'boolean',
      OBJECT: 'object',
      ARRAY: 'array',
    },
  };
});

describe('parseNaturalLanguageQuery', () => {
  const mockSettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-2.5-flash',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    mockGenerateContent.mockClear();
  });

  describe('Basic Natural Language Conversion', () => {
    it('should convert "Rechnungen von letztem Monat" to category and date operators', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              query: 'category:Rechnungen after:2026-01-01',
            }),
        },
      });

      const result = await parseNaturalLanguageQuery('Rechnungen von letztem Monat', mockSettings);

      expect(result).toContain('category:Rechnungen');
      expect(result).toContain('after:');
    });

    it('should convert "Emails von Amazon" to from operator', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              query: 'from:amazon',
            }),
        },
      });

      const result = await parseNaturalLanguageQuery('Emails von Amazon', mockSettings);

      expect(result).toBe('from:amazon');
    });

    it('should convert "Newsletter mit Anhängen" to category and attachment operators', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              query: 'category:Newsletter has:attachment',
            }),
        },
      });

      const result = await parseNaturalLanguageQuery('Newsletter mit Anhängen', mockSettings);

      expect(result).toContain('category:Newsletter');
      expect(result).toContain('has:attachment');
    });

    it('should convert "Emails über Rechnung" to subject operator', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              query: 'subject:Rechnung',
            }),
        },
      });

      const result = await parseNaturalLanguageQuery('Emails über Rechnung', mockSettings);

      expect(result).toBe('subject:Rechnung');
    });

    it('should handle date ranges like "vor Januar 2026"', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              query: 'before:2026-01-01',
            }),
        },
      });

      const result = await parseNaturalLanguageQuery('vor Januar 2026', mockSettings);

      expect(result).toContain('before:2026-01-01');
    });
  });

  describe('Complex Queries', () => {
    it('should handle multiple operators in one query', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              query: 'from:amazon category:Rechnungen after:2026-01-01 has:attachment',
            }),
        },
      });

      const result = await parseNaturalLanguageQuery(
        'Rechnungen von Amazon aus diesem Jahr mit Anhängen',
        mockSettings
      );

      expect(result).toContain('from:amazon');
      expect(result).toContain('category:Rechnungen');
      expect(result).toContain('has:attachment');
    });

    it('should preserve free text when no specific operators match', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              query: 'meeting notes',
            }),
        },
      });

      const result = await parseNaturalLanguageQuery('meeting notes', mockSettings);

      expect(result).toBe('meeting notes');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      await expect(parseNaturalLanguageQuery('test query', mockSettings)).rejects.toThrow();
    });

    it('should handle missing API key', async () => {
      const settingsWithoutKey = {
        ...mockSettings,
        apiKey: '',
      };

      await expect(parseNaturalLanguageQuery('test query', settingsWithoutKey)).rejects.toThrow(
        'Missing API Key for Gemini'
      );
    });

    it('should handle empty query', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              query: '',
            }),
        },
      });

      const result = await parseNaturalLanguageQuery('', mockSettings);

      expect(result).toBe('');
    });
  });

  describe('Response Format Handling', () => {
    it('should handle response with text as function', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              query: 'category:Newsletter',
            }),
        },
      });

      const result = await parseNaturalLanguageQuery('Newsletter', mockSettings);

      expect(result).toBe('category:Newsletter');
    });

    it('should handle response with markdown wrapped JSON', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            '```json\n' +
            JSON.stringify({
              query: 'from:test',
            }) +
            '\n```',
        },
      });

      const result = await parseNaturalLanguageQuery('test', mockSettings);

      expect(result).toBe('from:test');
    });

    it('should handle candidate-based response format', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    query: 'category:Spam',
                  }),
                },
              ],
            },
          },
        ],
      });

      const result = await parseNaturalLanguageQuery('Spam', mockSettings);

      expect(result).toBe('category:Spam');
    });
  });
});
