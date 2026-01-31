import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { ImapAccount } from '../../types';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Mock Electron to provide app.getPath
const electronPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../node_modules/electron/index.js');
require.cache[electronPath] = {
  exports: {
    app: {
      getPath: () => './test-data'
    }
  }
};

// Define interface for db module methods (account-related)
interface DbModule {
  init: (path: string) => void;
  addAccount: (account: Partial<ImapAccount> & { id: string; username?: string; password?: string }) => { changes: number };
  getAccounts: () => Array<ImapAccount & { username?: string; password?: string; lastSyncUid?: number }>;
  updateAccountSync: (id: string, lastSyncUid: number) => { changes: number };
  updateAccountQuota: (id: string, used: number, total: number) => { changes: number };
  deleteAccountDn: (id: string) => void;
  saveEmail: (email: { id: string; accountId: string; [key: string]: unknown }) => void;
  getEmails: (accountId: string) => Array<{ id: string; accountId: string; [key: string]: unknown }>;
}

// Import the database module under test
const db: DbModule = require('../db.cjs');

describe('Database Account CRUD Operations', () => {
  beforeEach(() => {
    // Initialize with in-memory DB for test isolation
    db.init(':memory:');
  });

  describe('addAccount', () => {
    it('should add a new account with all fields', () => {
      const account = {
        id: 'acc-add-1',
        name: 'Test Account',
        email: 'test@example.com',
        provider: 'gmail',
        username: 'testuser',
        password: 'securepassword',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        color: '#FF5733'
      };

      db.addAccount(account);
      const accounts = db.getAccounts();

      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe('acc-add-1');
      expect(accounts[0].name).toBe('Test Account');
      expect(accounts[0].email).toBe('test@example.com');
      expect(accounts[0].provider).toBe('gmail');
      expect(accounts[0].username).toBe('testuser');
      expect(accounts[0].password).toBe('securepassword');
      expect(accounts[0].imapHost).toBe('imap.gmail.com');
      expect(accounts[0].imapPort).toBe(993);
      expect(accounts[0].color).toBe('#FF5733');
    });

    it('should add multiple accounts', () => {
      const account1 = {
        id: 'acc-multi-1',
        name: 'Account One',
        email: 'one@example.com',
        provider: 'gmail',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        username: 'user1',
        password: 'pass1',
        color: '#0000FF'
      };

      const account2 = {
        id: 'acc-multi-2',
        name: 'Account Two',
        email: 'two@example.com',
        provider: 'outlook',
        imapHost: 'imap.outlook.com',
        imapPort: 993,
        username: 'user2',
        password: 'pass2',
        color: '#00FF00'
      };

      db.addAccount(account1);
      db.addAccount(account2);
      const accounts = db.getAccounts();

      expect(accounts).toHaveLength(2);
      expect(accounts.map(a => a.id)).toContain('acc-multi-1');
      expect(accounts.map(a => a.id)).toContain('acc-multi-2');
    });

    it('should set default values for storage fields', () => {
      const account = {
        id: 'acc-defaults',
        name: 'Default Test',
        email: 'default@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#123456'
      };

      db.addAccount(account);
      const accounts = db.getAccounts();

      expect(accounts[0].storageUsed).toBe(0);
      expect(accounts[0].storageTotal).toBe(0);
      expect(accounts[0].lastSyncUid).toBe(0);
    });

    it('should reject duplicate account IDs', () => {
      const account = {
        id: 'acc-dupe',
        name: 'Original',
        email: 'orig@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#000000'
      };

      db.addAccount(account);

      const duplicateAccount = {
        id: 'acc-dupe',
        name: 'Duplicate',
        email: 'dupe@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user2',
        password: 'pass2',
        color: '#FFFFFF'
      };

      // Should throw due to unique constraint on primary key
      expect(() => db.addAccount(duplicateAccount)).toThrow();
    });
  });

  describe('getAccounts', () => {
    it('should return empty array when no accounts exist', () => {
      const accounts = db.getAccounts();
      expect(accounts).toEqual([]);
    });

    it('should return all accounts', () => {
      const accounts = [
        { id: 'get-1', name: 'A1', email: 'a1@t.com', provider: 'test', imapHost: 'h', imapPort: 993, username: 'u', password: 'p', color: '#111' },
        { id: 'get-2', name: 'A2', email: 'a2@t.com', provider: 'test', imapHost: 'h', imapPort: 993, username: 'u', password: 'p', color: '#222' },
        { id: 'get-3', name: 'A3', email: 'a3@t.com', provider: 'test', imapHost: 'h', imapPort: 993, username: 'u', password: 'p', color: '#333' }
      ];

      accounts.forEach(acc => db.addAccount(acc));
      const retrieved = db.getAccounts();

      expect(retrieved).toHaveLength(3);
    });

    it('should return accounts with all stored fields', () => {
      const account = {
        id: 'get-full',
        name: 'Full Account',
        email: 'full@test.com',
        provider: 'custom',
        imapHost: 'mail.custom.com',
        imapPort: 143,
        username: 'fulluser',
        password: 'fullpass',
        color: '#ABCDEF'
      };

      db.addAccount(account);
      db.updateAccountSync('get-full', 500);
      db.updateAccountQuota('get-full', 1024, 5120);

      const accounts = db.getAccounts();
      const retrieved = accounts.find(a => a.id === 'get-full');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Full Account');
      expect(retrieved?.email).toBe('full@test.com');
      expect(retrieved?.provider).toBe('custom');
      expect(retrieved?.imapHost).toBe('mail.custom.com');
      expect(retrieved?.imapPort).toBe(143);
      expect(retrieved?.username).toBe('fulluser');
      expect(retrieved?.password).toBe('fullpass');
      expect(retrieved?.color).toBe('#ABCDEF');
      expect(retrieved?.lastSyncUid).toBe(500);
      expect(retrieved?.storageUsed).toBe(1024);
      expect(retrieved?.storageTotal).toBe(5120);
    });
  });

  describe('updateAccountSync', () => {
    it('should update lastSyncUid for an account', () => {
      const account = {
        id: 'sync-test-1',
        name: 'Sync Test',
        email: 'sync@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#FF0000'
      };

      db.addAccount(account);

      // Initial state should be 0
      let accounts = db.getAccounts();
      expect(accounts[0].lastSyncUid).toBe(0);

      // Update sync uid
      db.updateAccountSync('sync-test-1', 100);
      accounts = db.getAccounts();
      expect(accounts[0].lastSyncUid).toBe(100);
    });

    it('should update lastSyncUid multiple times', () => {
      const account = {
        id: 'sync-multi',
        name: 'Multi Sync',
        email: 'multi@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#00FF00'
      };

      db.addAccount(account);

      db.updateAccountSync('sync-multi', 50);
      expect(db.getAccounts()[0].lastSyncUid).toBe(50);

      db.updateAccountSync('sync-multi', 150);
      expect(db.getAccounts()[0].lastSyncUid).toBe(150);

      db.updateAccountSync('sync-multi', 999);
      expect(db.getAccounts()[0].lastSyncUid).toBe(999);
    });

    it('should only update the specified account', () => {
      const account1 = {
        id: 'sync-iso-1',
        name: 'Account 1',
        email: 'a1@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'u1',
        password: 'p1',
        color: '#111'
      };

      const account2 = {
        id: 'sync-iso-2',
        name: 'Account 2',
        email: 'a2@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'u2',
        password: 'p2',
        color: '#222'
      };

      db.addAccount(account1);
      db.addAccount(account2);

      db.updateAccountSync('sync-iso-1', 200);

      const accounts = db.getAccounts();
      const acc1 = accounts.find(a => a.id === 'sync-iso-1');
      const acc2 = accounts.find(a => a.id === 'sync-iso-2');

      expect(acc1?.lastSyncUid).toBe(200);
      expect(acc2?.lastSyncUid).toBe(0);
    });

    it('should handle updating non-existent account gracefully', () => {
      const result = db.updateAccountSync('non-existent-id', 100);
      // Should not throw, but changes should be 0
      expect(result.changes).toBe(0);
    });
  });

  describe('updateAccountQuota', () => {
    it('should update storage quota for an account', () => {
      const account = {
        id: 'quota-test-1',
        name: 'Quota Test',
        email: 'quota@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#0000FF'
      };

      db.addAccount(account);
      db.updateAccountQuota('quota-test-1', 2048, 10240);

      const accounts = db.getAccounts();
      const updated = accounts.find(a => a.id === 'quota-test-1');

      expect(updated?.storageUsed).toBe(2048);
      expect(updated?.storageTotal).toBe(10240);
    });

    it('should update quota with large values', () => {
      const account = {
        id: 'quota-large',
        name: 'Large Quota',
        email: 'large@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#PURPLE'
      };

      db.addAccount(account);

      // 10GB used, 15GB total (in bytes)
      const used = 10 * 1024 * 1024 * 1024;
      const total = 15 * 1024 * 1024 * 1024;

      db.updateAccountQuota('quota-large', used, total);

      const accounts = db.getAccounts();
      const updated = accounts.find(a => a.id === 'quota-large');

      expect(updated?.storageUsed).toBe(used);
      expect(updated?.storageTotal).toBe(total);
    });

    it('should update quota multiple times', () => {
      const account = {
        id: 'quota-multi',
        name: 'Multi Quota',
        email: 'multi@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#ABC'
      };

      db.addAccount(account);

      db.updateAccountQuota('quota-multi', 100, 1000);
      let updated = db.getAccounts().find(a => a.id === 'quota-multi');
      expect(updated?.storageUsed).toBe(100);
      expect(updated?.storageTotal).toBe(1000);

      db.updateAccountQuota('quota-multi', 500, 1000);
      updated = db.getAccounts().find(a => a.id === 'quota-multi');
      expect(updated?.storageUsed).toBe(500);
      expect(updated?.storageTotal).toBe(1000);

      db.updateAccountQuota('quota-multi', 900, 2000);
      updated = db.getAccounts().find(a => a.id === 'quota-multi');
      expect(updated?.storageUsed).toBe(900);
      expect(updated?.storageTotal).toBe(2000);
    });

    it('should only update the specified account quota', () => {
      const account1 = {
        id: 'quota-iso-1',
        name: 'Account 1',
        email: 'a1@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'u1',
        password: 'p1',
        color: '#111'
      };

      const account2 = {
        id: 'quota-iso-2',
        name: 'Account 2',
        email: 'a2@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'u2',
        password: 'p2',
        color: '#222'
      };

      db.addAccount(account1);
      db.addAccount(account2);

      db.updateAccountQuota('quota-iso-1', 5000, 10000);

      const accounts = db.getAccounts();
      const acc1 = accounts.find(a => a.id === 'quota-iso-1');
      const acc2 = accounts.find(a => a.id === 'quota-iso-2');

      expect(acc1?.storageUsed).toBe(5000);
      expect(acc1?.storageTotal).toBe(10000);
      expect(acc2?.storageUsed).toBe(0);
      expect(acc2?.storageTotal).toBe(0);
    });

    it('should handle updating non-existent account gracefully', () => {
      const result = db.updateAccountQuota('non-existent', 100, 1000);
      expect(result.changes).toBe(0);
    });
  });

  describe('deleteAccountDn', () => {
    it('should delete an account', () => {
      const account = {
        id: 'del-test-1',
        name: 'Delete Test',
        email: 'delete@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#FF0000'
      };

      db.addAccount(account);
      expect(db.getAccounts()).toHaveLength(1);

      db.deleteAccountDn('del-test-1');
      expect(db.getAccounts()).toHaveLength(0);
    });

    it('should only delete the specified account', () => {
      const account1 = {
        id: 'del-iso-1',
        name: 'Keep This',
        email: 'keep@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'u1',
        password: 'p1',
        color: '#111'
      };

      const account2 = {
        id: 'del-iso-2',
        name: 'Delete This',
        email: 'delete@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'u2',
        password: 'p2',
        color: '#222'
      };

      db.addAccount(account1);
      db.addAccount(account2);
      expect(db.getAccounts()).toHaveLength(2);

      db.deleteAccountDn('del-iso-2');

      const remaining = db.getAccounts();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('del-iso-1');
      expect(remaining[0].name).toBe('Keep This');
    });

    it('should cascade delete associated emails', () => {
      const account = {
        id: 'del-cascade',
        name: 'Cascade Test',
        email: 'cascade@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#CASCAD'
      };

      db.addAccount(account);

      // Add some emails to this account
      db.saveEmail({
        id: 'email-cascade-1',
        accountId: 'del-cascade',
        sender: 'Sender 1',
        senderEmail: 's1@test.com',
        subject: 'Email 1',
        body: 'Body 1',
        date: new Date().toISOString()
      });

      db.saveEmail({
        id: 'email-cascade-2',
        accountId: 'del-cascade',
        sender: 'Sender 2',
        senderEmail: 's2@test.com',
        subject: 'Email 2',
        body: 'Body 2',
        date: new Date().toISOString()
      });

      expect(db.getEmails('del-cascade')).toHaveLength(2);

      // Delete the account - should cascade to emails
      db.deleteAccountDn('del-cascade');

      expect(db.getAccounts()).toHaveLength(0);
      expect(db.getEmails('del-cascade')).toHaveLength(0);
    });

    it('should handle deleting non-existent account gracefully', () => {
      // Should not throw
      expect(() => db.deleteAccountDn('non-existent-account')).not.toThrow();
    });

    it('should allow re-adding an account after deletion', () => {
      const account = {
        id: 'del-readd',
        name: 'Original',
        email: 'orig@test.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'user',
        password: 'pass',
        color: '#000'
      };

      db.addAccount(account);
      db.deleteAccountDn('del-readd');
      expect(db.getAccounts()).toHaveLength(0);

      // Re-add with same ID but different details
      const newAccount = {
        id: 'del-readd',
        name: 'New Account',
        email: 'new@test.com',
        provider: 'newprov',
        imapHost: 'imap.new.com',
        imapPort: 993,
        username: 'newuser',
        password: 'newpass',
        color: '#FFF'
      };

      db.addAccount(newAccount);
      const accounts = db.getAccounts();

      expect(accounts).toHaveLength(1);
      expect(accounts[0].name).toBe('New Account');
      expect(accounts[0].email).toBe('new@test.com');
    });
  });

  describe('Combined Account Operations', () => {
    it('should handle full account lifecycle', () => {
      // 1. Add account
      const account = {
        id: 'lifecycle-test',
        name: 'Lifecycle Account',
        email: 'life@test.com',
        provider: 'lifecycle',
        imapHost: 'imap.life.com',
        imapPort: 993,
        username: 'lifeuser',
        password: 'lifepass',
        color: '#LIFE00'
      };

      db.addAccount(account);
      let accounts = db.getAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].lastSyncUid).toBe(0);
      expect(accounts[0].storageUsed).toBe(0);

      // 2. Update sync UID
      db.updateAccountSync('lifecycle-test', 250);
      accounts = db.getAccounts();
      expect(accounts[0].lastSyncUid).toBe(250);

      // 3. Update quota
      db.updateAccountQuota('lifecycle-test', 1500, 5000);
      accounts = db.getAccounts();
      expect(accounts[0].storageUsed).toBe(1500);
      expect(accounts[0].storageTotal).toBe(5000);

      // 4. Update both again
      db.updateAccountSync('lifecycle-test', 300);
      db.updateAccountQuota('lifecycle-test', 2000, 5000);
      accounts = db.getAccounts();
      expect(accounts[0].lastSyncUid).toBe(300);
      expect(accounts[0].storageUsed).toBe(2000);

      // 5. Delete account
      db.deleteAccountDn('lifecycle-test');
      expect(db.getAccounts()).toHaveLength(0);
    });

    it('should maintain data integrity with multiple accounts', () => {
      // Add 3 accounts
      const accounts = [
        { id: 'int-1', name: 'A1', email: 'a1@t.com', provider: 'p', imapHost: 'h', imapPort: 993, username: 'u', password: 'p', color: '#1' },
        { id: 'int-2', name: 'A2', email: 'a2@t.com', provider: 'p', imapHost: 'h', imapPort: 993, username: 'u', password: 'p', color: '#2' },
        { id: 'int-3', name: 'A3', email: 'a3@t.com', provider: 'p', imapHost: 'h', imapPort: 993, username: 'u', password: 'p', color: '#3' }
      ];

      accounts.forEach(acc => db.addAccount(acc));

      // Update different fields for different accounts
      db.updateAccountSync('int-1', 100);
      db.updateAccountSync('int-2', 200);
      db.updateAccountQuota('int-2', 500, 1000);
      db.updateAccountQuota('int-3', 800, 2000);

      const retrieved = db.getAccounts();

      const a1 = retrieved.find(a => a.id === 'int-1');
      const a2 = retrieved.find(a => a.id === 'int-2');
      const a3 = retrieved.find(a => a.id === 'int-3');

      expect(a1?.lastSyncUid).toBe(100);
      expect(a1?.storageUsed).toBe(0);

      expect(a2?.lastSyncUid).toBe(200);
      expect(a2?.storageUsed).toBe(500);
      expect(a2?.storageTotal).toBe(1000);

      expect(a3?.lastSyncUid).toBe(0);
      expect(a3?.storageUsed).toBe(800);
      expect(a3?.storageTotal).toBe(2000);

      // Delete middle account
      db.deleteAccountDn('int-2');

      const remaining = db.getAccounts();
      expect(remaining).toHaveLength(2);
      expect(remaining.map(a => a.id)).toContain('int-1');
      expect(remaining.map(a => a.id)).toContain('int-3');
      expect(remaining.map(a => a.id)).not.toContain('int-2');
    });
  });
});
