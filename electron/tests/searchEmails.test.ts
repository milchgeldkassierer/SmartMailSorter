import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

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
interface TestAccount {
  id: string;
  name: string;
  email: string;
  provider: string;
  username: string;
  password: string;
  imapHost: string;
  imapPort: number;
  color: string;
}

interface TestEmail {
  id: string;
  accountId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  body: string;
  date: string;
  folder: string;
  smartCategory?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  isFlagged?: boolean;
}

interface SearchResult {
  id: string;
  accountId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  date: string;
  folder: string;
  smartCategory: string | null;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
}

interface DbModule {
  init: (path: string) => void;
  addAccount: (account: TestAccount) => void;
  saveEmail: (email: TestEmail) => void;
  searchEmails: (query: string, accountId?: string | null) => SearchResult[];
}

// Import the database module under test
const db: DbModule = require('../db.cjs');

// Import folder constants
const { INBOX_FOLDER, SENT_FOLDER }: { INBOX_FOLDER: string; SENT_FOLDER: string } = require('../folderConstants.cjs');

describe('searchEmails', () => {
  const accountId = 'search-test-account';

  beforeEach(() => {
    // Initialize with in-memory DB for test isolation
    db.init(':memory:');
    // Create a test account
    db.addAccount({
      id: accountId,
      name: 'Test Account',
      email: 'test@example.com',
      provider: 'test',
      username: 'testuser',
      password: 'password',
      imapHost: 'imap.test.com',
      imapPort: 993,
      color: '#0000FF',
    });

    // Create test emails with different attributes
    db.saveEmail({
      id: 'email-1',
      accountId,
      sender: 'Amazon',
      senderEmail: 'noreply@amazon.com',
      subject: 'Your order has been shipped',
      body: 'Your package is on the way',
      date: '2026-01-15T10:00:00Z',
      folder: INBOX_FOLDER,
      smartCategory: 'Rechnungen',
      hasAttachments: true,
      isRead: false,
      isFlagged: false,
    });

    db.saveEmail({
      id: 'email-2',
      accountId,
      sender: 'Newsletter',
      senderEmail: 'news@example.com',
      subject: 'Weekly digest',
      body: "Here are this week's top stories",
      date: '2026-02-01T10:00:00Z',
      folder: INBOX_FOLDER,
      smartCategory: 'Newsletter',
      hasAttachments: false,
      isRead: true,
      isFlagged: false,
    });

    db.saveEmail({
      id: 'email-3',
      accountId,
      sender: 'Work Colleague',
      senderEmail: 'colleague@work.com',
      subject: 'Meeting notes',
      body: "Here are the notes from today's meeting",
      date: '2026-02-10T10:00:00Z',
      folder: SENT_FOLDER,
      smartCategory: 'Geschäftlich',
      hasAttachments: true,
      isRead: true,
      isFlagged: true,
    });
  });

  it('should search all emails with empty query', () => {
    const results = db.searchEmails('', accountId);
    expect(results).toHaveLength(3);
  });

  it('should filter by sender email with from: operator', () => {
    const results = db.searchEmails('from:amazon', accountId);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('email-1');
  });

  it('should filter by subject with subject: operator', () => {
    const results = db.searchEmails('subject:meeting', accountId);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('email-3');
  });

  it('should filter by category with category: operator', () => {
    const results = db.searchEmails('category:Newsletter', accountId);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('email-2');
  });

  it('should filter by attachments with has:attachment operator', () => {
    const results = db.searchEmails('has:attachment', accountId);
    expect(results).toHaveLength(2);
    expect(results.map((e) => e.id).sort()).toEqual(['email-1', 'email-3']);
  });

  it('should filter by date range with after: operator', () => {
    const results = db.searchEmails('after:2026-02-01', accountId);
    expect(results).toHaveLength(2);
    expect(results.map((e) => e.id).sort()).toEqual(['email-2', 'email-3']);
  });

  it('should filter by date range with before: operator', () => {
    const results = db.searchEmails('before:2026-02-01', accountId);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('email-1');
  });

  it('should combine multiple operators with AND logic', () => {
    const results = db.searchEmails('from:amazon category:Rechnungen has:attachment', accountId);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('email-1');
  });

  it('should search free text in subject and body', () => {
    const results = db.searchEmails('meeting', accountId);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('email-3');
  });

  it('should combine operators with free text search', () => {
    const results = db.searchEmails('category:Rechnungen shipped', accountId);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('email-1');
  });

  it('should return results sorted by date descending', () => {
    const results = db.searchEmails('', accountId);
    expect(results[0].id).toBe('email-3'); // 2026-02-10
    expect(results[1].id).toBe('email-2'); // 2026-02-01
    expect(results[2].id).toBe('email-1'); // 2026-01-15
  });

  it('should convert boolean fields correctly', () => {
    const results = db.searchEmails('from:amazon', accountId);
    expect(typeof results[0].isRead).toBe('boolean');
    expect(typeof results[0].isFlagged).toBe('boolean');
    expect(typeof results[0].hasAttachments).toBe('boolean');
  });

  it('should not include body/bodyHtml in results', () => {
    const results = db.searchEmails('', accountId);
    expect(results[0]).not.toHaveProperty('body');
    expect(results[0]).not.toHaveProperty('bodyHtml');
  });

  it('should search across all accounts when accountId is null', () => {
    // Create second account
    db.addAccount({
      id: 'account-2',
      name: 'Second Account',
      email: 'test2@example.com',
      provider: 'test',
      username: 'testuser2',
      password: 'password',
      imapHost: 'imap.test.com',
      imapPort: 993,
      color: '#FF0000',
    });

    db.saveEmail({
      id: 'email-4',
      accountId: 'account-2',
      sender: 'Another Sender',
      senderEmail: 'sender@example.com',
      subject: 'Test email',
      body: 'Test body',
      date: '2026-02-15T10:00:00Z',
      folder: INBOX_FOLDER,
    });

    const results = db.searchEmails('', null);
    expect(results).toHaveLength(4);
  });

  it('should handle quoted values in operators', () => {
    const results = db.searchEmails('subject:"Weekly digest"', accountId);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('email-2');
  });
});
