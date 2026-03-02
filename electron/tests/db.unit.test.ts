import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { ImapAccount, Email, CategorizationFeedback } from '../../src/types';

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
interface SavedFilter {
  id: string;
  name: string;
  query: string;
  createdAt: number;
}

interface SearchHistory {
  id: string;
  query: string;
  timestamp: number;
}

interface DbModule {
  init: (path: string) => void;
  addAccount: (account: Partial<ImapAccount> & { id: string; username?: string; password?: string }) => void;
  getAccounts: () => Array<ImapAccount & { username?: string; password?: string; lastSyncUid?: number }>;
  saveEmail: (email: Partial<Email> & { id: string; accountId: string }) => void;
  getEmails: (accountId: string) => Email[];
  updateAccountQuota: (id: string, used: number, total: number) => void;
  getSavedFilters: () => SavedFilter[];
  addSavedFilter: (id: string, name: string, query: string) => { success: boolean; changes: number };
  updateSavedFilter: (id: string, name: string, query: string) => { success: boolean; changes: number };
  deleteSavedFilter: (id: string) => { success: boolean; changes: number };
  getSearchHistory: () => SearchHistory[];
  addSearchHistory: (id: string, query: string) => { success: boolean; changes: number };
  clearSearchHistory: () => { success: boolean; changes: number };
  saveCategorizationFeedback: (feedback: CategorizationFeedback) => void;
  getCategorizationFeedback: (accountId: string, limit: number) => CategorizationFeedback[];
  getRecentFeedbackForSender: (accountId: string, senderEmail: string, limit: number) => CategorizationFeedback[];
  exportCategorizationFeedback: (accountId: string) => CategorizationFeedback[];
  clearCategorizationFeedback: (accountId: string) => { success: boolean; changes: number };
  deleteEmail: (emailId: string) => void;
  deleteAccountDn: (id: string) => void;
}

// Import the database module under test
const db: DbModule = require('../db.cjs');

