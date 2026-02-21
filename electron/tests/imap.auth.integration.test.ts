import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import Module from 'module';
import { ImapAccount } from '../../src/types';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Mock state for safeStorage
let mockEncryptionAvailable = true;

// Save original require for restoration
const originalRequire = Module.prototype.require;

// Mock Electron by intercepting require calls (same pattern as db.accounts.test.ts)
Module.prototype.require = function (id: string) {
  if (id === 'electron' && process.env.VITEST) {
    return {
      safeStorage: {
        isEncryptionAvailable: () => mockEncryptionAvailable,
        encryptString: (plaintext: string) => {
          if (!mockEncryptionAvailable) {
            throw new Error('Encryption not available');
          }
          // Simulate encryption by creating a buffer with a prefix and the plaintext
          // In real Electron, this would be OS-level encryption
          const encrypted = Buffer.from(`ENCRYPTED:${plaintext}`, 'utf-8');
          return encrypted;
        },
        decryptString: (encrypted: Buffer) => {
          if (!mockEncryptionAvailable) {
            throw new Error('Encryption not available');
          }
          // Simulate decryption by removing the prefix
          const decrypted = encrypted.toString('utf-8').replace('ENCRYPTED:', '');
          return decrypted;
        },
      },
      app: {
        getPath: () => './test-data',
      },
    };
  }
  return originalRequire.apply(this, arguments as unknown as [string]);
};

// Mock logger to suppress console output during tests
const loggerPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../utils/logger.cjs');

require.cache[loggerPath] = {
  exports: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
} as NodeModule;

// Define interface for db module methods
interface DbModule {
  init: (path: string | { getPath: (key: string) => string }) => void;
  addAccount: (account: Partial<ImapAccount> & { id: string; username?: string; password?: string }) => {
    changes: number;
  };
  getAccounts: () => Array<ImapAccount & { username?: string; password?: string }>;
  getAccountWithPassword: (id: string) => (ImapAccount & { username?: string; password?: string }) | undefined;
  _getRawPasswordForTesting: (id: string) => string | null;
  resetDb: () => void;
}

// Import the database module under test
const db: DbModule = require('../db.cjs');

