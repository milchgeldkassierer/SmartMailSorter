import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Email, DefaultEmailCategory, AISettings, LLMProvider } from '../../types';

// Mock variables for GoogleGenAI
let mockGenerateContent: any;

// Mock @google/genai before importing geminiService
vi.mock('@google/genai', () => {
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

describe('GeminiService - generateDemoEmails', () => {
  const geminiSettings: AISettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3-flash-preview',
    apiKey: 'test-gemini-api-key'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should generate demo emails successfully', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Max Mustermann', senderEmail: 'max@example.com', subject: 'Testmail 1', body: 'Dies ist eine Testmail.' },
            { sender: 'Anna Schmidt', senderEmail: 'anna@example.com', subject: 'Testmail 2', body: 'Noch eine Testmail.' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(2, geminiSettings);

      expect(emails).toHaveLength(2);
      expect(emails[0].sender).toBe('Max Mustermann');
      expect(emails[0].senderEmail).toBe('max@example.com');
      expect(emails[0].subject).toBe('Testmail 1');
      expect(emails[0].body).toBe('Dies ist eine Testmail.');
      expect(emails[1].sender).toBe('Anna Schmidt');
      expect(emails[1].senderEmail).toBe('anna@example.com');
    });

    it('should use default count of 5 when not specified', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'User 1' },
            { sender: 'User 2' },
            { sender: 'User 3' },
            { sender: 'User 4' },
            { sender: 'User 5' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(undefined as any, geminiSettings);

      // Verify prompt contains the default count
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('5')
        })
      );
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

      await geminiService.generateDemoEmails(3, geminiSettings);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('3')
        })
      );
    });

    it('should generate 10 emails when requested', async () => {
      const mockEmails = Array.from({ length: 10 }, (_, i) => ({
        sender: `User ${i + 1}`,
        senderEmail: `user${i + 1}@example.com`,
        subject: `Email ${i + 1}`,
        body: `Body ${i + 1}`
      }));

      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockEmails)
        }
      });

      const emails = await geminiService.generateDemoEmails(10, geminiSettings);

      expect(emails).toHaveLength(10);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('10')
        })
      );
    });

    it('should generate a single email when count is 1', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Single User', senderEmail: 'single@example.com', subject: 'Single Email', body: 'Only one email.' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Single User');
    });
  });

  describe('Default Values for Missing Properties', () => {
    it('should fill in default sender when missing', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { senderEmail: 'test@example.com', subject: 'Test', body: 'Body' }
            // Missing sender
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Unbekannt');
    });

    it('should fill in default senderEmail when missing', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Test Sender', subject: 'Test', body: 'Body' }
            // Missing senderEmail
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].senderEmail).toBe('unknown@example.com');
    });

    it('should fill in default subject when missing', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Test Sender', senderEmail: 'test@example.com', body: 'Body' }
            // Missing subject
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].subject).toBe('Kein Betreff');
    });

    it('should fill in default body when missing', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Test Sender', senderEmail: 'test@example.com', subject: 'Test Subject' }
            // Missing body
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].body).toBe('');
    });

    it('should fill in all default values for minimal data', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            {} // Empty object - no properties at all
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Unbekannt');
      expect(emails[0].senderEmail).toBe('unknown@example.com');
      expect(emails[0].subject).toBe('Kein Betreff');
      expect(emails[0].body).toBe('');
    });
  });

  describe('Email Properties', () => {
    it('should set category to INBOX for all generated emails', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'User 1' },
            { sender: 'User 2' },
            { sender: 'User 3' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(3, geminiSettings);

      emails.forEach(email => {
        expect(email.category).toBe(DefaultEmailCategory.INBOX);
      });
    });

    it('should set folder to Posteingang for all generated emails', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'User 1' },
            { sender: 'User 2' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(2, geminiSettings);

      emails.forEach(email => {
        expect(email.folder).toBe('Posteingang');
      });
    });

    it('should set isRead to false for all generated emails', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'User 1' },
            { sender: 'User 2' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(2, geminiSettings);

      emails.forEach(email => {
        expect(email.isRead).toBe(false);
      });
    });

    it('should set isFlagged to false for all generated emails', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'User 1' },
            { sender: 'User 2' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(2, geminiSettings);

      emails.forEach(email => {
        expect(email.isFlagged).toBe(false);
      });
    });

    it('should generate unique IDs for each email', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'User 1' },
            { sender: 'User 2' },
            { sender: 'User 3' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(3, geminiSettings);

      const ids = emails.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should generate IDs with gen- prefix', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Test User' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails[0].id).toMatch(/^gen-\d+-\d+$/);
    });

    it('should generate valid ISO date strings', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Test User' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      // Verify date is a valid ISO string
      const parsedDate = new Date(emails[0].date);
      expect(parsedDate.toISOString()).toBe(emails[0].date);
    });

    it('should apply dateOffset when provided in AI response', async () => {
      const beforeTest = Date.now();

      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Recent User', dateOffset: 0 },
            { sender: 'Older User', dateOffset: 24 } // 24 hours ago
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(2, geminiSettings);

      const recentDate = new Date(emails[0].date).getTime();
      const olderDate = new Date(emails[1].date).getTime();

      // Older email should be about 24 hours earlier
      const timeDiff = recentDate - olderDate;
      const hoursDiff = timeDiff / 3600000; // Convert to hours

      expect(hoursDiff).toBeGreaterThanOrEqual(23.9);
      expect(hoursDiff).toBeLessThanOrEqual(24.1);
    });
  });

  describe('Error Handling', () => {
    it('should return empty array on API failure', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('API Error'));

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should return empty array on rate limit error', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('429 Rate limit exceeded'));

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('Network error'));

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should return empty array on quota exceeded error', async () => {
      mockGenerateContent = vi.fn().mockRejectedValue(new Error('quota exceeded'));

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should return empty array when missing API key', async () => {
      // When no settings provided and no env API_KEY, it should return empty array
      const emails = await geminiService.generateDemoEmails(1);

      expect(emails).toEqual([]);
    });
  });

  describe('Malformed Response Handling', () => {
    it('should return empty array when response is not an array (object)', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({ not: 'an array' })
        }
      });

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should return empty array when response is null', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(null)
        }
      });

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should return empty array when response is a string', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify('just a string')
        }
      });

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should return empty array when response is a number', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(42)
        }
      });

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should handle empty array response', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([])
        }
      });

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('should return empty array on invalid JSON response', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => 'not valid json'
        }
      });

      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toEqual([]);
    });
  });

  describe('Settings Handling', () => {
    it('should use provided settings', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ sender: 'Test' }])
        }
      });

      const customSettings: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-pro-preview',
        apiKey: 'custom-api-key'
      };

      await geminiService.generateDemoEmails(1, customSettings);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-pro-preview'
        })
      );
    });

    it('should use system instruction for data generation', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ sender: 'Test' }])
        }
      });

      await geminiService.generateDemoEmails(1, geminiSettings);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: 'You are a data generator.'
          })
        })
      );
    });

    it('should request JSON response format', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ sender: 'Test' }])
        }
      });

      await geminiService.generateDemoEmails(1, geminiSettings);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            responseMimeType: 'application/json'
          })
        })
      );
    });

    it('should include German language instruction in prompt', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([{ sender: 'Test' }])
        }
      });

      await geminiService.generateDemoEmails(5, geminiSettings);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('Deutsch')
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('edge: should handle zero count', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([])
        }
      });

      const emails = await geminiService.generateDemoEmails(0, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('edge: should handle very large count', async () => {
      const mockEmails = Array.from({ length: 100 }, (_, i) => ({
        sender: `User ${i}`
      }));

      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockEmails)
        }
      });

      const emails = await geminiService.generateDemoEmails(100, geminiSettings);

      expect(emails).toHaveLength(100);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('100')
        })
      );
    });

    it('edge: should handle negative count (prompt still includes it)', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([])
        }
      });

      const emails = await geminiService.generateDemoEmails(-5, geminiSettings);

      expect(emails).toEqual([]);
    });

    it('edge: should handle null sender value', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: null, senderEmail: 'test@example.com' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Unbekannt');
    });

    it('edge: should handle empty string sender value', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: '', senderEmail: 'test@example.com' }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      // Empty string is falsy, so should use default
      expect(emails[0].sender).toBe('Unbekannt');
    });

    it('edge: should handle markdown wrapped JSON response', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => '```json\n[{"sender": "Wrapped User"}]\n```'
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Wrapped User');
    });

    it('edge: should handle AI returning fewer emails than requested', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'User 1' },
            { sender: 'User 2' }
          ])
        }
      });

      // Request 5 but AI only returns 2
      const emails = await geminiService.generateDemoEmails(5, geminiSettings);

      expect(emails).toHaveLength(2);
    });

    it('edge: should handle AI returning more emails than requested', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'User 1' },
            { sender: 'User 2' },
            { sender: 'User 3' },
            { sender: 'User 4' },
            { sender: 'User 5' }
          ])
        }
      });

      // Request 2 but AI returns 5
      const emails = await geminiService.generateDemoEmails(2, geminiSettings);

      // All 5 emails should be returned (function doesn't limit)
      expect(emails).toHaveLength(5);
    });

    it('edge: should handle special characters in email content', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            {
              sender: 'Müller & Söhne GmbH',
              senderEmail: 'müller@über.de',
              subject: 'Änderung: Größe €100',
              body: 'Liebe Grüße, äöüß'
            }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Müller & Söhne GmbH');
      expect(emails[0].subject).toBe('Änderung: Größe €100');
    });

    it('edge: should handle very long email body', async () => {
      const longBody = 'A'.repeat(10000);
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Long Body User', body: longBody }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].body).toBe(longBody);
    });

    it('edge: should handle undefined dateOffset', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Test User', dateOffset: undefined }
          ])
        }
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      // Should have a valid date near current time
      const emailDate = new Date(emails[0].date);
      const now = Date.now();
      expect(Math.abs(emailDate.getTime() - now)).toBeLessThan(1000);
    });

    it('edge: should handle negative dateOffset', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify([
            { sender: 'Future User', dateOffset: -1 } // 1 hour in the future
          ])
        }
      });

      const beforeTest = Date.now();
      const emails = await geminiService.generateDemoEmails(1, geminiSettings);
      const afterTest = Date.now();

      expect(emails).toHaveLength(1);
      // With negative offset, date should be in the future
      const emailDate = new Date(emails[0].date).getTime();
      expect(emailDate).toBeGreaterThan(beforeTest);
    });
  });

  describe('Response Text Extraction Strategies', () => {
    it('should extract text using Strategy 2: result.text()', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => { throw new Error('Strategy 1 failed'); }
        },
        text: () => JSON.stringify([
          { sender: 'Strategy 2 User' }
        ])
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Strategy 2 User');
    });

    it('should extract text using Strategy 3: manual candidate extraction', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => { throw new Error('Strategy 1 failed'); }
        },
        candidates: [
          {
            content: {
              parts: [
                { text: JSON.stringify([{ sender: 'Strategy 3 User' }]) }
              ]
            }
          }
        ]
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Strategy 3 User');
    });

    it('should return empty array when all text extraction strategies fail', async () => {
      mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => { throw new Error('Strategy 1 failed'); }
        },
        candidates: [] // Empty candidates - Strategy 3 fails too
      });

      const emails = await geminiService.generateDemoEmails(1, geminiSettings);

      expect(emails).toEqual([]);
    });
  });
});
