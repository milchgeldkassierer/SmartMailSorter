import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { ImapAccount, Email } from '../../src/types';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Mock Electron to provide app.getPath
const electronPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../node_modules/electron/index.js'
);
if (require.cache) {
  require.cache[electronPath] = {
    exports: {
      app: {
        getPath: () => './test-data',
      },
    },
  } as NodeModule;
}

// Define interface for db module methods
interface DbModule {
  init: (path: string) => void;
  addAccount: (account: Partial<ImapAccount> & { id: string; username?: string; password?: string }) => void;
  saveEmail: (
    email: Partial<Email> & {
      id: string;
      accountId: string;
      attachments?: Array<{ id?: string; filename?: string; contentType?: string; size?: number; data?: Buffer }>;
    }
  ) => { changes: number };
  searchEmails: (query: string, accountId?: string) => Email[];
  getSavedFilters: () => Array<{ id: string; name: string; query: string; createdAt: number }>;
  addSavedFilter: (id: string, name: string, query: string) => { success: boolean; changes: number };
  deleteSavedFilter: (id: string) => { success: boolean; changes: number };
  getSearchHistory: () => Array<{ id: string; query: string; timestamp: number }>;
  addSearchHistory: (id: string, query: string) => { success: boolean; changes: number };
  clearSearchHistory: () => { success: boolean; changes: number };
}

// Import the database module under test
const db: DbModule = require('../db.cjs');

// Import folder constants
const { INBOX_FOLDER } = require('../folderConstants.cjs');

// Helper function to create a test account
function createTestAccount(id: string = 'test-account') {
  return {
    id,
    name: 'Test Account',
    email: 'test@example.com',
    provider: 'test',
    username: 'testuser',
    password: 'password',
    imapHost: 'imap.test.com',
    imapPort: 993,
    color: '#0000FF',
  };
}

// Helper function to create a test email
function createTestEmail(id: string, accountId: string, overrides: Partial<Email> = {}) {
  return {
    id,
    accountId,
    sender: 'Test Sender',
    senderEmail: 'sender@test.com',
    subject: 'Test Subject',
    body: 'Test body content',
    bodyHtml: '<p>Test body content</p>',
    date: new Date().toISOString(),
    folder: INBOX_FOLDER,
    smartCategory: undefined,
    isRead: false,
    isFlagged: false,
    hasAttachments: false,
    uid: 100,
    ...overrides,
  };
}

