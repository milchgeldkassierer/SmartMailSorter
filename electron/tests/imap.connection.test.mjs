import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { resetMockState, setConnectFailure } from './vitest-setup.js';

// Use CommonJS require to ensure we get the SAME module instances as imap.cjs
const require = createRequire(import.meta.url);

// Mock electron (still use vi.mock for this)
vi.mock('electron', () => ({
  app: { getPath: () => './test-data' },
}));

// Use CJS require to get the same module instances that imap.cjs uses
const db = require('../db.cjs');
const imap = require('../imap.cjs');

describe('IMAP Connection Tests', () => {
  beforeEach(() => {
    // Initialize with in-memory database
    db.init(':memory:');
    // Reset mock state before each test
    resetMockState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetMockState();
    vi.clearAllMocks();
  });

  describe('testConnection', () => {
    describe('Success scenarios', () => {
      it('should return success when connection is established', async () => {
        const account = {
          email: 'test@example.com',
          password: 'password123',
          imapHost: 'imap.example.com',
          imapPort: 993,
        };

        const result = await imap.testConnection(account);

        expect(result).toHaveProperty('success');
        expect(result.success).toBe(true);
        expect(result).not.toHaveProperty('error');
      });

      it('should return success with different account configurations', async () => {
        const accounts = [
          {
            email: 'user@gmail.com',
            password: 'appPassword',
            imapHost: 'imap.gmail.com',
            imapPort: 993,
          },
          {
            email: 'user@gmx.net',
            password: 'pass',
            imapHost: 'imap.gmx.net',
            imapPort: 993,
          },
          {
            email: 'user@web.de',
            password: 'pass',
            imapHost: 'imap.web.de',
            imapPort: 993,
          },
        ];

        for (const account of accounts) {
          resetMockState(); // Reset between accounts
          const result = await imap.testConnection(account);
          expect(result.success).toBe(true);
        }
      });

      it('should handle account with username field', async () => {
        const account = {
          email: 'user@example.com',
          username: 'customUsername',
          password: 'password123',
          imapHost: 'imap.example.com',
          imapPort: 993,
        };

        const result = await imap.testConnection(account);

        expect(result.success).toBe(true);
      });

      it('should handle account without username field (uses email)', async () => {
        const account = {
          email: 'user@example.com',
          password: 'password123',
          imapHost: 'imap.example.com',
          imapPort: 993,
        };

        const result = await imap.testConnection(account);
        expect(result.success).toBe(true);
      });
    });

    describe('Connection failure scenarios', () => {
      it('should return failure when connection fails', async () => {
        setConnectFailure(true);

        const account = {
          email: 'test@example.com',
          password: 'password123',
          imapHost: 'imap.example.com',
          imapPort: 993,
        };

        const result = await imap.testConnection(account);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should return error message when connection fails', async () => {
        setConnectFailure(true);

        const account = {
          email: 'test@example.com',
          password: 'password123',
          imapHost: 'nonexistent.host.com',
          imapPort: 993,
        };

        const result = await imap.testConnection(account);

        expect(result.success).toBe(false);
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      });

      it('should recover from failed connection on retry', async () => {
        const account = {
          email: 'test@example.com',
          password: 'password123',
          imapHost: 'imap.example.com',
          imapPort: 993,
        };

        // First attempt fails
        setConnectFailure(true);
        const result1 = await imap.testConnection(account);
        expect(result1.success).toBe(false);

        // Second attempt succeeds
        setConnectFailure(false);
        const result2 = await imap.testConnection(account);
        expect(result2.success).toBe(true);
      });
    });
  });

  describe('PROVIDERS configuration', () => {
    it('should have GMX provider correctly configured', () => {
      expect(imap.PROVIDERS.gmx).toBeDefined();
      expect(imap.PROVIDERS.gmx.host).toBe('imap.gmx.net');
      expect(imap.PROVIDERS.gmx.port).toBe(993);
      expect(imap.PROVIDERS.gmx.secure).toBe(true);
    });

    it('should have Web.de provider correctly configured', () => {
      expect(imap.PROVIDERS.webde).toBeDefined();
      expect(imap.PROVIDERS.webde.host).toBe('imap.web.de');
      expect(imap.PROVIDERS.webde.port).toBe(993);
      expect(imap.PROVIDERS.webde.secure).toBe(true);
    });

    it('should have Gmail provider correctly configured', () => {
      expect(imap.PROVIDERS.gmail).toBeDefined();
      expect(imap.PROVIDERS.gmail.host).toBe('imap.gmail.com');
      expect(imap.PROVIDERS.gmail.port).toBe(993);
      expect(imap.PROVIDERS.gmail.secure).toBe(true);
    });
  });

  describe('Function exports', () => {
    it('should export testConnection function', () => {
      expect(typeof imap.testConnection).toBe('function');
    });

    it('should export syncAccount function', () => {
      expect(typeof imap.syncAccount).toBe('function');
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
});
