import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

// The vitest-setup.js file patches require() to intercept 'imapflow' imports
// Import helpers from setup to control mock state
import {
  resetMockState,
  setServerEmails,
  setConnectFailure,
  setFetchFailure,
  setQuotaResponse,
} from './vitest-setup.js';

// Use CommonJS require to ensure we get the SAME module instances as imap.cjs
const require = createRequire(import.meta.url);

// Mock electron (still use vi.mock for this)
vi.mock('electron', () => ({
  app: { getPath: () => './test-data' },
}));

// Use CJS require to get the same module instances that imap.cjs uses
// This ensures db.init() affects the same db variable that saveEmail() uses
const db = require('../db.cjs');
const imap = require('../imap.cjs');

// Helper function to create test accounts
function createTestAccount(overrides = {}) {
  return {
    id: overrides.id || 'test-account-1',
    email: overrides.email || 'test@example.com',
    username: overrides.username || 'test@example.com',
    password: overrides.password || 'testpass',
    imapHost: overrides.imapHost || 'imap.test.com',
    imapPort: overrides.imapPort || 993,
    ...overrides,
  };
}

// Helper to add account to database
function addAccountToDb(account) {
  db.addAccount({
    id: account.id,
    email: account.email,
    name: account.name || account.email,
    provider: account.provider || 'test',
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    username: account.username,
    password: account.password,
    color: account.color || '#000000',
  });
}

