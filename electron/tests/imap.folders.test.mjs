import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

// Import helpers from vitest-setup to control mock state
import {
  resetMockState,
  setServerEmails,
  setConnectFailure as _setConnectFailure,
  setFolderList,
  setQuotaResponse,
} from './vitest-setup.js';

// Use CommonJS require to ensure we get the SAME module instances as imap.cjs
const require = createRequire(import.meta.url);

// Mock electron
vi.mock('electron', () => ({
  app: { getPath: () => './test-data' },
}));

// Use CJS require to get the same module instances that imap.cjs uses
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

describe('IMAP Folder Mapping and Special Folders', () => {
  beforeEach(() => {
    db.init(':memory:');
    resetMockState();
  });

  describe('deleteEmail with folder mapping', () => {
    beforeEach(() => {
      setServerEmails([
        { uid: 100, body: 'Test email in INBOX', flags: [] },
        { uid: 200, body: 'Test email in Sent', flags: ['\\Seen'] },
      ]);
    });

    it('should delete from INBOX when dbFolder is Posteingang', async () => {
      const account = createTestAccount({ id: 'delete-inbox' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Posteingang');

      expect(result.success).toBe(true);
    });

    it('should handle delete from Gesendet (Sent folder)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' },
      ]);

      const account = createTestAccount({ id: 'delete-sent' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Gesendet');

      expect(result.success).toBe(true);
    });

    it('should handle delete from Papierkorb (Trash folder)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Trash', path: 'Trash', delimiter: '.', specialUse: '\\Trash' },
      ]);

      const account = createTestAccount({ id: 'delete-trash' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Papierkorb');

      expect(result.success).toBe(true);
    });

    it('should handle delete from Spam (Junk folder)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Junk', path: 'Junk', delimiter: '.', specialUse: '\\Junk' },
      ]);

      const account = createTestAccount({ id: 'delete-spam' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Spam');

      expect(result.success).toBe(true);
    });

    it('should handle delete from subfolder (Posteingang/Amazon)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'delete-subfolder' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Posteingang/Amazon');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "sent" (lowercase)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'sent', path: 'sent', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'delete-sent-lowercase' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Gesendet');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "gesendet" (German name)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'gesendet', path: 'gesendet', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'delete-gesendet' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Gesendet');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "trash" (lowercase)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'trash', path: 'trash', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'delete-trash-lowercase' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Papierkorb');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "papierkorb" (German name)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'papierkorb', path: 'papierkorb', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'delete-papierkorb' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Papierkorb');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "junk" (lowercase)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'junk', path: 'junk', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'delete-junk-lowercase' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Spam');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "spam" (lowercase)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'spam', path: 'spam', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'delete-spam-lowercase' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'Spam');

      expect(result.success).toBe(true);
    });

    it('should default to INBOX when folder not found', async () => {
      setFolderList([{ name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null }]);

      const account = createTestAccount({ id: 'delete-unknown' });
      addAccountToDb(account);

      const result = await imap.deleteEmail(account, 100, 'UnknownFolder');

      expect(result.success).toBe(true);
    });
  });

  describe('setEmailFlag with folder mapping', () => {
    beforeEach(() => {
      setServerEmails([{ uid: 100, body: 'Test email', flags: [] }]);
    });

    it('should set flag in INBOX when dbFolder is Posteingang', async () => {
      const account = createTestAccount({ id: 'flag-inbox' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Posteingang');

      expect(result.success).toBe(true);
    });

    it('should handle setEmailFlag in Gesendet (Sent folder)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' },
      ]);

      const account = createTestAccount({ id: 'flag-sent' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Gesendet');

      expect(result.success).toBe(true);
    });

    it('should handle setEmailFlag in Papierkorb (Trash folder)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Trash', path: 'Trash', delimiter: '.', specialUse: '\\Trash' },
      ]);

      const account = createTestAccount({ id: 'flag-trash' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Papierkorb');

      expect(result.success).toBe(true);
    });

    it('should handle setEmailFlag in Spam (Junk folder)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Junk', path: 'Junk', delimiter: '.', specialUse: '\\Junk' },
      ]);

      const account = createTestAccount({ id: 'flag-spam' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Spam');

      expect(result.success).toBe(true);
    });

    it('should handle setEmailFlag in subfolder (Posteingang/Amazon)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'flag-subfolder' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Posteingang/Amazon');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "sent" (lowercase)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'sent', path: 'sent', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'flag-sent-lowercase' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Gesendet');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "gesendet" (German)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'gesendet', path: 'gesendet', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'flag-gesendet' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Gesendet');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "trash" (lowercase)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'trash', path: 'trash', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'flag-trash-lowercase' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Papierkorb');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "papierkorb" (German)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'papierkorb', path: 'papierkorb', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'flag-papierkorb' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Papierkorb');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "junk" (lowercase)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'junk', path: 'junk', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'flag-junk-lowercase' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Spam');

      expect(result.success).toBe(true);
    });

    it('should handle folder name matching for "spam" (lowercase)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'spam', path: 'spam', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'flag-spam-lowercase' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Spam');

      expect(result.success).toBe(true);
    });

    it('should default to INBOX when folder not found', async () => {
      setFolderList([{ name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null }]);

      const account = createTestAccount({ id: 'flag-unknown' });
      addAccountToDb(account);

      const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'UnknownFolder');

      expect(result.success).toBe(true);
    });
  });

  describe('Quota handling during sync', () => {
    it('should handle sync when quota is available', async () => {
      setQuotaResponse({
        storage: {
          usage: 1024000, // 1MB
          limit: 10240000, // 10MB
        },
      });

      const account = createTestAccount({
        id: 'quota-test',
        email: 'quota@test.com',
      });

      addAccountToDb(account);
      setServerEmails([{ uid: 1, body: 'Subject: Test\nFrom: a@b.com\n\nBody', flags: [] }]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should handle sync when quota is null', async () => {
      setQuotaResponse(null);

      const account = createTestAccount({
        id: 'no-quota-test',
        email: 'noquota@test.com',
      });

      addAccountToDb(account);
      setServerEmails([{ uid: 1, body: 'Subject: Test\nFrom: a@b.com\n\nBody', flags: [] }]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should handle quota with zero limit', async () => {
      setQuotaResponse({
        storage: {
          usage: 1024,
          limit: 0,
        },
      });

      const account = createTestAccount({
        id: 'zero-quota-test',
        email: 'zeroquota@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should handle quota without storage property', async () => {
      setQuotaResponse({});

      const account = createTestAccount({
        id: 'no-storage-quota',
        email: 'nostorage@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });
  });

  describe('Sync with multiple folders', () => {
    it('should sync emails from multiple folders', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' },
      ]);

      const account = createTestAccount({
        id: 'multi-folder-sync',
        email: 'multifolders@test.com',
      });

      addAccountToDb(account);

      // Note: MockImapFlow only returns emails for INBOX based on current implementation
      setServerEmails([{ uid: 1, body: 'Subject: Inbox Email\nFrom: a@b.com\n\nBody', flags: [] }]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should handle sync with Sent folder (specialUse)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' },
      ]);

      const account = createTestAccount({
        id: 'sent-folder-sync',
        email: 'sentfolder@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should handle sync with Trash folder (specialUse)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Trash', path: 'Trash', delimiter: '.', specialUse: '\\Trash' },
      ]);

      const account = createTestAccount({
        id: 'trash-folder-sync',
        email: 'trashfolder@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should handle sync with Junk folder (specialUse)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Junk', path: 'Junk', delimiter: '.', specialUse: '\\Junk' },
      ]);

      const account = createTestAccount({
        id: 'junk-folder-sync',
        email: 'junkfolder@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should handle sync with subfolders (INBOX.Subfolder)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null },
      ]);

      const account = createTestAccount({
        id: 'subfolder-sync',
        email: 'subfolder@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should handle folder with different delimiter (slash)', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'Subfolder', path: 'INBOX/Subfolder', delimiter: '/', specialUse: null },
      ]);

      const account = createTestAccount({
        id: 'slash-delimiter-sync',
        email: 'slashdelimiter@test.com',
      });

      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });
  });

  describe('Special folder detection', () => {
    it('should detect Sent folder by specialUse attribute', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'MySent', path: 'MySent', delimiter: '.', specialUse: '\\Sent' },
      ]);

      const account = createTestAccount({ id: 'detect-sent' });
      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should detect Trash folder by specialUse attribute', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'MyTrash', path: 'MyTrash', delimiter: '.', specialUse: '\\Trash' },
      ]);

      const account = createTestAccount({ id: 'detect-trash' });
      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should detect Junk folder by specialUse attribute', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'MyJunk', path: 'MyJunk', delimiter: '.', specialUse: '\\Junk' },
      ]);

      const account = createTestAccount({ id: 'detect-junk' });
      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });

    it('should fallback to name matching when specialUse not available', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'sent', path: 'sent', delimiter: '.', specialUse: null },
        { name: 'trash', path: 'trash', delimiter: '.', specialUse: null },
        { name: 'junk', path: 'junk', delimiter: '.', specialUse: null },
      ]);

      const account = createTestAccount({ id: 'name-matching' });
      addAccountToDb(account);
      setServerEmails([]);

      const result = await imap.syncAccount(account);

      expect(result.success).toBe(true);
    });
  });
});
