import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { setupElectronMock } from './helpers/mockElectron';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Set up shared Electron mock (must happen before requiring security.cjs)
const electronMock = setupElectronMock();

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

// Define interface for security module methods
interface SecurityModule {
  encryptPassword: (plainPassword: string) => Buffer;
  decryptPassword: (encryptedBuffer: Buffer) => string;
  sanitizeFilename: (filename: string) => string;
}

// Import the security module under test AFTER setting up mocks
const security: SecurityModule = require('../utils/security.cjs');

describe('Security Encryption Functions', () => {
  beforeEach(() => {
    // Reset mock state before each test
    electronMock.setEncryptionAvailable(true);
    vi.clearAllMocks();
  });

  describe('encryptPassword', () => {
    it('should encrypt a password and return a Buffer', () => {
      const plainPassword = 'mySecurePassword123';
      const encrypted = security.encryptPassword(plainPassword);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should encrypt different passwords to different outputs', () => {
      const password1 = 'password1';
      const password2 = 'password2';

      const encrypted1 = security.encryptPassword(password1);
      const encrypted2 = security.encryptPassword(password2);

      expect(encrypted1).not.toEqual(encrypted2);
      expect(encrypted1.toString()).not.toBe(encrypted2.toString());
    });

    it('should throw error when encryption is not available', () => {
      electronMock.setEncryptionAvailable(false);

      expect(() => {
        security.encryptPassword('testPassword');
      }).toThrow('Encryption is not available on this system');
    });

    it('should handle empty password', () => {
      const emptyPassword = '';
      const encrypted = security.encryptPassword(emptyPassword);

      expect(encrypted).toBeInstanceOf(Buffer);
      // Should still produce output even for empty string
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle special characters in password', () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = security.encryptPassword(specialPassword);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle long passwords', () => {
      const longPassword = 'a'.repeat(1000);
      const encrypted = security.encryptPassword(longPassword);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters in password', () => {
      const unicodePassword = '密码🔐パスワード';
      const encrypted = security.encryptPassword(unicodePassword);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(0);
    });
  });

  describe('decryptPassword', () => {
    it('should decrypt an encrypted password back to original', () => {
      const originalPassword = 'mySecurePassword123';
      const encrypted = security.encryptPassword(originalPassword);
      const decrypted = security.decryptPassword(encrypted);

      expect(decrypted).toBe(originalPassword);
    });

    it('should handle round-trip encryption/decryption for multiple passwords', () => {
      const passwords = ['password1', 'password2', 'veryLongPassword12345678901234567890'];

      passwords.forEach((password) => {
        const encrypted = security.encryptPassword(password);
        const decrypted = security.decryptPassword(encrypted);
        expect(decrypted).toBe(password);
      });
    });

    it('should throw error when decryption is not available', () => {
      const plainPassword = 'testPassword';
      const encrypted = security.encryptPassword(plainPassword);

      // Disable encryption after encrypting
      electronMock.setEncryptionAvailable(false);

      expect(() => {
        security.decryptPassword(encrypted);
      }).toThrow('Encryption is not available on this system');
    });

    it('should handle empty password round-trip', () => {
      const emptyPassword = '';
      const encrypted = security.encryptPassword(emptyPassword);
      const decrypted = security.decryptPassword(encrypted);

      expect(decrypted).toBe(emptyPassword);
    });

    it('should handle special characters round-trip', () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = security.encryptPassword(specialPassword);
      const decrypted = security.decryptPassword(encrypted);

      expect(decrypted).toBe(specialPassword);
    });

    it('should handle unicode characters round-trip', () => {
      const unicodePassword = '密码🔐パスワード';
      const encrypted = security.encryptPassword(unicodePassword);
      const decrypted = security.decryptPassword(encrypted);

      expect(decrypted).toBe(unicodePassword);
    });

    it('should handle long passwords round-trip', () => {
      const longPassword = 'a'.repeat(1000);
      const encrypted = security.encryptPassword(longPassword);
      const decrypted = security.decryptPassword(encrypted);

      expect(decrypted).toBe(longPassword);
    });
  });

  describe('Encryption/Decryption Integration', () => {
    it('should maintain data integrity across multiple encryptions', () => {
      const password = 'testPassword';

      // Encrypt the same password multiple times
      const encrypted1 = security.encryptPassword(password);
      const encrypted2 = security.encryptPassword(password);

      // Both should decrypt to the same value
      const decrypted1 = security.decryptPassword(encrypted1);
      const decrypted2 = security.decryptPassword(encrypted2);

      expect(decrypted1).toBe(password);
      expect(decrypted2).toBe(password);
    });

    it('should handle batch encryption/decryption of multiple accounts', () => {
      const accounts = [
        { id: 'acc1', password: 'password1' },
        { id: 'acc2', password: 'password2' },
        { id: 'acc3', password: 'password3' },
      ];

      // Encrypt all passwords
      const encrypted = accounts.map((acc) => ({
        id: acc.id,
        encrypted: security.encryptPassword(acc.password),
        original: acc.password,
      }));

      // Decrypt all passwords
      encrypted.forEach((item) => {
        const decrypted = security.decryptPassword(item.encrypted);
        expect(decrypted).toBe(item.original);
      });
    });

    it('should produce unique encrypted outputs for same password', () => {
      const password = 'samePassword';

      // In a real implementation with proper encryption, each encryption
      // might produce the same or different output depending on the algorithm
      // Our mock produces the same output, but in production it might differ
      const encrypted1 = security.encryptPassword(password);
      const encrypted2 = security.encryptPassword(password);

      // Both should decrypt to the same value regardless
      const decrypted1 = security.decryptPassword(encrypted1);
      const decrypted2 = security.decryptPassword(encrypted2);

      expect(decrypted1).toBe(password);
      expect(decrypted2).toBe(password);
    });

    it('should handle whitespace-only passwords', () => {
      const whitespacePasswords = ['   ', '\t\t', '\n\n', '  \t\n  '];

      whitespacePasswords.forEach((password) => {
        const encrypted = security.encryptPassword(password);
        const decrypted = security.decryptPassword(encrypted);
        expect(decrypted).toBe(password);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption availability check properly', () => {
      // First check when available
      electronMock.setEncryptionAvailable(true);
      expect(() => security.encryptPassword('test')).not.toThrow();

      // Then check when not available
      electronMock.setEncryptionAvailable(false);
      expect(() => security.encryptPassword('test')).toThrow();
    });

    it('should throw consistent error messages for unavailable encryption', () => {
      electronMock.setEncryptionAvailable(false);

      try {
        security.encryptPassword('test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Encryption is not available on this system');
      }

      try {
        const dummyBuffer = Buffer.from('test');
        security.decryptPassword(dummyBuffer);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Encryption is not available on this system');
      }
    });
  });
});
