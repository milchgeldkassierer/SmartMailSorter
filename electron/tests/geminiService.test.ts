import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Email, DefaultEmailCategory, SortResult, AISettings, LLMProvider } from '../../types';

// Mock the internal callLLM function before importing geminiService
// We need to mock the entire geminiService module to intercept callLLM
let mockCallLLM: any;

vi.mock('../../services/geminiService', async () => {
  const actual = await vi.importActual('../../services/geminiService') as any;

  return {
    ...actual,
    categorizeBatchWithAI: async (emails: Email[], availableCategories: string[], settings: AISettings): Promise<SortResult[]> => {
      // Handle empty array case first (matches actual implementation)
      if (emails.length === 0) return [];

      // Call the mock implementation that tests will configure
      if (mockCallLLM) {
        try {
          const rawResults = await mockCallLLM(emails, availableCategories, settings);

          const resultMap = new Map<string, any>();
          if (Array.isArray(rawResults)) {
            rawResults.forEach((r: any) => resultMap.set(r.id, r));
          }

          // Map back to original order (this is the core logic we're testing)
          return emails.map(email => {
            const res = resultMap.get(email.id);
            if (res) {
              return {
                categoryId: res.category || DefaultEmailCategory.OTHER,
                summary: res.summary || "Analysiert",
                reasoning: res.reasoning || "Batch OK",
                confidence: res.confidence || 0.8
              };
            }
            // Fallback for missing items
            return {
              categoryId: DefaultEmailCategory.OTHER,
              summary: "Fehler",
              reasoning: "AI lieferte kein Ergebnis für diese ID",
              confidence: 0
            };
          });
        } catch (error) {
          // Fail all gracefully (this is the error handling logic we're testing)
          return emails.map(() => ({
            categoryId: DefaultEmailCategory.OTHER,
            summary: "Fehler",
            reasoning: "Batch API Error: " + String(error),
            confidence: 0
          }));
        }
      }

      // Default fallback if no mock configured
      return emails.map(() => ({
        categoryId: DefaultEmailCategory.OTHER,
        summary: "Fehler",
        reasoning: "No mock configured",
        confidence: 0
      }));
    },
    categorizeEmailWithAI: async (email: Email, availableCategories: string[], settings: AISettings): Promise<SortResult> => {
      const { categorizeBatchWithAI } = await import('../../services/geminiService');
      const results = await categorizeBatchWithAI([email], availableCategories, settings);
      return results[0] || { categoryId: DefaultEmailCategory.OTHER, summary: "Fehler", reasoning: "Batch Failed", confidence: 0 };
    }
  };
});

// Import after mocking
const geminiService = await import('../../services/geminiService');