describe('Database Module', () => {
  beforeEach(() => {
    // Initialize with in-memory DB for test isolation
    // This exercises the DI path in db.cjs
    db.init(':memory:');
  });

  it('should add and retrieve accounts', () => {
    const account = {
      id: 'acc1',
      name: 'Test Account',
      email: 'test@example.com',
      provider: 'test',
      username: 'testuser',
      password: 'password',
      imapHost: 'imap.test.com',
      imapPort: 993,
      color: '#0000FF',
    };

    db.addAccount(account);
    const accounts = db.getAccounts();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].email).toBe('test@example.com');
    expect(accounts[0].name).toBe('Test Account');
    expect(accounts[0].imapHost).toBe('imap.test.com');
  });

  it('should save and retrieve emails', () => {
    // First add an account (foreign key requirement)
    const account = {
      id: 'acc2',
      name: 'Test',
      email: 't@t.com',
      provider: 'test',
      imapHost: 'imap.test.com',
      imapPort: 993,
      username: 'test',
      password: 'pass',
      color: '#000000',
    };
    db.addAccount(account);

    const email = {
      id: 'email1',
      accountId: 'acc2',
      sender: 'Sender',
      senderEmail: 'sender@test.com',
      subject: 'Subject',
      body: 'Body',
      date: new Date().toISOString(),
      category: 'Inbox',
      isRead: false,
      isFlagged: false,
      uid: 100,
    };

    db.saveEmail(email);
    const emails = db.getEmails('acc2');

    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe('Subject');
    expect(emails[0].sender).toBe('Sender');
    expect(emails[0].uid).toBe(100);
  });

  it('should update account quota', () => {
    const account = {
      id: 'acc3',
      name: 'Test',
      email: 't@t.com',
      provider: 'test',
      imapHost: 'imap.test.com',
      imapPort: 993,
      username: 'test',
      password: 'pass',
      color: '#000000',
    };
    db.addAccount(account);

    db.updateAccountQuota('acc3', 1000, 5000);
    const accounts = db.getAccounts();
    const updated = accounts.find((a) => a.id === 'acc3');

    expect(updated?.storageUsed).toBe(1000);
    expect(updated?.storageTotal).toBe(5000);
  });

  describe('Saved Filters', () => {
    it('should add and retrieve saved filters', () => {
      const result = db.addSavedFilter('filter1', 'Amazon Invoices', 'from:amazon category:Rechnungen');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);

      const filters = db.getSavedFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0].id).toBe('filter1');
      expect(filters[0].name).toBe('Amazon Invoices');
      expect(filters[0].query).toBe('from:amazon category:Rechnungen');
      expect(filters[0].createdAt).toBeGreaterThan(0);
    });

    it('should update a saved filter', () => {
      db.addSavedFilter('filter2', 'Old Name', 'old query');

      const result = db.updateSavedFilter('filter2', 'New Name', 'new query');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);

      const filters = db.getSavedFilters();
      const updated = filters.find((f) => f.id === 'filter2');
      expect(updated?.name).toBe('New Name');
      expect(updated?.query).toBe('new query');
    });

    it('should delete a saved filter', () => {
      db.addSavedFilter('filter3', 'To Delete', 'some query');

      let filters = db.getSavedFilters();
      expect(filters.find((f) => f.id === 'filter3')).toBeDefined();

      const result = db.deleteSavedFilter('filter3');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);

      filters = db.getSavedFilters();
      expect(filters.find((f) => f.id === 'filter3')).toBeUndefined();
    });

    it('should return filters ordered by createdAt DESC', () => {
      // Add filters with slight delay to ensure different timestamps
      db.addSavedFilter('filter4', 'First', 'query1');
      db.addSavedFilter('filter5', 'Second', 'query2');

      const filters = db.getSavedFilters();

      expect(filters.length).toBeGreaterThanOrEqual(2);
      // Most recent should be first
      expect(filters[0].createdAt).toBeGreaterThanOrEqual(filters[filters.length - 1].createdAt);
    });

    it('should return empty array when no filters exist', () => {
      // Fresh database from beforeEach
      const filters = db.getSavedFilters();
      expect(filters).toEqual([]);
    });

    it('should handle updating non-existent filter', () => {
      const result = db.updateSavedFilter('non-existent', 'Name', 'query');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(0);
    });

    it('should handle deleting non-existent filter', () => {
      const result = db.deleteSavedFilter('non-existent');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(0);
    });
  });

  describe('Search History', () => {
    it('should add and retrieve search history', () => {
      const result = db.addSearchHistory('search1', 'from:amazon');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);

      const history = db.getSearchHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('search1');
      expect(history[0].query).toBe('from:amazon');
      expect(history[0].timestamp).toBeGreaterThan(0);
    });

    it('should return search history ordered by timestamp DESC', () => {
      db.addSearchHistory('search2', 'query1');
      db.addSearchHistory('search3', 'query2');

      const history = db.getSearchHistory();

      expect(history.length).toBeGreaterThanOrEqual(2);
      // Most recent should be first
      expect(history[0].timestamp).toBeGreaterThanOrEqual(history[history.length - 1].timestamp);
    });

    it('should limit search history to last 20 entries', () => {
      // Add 25 search queries
      for (let i = 1; i <= 25; i++) {
        db.addSearchHistory(`search-${i}`, `query ${i}`);
      }

      const history = db.getSearchHistory();
      // Should only keep the last 20
      expect(history.length).toBeLessThanOrEqual(20);
    });

    it('should clear all search history', () => {
      db.addSearchHistory('search4', 'query1');
      db.addSearchHistory('search5', 'query2');

      let history = db.getSearchHistory();
      expect(history.length).toBeGreaterThan(0);

      const result = db.clearSearchHistory();

      expect(result.success).toBe(true);
      expect(result.changes).toBeGreaterThan(0);

      history = db.getSearchHistory();
      expect(history).toEqual([]);
    });

    it('should return empty array when no search history exists', () => {
      const history = db.getSearchHistory();
      expect(history).toEqual([]);
    });

    it('should handle clearing empty search history', () => {
      const result = db.clearSearchHistory();

      expect(result.success).toBe(true);
      expect(result.changes).toBe(0);
    });
  });

  describe('Categorization Feedback', () => {
    beforeEach(() => {
      db.init(':memory:');

      // Add test account (required for foreign key)
      const account = {
        id: 'test-acc',
        name: 'Test Account',
        email: 'test@example.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'test',
        password: 'pass',
        color: '#FF0000',
      };
      db.addAccount(account);

      // Add test email (required for foreign key)
      const email = {
        id: 'test-email-1',
        accountId: 'test-acc',
        sender: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Test Email',
        body: 'Test Body',
        date: new Date().toISOString(),
        category: 'Inbox',
        isRead: false,
        isFlagged: false,
        uid: 1,
      };
      db.saveEmail(email);
    });

    it('should save and retrieve categorization feedback', () => {
      // Create feedback object
      const feedback = {
        id: 'feedback1',
        emailId: 'test-email-1',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Important',
        sender: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Test Email',
        aiSummary: 'Email summary',
        aiReasoning: 'AI reasoning',
        confidence: 0.85,
        correctedAt: Date.now(),
      };

      // Save feedback
      db.saveCategorizationFeedback(feedback);

      // Retrieve feedback
      const result = db.getCategorizationFeedback('test-acc', 100);

      // Assertions
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('feedback1');
      expect(result[0].originalCategory).toBe('Inbox');
      expect(result[0].correctedCategory).toBe('Important');
      expect(result[0].senderEmail).toBe('john@example.com');
      expect(result[0].confidence).toBe(0.85);
    });

    it('should get recent feedback for specific sender', () => {
      // Add multiple emails from same sender
      const email2 = {
        id: 'test-email-2',
        accountId: 'test-acc',
        sender: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Second Email',
        body: 'Body',
        date: new Date().toISOString(),
        category: 'Inbox',
        isRead: false,
        isFlagged: false,
        uid: 2,
      };
      db.saveEmail(email2);

      // Add feedback for both emails
      db.saveCategorizationFeedback({
        id: 'f1',
        emailId: 'test-email-1',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Important',
        sender: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Test Email',
        aiSummary: null,
        aiReasoning: null,
        confidence: 0.8,
        correctedAt: Date.now() - 1000,
      });

      db.saveCategorizationFeedback({
        id: 'f2',
        emailId: 'test-email-2',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Work',
        sender: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Second Email',
        aiSummary: null,
        aiReasoning: null,
        confidence: 0.9,
        correctedAt: Date.now(),
      });

      // Get feedback for sender
      const result = db.getRecentFeedbackForSender('test-acc', 'john@example.com', 10);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('f2'); // Most recent first
      expect(result[1].id).toBe('f1');
    });

    it('should limit recent feedback to specified count', () => {
      // Add 10 emails and feedback entries
      for (let i = 0; i < 10; i++) {
        const email = {
          id: `email-${i}`,
          accountId: 'test-acc',
          sender: 'Sender',
          senderEmail: 'sender@example.com',
          subject: `Email ${i}`,
          body: 'Body',
          date: new Date().toISOString(),
          category: 'Inbox',
          isRead: false,
          isFlagged: false,
          uid: i + 10,
        };
        db.saveEmail(email);

        db.saveCategorizationFeedback({
          id: `f-${i}`,
          emailId: `email-${i}`,
          accountId: 'test-acc',
          originalCategory: 'Inbox',
          correctedCategory: 'Important',
          sender: 'Sender',
          senderEmail: 'sender@example.com',
          subject: `Email ${i}`,
          aiSummary: null,
          aiReasoning: null,
          confidence: 0.8,
          correctedAt: Date.now() + i,
        });
      }

      // Limit to 5
      const result = db.getRecentFeedbackForSender('test-acc', 'sender@example.com', 5);

      expect(result).toHaveLength(5);
      // Should be most recent 5 (highest indices)
      expect(result[0].id).toBe('f-9');
      expect(result[4].id).toBe('f-5');
    });

    it('should export categorization feedback with all data', () => {
      const feedback = {
        id: 'export-test',
        emailId: 'test-email-1',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Important',
        sender: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Test',
        aiSummary: 'Summary',
        aiReasoning: 'Reasoning',
        confidence: 0.9,
        correctedAt: Date.now(),
      };

      db.saveCategorizationFeedback(feedback);

      const exported = db.exportCategorizationFeedback('test-acc');

      expect(exported).toHaveLength(1);
      expect(exported[0].id).toBe('export-test');
      expect(exported[0].originalCategory).toBe('Inbox');
      expect(exported[0].aiSummary).toBe('Summary');
    });

    it('should clear categorization feedback for account', () => {
      db.saveCategorizationFeedback({
        id: 'clear-test',
        emailId: 'test-email-1',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Important',
        sender: 'John',
        senderEmail: 'john@example.com',
        subject: 'Test',
        aiSummary: null,
        aiReasoning: null,
        confidence: 0.8,
        correctedAt: Date.now(),
      });

      let feedback = db.getCategorizationFeedback('test-acc', 100);
      expect(feedback.length).toBeGreaterThan(0);

      const result = db.clearCategorizationFeedback('test-acc');

      expect(result.success).toBe(true);
      expect(result.changes).toBeGreaterThan(0);

      feedback = db.getCategorizationFeedback('test-acc', 100);
      expect(feedback).toEqual([]);
    });

    it('should return empty array when no feedback exists', () => {
      const feedback = db.getCategorizationFeedback('test-acc', 100);
      expect(feedback).toEqual([]);
    });

    it('should cascade delete feedback when email is deleted', () => {
      // Add feedback
      db.saveCategorizationFeedback({
        id: 'cascade-test',
        emailId: 'test-email-1',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Important',
        sender: 'John',
        senderEmail: 'john@example.com',
        subject: 'Test',
        aiSummary: null,
        aiReasoning: null,
        confidence: 0.8,
        correctedAt: Date.now(),
      });

      let feedback = db.getCategorizationFeedback('test-acc', 100);
      expect(feedback).toHaveLength(1);

      // Delete the email (this should cascade delete feedback)
      db.deleteEmail('test-email-1');

      feedback = db.getCategorizationFeedback('test-acc', 100);
      expect(feedback).toEqual([]);
    });

    it('should cascade delete feedback when account is deleted', () => {
      db.saveCategorizationFeedback({
        id: 'acc-cascade-test',
        emailId: 'test-email-1',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Important',
        sender: 'John',
        senderEmail: 'john@example.com',
        subject: 'Test',
        aiSummary: null,
        aiReasoning: null,
        confidence: 0.8,
        correctedAt: Date.now(),
      });

      let feedback = db.getCategorizationFeedback('test-acc', 100);
      expect(feedback).toHaveLength(1);

      // Delete the account (this should cascade delete feedback)
      db.deleteAccountDn('test-acc');

      feedback = db.getCategorizationFeedback('test-acc', 100);
      expect(feedback).toEqual([]);
    });

    it('should order feedback by correctedAt DESC', () => {
      const email2 = {
        id: 'email-2',
        accountId: 'test-acc',
        sender: 'Jane',
        senderEmail: 'jane@example.com',
        subject: 'Email 2',
        body: 'Body',
        date: new Date().toISOString(),
        category: 'Inbox',
        isRead: false,
        isFlagged: false,
        uid: 99,
      };
      db.saveEmail(email2);

      const now = Date.now();

      db.saveCategorizationFeedback({
        id: 'f-old',
        emailId: 'test-email-1',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Important',
        sender: 'John',
        senderEmail: 'john@example.com',
        subject: 'Test',
        aiSummary: null,
        aiReasoning: null,
        confidence: 0.8,
        correctedAt: now - 10000,
      });

      db.saveCategorizationFeedback({
        id: 'f-new',
        emailId: 'email-2',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Work',
        sender: 'Jane',
        senderEmail: 'jane@example.com',
        subject: 'Email 2',
        aiSummary: null,
        aiReasoning: null,
        confidence: 0.9,
        correctedAt: now,
      });

      const feedback = db.getCategorizationFeedback('test-acc', 100);

      expect(feedback[0].id).toBe('f-new'); // Most recent first
      expect(feedback[1].id).toBe('f-old');
      expect(feedback[0].correctedAt).toBeGreaterThan(feedback[1].correctedAt);
    });

    it('should filter feedback by accountId', () => {
      // Add second account
      const account2 = {
        id: 'acc2',
        name: 'Account 2',
        email: 'test2@example.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'test2',
        password: 'pass',
        color: '#00FF00',
      };
      db.addAccount(account2);

      const email2 = {
        id: 'email-acc2',
        accountId: 'acc2',
        sender: 'Other',
        senderEmail: 'other@example.com',
        subject: 'Other Email',
        body: 'Body',
        date: new Date().toISOString(),
        category: 'Inbox',
        isRead: false,
        isFlagged: false,
        uid: 1,
      };
      db.saveEmail(email2);

      // Add feedback for both accounts
      db.saveCategorizationFeedback({
        id: 'f-acc1',
        emailId: 'test-email-1',
        accountId: 'test-acc',
        originalCategory: 'Inbox',
        correctedCategory: 'Important',
        sender: 'John',
        senderEmail: 'john@example.com',
        subject: 'Test',
        aiSummary: null,
        aiReasoning: null,
        confidence: 0.8,
        correctedAt: Date.now(),
      });

      db.saveCategorizationFeedback({
        id: 'f-acc2',
        emailId: 'email-acc2',
        accountId: 'acc2',
        originalCategory: 'Inbox',
        correctedCategory: 'Work',
        sender: 'Other',
        senderEmail: 'other@example.com',
        subject: 'Other Email',
        aiSummary: null,
        aiReasoning: null,
        confidence: 0.9,
        correctedAt: Date.now(),
      });

      // Get feedback for each account
      const acc1Feedback = db.getCategorizationFeedback('test-acc', 100);
      const acc2Feedback = db.getCategorizationFeedback('acc2', 100);

      expect(acc1Feedback).toHaveLength(1);
      expect(acc1Feedback[0].id).toBe('f-acc1');

      expect(acc2Feedback).toHaveLength(1);
      expect(acc2Feedback[0].id).toBe('f-acc2');
    });

    it('should handle clearing empty feedback', () => {
      const result = db.clearCategorizationFeedback('test-acc');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(0); // Nothing to delete
    });
  });
});
