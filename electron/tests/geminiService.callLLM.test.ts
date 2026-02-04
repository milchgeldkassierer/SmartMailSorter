import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { Email, DefaultEmailCategory, SortResult, AISettings, LLMProvider } from '../../types';

// Store the original fetch
const originalFetch = global.fetch;

// Define types for Gemini API mocks
interface GeminiGenerateContentRequest {
  model: string;
  contents: string;
  config?: {
    responseMimeType?: string;
    thinkingConfig?: {
      thinkingBudget?: number;
    };
  };
}

interface GeminiGenerateContentResponse {
  response?: {
    text: () => string;
    candidates?: Array<{
      content: {
        parts: Array<{ text: string }>;
      };
    }>;
  };
  text?: () => string;
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

// Mock variables for GoogleGenAI
let mockGenerateContent: Mock<(request: GeminiGenerateContentRequest) => Promise<GeminiGenerateContentResponse>>;

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
        generateContent: (request: GeminiGenerateContentRequest) => mockGenerateContent(request),
      };
    }
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: 'object',
      ARRAY: 'array',
      STRING: 'string',
      NUMBER: 'number',
    },
    Schema: {},
  };
});

// Import after mocking
const geminiService = await import('../../services/geminiService');

describe('GeminiService - callLLM Function', () => {
  const geminiSettings: AISettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3-flash-preview',
    apiKey: 'test-gemini-api-key',
  };

  const openaiSettings: AISettings = {
    provider: LLMProvider.OPENAI,
    model: 'gpt-4o',
    apiKey: 'test-openai-api-key',
  };

  const availableCategories = [
    DefaultEmailCategory.INBOX,
    DefaultEmailCategory.SPAM,
    DefaultEmailCategory.INVOICE,
    DefaultEmailCategory.NEWSLETTER,
    DefaultEmailCategory.PRIVATE,
    DefaultEmailCategory.BUSINESS,
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
      isFlagged: false,
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
          text: () =>
            JSON.stringify([{ id: 'email-1', category: DefaultEmailCategory.BUSINESS, summary: 'Test Summary' }]),
        },
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
          text: () => {
            throw new Error('Strategy 1 failed');
          },
        },
        text: () =>
          JSON.stringify([{ id: 'email-1', category: DefaultEmailCategory.INVOICE, summary: 'Invoice Summary' }]),
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
          text: () => {
            throw new Error('Strategy 1 failed');
          },
        },
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    { id: 'email-1', category: DefaultEmailCategory.NEWSLETTER, summary: 'Newsletter' },
                  ]),
                },
              ],
            },
          },
        ],
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
          text: () => '```json\n[{"id": "email-1", "category": "Geschäftlich", "summary": "Clean Test"}]\n```',
        },
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
        apiKey: '',
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
          text: () => {
            throw new Error('Strategy 1 failed');
          },
        },
        candidates: [], // Empty candidates - Strategy 3 fails too
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
          text: () => JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]),
        },
      });

      const customSettings: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-pro-preview',
        apiKey: 'custom-key',
      };

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, customSettings);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-pro-preview',
        })
      );
    });

    it('should include thinkingConfig in Gemini request', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]),
        },
      });

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            responseMimeType: 'application/json',
            thinkingConfig: expect.objectContaining({
              thinkingBudget: 1024,
            }),
          }),
        })
      );
    });
  });

  describe('OpenAI Provider', () => {
    it('should successfully call OpenAI API', async () => {
      // Mock fetch for OpenAI
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    { id: 'email-1', category: DefaultEmailCategory.PRIVATE, summary: 'Private Email' },
                  ]),
                },
              },
            ],
          }),
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
            Authorization: 'Bearer test-openai-api-key',
          }),
        })
      );
    });

    it('should pass correct model to OpenAI API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]) } }],
          }),
      });

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4o"'),
        })
      );
    });

    it('should use json_object response format for OpenAI', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]) } }],
          }),
      });

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"response_format":{"type":"json_object"}'),
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

    it('should handle OpenAI rate limit errors (429)', async () => {
      // Mock fetch to throw a rate limit error
      global.fetch = vi.fn().mockRejectedValue(new Error('Rate limit exceeded 429'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Batch API Error');
    });

    it('should handle OpenAI network timeout', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Network timeout');
    });

    it('should categorize multiple emails in batch with OpenAI', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    { id: 'email-1', category: DefaultEmailCategory.INVOICE, summary: 'Invoice from vendor' },
                    { id: 'email-2', category: DefaultEmailCategory.NEWSLETTER, summary: 'Weekly digest' },
                    { id: 'email-3', category: DefaultEmailCategory.SPAM, summary: 'Promotional offer' },
                  ]),
                },
              },
            ],
          }),
      });

      const emails = [
        createTestEmail('email-1', 'Invoice #12345', 'billing@vendor.com'),
        createTestEmail('email-2', 'Weekly Newsletter', 'news@example.com'),
        createTestEmail('email-3', 'Special Offer!', 'spam@example.com'),
      ];

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, openaiSettings);

      expect(results).toHaveLength(3);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.INVOICE);
      expect(results[1].categoryId).toBe(DefaultEmailCategory.NEWSLETTER);
      expect(results[2].categoryId).toBe(DefaultEmailCategory.SPAM);
    });

    it('should preserve OpenAI email order when mapping results back', async () => {
      // OpenAI returns results in different order than input
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    { id: 'email-3', category: DefaultEmailCategory.BUSINESS, summary: 'Third' },
                    { id: 'email-1', category: DefaultEmailCategory.PRIVATE, summary: 'First' },
                    { id: 'email-2', category: DefaultEmailCategory.NEWSLETTER, summary: 'Second' },
                  ]),
                },
              },
            ],
          }),
      });

      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email'),
        createTestEmail('email-3', 'Third Email'),
      ];

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, openaiSettings);

      // Results should be mapped back to original order
      expect(results[0].summary).toBe('First');
      expect(results[1].summary).toBe('Second');
      expect(results[2].summary).toBe('Third');
    });

    it('should handle OpenAI invalid JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: 'This is not valid JSON',
                },
              },
            ],
          }),
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Batch API Error');
    });

    it('should handle OpenAI empty choices array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [],
          }),
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle OpenAI missing message content', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: null,
                },
              },
            ],
          }),
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should use different OpenAI models when specified', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]) } }],
          }),
      });

      const customOpenAISettings: AISettings = {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4-turbo',
        apiKey: 'test-openai-api-key',
      };

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, customOpenAISettings);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4-turbo"'),
        })
      );
    });

    it('should include system instruction in OpenAI request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]) } }],
          }),
      });

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      // Check that system role message is included
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"role":"system"'),
        })
      );
    });

    it('should include user prompt in OpenAI request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]) } }],
          }),
      });

      const email = createTestEmail('email-1', 'Test');
      await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      // Check that user role message is included
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"role":"user"'),
        })
      );
    });

    it('should handle OpenAI partial results (missing email IDs)', async () => {
      // OpenAI returns fewer results than input emails
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    { id: 'email-1', category: DefaultEmailCategory.INVOICE, summary: 'Invoice' },
                    // email-2 is missing from response
                  ]),
                },
              },
            ],
          }),
      });

      const emails = [createTestEmail('email-1', 'Invoice Email'), createTestEmail('email-2', 'Missing Email')];

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, openaiSettings);

      expect(results).toHaveLength(2);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.INVOICE);
      // Fallback for missing email
      expect(results[1].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[1].reasoning).toContain('AI lieferte kein Ergebnis');
    });

    it('should handle OpenAI response with extra whitespace', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: '  \n  [{"id": "email-1", "category": "Geschäftlich", "summary": "Business"}]  \n  ',
                },
              },
            ],
          }),
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.BUSINESS);
    });

    it('should categorize single email with OpenAI via categorizeEmailWithAI wrapper', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    { id: 'email-1', category: DefaultEmailCategory.SPAM, summary: 'Spam detected' },
                  ]),
                },
              },
            ],
          }),
      });

      const email = createTestEmail('email-1', 'Win a prize!');
      const result = await geminiService.categorizeEmailWithAI(email, availableCategories, openaiSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.SPAM);
      expect(result.summary).toBe('Spam detected');
    });

    it('should handle OpenAI HTTP error status', async () => {
      // Mock fetch to return non-ok response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Internal Server Error' } })),
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });
  });

  describe('Unknown Provider', () => {
    it('should throw error for unknown provider', async () => {
      const unknownSettings: AISettings = {
        provider: 'Unknown Provider' as LLMProvider,
        model: 'some-model',
        apiKey: 'some-key',
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
          text: () =>
            JSON.stringify([
              { sender: 'John Doe', senderEmail: 'john@example.com', subject: 'Demo Email 1', body: 'Demo body 1' },
              { sender: 'Jane Doe', senderEmail: 'jane@example.com', subject: 'Demo Email 2', body: 'Demo body 2' },
            ]),
        },
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
          text: () => JSON.stringify({ not: 'an array' }),
        },
      });

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should fill in default values for missing properties', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify([
              { sender: 'Test Sender' }, // Minimal data
            ]),
        },
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
          text: () => JSON.stringify([{ sender: 'Test1' }, { sender: 'Test2' }, { sender: 'Test3' }]),
        },
      });

      const emails = await geminiService.generateDemoEmails(3, geminiSettings);

      expect(emails).toHaveLength(3);
      // Verify prompt contains the count
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('3'),
        })
      );
    });
  });

  describe('categorizeEmailWithAI (Legacy Wrapper)', () => {
    it('should delegate to batch function for single email', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ id: 'email-1', category: DefaultEmailCategory.SPAM, summary: 'Spam Email' }]),
        },
      });

      const email = createTestEmail('email-1', 'You won a lottery!');
      const result = await geminiService.categorizeEmailWithAI(email, availableCategories, geminiSettings);

      expect(result.categoryId).toBe(DefaultEmailCategory.SPAM);
      expect(result.summary).toBe('Spam Email');
    });

    it('should return fallback when batch fails completely', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([]), // Empty result
        },
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
          text: () => {
            throw new Error('Failed');
          },
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Via Response Candidates' }]) },
                ],
              },
            },
          ],
        },
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].summary).toBe('Via Response Candidates');
    });

    it('edge: should handle empty parts array in candidates', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => {
            throw new Error('Failed');
          },
        },
        candidates: [
          {
            content: {
              parts: [], // Empty parts
            },
          },
        ],
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('edge: should handle invalid JSON in response', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => 'not valid json',
        },
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
          text: () =>
            '```json\n```json\n[{"id": "email-1", "category": "Test", "summary": "Double Cleaned"}]\n```\n```',
        },
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
          text: () => JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Long Body' }]),
        },
      });

      const email: Email = {
        ...createTestEmail('email-1', 'Long Email'),
        body: longBody,
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
          text: () => JSON.stringify([{ id: 'email-1', category: 'Test', summary: 'Test' }]),
        },
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
        apiKey: '   ',
      };

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI(
        [email],
        availableCategories,
        settingsWithWhitespaceKey
      );

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Missing API Key');
    });

    it('edge: should handle null response from text()', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => null,
        },
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify([{ id: 'email-1', category: 'Fallback', summary: 'From candidates' }]) }],
            },
          },
        ],
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      // When text() returns null/empty, it should try candidates
      expect(results).toHaveLength(1);
    });

    it('edge: should handle missing content in candidates', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => {
            throw new Error('Failed');
          },
        },
        candidates: [
          {
            // Missing content property
          },
        ],
      });

      const email = createTestEmail('email-1', 'Test');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });
  });

  describe('Rate Limit Edge Cases', () => {
    it('should handle rate limit with "Resource has been exhausted" message', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('Resource has been exhausted (e.g. check quota).'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('AI Busy (429)');
    });

    it('should handle rate limit with lowercase "quota" in message', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('Your daily quota has been exceeded'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('AI Busy (429)');
    });

    it('should handle rate limit with HTTP status in message', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('HTTP Error 429 Too Many Requests'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('AI Busy (429)');
    });

    it('should fail all batch emails on rate limit error', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('Rate limit exceeded 429'));

      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email'),
        createTestEmail('email-3', 'Third Email'),
      ];

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, geminiSettings);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
        expect(result.reasoning).toContain('AI Busy (429)');
        expect(result.confidence).toBe(0);
      });
    });

    it('should handle OpenAI 429 status in response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Rate limit exceeded' } })),
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });
  });

  describe('Empty Response Edge Cases', () => {
    it('should handle empty string from text() function', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => '',
        },
        candidates: [],
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Failed to extract text');
    });

    it('should handle whitespace-only response from text()', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => '   \n\t  ',
        },
        candidates: [],
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle empty array result for batch request', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => '[]',
        },
      });

      const emails = [createTestEmail('email-1', 'First Email'), createTestEmail('email-2', 'Second Email')];

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, geminiSettings);

      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
        expect(result.summary).toBe('Fehler');
        expect(result.reasoning).toContain('AI lieferte kein Ergebnis');
      });
    });

    it('should handle null response object', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: null,
        candidates: [],
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle undefined response', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: undefined,
        candidates: undefined,
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle OpenAI empty response body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle OpenAI null message content', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: null } }],
          }),
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle OpenAI undefined message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: undefined }],
          }),
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle connection refused error', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Batch API Error');
      expect(results[0].reasoning).toContain('ECONNREFUSED');
    });

    it('should handle connection reset error', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('ECONNRESET: Connection reset by peer'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('ECONNRESET');
    });

    it('should handle socket timeout error', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('ETIMEDOUT: Socket timeout'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('ETIMEDOUT');
    });

    it('should handle DNS resolution failure', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('ENOTFOUND: getaddrinfo ENOTFOUND api.google.com'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('ENOTFOUND');
    });

    it('should handle non-Error object thrown', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue('String error message');

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Batch API Error');
    });

    it('should handle error object without message property', async () => {
      const customError = { code: 'CUSTOM_ERROR', details: 'Something went wrong' };
      mockGenerateContent = vi.fn().mockRejectedValue(customError);

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle JSON parse error with truncated response', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => '[{"id": "email-1", "category": "Test", "summa',
        },
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Batch API Error');
    });

    it('should handle JSON with invalid unicode escape', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => '[{"id": "email-1", "summary": "Test\\uXXXX"}]',
        },
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle object response instead of array', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({ id: 'email-1', category: 'Test', summary: 'Not an array' }),
        },
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].summary).toBe('Fehler');
    });

    it('should handle primitive value response', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => '"just a string"',
        },
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle null JSON response', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => 'null',
        },
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, geminiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle OpenAI fetch throwing TypeError', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].reasoning).toContain('Failed to fetch');
    });

    it('should handle OpenAI response json() throwing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const email = createTestEmail('email-1', 'Test Email');
      const results = await geminiService.categorizeBatchWithAI([email], availableCategories, openaiSettings);

      expect(results).toHaveLength(1);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    });

    it('should handle multiple batch errors returning consistent fallbacks', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('Service Unavailable'));

      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email'),
        createTestEmail('email-3', 'Third Email'),
        createTestEmail('email-4', 'Fourth Email'),
        createTestEmail('email-5', 'Fifth Email'),
      ];

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, geminiSettings);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
        expect(result.summary).toBe('Fehler');
        expect(result.reasoning).toContain('Batch API Error');
        expect(result.confidence).toBe(0);
      });
    });

    it('should preserve batch order on partial failures', async () => {
      // API returns results but with some IDs missing
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify([
              { id: 'email-2', category: DefaultEmailCategory.INVOICE, summary: 'Second worked' },
              { id: 'email-4', category: DefaultEmailCategory.BUSINESS, summary: 'Fourth worked' },
            ]),
        },
      });

      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email'),
        createTestEmail('email-3', 'Third Email'),
        createTestEmail('email-4', 'Fourth Email'),
        createTestEmail('email-5', 'Fifth Email'),
      ];

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, geminiSettings);

      expect(results).toHaveLength(5);

      // First email - fallback
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].summary).toBe('Fehler');

      // Second email - success
      expect(results[1].categoryId).toBe(DefaultEmailCategory.INVOICE);
      expect(results[1].summary).toBe('Second worked');

      // Third email - fallback
      expect(results[2].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[2].summary).toBe('Fehler');

      // Fourth email - success
      expect(results[3].categoryId).toBe(DefaultEmailCategory.BUSINESS);
      expect(results[3].summary).toBe('Fourth worked');

      // Fifth email - fallback
      expect(results[4].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[4].summary).toBe('Fehler');
    });
  });
});