describe('Advanced Search - End-to-End Integration', () => {
  const accountId = 'e2e-test-account';

  beforeEach(() => {
    // Initialize with in-memory DB for test isolation
    db.init(':memory:');

    // Create test account
    db.addAccount(createTestAccount(accountId));
  });

  describe('Search with Operators', () => {
    beforeEach(() => {
      // Create test data for operator searches
      // Amazon invoices in Rechnungen category
      db.saveEmail(
        createTestEmail('email-1', accountId, {
          senderEmail: 'noreply@amazon.com',
          sender: 'Amazon',
          subject: 'Your Amazon Order Invoice',
          date: '2026-02-15T10:00:00Z',
          smartCategory: 'Rechnungen',
          hasAttachments: true,
        })
      );

      db.saveEmail(
        createTestEmail('email-2', accountId, {
          senderEmail: 'billing@amazon.de',
          sender: 'Amazon Billing',
          subject: 'Invoice for Order #12345',
          date: '2026-01-05T14:30:00Z',
          smartCategory: 'Rechnungen',
          hasAttachments: true,
        })
      );

      // Old Amazon email (before 2026-01-01)
      db.saveEmail(
        createTestEmail('email-3', accountId, {
          senderEmail: 'orders@amazon.com',
          sender: 'Amazon Orders',
          subject: 'Order Confirmation',
          date: '2025-12-20T09:00:00Z',
          smartCategory: 'Shopping',
          hasAttachments: false,
        })
      );

      // Newsletter with attachment (not Amazon, not Rechnungen)
      db.saveEmail(
        createTestEmail('email-4', accountId, {
          senderEmail: 'news@newsletter.com',
          sender: 'Newsletter',
          subject: 'Weekly Deals',
          date: '2026-02-10T08:00:00Z',
          smartCategory: 'Newsletter',
          hasAttachments: true,
        })
      );

      // Regular email (no special category, no attachments)
      db.saveEmail(
        createTestEmail('email-5', accountId, {
          senderEmail: 'friend@example.com',
          sender: 'Friend',
          subject: 'Hello',
          date: '2026-02-01T12:00:00Z',
          smartCategory: undefined,
          hasAttachments: false,
        })
      );
    });

    it('should return correct results for complex operator query: from:amazon category:Rechnungen after:2026-01-01', () => {
      const query = 'from:amazon category:Rechnungen after:2026-01-01';
      const results = db.searchEmails(query, accountId);

      // Should only return Amazon emails in Rechnungen category after Jan 1, 2026
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.senderEmail.toLowerCase().includes('amazon'))).toBe(true);
      expect(results.every((e) => e.smartCategory === 'Rechnungen')).toBe(true);
      expect(results.every((e) => new Date(e.date) > new Date('2026-01-01'))).toBe(true);

      // Verify specific emails
      const ids = results.map((e) => e.id);
      expect(ids).toContain('email-1');
      expect(ids).toContain('email-2');
      expect(ids).not.toContain('email-3'); // Too old
      expect(ids).not.toContain('email-4'); // Wrong sender
      expect(ids).not.toContain('email-5'); // Wrong sender and category
    });

    it('should return correct results for from: operator', () => {
      const results = db.searchEmails('from:amazon', accountId);
      expect(results).toHaveLength(3);
      expect(results.every((e) => e.senderEmail.toLowerCase().includes('amazon'))).toBe(true);
    });

    it('should return correct results for category: operator', () => {
      const results = db.searchEmails('category:Rechnungen', accountId);
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.smartCategory === 'Rechnungen')).toBe(true);
    });

    it('should return correct results for has:attachment operator', () => {
      const results = db.searchEmails('has:attachment', accountId);
      expect(results).toHaveLength(3);
      expect(results.every((e) => e.hasAttachments)).toBe(true);
    });

    it('should return correct results for after: operator', () => {
      const results = db.searchEmails('after:2026-01-01', accountId);
      expect(results).toHaveLength(4);
      expect(results.every((e) => new Date(e.date) > new Date('2026-01-01'))).toBe(true);
    });

    it('should return correct results for before: operator', () => {
      const results = db.searchEmails('before:2026-01-01', accountId);
      expect(results).toHaveLength(1);
      expect(results.every((e) => new Date(e.date) < new Date('2026-01-01'))).toBe(true);
    });

    it('should return correct results for subject: operator', () => {
      const results = db.searchEmails('subject:Invoice', accountId);
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.subject.toLowerCase().includes('invoice'))).toBe(true);
    });

    it('should combine multiple operators with AND logic', () => {
      const results = db.searchEmails('category:Newsletter has:attachment', accountId);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('email-4');
      expect(results[0].smartCategory).toBe('Newsletter');
      expect(results[0].hasAttachments).toBe(true);
    });
  });

  describe('Saved Filters', () => {
    it('should save a filter successfully', () => {
      const result = db.addSavedFilter(
        'filter1',
        'Amazon Invoices',
        'from:amazon category:Rechnungen after:2026-01-01'
      );
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });

    it('should retrieve saved filters', () => {
      db.addSavedFilter('filter1', 'Amazon Invoices', 'from:amazon category:Rechnungen after:2026-01-01');
      db.addSavedFilter('filter2', 'Newsletter Attachments', 'category:Newsletter has:attachment');

      const filters = db.getSavedFilters();
      expect(filters).toHaveLength(2);
      const names = filters.map((f) => f.name);
      expect(names).toEqual(expect.arrayContaining(['Amazon Invoices', 'Newsletter Attachments']));
      const amazonFilter = filters.find((f) => f.name === 'Amazon Invoices');
      const newsletterFilter = filters.find((f) => f.name === 'Newsletter Attachments');
      expect(amazonFilter!.query).toBe('from:amazon category:Rechnungen after:2026-01-01');
      expect(newsletterFilter!.query).toBe('category:Newsletter has:attachment');
    });

    it('should delete a saved filter', () => {
      db.addSavedFilter('filter1', 'Test Filter', 'from:test');
      const result = db.deleteSavedFilter('filter1');
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);

      const filters = db.getSavedFilters();
      expect(filters).toHaveLength(0);
    });

    it('should execute saved filter query and return correct results', () => {
      // Create test emails
      db.saveEmail(
        createTestEmail('email-1', accountId, {
          senderEmail: 'noreply@amazon.com',
          smartCategory: 'Rechnungen',
          date: '2026-02-15T10:00:00Z',
        })
      );

      // Save filter
      db.addSavedFilter('filter1', 'Amazon Invoices', 'from:amazon category:Rechnungen after:2026-01-01');

      // Retrieve and execute filter
      const filters = db.getSavedFilters();
      const filter = filters.find((f) => f.name === 'Amazon Invoices');
      expect(filter).toBeDefined();

      const results = db.searchEmails(filter!.query, accountId);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('email-1');
    });
  });

  describe('Search History', () => {
    it('should record search history', () => {
      const result = db.addSearchHistory('search1', 'from:amazon');
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });

    it('should retrieve search history in reverse chronological order', () => {
      db.addSearchHistory('search1', 'from:amazon');
      db.addSearchHistory('search2', 'category:Rechnungen');
      db.addSearchHistory('search3', 'has:attachment');

      const history = db.getSearchHistory();
      expect(history).toHaveLength(3);

      // Verify all queries are present (order may vary if timestamps are identical)
      const queries = history.map((h) => h.query);
      expect(queries).toContain('from:amazon');
      expect(queries).toContain('category:Rechnungen');
      expect(queries).toContain('has:attachment');

      // Verify ordering is by timestamp DESC (most recent has highest or equal timestamp)
      expect(history[0].timestamp).toBeGreaterThanOrEqual(history[1].timestamp);
      expect(history[1].timestamp).toBeGreaterThanOrEqual(history[2].timestamp);
    });

    it('should limit search history to 20 entries', () => {
      // Add 25 search queries
      for (let i = 1; i <= 25; i++) {
        db.addSearchHistory(`search-${i}`, `query-${i}`);
      }

      const history = db.getSearchHistory();

      // Verify limit is enforced
      expect(history.length).toBeLessThanOrEqual(20);

      // Verify timestamps are in descending order
      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i + 1].timestamp);
      }

      // Verify we have query data
      expect(history.every((h) => h.query.startsWith('query-'))).toBe(true);
      expect(history.every((h) => h.id.startsWith('search-'))).toBe(true);
    });

    it('should clear search history', () => {
      db.addSearchHistory('search1', 'from:amazon');
      db.addSearchHistory('search2', 'category:Rechnungen');

      const result = db.clearSearchHistory();
      expect(result.success).toBe(true);
      expect(result.changes).toBeGreaterThanOrEqual(0);

      const history = db.getSearchHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    const PERF_BUDGET_MS = Number(process.env.SEARCH_PERF_BUDGET_MS ?? (process.env.CI ? 2000 : 500));

    it('should search 10,000+ emails in under 500ms', () => {
      // Create 10,000 test emails
      console.warn('Creating 10,000 test emails...');
      const startCreate = Date.now();

      for (let i = 1; i <= 10000; i++) {
        db.saveEmail(
          createTestEmail(`email-${i}`, accountId, {
            senderEmail: i % 10 === 0 ? 'noreply@amazon.com' : `user${i}@example.com`,
            sender: i % 10 === 0 ? 'Amazon' : `User ${i}`,
            subject: i % 5 === 0 ? `Invoice #${i}` : `Message ${i}`,
            date: new Date(2026, 0, 1 + (i % 28), i % 24, i % 60).toISOString(),
            smartCategory: i % 3 === 0 ? 'Rechnungen' : i % 3 === 1 ? 'Newsletter' : undefined,
            hasAttachments: i % 4 === 0,
          })
        );
      }

      const createTime = Date.now() - startCreate;
      console.warn(`Created 10,000 emails in ${createTime}ms`);

      // Test search performance
      const startSearch = Date.now();
      const results = db.searchEmails('from:amazon category:Rechnungen after:2026-01-01', accountId);
      const searchTime = Date.now() - startSearch;

      console.warn(`Search completed in ${searchTime}ms, found ${results.length} results`);

      // Verify performance requirement (configurable via SEARCH_PERF_BUDGET_MS env var)
      expect(searchTime).toBeLessThan(PERF_BUDGET_MS);

      // Verify results are correct
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((e) => e.senderEmail.includes('amazon'))).toBe(true);
      expect(results.every((e) => e.smartCategory === 'Rechnungen')).toBe(true);
    });

    it('should search with has:attachment in under 500ms for 10k emails', () => {
      // Create 10,000 test emails with attachments
      for (let i = 1; i <= 10000; i++) {
        db.saveEmail(
          createTestEmail(`email-${i}`, accountId, {
            hasAttachments: i % 2 === 0,
            date: new Date(2026, 0, 1 + (i % 28), i % 24, i % 60).toISOString(),
          })
        );
      }

      const startSearch = Date.now();
      const results = db.searchEmails('has:attachment', accountId);
      const searchTime = Date.now() - startSearch;

      console.warn(`Attachment search completed in ${searchTime}ms, found ${results.length} results`);

      expect(searchTime).toBeLessThan(PERF_BUDGET_MS);
      expect(results).toHaveLength(500); // Capped by LIMIT 500 (5000 match, half have attachments)
      expect(results.every((e) => e.hasAttachments)).toBe(true);
    });

    it('should search with date range in under 500ms for 10k emails', () => {
      // Create 10,000 test emails spread over 2025-2026
      for (let i = 1; i <= 10000; i++) {
        db.saveEmail(
          createTestEmail(`email-${i}`, accountId, {
            date: new Date(2025 + (i % 2), i % 12, 1 + (i % 28), i % 24, i % 60).toISOString(),
          })
        );
      }

      const startSearch = Date.now();
      const results = db.searchEmails('after:2026-01-01 before:2026-12-31', accountId);
      const searchTime = Date.now() - startSearch;

      console.warn(`Date range search completed in ${searchTime}ms, found ${results.length} results`);

      expect(searchTime).toBeLessThan(PERF_BUDGET_MS);
      expect(
        results.every((e) => {
          const date = new Date(e.date);
          return date >= new Date('2026-01-01') && date <= new Date('2026-12-31');
        })
      ).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty search query', () => {
      db.saveEmail(createTestEmail('email-1', accountId));
      const results = db.searchEmails('', accountId);
      expect(results).toHaveLength(1); // Should return all emails
    });

    it('should handle search with no results', () => {
      db.saveEmail(createTestEmail('email-1', accountId));
      const results = db.searchEmails('from:nonexistent', accountId);
      expect(results).toHaveLength(0);
    });

    it('should handle invalid date format gracefully', () => {
      db.saveEmail(createTestEmail('email-1', accountId));
      // Should not throw error, may return no results or all results
      expect(() => {
        db.searchEmails('after:invalid-date', accountId);
      }).not.toThrow();
    });

    it('should handle special characters in search query', () => {
      db.saveEmail(
        createTestEmail('email-1', accountId, {
          subject: 'Special chars: @#$%^&*()\'"',
        })
      );
      // Should not throw error
      expect(() => {
        db.searchEmails('subject:Special', accountId);
      }).not.toThrow();
    });

    it('should save filter with special characters in name', () => {
      const result = db.addSavedFilter('filter1', "Amazon's Invoices (2026)", 'from:amazon');
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);

      const filters = db.getSavedFilters();
      expect(filters[0].name).toBe("Amazon's Invoices (2026)");
    });
  });

  describe('Multi-Account Support', () => {
    const account2Id = 'account-2';

    beforeEach(() => {
      // Create second account
      db.addAccount(createTestAccount(account2Id));

      // Add emails to both accounts
      db.saveEmail(
        createTestEmail('email-acc1-1', accountId, {
          senderEmail: 'noreply@amazon.com',
          smartCategory: 'Rechnungen',
        })
      );

      db.saveEmail(
        createTestEmail('email-acc2-1', account2Id, {
          senderEmail: 'noreply@amazon.com',
          smartCategory: 'Rechnungen',
        })
      );
    });

    it('should search only in specified account when accountId provided', () => {
      const results = db.searchEmails('from:amazon', accountId);
      expect(results).toHaveLength(1);
      expect(results[0].accountId).toBe(accountId);
      expect(results[0].id).toBe('email-acc1-1');
    });

    it('should search across all accounts when no accountId provided', () => {
      const results = db.searchEmails('from:amazon');
      expect(results).toHaveLength(2);
      const accountIds = results.map((e) => e.accountId);
      expect(accountIds).toContain(accountId);
      expect(accountIds).toContain(account2Id);
    });
  });

  describe('Complete E2E Workflow', () => {
    it('should complete full workflow: search → save filter → execute filter → verify results', () => {
      // Step 1: Create test data
      db.saveEmail(
        createTestEmail('email-1', accountId, {
          senderEmail: 'noreply@amazon.com',
          sender: 'Amazon',
          subject: 'Your Invoice',
          date: '2026-02-15T10:00:00Z',
          smartCategory: 'Rechnungen',
          hasAttachments: true,
        })
      );

      db.saveEmail(
        createTestEmail('email-2', accountId, {
          senderEmail: 'billing@amazon.de',
          sender: 'Amazon Billing',
          subject: 'Invoice #12345',
          date: '2026-01-05T14:30:00Z',
          smartCategory: 'Rechnungen',
          hasAttachments: true,
        })
      );

      db.saveEmail(
        createTestEmail('email-3', accountId, {
          senderEmail: 'noreply@amazon.com',
          sender: 'Amazon',
          subject: 'Old Order',
          date: '2025-12-20T09:00:00Z',
          smartCategory: 'Shopping',
          hasAttachments: false,
        })
      );

      // Step 2: Search with operators
      const query = 'from:amazon category:Rechnungen after:2026-01-01';
      const searchResults = db.searchEmails(query, accountId);

      // Verify search results
      expect(searchResults).toHaveLength(2);
      expect(searchResults.every((e) => e.senderEmail.toLowerCase().includes('amazon'))).toBe(true);
      expect(searchResults.every((e) => e.smartCategory === 'Rechnungen')).toBe(true);
      expect(searchResults.every((e) => new Date(e.date) > new Date('2026-01-01'))).toBe(true);

      // Step 3: Save the filter
      const saveResult = db.addSavedFilter('filter1', 'Amazon Invoices', query);
      expect(saveResult.success).toBe(true);
      expect(saveResult.changes).toBe(1);

      // Step 4: Verify saved filter appears in list
      const savedFilters = db.getSavedFilters();
      expect(savedFilters).toHaveLength(1);
      expect(savedFilters[0].name).toBe('Amazon Invoices');
      expect(savedFilters[0].query).toBe(query);

      // Step 5: Execute saved filter (simulate clicking on it)
      const filterToExecute = savedFilters.find((f) => f.name === 'Amazon Invoices');
      expect(filterToExecute).toBeDefined();

      const filterResults = db.searchEmails(filterToExecute!.query, accountId);

      // Step 6: Verify filter execution returns same results
      expect(filterResults).toHaveLength(2);
      expect(filterResults).toEqual(searchResults);

      // Step 7: Record search history
      db.addSearchHistory('search1', query);
      const history = db.getSearchHistory();
      expect(history).toHaveLength(1);
      expect(history[0].query).toBe(query);

      // Step 8: Performance check
      const startTime = Date.now();
      db.searchEmails(query, accountId);
      const searchTime = Date.now() - startTime;
      expect(searchTime).toBeLessThan(Number(process.env.SEARCH_SMALL_PERF_BUDGET_MS ?? (process.env.CI ? 500 : 100)));
    });
  });
});
