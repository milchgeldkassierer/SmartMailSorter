import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { resetMockState, setServerEmails, setConnectFailure, setFolderList } from './vitest-setup.js';

// Use CommonJS require to ensure we get the SAME module instances as imap.cjs
const require = createRequire(import.meta.url);

// Mock electron (still use vi.mock for this)
vi.mock('electron', () => ({
  app: { getPath: () => './test-data' },
}));

// Use CJS require to get the same module instances that imap.cjs uses
const db = require('../db.cjs');
const imap = require('../imap.cjs');

describe('IMAP Delete Operations', () => {
  const testAccount = {
    id: 'test-account-id',
    email: 'test@test.com',
    password: 'testpass',
    imapHost: 'imap.test.com',
    imapPort: 993,
  };

  beforeEach(() => {
    // Initialize with in-memory database
    db.init(':memory:');
    // Reset mock server state
    resetMockState();
    // Set up some test emails on the server
    setServerEmails([
      { uid: 1001, body: 'Test email 1', flags: [] },
      { uid: 1002, body: 'Test email 2', flags: ['\\Seen'] },
      { uid: 1003, body: 'Test email 3', flags: ['\\Flagged'] },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteEmail function export and signature', () => {
    it('should export deleteEmail function', () => {
      expect(typeof imap.deleteEmail).toBe('function');
    });

    it('should have correct function signature with account, uid, dbFolder parameters', () => {
      const deleteEmailStr = imap.deleteEmail.toString();
      expect(deleteEmailStr).toContain('account');
      expect(deleteEmailStr).toContain('uid');
      expect(deleteEmailStr).toContain('dbFolder');
    });
  });

  describe('Missing UID handling', () => {
    it('should return error when UID is null', async () => {
      const result = await imap.deleteEmail(testAccount, null, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No UID');
    });

    it('should return error when UID is undefined', async () => {
      const result = await imap.deleteEmail(testAccount, undefined, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No UID');
    });

    it('should return error when UID is 0', async () => {
      const result = await imap.deleteEmail(testAccount, 0, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No UID');
    });

    it('should return error when UID is empty string', async () => {
      const result = await imap.deleteEmail(testAccount, '', 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No UID');
    });

    it('should return error when UID is false', async () => {
      const result = await imap.deleteEmail(testAccount, false, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No UID');
    });

    it('should NOT return error for valid numeric UID', async () => {
      const result = await imap.deleteEmail(testAccount, 1001, 'Posteingang');

      // Should succeed (UID check passes, function proceeds)
      expect(result.success).toBe(true);
    });

    it('should NOT return error for string UID that represents a number', async () => {
      const result = await imap.deleteEmail(testAccount, '1001', 'Posteingang');

      // String "1001" is truthy, so UID check passes
      expect(result.success).toBe(true);
    });
  });

  describe('Delete from INBOX (Posteingang)', () => {
    it('should successfully delete email from INBOX with valid UID', async () => {
      const result = await imap.deleteEmail(testAccount, 1001, 'Posteingang');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should delete email when dbFolder is undefined (defaults to INBOX)', async () => {
      const result = await imap.deleteEmail(testAccount, 1002, undefined);

      expect(result.success).toBe(true);
    });

    it('should delete email when dbFolder is null (defaults to INBOX)', async () => {
      const result = await imap.deleteEmail(testAccount, 1003, null);

      expect(result.success).toBe(true);
    });

    it('should handle deletion of email that exists on server', async () => {
      // Delete first email
      const result1 = await imap.deleteEmail(testAccount, 1001, 'Posteingang');
      expect(result1.success).toBe(true);

      // Verify the email was removed from the mock state
      const remainingEmails = global.__mockState.serverEmails;
      expect(remainingEmails.some((e) => e.uid === 1001)).toBe(false);
    });

    it('should handle deletion of multiple emails sequentially', async () => {
      const result1 = await imap.deleteEmail(testAccount, 1001, 'Posteingang');
      const result2 = await imap.deleteEmail(testAccount, 1002, 'Posteingang');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('Delete from subfolders', () => {
    it('should attempt delete from subfolder path', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Subfolder', path: 'INBOX.Subfolder', delimiter: '.', specialUse: null },
      ]);

      const result = await imap.deleteEmail(testAccount, 1001, 'Posteingang/Subfolder');

      expect(result.success).toBe(true);
    });

    it('should handle special folder Gesendet', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' },
      ]);

      const result = await imap.deleteEmail(testAccount, 1001, 'Gesendet');

      expect(result.success).toBe(true);
    });

    it('should handle special folder Papierkorb', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Trash', path: 'Trash', delimiter: '.', specialUse: '\\Trash' },
      ]);

      const result = await imap.deleteEmail(testAccount, 1001, 'Papierkorb');

      expect(result.success).toBe(true);
    });

    it('should handle special folder Spam', async () => {
      setFolderList([
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Junk', path: 'Junk', delimiter: '.', specialUse: '\\Junk' },
      ]);

      const result = await imap.deleteEmail(testAccount, 1001, 'Spam');

      expect(result.success).toBe(true);
    });
  });

  describe('Connection error handling', () => {
    it('should return error when connection fails', async () => {
      setConnectFailure(true);

      const result = await imap.deleteEmail(testAccount, 1001, 'Posteingang');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should reset and succeed after connection failure is cleared', async () => {
      setConnectFailure(true);
      const failResult = await imap.deleteEmail(testAccount, 1001, 'Posteingang');
      expect(failResult.success).toBe(false);

      setConnectFailure(false);
      const successResult = await imap.deleteEmail(testAccount, 1001, 'Posteingang');
      expect(successResult.success).toBe(true);
    });
  });

  describe('UID edge cases', () => {
    it('should handle large UID values', async () => {
      setServerEmails([{ uid: 999999999, body: 'Large UID email' }]);

      const result = await imap.deleteEmail(testAccount, 999999999, 'Posteingang');

      expect(result.success).toBe(true);
    });

    it('should handle numeric string UID', async () => {
      const result = await imap.deleteEmail(testAccount, '1001', 'Posteingang');

      expect(result.success).toBe(true);
    });
  });

  describe('Account configuration', () => {
    it('should work with account using username field', async () => {
      const accountWithUsername = {
        ...testAccount,
        username: 'different_username',
      };

      const result = await imap.deleteEmail(accountWithUsername, 1001, 'Posteingang');

      expect(result.success).toBe(true);
    });

    it('should work with account without username (uses email)', async () => {
      const accountWithoutUsername = {
        id: 'test-id',
        email: 'user@example.com',
        password: 'secret',
        imapHost: 'imap.example.com',
        imapPort: 993,
      };

      const result = await imap.deleteEmail(accountWithoutUsername, 1001, 'Posteingang');

      expect(result.success).toBe(true);
    });

    it('should work with custom IMAP port', async () => {
      const accountCustomPort = {
        ...testAccount,
        imapPort: 143, // Non-standard port
      };

      const result = await imap.deleteEmail(accountCustomPort, 1001, 'Posteingang');

      expect(result.success).toBe(true);
    });
  });

  describe('Return value structure', () => {
    it('should return object with success:true on successful delete', async () => {
      const result = await imap.deleteEmail(testAccount, 1001, 'Posteingang');

      expect(result).toEqual({ success: true });
    });

    it('should return object with success:false and error on UID error', async () => {
      const result = await imap.deleteEmail(testAccount, null, 'Posteingang');

      expect(result).toEqual({ success: false, error: 'No UID' });
    });

    it('should return object with success:false and error message on connection error', async () => {
      setConnectFailure(true);
      const result = await imap.deleteEmail(testAccount, 1001, 'Posteingang');

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });
});
