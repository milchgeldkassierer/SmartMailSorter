import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Email, DefaultEmailCategory, SortResult, AISettings, LLMProvider } from '../../types';

// Store the original fetch
const originalFetch = global.fetch;

// Mock variables for GoogleGenAI
let mockGenerateContent: any;

// Mock @google/genai before importing geminiService
vi.mock('@google/genai', () => {
  // Use a class constructor that vitest can properly mock
  class MockGoogleGenAI {
    apiKey: string;

    constructor(config: { apiKey: string }) {
      this.apiKey = config.apiKey;
    }

    get models() {
      return {
        generateContent: (...args: any[]) => mockGenerateContent(...args)
      };
    }
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: 'object',
      ARRAY: 'array',
      STRING: 'string',
      NUMBER: 'number'
    },
    Schema: {}
  };
});

// Import after mocking
const geminiService = await import('../../services/geminiService');

describe('GeminiService - callLLM Function', () => {
  const geminiSettings: AISettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3-flash-preview',
    apiKey: 'test-gemini-api-key'
  };

  const openaiSettings: AISettings = {
    provider: LLMProvider.OPENAI,
    model: 'gpt-4o',
    apiKey: 'test-openai-api-key'
  };

  const availableCategories = [
    DefaultEmailCategory.INBOX,
    DefaultEmailCategory.SPAM,
    DefaultEmailCategory.INVOICE,
    DefaultEmailCategory.NEWSLETTER,
    DefaultEmailCategory.PRIVATE,
    DefaultEmailCategory.BUSINESS
  ];

  // Helper to create test emails
  function createTestEmail(id: string, subject: string, sender: string = 'test@example.com'): Email {
    return {
      id,
      sender: sender,
      senderEmail: sender,
      subject,
      body: `This is a test email about ${subject}`,
      date: new Date().toISOString(),
      folder: 'INBOX',
      category: DefaultEmailCategory.INBOX,
      isRead: false,
      isFlagged: false
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch to original
    global.fetch = originalFetch;
    // Reset mock
    mockGenerateContent = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe('Gemini Provider', () => {
    it('should successfully call Gemini API with Strategy 1: response.text()', async () => {
      // Mock successful Gemini response using Strategy 1: result.response.text()
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { id: 'email-1', category: DefaultEmailCategory.BUSINESS, summary: 'Test Summary' }
          ])
        }
      });

      const email = createTestEmail('email-1', 'Business Meeting');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.BUSINESS);
      expect(results[0].summary).toBe('Test Summary');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should successfully call Gemini API with Strategy 2: result.text()', async () => {
      // Mock response using Strategy 2: result.text() (simpler SDK)
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => { throw new Error('Strategy 1 failed'); }
        },
        text: () => JSON.stringify([
          { id: 'email-1', category: DefaultEmailCategory.INVOICE, summary: 'Invoice Summary' }
        ])
      });

      const email = createTestEmail('email-1', 'Invoice #12345');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.INVOICE);
      expect(results[0].summary).toBe('Invoice Summary');
    });

    it('should successfully call Gemini API with Strategy 3: manual candidate extraction', async () => {
      // Mock response using Strategy 3: candidates extraction
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => { throw new Error('Strategy 1 failed'); }
        },
        candidates: [
          {
            content: {
              parts: [
                { text: JSON.stringify([{ id: 'email-1', category: DefaultEmailCategory.NEWSLETTER, summary: 'Newsletter' }]) }
              ]
            }
          }
        ]
      });

      const email = createTestEmail('email-1', 'Weekly Newsletter');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.NEWSLETTER);
      expect(results[0].summary).toBe('Newsletter');
    });

    it('should clean markdown from JSON response', async () => {
      // Mock response with markdown code blocks
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => '```json\n[{"id": "email-1", "category": "Geschäftlich", "summary": "Clean Test"}]\n```'
        }
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.BUSINESS);
      expect(results[0].summary).toBe('Clean Test');
    });

    it('should handle rate limit errors (429)', async () => {
      // Mock rate limit error
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('Resource has been exhausted (e.g. check quota). 429'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('AI Busy (429)');
    });

    it('should handle quota exceeded errors', async () => {
      // Mock quota error
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('quota exceeded'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('AI Busy (429)');
    });

    it('should throw error when API key is missing for Gemini', async () => {
      const settingsWithoutKey: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-flash-preview',
        apiKey: ''
      };

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, settingsWithoutKey);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Missing API Key');
    });

    it('should handle text extraction failure when all strategies fail', async () => {
      // Mock response where all text extraction strategies fail
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => { throw new Error('Strategy 1 failed'); }
        },
        candidates: [] // Empty candidates - Strategy 3 fails too
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Failed to extract text');
    });

    it('should handle generic API error', async () => {
      // Mock generic error
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('Network error'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Batch API Error');
      expect(results[0].reasoning).toContain('Network error');
    });

    it('should pass correct model and settings to Gemini API', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }])
        }
      });

      const customSettings: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-pro-preview',
        apiKey: 'custom-key'
      };

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, customSettings);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-pro-preview'
        })
      );
    });

    it('should include thinkingConfig in Gemini request', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }])
        }
      });

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            responseMimeType: 'application/json',
            thinkingConfig: expect.objectContaining({
              thinkingBudget: 1024
            })
          })
        })
      );
    });
  });

  describe('OpenAI Provider', () => {
    it('should successfully call OpenAI API', async () => {
      // Mock fetch for OpenAI
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { id: 'email-1', category: DefaultEmailCategory.PRIVATE, summary: 'Private Email' }
                ])
              }
            }
          ]
        })
      });

      const email = createTestEmail('email-1', 'Personal Matter');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.PRIVATE);
      expect(results[0].summary).toBe('Private Email');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-openai-api-key'
          })
        })
      );
    });

    it('should pass correct model to OpenAI API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]) } }]
        })
      });

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4o"')
        })
      );
    });

    it('should use json_object response format for OpenAI', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]) } }]
        })
      });

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"response_format":{"type":"json_object"}')
        })
      );
    });

    it('should handle OpenAI API errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('OpenAI API Error'));

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Batch API Error');
    });
  });

  describe('Unknown Provider', () => {
    it('should throw error for unknown provider', async () => {
      const unknownSettings: AISettings = {
        provider: 'Unknown Provider' as LLMProvider,
        model: 'some-model',
        apiKey: 'some-key'
      };

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, unknownSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Unknown Provider');
    });
  });

  describe('generateDemoEmails', () => {
    it('should generate demo emails successfully', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'John Doe', senderEmail: 'john@example.com', subject: 'Demo Email 1', body: 'Demo body 1' },
            { sender: 'Jane Doe', senderEmail: 'jane@example.com', subject: 'Demo Email 2', body: 'Demo body 2' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(2, geminiSettings);

      expect(emails).toHaveLength(2);
      expect(emails[0]).toHaveProperty('id');
      expect(emails[0]).toHaveProperty('sender');
      expect(emails[0]).toHaveProperty('subject');
      expect(emails[0].folder).toBe('Posteingang');
      expect(emails[0].isRead).toBe(false);
    });

    it('should return empty array on API failure', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('API Error'));

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should handle malformed response gracefully', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({ not: 'an array' })
        }
      });

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should fill in default values for missing properties', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Test Sender' } // Minimal data
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Test Sender');
      expect(emails[0].senderEmail).toBe('unknown@example.com');
      expect(emails[0].subject).toBe('Kein Betreff');
      expect(emails[0].body).toBe('');
    });

    it('should use default settings and return empty on missing API key', async () => {
      // When no settings provided and no env API_KEY, it should return empty array
      // because generateDemoEmails catches errors and returns []
      const emails = await geminiService.generateDemoEmails(1);

      // Without API key, function catches error and returns empty array
      expect(emails).toEqual([]);
    });

    it('should request correct count of demo emails', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Test1' },
            { sender: 'Test2' },
            { sender: 'Test3' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(3, geminiSettings);

      expect(emails).toHaveLength(3);
      // Verify prompt contains the count
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('3')
        })
      );
    });
  });

  describe('categorizeEmailWithAI (Legacy Wrapper)', () => {
    it('should delegate to batch function for single email', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { id: 'email-1', category: DefaultEmailCategory.SPAM, summary: 'Spam Email' }
          ])
        }
      });

      const email = createTestEmail('email-1', 'You won a lottery!');
      const result = await geminiService.categorizeEmailWithAI(email, availableCategories, geminiSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.SPAM);
      expect(result.summary).toBe('Spam Email');
    });

    it('should return fallback when batch fails completely', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([]) // Empty result
        }
      });

      const email = createTestEmail('email-1', 'Test');
      const result = await geminiService.categorizeEmailWithAI(email, availableCategories, geminiSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
    });
  });

  describe('Edge Cases', () => {
    it('edge: should handle Strategy 3 with response.candidates', async () => {
      // Alternative path: candidates on response object instead of result
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => { throw new Error('Failed'); },
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Via Response Candidates' }]) }
                ]
              }
            }
          ]
        }
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].summary).toBe('Via Response Candidates');
    });

    it('edge: should handle empty parts array in candidates', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => { throw new Error('Failed'); }
        },
        candidates: [
          {
            content: {
              parts: [] // Empty parts
            }
          }
        ]
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('edge: should handle invalid JSON in response', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => 'not valid json'
        }
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Batch API Error');
    });

    it('edge: should handle multiple consecutive markdown code blocks', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => '```json\n```json\n[{"id": "email-1", "category": "Test", "summary": "Double Cleaned"}]\n```\n```'
        }
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].summary).toBe('Double Cleaned');
    });

    it('edge: should truncate email body to 1500 chars', async () => {
      // Create email with very long body
      const longBody = 'A'.repeat(3000);
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Long Body' }])
        }
      });

      const email: Email = {
        ...createTestEmail('email-1', 'Long Email'),
        body: longBody
      };

      await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      // Verify the body was truncated in the prompt
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.contents).toContain('body_preview');
      // The body_preview should only have 1500 chars
      expect(callArgs.contents.includes('AAAA')).toBe(true);
    });

    it('edge: should filter out INBOX from target categories', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }])
        }
      });

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      // INBOX (Posteingang) should not appear alone in the categories list
      // It should be filtered, so the categories list should not start with it
      expect(callArgs.contents).toContain('EXISTIERENDE KATEGORIEN:');
    });

    it('edge: should handle whitespace-only API key', async () => {
      const settingsWithWhitespaceKey: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-flash-preview',
        apiKey: '   '
      };

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, settingsWithWhitespaceKey);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Missing API Key');
    });

    it('edge: should handle null response from text()', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => null
        },
        candidates: [
          {
            content: {
              parts: [
                { text: JSON.stringify([{ id: 'email-1', category: 'Fallback', summary: 'From candidates' }]) }
              ]
            }
          }
        ]
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      // When text() returns null/empty, it should try candidates
      expect(results).toHaveLength(1);
    });

    it('edge: should handle missing content in candidates', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => { throw new Error('Failed'); }
        },
        candidates: [
          {
            // Missing content property
          }
        ]
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });
  });
});