describe('IMAP Sync Edge Cases and Error Handling', () => {
  beforeEach(() => {
    // Initialize with in-memory database
    db.init(':memory:');
    // Reset mock server state
    resetMockState();
  });

  describe('Connection failure handling', () => {
    it('should return error when connection fails during sync', async () => {
      setConnectFailure(true);

      const account = createTestAccount({
        id: 'test-connection-fail',
        email: 'connfail@test.com',
      });

      addAccountToDb(account);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should return error when connection fails during testConnection', async () => {
      setConnectFailure(true);

      const account = createTestAccount({
        id: 'test-conn-test-fail',
        email: 'testconnfail@test.com',
      });

      const result = await imap.testConnection(account);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should succeed after connection failure is cleared', async () => {
      setConnectFailure(true);
      const account = createTestAccount({ id: 'recover-test' });
      addAccountToDb(account);

      const failResult = await imap.syncAccount(account);
      expect(failResult.success).toBe(false);

      setConnectFailure(false);
      setServerEmails([]);
      const successResult = await imap.syncAccount(account);
      expect(successResult.success).toBe(true);
    });
  });

  describe('testConnection function', () => {
    it('should successfully test connection with valid account', async () => {
      const account = createTestAccount({
        id: 'test-connection-valid',
        email: 'valid@test.com',
      });

      const result = await imap.testConnection(account);

      expect(result.success).toBe(true);
    });

    it('should use account.username when available', async () => {
      const account = createTestAccount({
        id: 'test-username',
        email: 'user@test.com',
        username: 'custom_username',
      });

      const result = await imap.testConnection(account);

      expect(result.success).toBe(true);
    });

    it('should fallback to email when username not provided', async () => {
      const account = {
        id: 'test-no-username',
        email: 'user@test.com',
        password: 'secret',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      const result = await imap.testConnection(account);

      expect(result.success).toBe(true);
    });
  });

  describe('PROVIDERS configuration', () => {
    it('should export PROVIDERS object', () => {
      expect(imap.PROVIDERS).toBeDefined();
      expect(typeof imap.PROVIDERS).toBe('object');
    });

    it('should have gmx provider configuration', () => {
      expect(imap.PROVIDERS.gmx).toBeDefined();
      expect(imap.PROVIDERS.gmx.host).toBe('imap.gmx.net');
      expect(imap.PROVIDERS.gmx.port).toBe(993);
      expect(imap.PROVIDERS.gmx.secure).toBe(true);
    });

    it('should have webde provider configuration', () => {
      expect(imap.PROVIDERS.webde).toBeDefined();
      expect(imap.PROVIDERS.webde.host).toBe('imap.web.de');
      expect(imap.PROVIDERS.webde.port).toBe(993);
      expect(imap.PROVIDERS.webde.secure).toBe(true);
    });

    it('should have gmail provider configuration', () => {
      expect(imap.PROVIDERS.gmail).toBeDefined();
      expect(imap.PROVIDERS.gmail.host).toBe('imap.gmail.com');
      expect(imap.PROVIDERS.gmail.port).toBe(993);
      expect(imap.PROVIDERS.gmail.secure).toBe(true);
    });
  });

  describe('deleteEmail function', () => {
    beforeEach(() => {
      setServerEmails([
        { uid: 100, body: 'Test email 1', flags: [] },
        { uid: 200, body: 'Test email 2', flags: ['\\Seen'] },
      ]);
    });

    it('should return error when UID is not provided', async () => {
      const account = createTestAccount();

      const result = await imap.deleteEmail(account, null, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No UID');
    });

    it('should return error when UID is 0', async () => {
      const account = createTestAccount();

      const result = await imap.deleteEmail(account, 0, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No UID');
    });

    it('should successfully delete email from INBOX (Posteingang)', async () => {
      const account = createTestAccount({ id: 'delete-test' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Posteingang');

      expect(result.success).toBe(true);
    });

    it('should handle delete when connection fails', async () => {
      setConnectFailure(true);
      const account = createTestAccount();

      const result = await imap.deleteEmail(account, 100, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should handle delete with dbFolder null (defaults to INBOX)', async () => {
      const account = createTestAccount({ id: 'delete-null-folder' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, null);

      expect(result.success).toBe(true);
    });

    it('should handle delete with dbFolder undefined', async () => {
      const account = createTestAccount({ id: 'delete-undef-folder' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, undefined);

      expect(result.success).toBe(true);
    });
  });

  describe('setEmailFlag function', () => {
    beforeEach(() => {
      setServerEmails([
        { uid: 100, body: 'Test email 1', flags: [] },
        { uid: 200, body: 'Test email 2', flags: ['\\Seen'] },
      ]);
    });

    it('should return error when UID is not provided', async () => {
      const account = createTestAccount();

      const result = await imap.setEmailFlag(account, null, '\\Seen', true, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No UID');
    });

    it('should return error when UID is 0', async () => {
      const account = createTestAccount();

      const result = await imap.setEmailFlag(account, 0, '\\Seen', true, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No UID');
    });

    it('should successfully add flag in INBOX (Posteingang)', async () => {
      const account = createTestAccount({ id: 'flag-add-test' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Posteingang');

      expect(result.success).toBe(true);

      // Verify flag was added
      const email = global.__mockState.serverEmails.find((e) => e.uid === 100);
      expect(email.flags.has('\\Seen')).toBe(true);
    });

    it('should successfully remove flag from email', async () => {
      const account = createTestAccount({ id: 'flag-remove-test' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 200, '\\Seen', false, 'Posteingang');

      expect(result.success).toBe(true);

      // Verify flag was removed
      const email = global.__mockState.serverEmails.find((e) => e.uid === 200);
      expect(email.flags.has('\\Seen')).toBe(false);
    });

    it('should handle setEmailFlag when connection fails', async () => {
      setConnectFailure(true);
      const account = createTestAccount();

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should handle setEmailFlag with dbFolder null (defaults to INBOX)', async () => {
      const account = createTestAccount({ id: 'flag-null-folder' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, null);

      expect(result.success).toBe(true);
    });

    it('should handle \\Flagged flag', async () => {
      const account = createTestAccount({ id: 'flagged-test' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Flagged', true, 'Posteingang');

      expect(result.success).toBe(true);

      const email = global.__mockState.serverEmails.find((e) => e.uid === 100);
      expect(email.flags.has('\\Flagged')).toBe(true);
    });
  });

  describe('Sync with email reconciliation (deleted emails)', () => {
    it('should remove locally orphaned emails that no longer exist on server', async () => {
      const account = createTestAccount({
        id: 'reconcile-test',
        email: 'reconcile@test.com',
      });

      addAccountToDb(account);

      // First sync: 3 emails on server
      setServerEmails([
        { uid: 1, body: 'Subject: Email 1\nFrom: a@b.com\n\nBody 1', flags: [] },
        { uid: 2, body: 'Subject: Email 2\nFrom: a@b.com\n\nBody 2', flags: [] },
        { uid: 3, body: 'Subject: Email 3\nFrom: a@b.com\n\nBody 3', flags: [] },
      ]);

      const result1 = await imap.syncAccount(account);
      expect(result1.success).toBe(true);
      expect(result1.count).toBe(3);

      let emails = db.getEmails(account.id);
      expect(emails).toHaveLength(3);

      // Second sync: Email 2 deleted from server
      setServerEmails([
        { uid: 1, body: 'Subject: Email 1\nFrom: a@b.com\n\nBody 1', flags: [] },
        { uid: 3, body: 'Subject: Email 3\nFrom: a@b.com\n\nBody 3', flags: [] },
      ]);

      const result2 = await imap.syncAccount(account);
      expect(result2.success).toBe(true);
      expect(result2.count).toBe(0); // No new emails

      // Verify local email was deleted
      emails = db.getEmails(account.id);
      expect(emails).toHaveLength(2);
      expect(emails.find((e) => e.uid === 2)).toBeUndefined();
    });
  });

  describe('Email parsing edge cases', () => {
    it('should handle email without From header', async () => {
      const account = createTestAccount({
        id: 'no-from-test',
        email: 'nofrom@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          body: `Subject: No From Header\nDate: ${new Date().toISOString()}\n\nThis email has no From header`,
          flags: [],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const emails = db.getEmails(account.id);
      expect(emails).toHaveLength(1);
      // Should have fallback sender
      expect(emails[0].sender).toBeDefined();
    });

    it('should handle email without Subject header', async () => {
      const account = createTestAccount({
        id: 'no-subject-test',
        email: 'nosubject@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          body: `From: sender@example.com\nDate: ${new Date().toISOString()}\n\nThis email has no subject`,
          flags: [],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const emails = db.getEmails(account.id);
      expect(emails).toHaveLength(1);
      // Should have fallback subject
      expect(emails[0].subject).toBeDefined();
    });

    it('should handle email with UTF-8 content', async () => {
      const account = createTestAccount({
        id: 'utf8-test',
        email: 'utf8@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          body: `Subject: =?UTF-8?Q?Hallo_W=C3=BCrld?=\nFrom: sender@example.com\nContent-Type: text/plain; charset=utf-8\n\nÄÖÜ äöü ß Привет мир 你好世界`,
          flags: [],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should handle empty mailbox', async () => {
      const account = createTestAccount({
        id: 'empty-mailbox-test',
        email: 'empty@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe('Flag status in synced emails', () => {
    it('should correctly sync \\Seen flag (isRead)', async () => {
      const account = createTestAccount({
        id: 'flag-seen-sync',
        email: 'seen@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          body: `Subject: Unread Email\nFrom: a@b.com\n\nBody`,
          flags: [],
        },
        {
          uid: 2,
          body: `Subject: Read Email\nFrom: a@b.com\n\nBody`,
          flags: ['\\Seen'],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);

      const emails = db.getEmails(account.id);
      const unreadEmail = emails.find((e) => e.uid === 1);
      const readEmail = emails.find((e) => e.uid === 2);

      expect(unreadEmail.isRead).toBe(false);
      expect(readEmail.isRead).toBe(true);
    });

    it('should correctly sync \\Flagged flag (isFlagged)', async () => {
      const account = createTestAccount({
        id: 'flag-flagged-sync',
        email: 'flagged@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          body: `Subject: Unflagged Email\nFrom: a@b.com\n\nBody`,
          flags: [],
        },
        {
          uid: 2,
          body: `Subject: Flagged Email\nFrom: a@b.com\n\nBody`,
          flags: ['\\Flagged'],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);

      const emails = db.getEmails(account.id);
      const unflaggedEmail = emails.find((e) => e.uid === 1);
      const flaggedEmail = emails.find((e) => e.uid === 2);

      expect(unflaggedEmail.isFlagged).toBe(false);
      expect(flaggedEmail.isFlagged).toBe(true);
    });

    it('should handle email with both \\Seen and \\Flagged', async () => {
      const account = createTestAccount({
        id: 'both-flags-sync',
        email: 'both@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          body: `Subject: Both Flags\nFrom: a@b.com\n\nBody`,
          flags: ['\\Seen', '\\Flagged'],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const emails = db.getEmails(account.id);
      expect(emails[0].isRead).toBe(true);
      expect(emails[0].isFlagged).toBe(true);
    });
  });

  describe('Account authentication variations', () => {
    it('should use username field when provided', async () => {
      const account = createTestAccount({
        id: 'username-auth',
        email: 'user@example.com',
        username: 'custom_username',
      });

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should fallback to email when username not provided', async () => {
      const account = {
        id: 'email-auth',
        email: 'user@example.com',
        password: 'password',
        imapHost: 'imap.example.com',
        imapPort: 993,
      };

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });
  });

  describe('Large email batch handling', () => {
    it('should handle 100+ emails efficiently', async () => {
      const account = createTestAccount({
        id: 'large-batch-test',
        email: 'large@test.com',
      });

      addAccountToDb(account);

      const emails = [];
      for (let i = 1; i <= 100; i++) {
        emails.push({
          uid: i,
          body: `Subject: Email ${i}\nFrom: sender${i}@example.com\n\nBody content for email ${i}`,
          flags: i % 2 === 0 ? ['\\Seen'] : [],
        });
      }

      setServerEmails(emails);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(100);

      const savedEmails = db.getEmails(account.id);
      expect(savedEmails).toHaveLength(100);

      // Verify alternating read status
      const readEmails = savedEmails.filter((e) => e.isRead);
      const unreadEmails = savedEmails.filter((e) => !e.isRead);
      expect(readEmails.length).toBe(50);
      expect(unreadEmails.length).toBe(50);
    });
  });

  describe('Module exports', () => {
    it('should export syncAccount function', () => {
      expect(typeof imap.syncAccount).toBe('function');
    });

    it('should export testConnection function', () => {
      expect(typeof imap.testConnection).toBe('function');
    });

    it('should export deleteEmail function', () => {
      expect(typeof imap.deleteEmail).toBe('function');
    });

    it('should export setEmailFlag function', () => {
      expect(typeof imap.setEmailFlag).toBe('function');
    });

    it('should export PROVIDERS object', () => {
      expect(typeof imap.PROVIDERS).toBe('object');
    });
  });

  describe('processMessages edge cases (lines 102-119)', () => {
    it('should handle messages without body/source returning empty body placeholder', async () => {
      const account = createTestAccount({
        id: 'no-body-test',
        email: 'nobody@test.com',
      });

      addAccountToDb(account);

      // Email with noSource flag - simulates server returning no content for message
      setServerEmails([
        {
          uid: 1,
          body: '',
          flags: [],
          noSource: true, // This triggers the mock to not include source
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      // Note: count is 0 because savedCount only increments on successful parse,
      // not for error placeholders (lines 102-119)
      expect(result.count).toBe(0);

      const emails = db.getEmails(account.id);
      expect(emails).toHaveLength(1);

      // Should have error placeholder values
      // Note: body is not returned by getEmails for optimization,
      // so we check other fields instead
      expect(emails[0].sender).toBe('System Error');
      expect(emails[0].senderEmail).toBe('error@local');
      expect(emails[0].subject).toContain('Empty Body UID 1');
      expect(emails[0].smartCategory).toBe('System Error');
      expect(emails[0].isRead).toBe(true);
      expect(emails[0].isFlagged).toBe(false);
    });

    it('should handle multiple messages with some missing body', async () => {
      const account = createTestAccount({
        id: 'mixed-body-test',
        email: 'mixed@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          body: 'Subject: Normal Email\nFrom: sender@test.com\n\nNormal content',
          flags: [],
        },
        {
          uid: 2,
          body: '',
          flags: [],
          noSource: true, // No body
        },
        {
          uid: 3,
          body: 'Subject: Another Normal\nFrom: other@test.com\n\nMore content',
          flags: ['\\Seen'],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      // Note: count is 2 because savedCount only increments on successful parse,
      // not for error placeholders (the noSource message doesn't count)
      expect(result.count).toBe(2);

      const emails = db.getEmails(account.id);
      expect(emails).toHaveLength(3);

      // Find the error placeholder
      const errorEmail = emails.find((e) => e.uid === 2);
      expect(errorEmail.sender).toBe('System Error');
      expect(errorEmail.subject).toContain('Empty Body UID 2');

      // Normal emails should be processed correctly
      const normalEmails = emails.filter((e) => e.sender !== 'System Error');
      expect(normalEmails).toHaveLength(2);
    });
  });

  describe('Quota handling (lines 146-175)', () => {
    it('should update account quota when server returns valid quota', async () => {
      const account = createTestAccount({
        id: 'quota-test',
        email: 'quota@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);

      // Set quota response (storage in bytes)
      setQuotaResponse({
        storage: {
          used: 1048576, // 1MB = 1024KB
          limit: 10485760, // 10MB = 10240KB
        },
      });

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should handle null quota response gracefully', async () => {
      const account = createTestAccount({
        id: 'no-quota-test',
        email: 'noquota@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);
      setQuotaResponse(null);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should handle quota without storage property', async () => {
      const account = createTestAccount({
        id: 'quota-no-storage',
        email: 'nostorge@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);
      setQuotaResponse({}); // Empty quota object

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should handle zero storage limit', async () => {
      const account = createTestAccount({
        id: 'quota-zero-limit',
        email: 'zerolimit@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);
      setQuotaResponse({
        storage: {
          used: 1000,
          limit: 0, // Zero limit should be handled
        },
      });

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });
  });

  describe('Email ID generation for different folders', () => {
    it('should generate correct ID for Posteingang (INBOX)', async () => {
      const account = createTestAccount({
        id: 'id-inbox-test',
        email: 'inbox@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 100,
          body: 'Subject: Test\nFrom: sender@test.com\n\nBody',
          flags: [],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);

      const emails = db.getEmails(account.id);
      expect(emails).toHaveLength(1);
      // INBOX/Posteingang ID format: uid-accountId
      expect(emails[0].id).toBe('100-id-inbox-test');
    });
  });

  describe('Sync with malformed email content', () => {
    it('should handle emails with malformed headers gracefully', async () => {
      const account = createTestAccount({
        id: 'malformed-test',
        email: 'malformed@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          // Malformed email with no proper headers
          body: 'This is just some random text without proper email headers',
          flags: [],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const emails = db.getEmails(account.id);
      expect(emails).toHaveLength(1);
      // Should still be saved with fallback values
      expect(emails[0].sender).toBeDefined();
    });

    it('should handle completely empty email body', async () => {
      const account = createTestAccount({
        id: 'empty-body-test',
        email: 'empty@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          body: '',
          flags: [],
        },
      ]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe('Fetch failure handling', () => {
    it('should handle fetch failure gracefully', async () => {
      const account = createTestAccount({
        id: 'fetch-fail-test',
        email: 'fetchfail@test.com',
      });

      addAccountToDb(account);

      setServerEmails([
        {
          uid: 1,
          body: 'Subject: Test\nFrom: sender@test.com\n\nBody',
          flags: [],
        },
      ]);

      setFetchFailure(true);

      const result = await imap.syncAccount(account);

      // Should still succeed at the account level, even if fetch failed for some ranges
      expect(result.success).toBe(true);
    });
  });

  describe('syncFolderMessages integration', () => {
    it('should sync folder messages with complete flow', async () => {
      const account = createTestAccount({
        id: 'sync-folder-test',
        email: 'syncfolder@test.com',
      });

      addAccountToDb(account);

      // Set up server emails for syncing
      setServerEmails([
        {
          uid: 100,
          body: 'Subject: Test Email 1\nFrom: sender1@test.com\nTo: syncfolder@test.com\n\nBody 1',
          flags: [],
        },
        {
          uid: 200,
          body: 'Subject: Test Email 2\nFrom: sender2@test.com\nTo: syncfolder@test.com\n\nBody 2',
          flags: ['\\Seen'],
        },
        {
          uid: 300,
          body: 'Subject: Test Email 3\nFrom: sender3@test.com\nTo: syncfolder@test.com\n\nBody 3',
          flags: [],
        },
      ]);

      // Create a mock IMAP client by connecting
      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: {
          user: account.username || account.email,
          pass: account.password,
        },
      });

      await client.connect();

      // Call syncFolderMessages directly
      const newMessagesCount = await imap.syncFolderMessages(client, account, 'INBOX', 'inbox');

      // Verify the result
      expect(newMessagesCount).toBe(3);

      // Verify messages were saved to database
      const savedEmails = db.getAllUidsForFolder(account.id, 'inbox');
      expect(savedEmails).toContain(100);
      expect(savedEmails).toContain(200);
      expect(savedEmails).toContain(300);

      await client.logout();
    });

    it('should handle empty folder', async () => {
      const account = createTestAccount({
        id: 'empty-folder-test',
        email: 'emptyfolder@test.com',
      });

      addAccountToDb(account);

      // Set up empty server
      setServerEmails([]);

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: {
          user: account.username || account.email,
          pass: account.password,
        },
      });

      await client.connect();

      const newMessagesCount = await imap.syncFolderMessages(client, account, 'INBOX', 'inbox');

      expect(newMessagesCount).toBe(0);

      await client.logout();
    });

    it('should reconcile orphaned emails', async () => {
      const account = createTestAccount({
        id: 'orphan-test',
        email: 'orphan@test.com',
      });

      addAccountToDb(account);

      // First sync with 3 emails
      setServerEmails([
        {
          uid: 100,
          body: 'Subject: Email 1\nFrom: sender@test.com\n\nBody 1',
          flags: [],
        },
        {
          uid: 200,
          body: 'Subject: Email 2\nFrom: sender@test.com\n\nBody 2',
          flags: [],
        },
        {
          uid: 300,
          body: 'Subject: Email 3\nFrom: sender@test.com\n\nBody 3',
          flags: [],
        },
      ]);

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: {
          user: account.username || account.email,
          pass: account.password,
        },
      });

      await client.connect();

      // First sync
      await imap.syncFolderMessages(client, account, 'INBOX', 'inbox');

      let savedEmails = db.getAllUidsForFolder(account.id, 'inbox');
      expect(savedEmails.length).toBe(3);

      // Second sync with only 2 emails (one deleted from server)
      setServerEmails([
        {
          uid: 100,
          body: 'Subject: Email 1\nFrom: sender@test.com\n\nBody 1',
          flags: [],
        },
        {
          uid: 300,
          body: 'Subject: Email 3\nFrom: sender@test.com\n\nBody 3',
          flags: [],
        },
      ]);

      await imap.syncFolderMessages(client, account, 'INBOX', 'inbox');

      // Verify orphaned email (UID 200) was deleted
      savedEmails = db.getAllUidsForFolder(account.id, 'inbox');
      expect(savedEmails.length).toBe(2);
      expect(savedEmails).toContain(100);
      expect(savedEmails).not.toContain(200);
      expect(savedEmails).toContain(300);

      await client.logout();
    });

    it('should handle large batch of messages', async () => {
      const account = createTestAccount({
        id: 'large-batch-test',
        email: 'largebatch@test.com',
      });

      addAccountToDb(account);

      // Create 150 messages to test batch processing
      const largeEmailSet = [];
      for (let i = 1; i <= 150; i++) {
        largeEmailSet.push({
          uid: i * 10,
          body: `Subject: Email ${i}\nFrom: sender${i}@test.com\n\nBody ${i}`,
          flags: [],
        });
      }

      setServerEmails(largeEmailSet);

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: {
          user: account.username || account.email,
          pass: account.password,
        },
      });

      await client.connect();

      const newMessagesCount = await imap.syncFolderMessages(client, account, 'INBOX', 'inbox');

      expect(newMessagesCount).toBe(150);

      const savedEmails = db.getAllUidsForFolder(account.id, 'inbox');
      expect(savedEmails.length).toBe(150);

      await client.logout();
    });

    it('should only sync missing messages on subsequent syncs', async () => {
      const account = createTestAccount({
        id: 'incremental-sync-test',
        email: 'incrementalsync@test.com',
      });

      addAccountToDb(account);

      // First sync with 2 emails
      setServerEmails([
        {
          uid: 100,
          body: 'Subject: Email 1\nFrom: sender@test.com\n\nBody 1',
          flags: [],
        },
        {
          uid: 200,
          body: 'Subject: Email 2\nFrom: sender@test.com\n\nBody 2',
          flags: [],
        },
      ]);

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: {
          user: account.username || account.email,
          pass: account.password,
        },
      });

      await client.connect();

      const firstSync = await imap.syncFolderMessages(client, account, 'INBOX', 'inbox');
      expect(firstSync).toBe(2);

      // Second sync adds 1 new email
      setServerEmails([
        {
          uid: 100,
          body: 'Subject: Email 1\nFrom: sender@test.com\n\nBody 1',
          flags: [],
        },
        {
          uid: 200,
          body: 'Subject: Email 2\nFrom: sender@test.com\n\nBody 2',
          flags: [],
        },
        {
          uid: 300,
          body: 'Subject: Email 3\nFrom: sender@test.com\n\nBody 3',
          flags: [],
        },
      ]);

      const secondSync = await imap.syncFolderMessages(client, account, 'INBOX', 'inbox');
      expect(secondSync).toBe(1); // Only 1 new message

      const savedEmails = db.getAllUidsForFolder(account.id, 'inbox');
      expect(savedEmails.length).toBe(3);

      await client.logout();
    });
  });
});