describe('IMAP Authentication with Encrypted Passwords', () => {
  beforeEach(() => {
    // Reset mock state before each test
    mockEncryptionAvailable = true;
    vi.clearAllMocks();

    // Initialize with in-memory DB for test isolation
    db.init(':memory:');
  });

  describe('Encrypted Password Flow for IMAP Authentication', () => {
    it('should encrypt password when adding account and decrypt when retrieving for IMAP auth', () => {
      const originalPassword = 'secureImapPassword123!';
      const account = {
        id: 'imap-test-1',
        name: 'IMAP Test Account',
        email: 'test@imap.com',
        provider: 'gmail',
        username: 'test@imap.com',
        password: originalPassword,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        color: '#FF5733',
      };

      // Add account - password should be encrypted
      db.addAccount(account);

      // Verify password is NOT in plaintext in the database
      const rawPassword = db._getRawPasswordForTesting('imap-test-1');
      expect(rawPassword).not.toBeNull();
      expect(rawPassword).not.toBe(originalPassword);

      // Verify raw password is base64-encoded encrypted buffer
      expect(() => Buffer.from(rawPassword!, 'base64')).not.toThrow();
      const encryptedBuffer = Buffer.from(rawPassword!, 'base64');
      expect(encryptedBuffer.length).toBeGreaterThan(0);

      // Retrieve account with password for IMAP authentication
      const accountWithPassword = db.getAccountWithPassword('imap-test-1');

      expect(accountWithPassword).toBeDefined();
      expect(accountWithPassword!.password).toBe(originalPassword);

      // Verify other fields are intact
      expect(accountWithPassword!.email).toBe('test@imap.com');
      expect(accountWithPassword!.username).toBe('test@imap.com');
      expect(accountWithPassword!.imapHost).toBe('imap.gmail.com');
      expect(accountWithPassword!.imapPort).toBe(993);
    });

    it('should handle multiple accounts with different passwords for IMAP authentication', () => {
      const accounts = [
        {
          id: 'imap-multi-1',
          name: 'Gmail Account',
          email: 'user1@gmail.com',
          provider: 'gmail',
          username: 'user1@gmail.com',
          password: 'gmailPassword123!',
          imapHost: 'imap.gmail.com',
          imapPort: 993,
          color: '#FF0000',
        },
        {
          id: 'imap-multi-2',
          name: 'Outlook Account',
          email: 'user2@outlook.com',
          provider: 'outlook',
          username: 'user2@outlook.com',
          password: 'outlookPassword456!',
          imapHost: 'imap.outlook.com',
          imapPort: 993,
          color: '#00FF00',
        },
        {
          id: 'imap-multi-3',
          name: 'Custom IMAP',
          email: 'user3@custom.com',
          provider: 'custom',
          username: 'user3@custom.com',
          password: 'customPassword789!',
          imapHost: 'imap.custom.com',
          imapPort: 993,
          color: '#0000FF',
        },
      ];

      // Add all accounts
      accounts.forEach((account) => db.addAccount(account));

      // Verify each account's password is encrypted and can be decrypted for IMAP auth
      accounts.forEach((originalAccount) => {
        const rawPassword = db._getRawPasswordForTesting(originalAccount.id);
        expect(rawPassword).not.toBe(originalAccount.password);

        const accountWithPassword = db.getAccountWithPassword(originalAccount.id);
        expect(accountWithPassword).toBeDefined();
        expect(accountWithPassword!.password).toBe(originalAccount.password);
        expect(accountWithPassword!.email).toBe(originalAccount.email);
        expect(accountWithPassword!.imapHost).toBe(originalAccount.imapHost);
      });
    });

    it('should handle special characters in IMAP passwords', () => {
      const specialPasswords = [
        '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
        'password with spaces',
        'パスワード🔐密码',
        'tab\there\nnewline',
      ];

      specialPasswords.forEach((password, index) => {
        const account = {
          id: `imap-special-${index}`,
          name: `Special Account ${index}`,
          email: `special${index}@test.com`,
          provider: 'test',
          username: `special${index}@test.com`,
          password: password,
          imapHost: 'imap.test.com',
          imapPort: 993,
          color: '#123456',
        };

        db.addAccount(account);

        // Verify password is encrypted
        const rawPassword = db._getRawPasswordForTesting(account.id);
        expect(rawPassword).not.toBe(password);

        // Verify password can be decrypted correctly for IMAP auth
        const accountWithPassword = db.getAccountWithPassword(account.id);
        expect(accountWithPassword).toBeDefined();
        expect(accountWithPassword!.password).toBe(password);
      });
    });

    it('should handle long IMAP passwords correctly', () => {
      const longPassword = 'a'.repeat(500) + '!@#$%^&*()' + 'b'.repeat(500);
      const account = {
        id: 'imap-long',
        name: 'Long Password Account',
        email: 'long@test.com',
        provider: 'test',
        username: 'long@test.com',
        password: longPassword,
        imapHost: 'imap.test.com',
        imapPort: 993,
        color: '#123456',
      };

      db.addAccount(account);

      // Verify password is encrypted
      const rawPassword = db._getRawPasswordForTesting('imap-long');
      expect(rawPassword).not.toBe(longPassword);

      // Verify password can be decrypted correctly for IMAP auth
      const accountWithPassword = db.getAccountWithPassword('imap-long');
      expect(accountWithPassword).toBeDefined();
      expect(accountWithPassword!.password).toBe(longPassword);
      expect(accountWithPassword!.password.length).toBe(longPassword.length);
    });

    it('should handle account with no password gracefully', () => {
      const account = {
        id: 'imap-no-pass',
        name: 'No Password Account',
        email: 'nopass@test.com',
        provider: 'test',
        username: 'nopass@test.com',
        imapHost: 'imap.test.com',
        imapPort: 993,
        color: '#123456',
      };

      db.addAccount(account);

      const accountWithPassword = db.getAccountWithPassword('imap-no-pass');
      expect(accountWithPassword).toBeDefined();
      // SQLite returns null for NULL columns
      expect(accountWithPassword!.password).toBeNull();
    });

    it('should return undefined for non-existent account', () => {
      const accountWithPassword = db.getAccountWithPassword('non-existent-id');
      expect(accountWithPassword).toBeUndefined();
    });
  });

  describe('Encryption Unavailable Scenarios', () => {
    it('should handle case when encryption becomes unavailable after storing password', () => {
      const originalPassword = 'testPassword123';
      const account = {
        id: 'imap-encryption-test',
        name: 'Encryption Test',
        email: 'encryption@test.com',
        provider: 'test',
        username: 'encryption@test.com',
        password: originalPassword,
        imapHost: 'imap.test.com',
        imapPort: 993,
        color: '#123456',
      };

      // Add account with encryption available
      mockEncryptionAvailable = true;
      db.addAccount(account);

      // Verify password was encrypted
      const rawPassword = db._getRawPasswordForTesting('imap-encryption-test');
      expect(rawPassword).not.toBe(originalPassword);

      // Disable encryption
      mockEncryptionAvailable = false;

      // Retrieve account - should return encrypted password as-is (base64 string)
      // since decryption is not available
      const accountWithPassword = db.getAccountWithPassword('imap-encryption-test');
      expect(accountWithPassword).toBeDefined();
      // When encryption is unavailable, password remains as base64-encoded string
      expect(accountWithPassword!.password).toBe(rawPassword);
      expect(accountWithPassword!.password).not.toBe(originalPassword);
    });

    it('should store plaintext password when encryption is unavailable at time of account creation', () => {
      mockEncryptionAvailable = false;

      const plainPassword = 'plaintextPassword123';
      const account = {
        id: 'imap-no-encryption',
        name: 'No Encryption Account',
        email: 'noenc@test.com',
        provider: 'test',
        username: 'noenc@test.com',
        password: plainPassword,
        imapHost: 'imap.test.com',
        imapPort: 993,
        color: '#123456',
      };

      db.addAccount(account);

      // Password should be stored as plaintext when encryption unavailable
      const rawPassword = db._getRawPasswordForTesting('imap-no-encryption');
      expect(rawPassword).toBe(plainPassword);

      // Retrieving should return the same plaintext password
      const accountWithPassword = db.getAccountWithPassword('imap-no-encryption');
      expect(accountWithPassword).toBeDefined();
      expect(accountWithPassword!.password).toBe(plainPassword);
    });
  });

  describe('Security Verification', () => {
    it('should verify getAccounts() does NOT return passwords', () => {
      const account = {
        id: 'imap-security-1',
        name: 'Security Test',
        email: 'security@test.com',
        provider: 'test',
        username: 'security@test.com',
        password: 'secretPassword123!',
        imapHost: 'imap.test.com',
        imapPort: 993,
        color: '#123456',
      };

      db.addAccount(account);

      // getAccounts() should NOT include passwords
      const accounts = db.getAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe('imap-security-1');
      expect(accounts[0].password).toBeUndefined();

      // Only getAccountWithPassword() should return decrypted password
      const accountWithPassword = db.getAccountWithPassword('imap-security-1');
      expect(accountWithPassword).toBeDefined();
      expect(accountWithPassword!.password).toBe('secretPassword123!');
    });

    it('should ensure encrypted passwords are not the same as plaintext', () => {
      const passwords = ['password1', 'password2', 'password3'];

      passwords.forEach((password, index) => {
        const account = {
          id: `imap-verify-${index}`,
          name: `Verify Account ${index}`,
          email: `verify${index}@test.com`,
          provider: 'test',
          username: `verify${index}@test.com`,
          password: password,
          imapHost: 'imap.test.com',
          imapPort: 993,
          color: '#123456',
        };

        db.addAccount(account);

        // Verify stored password is NOT plaintext
        const rawPassword = db._getRawPasswordForTesting(account.id);
        expect(rawPassword).not.toBe(password);

        // Verify it's a valid base64 string
        expect(() => Buffer.from(rawPassword!, 'base64')).not.toThrow();

        // Verify decryption returns original
        const accountWithPassword = db.getAccountWithPassword(account.id);
        expect(accountWithPassword!.password).toBe(password);
      });
    });
  });

  describe('IMAP Connection Readiness', () => {
    it('should verify account data is ready for IMAP connection with decrypted password', () => {
      const account = {
        id: 'imap-ready-1',
        name: 'Ready Account',
        email: 'ready@gmail.com',
        provider: 'gmail',
        username: 'ready@gmail.com',
        password: 'imapReadyPassword!',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        color: '#FF5733',
      };

      db.addAccount(account);

      // Simulate IMAP connection preparation
      const accountForImap = db.getAccountWithPassword('imap-ready-1');

      // Verify all IMAP connection parameters are present
      expect(accountForImap).toBeDefined();
      expect(accountForImap!.imapHost).toBe('imap.gmail.com');
      expect(accountForImap!.imapPort).toBe(993);
      expect(accountForImap!.username).toBe('ready@gmail.com');
      expect(accountForImap!.password).toBe('imapReadyPassword!');

      // Verify password is in plaintext (decrypted) for IMAP auth
      expect(typeof accountForImap!.password).toBe('string');
      expect(accountForImap!.password).not.toMatch(/^[A-Za-z0-9+/=]+$/); // Not base64

      // Verify email can be used as fallback username
      expect(accountForImap!.email).toBe('ready@gmail.com');
    });

    it('should handle accounts where username differs from email', () => {
      const account = {
        id: 'imap-diff-user',
        name: 'Different Username',
        email: 'display@example.com',
        provider: 'custom',
        username: 'actual.username',
        password: 'userPassword123',
        imapHost: 'imap.example.com',
        imapPort: 993,
        color: '#123456',
      };

      db.addAccount(account);

      const accountForImap = db.getAccountWithPassword('imap-diff-user');

      // Verify correct username is used (not email)
      expect(accountForImap!.username).toBe('actual.username');
      expect(accountForImap!.email).toBe('display@example.com');
      expect(accountForImap!.password).toBe('userPassword123');
    });
  });
});