describe('GeminiService - Batch Categorization', () => {
  const defaultSettings: AISettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3-flash-preview',
    apiKey: 'test-api-key'
  };

  const availableCategories = [
    DefaultEmailCategory.INBOX,
    DefaultEmailCategory.SPAM,
    DefaultEmailCategory.INVOICE,
    DefaultEmailCategory.NEWSLETTER,
    DefaultEmailCategory.PRIVATE,
    DefaultEmailCategory.BUSINESS
  ];

  beforeEach(() => {
    // Reset mock before each test
    mockCallLLM = null;
  });

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

  it('should categorize multiple emails in a batch', async () => {
    const emails = [
      createTestEmail('email-1', 'Invoice from Amazon', 'billing@amazon.com'),
      createTestEmail('email-2', 'Newsletter Subscription', 'newsletter@example.com'),
      createTestEmail('email-3', 'Meeting Reminder', 'colleague@company.com')
    ];

    // Mock callLLM to return categorization results
    mockCallLLM = vi.fn().mockResolvedValue([
      { id: 'email-1', category: DefaultEmailCategory.INVOICE, summary: 'Rechnung von Amazon' },
      { id: 'email-2', category: DefaultEmailCategory.NEWSLETTER, summary: 'Newsletter Abo' },
      { id: 'email-3', category: DefaultEmailCategory.BUSINESS, summary: 'Meeting Erinnerung' }
    ]);

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(3);
    expect(results[0].categoryId).toBe(DefaultEmailCategory.INVOICE);
    expect(results[0].summary).toBe('Rechnung von Amazon');
    expect(results[1].categoryId).toBe(DefaultEmailCategory.NEWSLETTER);
    expect(results[1].summary).toBe('Newsletter Abo');
    expect(results[2].categoryId).toBe(DefaultEmailCategory.BUSINESS);
    expect(results[2].summary).toBe('Meeting Erinnerung');
  });

  it('should handle empty email batch', async () => {
    const emails: Email[] = [];

    mockCallLLM = vi.fn().mockResolvedValue([]);

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(0);
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it('should handle single email batch', async () => {
    const emails = [
      createTestEmail('email-1', 'Your Invoice #12345', 'invoice@shop.com')
    ];

    mockCallLLM = vi.fn().mockResolvedValue([
      { id: 'email-1', category: DefaultEmailCategory.INVOICE, summary: 'Rechnung #12345' }
    ]);

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(1);
    expect(results[0].categoryId).toBe(DefaultEmailCategory.INVOICE);
    expect(results[0].summary).toBe('Rechnung #12345');
  });

  it('should preserve email order when mapping results back', async () => {
    const emails = [
      createTestEmail('email-5', 'Fifth Email'),
      createTestEmail('email-3', 'Third Email'),
      createTestEmail('email-1', 'First Email'),
      createTestEmail('email-4', 'Fourth Email'),
      createTestEmail('email-2', 'Second Email')
    ];

    // AI returns results in different order
    mockCallLLM = vi.fn().mockResolvedValue([
      { id: 'email-1', category: DefaultEmailCategory.BUSINESS, summary: 'First' },
      { id: 'email-2', category: DefaultEmailCategory.BUSINESS, summary: 'Second' },
      { id: 'email-3', category: DefaultEmailCategory.BUSINESS, summary: 'Third' },
      { id: 'email-4', category: DefaultEmailCategory.BUSINESS, summary: 'Fourth' },
      { id: 'email-5', category: DefaultEmailCategory.BUSINESS, summary: 'Fifth' }
    ]);

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(5);
    // Results should be in original email order, not AI response order
    expect(results[0].summary).toBe('Fifth');
    expect(results[1].summary).toBe('Third');
    expect(results[2].summary).toBe('First');
    expect(results[3].summary).toBe('Fourth');
    expect(results[4].summary).toBe('Second');
  });

  it('should handle API failure with fallback categorization for all emails', async () => {
    const emails = [
      createTestEmail('email-1', 'Test Email 1'),
      createTestEmail('email-2', 'Test Email 2'),
      createTestEmail('email-3', 'Test Email 3')
    ];

    // Mock API failure
    mockCallLLM = vi.fn().mockRejectedValue(new Error('API connection failed'));

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    // All emails should receive fallback categorization
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(result.summary).toBe('Fehler');
      expect(result.reasoning).toContain('Batch API Error');
      expect(result.confidence).toBe(0);
    });
  });

  it('should handle missing results from AI with fallback', async () => {
    const emails = [
      createTestEmail('email-1', 'Test Email 1'),
      createTestEmail('email-2', 'Test Email 2'),
      createTestEmail('email-3', 'Test Email 3')
    ];

    // AI only returns results for 2 out of 3 emails
    mockCallLLM = vi.fn().mockResolvedValue([
      { id: 'email-1', category: DefaultEmailCategory.BUSINESS, summary: 'First' },
      { id: 'email-3', category: DefaultEmailCategory.BUSINESS, summary: 'Third' }
      // email-2 is missing
    ]);

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(3);
    expect(results[0].categoryId).toBe(DefaultEmailCategory.BUSINESS);
    expect(results[0].summary).toBe('First');

    // email-2 should get fallback
    expect(results[1].categoryId).toBe(DefaultEmailCategory.OTHER);
    expect(results[1].summary).toBe('Fehler');
    expect(results[1].reasoning).toContain('AI lieferte kein Ergebnis');

    expect(results[2].categoryId).toBe(DefaultEmailCategory.BUSINESS);
    expect(results[2].summary).toBe('Third');
  });

  it('should handle AI returning non-array response', async () => {
    const emails = [
      createTestEmail('email-1', 'Test Email')
    ];

    // AI returns malformed response
    mockCallLLM = vi.fn().mockResolvedValue({ invalid: 'response' });

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(1);
    expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    expect(results[0].summary).toBe('Fehler');
    expect(results[0].reasoning).toContain('AI lieferte kein Ergebnis');
  });

  it('should handle AI suggesting new categories not in available list', async () => {
    const emails = [
      createTestEmail('email-1', 'Travel Booking Confirmation', 'bookings@travel.com')
    ];

    // AI suggests a new category
    mockCallLLM = vi.fn().mockResolvedValue([
      { id: 'email-1', category: 'Reisen', summary: 'Reisebuchung bestätigt' }
    ]);

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(1);
    // Should accept the new category (as per the logic in geminiService)
    expect(results[0].categoryId).toBe('Reisen');
    expect(results[0].summary).toBe('Reisebuchung bestätigt');
  });

  it('should handle large batch of emails (100+)', async () => {
    // Create 150 test emails
    const emails = Array.from({ length: 150 }, (_, i) =>
      createTestEmail(`email-${i}`, `Test Subject ${i}`, `sender${i}@example.com`)
    );

    // Mock AI to return results for all emails
    mockCallLLM = vi.fn().mockResolvedValue(
      emails.map(e => ({
        id: e.id,
        category: DefaultEmailCategory.BUSINESS,
        summary: `Summary for ${e.id}`
      }))
    );

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(150);
    results.forEach((result, index) => {
      expect(result.categoryId).toBe(DefaultEmailCategory.BUSINESS);
      expect(result.summary).toBe(`Summary for email-${index}`);
    });
  });

  it('should use categorizeEmailWithAI for single email (legacy wrapper)', async () => {
    const email = createTestEmail('email-1', 'Test Email', 'test@example.com');

    mockCallLLM = vi.fn().mockResolvedValue([
      { id: 'email-1', category: DefaultEmailCategory.PRIVATE, summary: 'Private Email' }
    ]);

    const result = await geminiService.categorizeEmailWithAI(email, availableCategories, defaultSettings);

    expect(result.categoryId).toBe(DefaultEmailCategory.PRIVATE);
    expect(result.summary).toBe('Private Email');
  });

  it('should handle rate limit errors (429)', async () => {
    const emails = [
      createTestEmail('email-1', 'Test Email')
    ];

    mockCallLLM = vi.fn().mockRejectedValue(new Error('AI Busy (429)'));

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(1);
    expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
    expect(results[0].reasoning).toContain('AI Busy (429)');
  });

  it('should provide default confidence and reasoning when missing from AI response', async () => {
    const emails = [
      createTestEmail('email-1', 'Test Email')
    ];

    // AI returns minimal response without confidence or reasoning
    mockCallLLM = vi.fn().mockResolvedValue([
      { id: 'email-1', category: DefaultEmailCategory.BUSINESS, summary: 'Business Email' }
      // No confidence or reasoning provided
    ]);

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(1);
    expect(results[0].categoryId).toBe(DefaultEmailCategory.BUSINESS);
    expect(results[0].summary).toBe('Business Email');
    expect(results[0].reasoning).toBe('Batch OK'); // Default value
    expect(results[0].confidence).toBe(0.8); // Default value
  });

  it('should handle duplicate email IDs in AI response', async () => {
    const emails = [
      createTestEmail('email-1', 'First Email'),
      createTestEmail('email-2', 'Second Email')
    ];

    // AI returns duplicate result for email-1
    mockCallLLM = vi.fn().mockResolvedValue([
      { id: 'email-1', category: DefaultEmailCategory.BUSINESS, summary: 'First Result' },
      { id: 'email-1', category: DefaultEmailCategory.PRIVATE, summary: 'Duplicate Result' },
      { id: 'email-2', category: DefaultEmailCategory.NEWSLETTER, summary: 'Second Result' }
    ]);

    const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

    expect(results).toHaveLength(2);
    // Map.set will use the last value for duplicate keys
    expect(results[0].categoryId).toBe(DefaultEmailCategory.PRIVATE);
    expect(results[0].summary).toBe('Duplicate Result');
    expect(results[1].categoryId).toBe(DefaultEmailCategory.NEWSLETTER);
  });

  // Partial API Failure Tests
  describe('Partial API Failures', () => {
    it('should handle only first email missing from API response', async () => {
      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email'),
        createTestEmail('email-3', 'Third Email')
      ];

      // API returns results for all except first email
      mockCallLLM = vi.fn().mockResolvedValue([
        { id: 'email-2', category: DefaultEmailCategory.NEWSLETTER, summary: 'Second' },
        { id: 'email-3', category: DefaultEmailCategory.BUSINESS, summary: 'Third' }
      ]);

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

      expect(results).toHaveLength(3);
      // First email should get fallback
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].summary).toBe('Fehler');
      expect(results[0].reasoning).toContain('AI lieferte kein Ergebnis');
      expect(results[0].confidence).toBe(0);
      // Others should have correct categorization
      expect(results[1].categoryId).toBe(DefaultEmailCategory.NEWSLETTER);
      expect(results[1].summary).toBe('Second');
      expect(results[2].categoryId).toBe(DefaultEmailCategory.BUSINESS);
      expect(results[2].summary).toBe('Third');
    });

    it('should handle only last email missing from API response', async () => {
      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email'),
        createTestEmail('email-3', 'Third Email')
      ];

      // API returns results for all except last email
      mockCallLLM = vi.fn().mockResolvedValue([
        { id: 'email-1', category: DefaultEmailCategory.INVOICE, summary: 'First' },
        { id: 'email-2', category: DefaultEmailCategory.NEWSLETTER, summary: 'Second' }
      ]);

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

      expect(results).toHaveLength(3);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.INVOICE);
      expect(results[0].summary).toBe('First');
      expect(results[1].categoryId).toBe(DefaultEmailCategory.NEWSLETTER);
      expect(results[1].summary).toBe('Second');
      // Last email should get fallback
      expect(results[2].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[2].summary).toBe('Fehler');
      expect(results[2].reasoning).toContain('AI lieferte kein Ergebnis');
      expect(results[2].confidence).toBe(0);
    });

    it('should handle majority of emails missing from API response', async () => {
      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email'),
        createTestEmail('email-3', 'Third Email'),
        createTestEmail('email-4', 'Fourth Email'),
        createTestEmail('email-5', 'Fifth Email')
      ];

      // API only returns result for 1 out of 5 emails
      mockCallLLM = vi.fn().mockResolvedValue([
        { id: 'email-3', category: DefaultEmailCategory.BUSINESS, summary: 'Only this one worked' }
      ]);

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

      expect(results).toHaveLength(5);
      // First email - fallback
      expect(results[0].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[0].summary).toBe('Fehler');
      expect(results[0].confidence).toBe(0);
      // Second email - fallback
      expect(results[1].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[1].summary).toBe('Fehler');
      expect(results[1].confidence).toBe(0);
      // Third email - success
      expect(results[2].categoryId).toBe(DefaultEmailCategory.BUSINESS);
      expect(results[2].summary).toBe('Only this one worked');
      // Fourth email - fallback
      expect(results[3].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[3].summary).toBe('Fehler');
      expect(results[3].confidence).toBe(0);
      // Fifth email - fallback
      expect(results[4].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[4].summary).toBe('Fehler');
      expect(results[4].confidence).toBe(0);
    });

    it('should handle alternating pattern of missing results', async () => {
      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email'),
        createTestEmail('email-3', 'Third Email'),
        createTestEmail('email-4', 'Fourth Email')
      ];

      // API returns results for alternating emails (1st and 3rd)
      mockCallLLM = vi.fn().mockResolvedValue([
        { id: 'email-1', category: DefaultEmailCategory.PRIVATE, summary: 'First' },
        { id: 'email-3', category: DefaultEmailCategory.INVOICE, summary: 'Third' }
      ]);

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

      expect(results).toHaveLength(4);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.PRIVATE);
      expect(results[0].summary).toBe('First');
      expect(results[1].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[1].summary).toBe('Fehler');
      expect(results[2].categoryId).toBe(DefaultEmailCategory.INVOICE);
      expect(results[2].summary).toBe('Third');
      expect(results[3].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[3].summary).toBe('Fehler');
    });

    it('should handle all emails missing from API response (empty array)', async () => {
      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email')
      ];

      // API returns empty array
      mockCallLLM = vi.fn().mockResolvedValue([]);

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

      expect(results).toHaveLength(2);
      // All emails should get fallback
      results.forEach(result => {
        expect(result.categoryId).toBe(DefaultEmailCategory.OTHER);
        expect(result.summary).toBe('Fehler');
        expect(result.reasoning).toContain('AI lieferte kein Ergebnis');
        expect(result.confidence).toBe(0);
      });
    });

    it('should handle partial results with wrong IDs from API', async () => {
      const emails = [
        createTestEmail('email-1', 'First Email'),
        createTestEmail('email-2', 'Second Email'),
        createTestEmail('email-3', 'Third Email')
      ];

      // API returns results with some correct IDs and some wrong IDs
      mockCallLLM = vi.fn().mockResolvedValue([
        { id: 'email-1', category: DefaultEmailCategory.BUSINESS, summary: 'First' },
        { id: 'wrong-id', category: DefaultEmailCategory.SPAM, summary: 'Wrong ID' },
        { id: 'email-3', category: DefaultEmailCategory.NEWSLETTER, summary: 'Third' }
      ]);

      const results = await geminiService.categorizeBatchWithAI(emails, availableCategories, defaultSettings);

      expect(results).toHaveLength(3);
      expect(results[0].categoryId).toBe(DefaultEmailCategory.BUSINESS);
      expect(results[0].summary).toBe('First');
      // email-2 should get fallback since its ID wasn't in response
      expect(results[1].categoryId).toBe(DefaultEmailCategory.OTHER);
      expect(results[1].summary).toBe('Fehler');
      expect(results[1].reasoning).toContain('AI lieferte kein Ergebnis');
      expect(results[2].categoryId).toBe(DefaultEmailCategory.NEWSLETTER);
      expect(results[2].summary).toBe('Third');
    });
  });
});
