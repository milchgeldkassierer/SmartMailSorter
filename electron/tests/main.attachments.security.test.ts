import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import os from 'os';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Type for Node.js require cache
interface RequireCache {
  [key: string]: NodeModule | undefined;
}

// Mock Electron app.getPath for db initialization
const electronPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../node_modules/electron/index.js'
);
(require.cache as RequireCache)[electronPath] = {
  exports: {
    app: {
      getPath: () => './test-data',
    },
  },
} as NodeModule;

// Define interfaces
interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  size: number;
  data?: Buffer | null;
}

interface DbAccount {
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

interface DbEmail {
  id: string;
  accountId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  body: string;
  date: string;
  folder: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments?: boolean;
  uid?: number;
  attachments?: Attachment[];
}

interface DbModule {
  init: (path: string) => void;
  addAccount: (account: DbAccount) => void;
  saveEmail: (email: DbEmail) => void;
  getAttachment: (id: string) => Attachment | undefined;
}

// Import the database module
const db: DbModule = require('../db.cjs');

// Import path module to test sanitization
const pathModule = require('path');

// Import the sanitizeFilename function from the security utility module
const { sanitizeFilename } = require('../utils/security.cjs');

describe('Attachment Filename Security Tests', () => {
  // Helper to create a test account
  const createTestAccount = (id: string = 'test-acc') => {
    const account = {
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
    db.addAccount(account);
    return account;
  };

  // Helper to create a test email with attachment
  const createTestEmail = (
    id: string,
    accountId: string,
    attachmentFilename: string,
    attachmentId: string = 'attach1'
  ) => {
    const attachment = {
      id: attachmentId,
      emailId: id,
      filename: attachmentFilename,
      contentType: 'application/octet-stream',
      size: 100,
      data: Buffer.from('test data'),
    };

    const email = {
      id,
      accountId,
      sender: 'Test Sender',
      senderEmail: 'sender@test.com',
      subject: 'Test Email',
      body: 'Test body content',
      date: new Date().toISOString(),
      folder: 'Posteingang',
      isRead: false,
      isFlagged: false,
      hasAttachments: true,
      uid: 100,
      attachments: [attachment],
    };
    db.saveEmail(email);
    return email;
  };

  /**
   * Helper to verify that a sanitized path stays within the temp directory
   */
  function verifySafeInTempDir(originalFilename: string): void {
    const sanitized = sanitizeFilename(originalFilename);
    const tempPath = pathModule.join(os.tmpdir(), sanitized);
    const normalizedTemp = pathModule.normalize(os.tmpdir());
    const normalizedPath = pathModule.normalize(tempPath);

    // Verify the path starts with the temp directory
    expect(normalizedPath.startsWith(normalizedTemp)).toBe(true);

    // Verify no path separators in sanitized filename (critical for security)
    expect(sanitized).not.toContain('/');
    expect(sanitized).not.toContain('\\');
  }

  beforeEach(() => {
    // Initialize with in-memory DB for test isolation
    db.init(':memory:');
  });

  describe('Path Traversal Protection', () => {
    it('should sanitize Unix-style path traversal attempts', () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '../../.bashrc',
        '../../../home/user/.ssh/id_rsa',
        '../../../../etc/shadow',
      ];

      maliciousFilenames.forEach((filename) => {
        verifySafeInTempDir(filename);
        const sanitized = sanitizeFilename(filename);
        // Critical: no path separators (basename + removal ensures this)
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
        // Should have some content
        expect(sanitized.length).toBeGreaterThan(0);
      });
    });

    it('should sanitize Windows-style path traversal attempts', () => {
      const maliciousFilenames = [
        '..\\..\\..\\Windows\\System32\\config',
        '..\\..\\..\\Windows\\System32\\drivers\\etc\\hosts',
        '..\\..\\Users\\Admin\\AppData',
      ];

      maliciousFilenames.forEach((filename) => {
        verifySafeInTempDir(filename);
        const sanitized = sanitizeFilename(filename);
        // Critical: no path separators
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
        // Should have some content
        expect(sanitized.length).toBeGreaterThan(0);
      });
    });

    it('should sanitize mixed path separator traversal attempts', () => {
      const maliciousFilenames = ['../../../etc/passwd', '..\\..\\..\\etc\\passwd', '../..\\../etc/passwd'];

      maliciousFilenames.forEach((filename) => {
        verifySafeInTempDir(filename);
        const sanitized = sanitizeFilename(filename);
        // Critical: no path separators regardless of style
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
        // Should have some content
        expect(sanitized.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Absolute Path Protection', () => {
    it('should sanitize Unix absolute paths', () => {
      const absolutePaths = ['/etc/passwd', '/home/user/.bashrc', '/root/.ssh/id_rsa', '/var/log/system.log'];

      absolutePaths.forEach((filename) => {
        verifySafeInTempDir(filename);
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).not.toContain('/');
        // Should only have the filename without path
        expect(sanitized.length).toBeGreaterThan(0);
      });
    });

    it('should sanitize Windows absolute paths', () => {
      const absolutePaths = [
        'C:\\Windows\\System32\\config',
        'D:\\Users\\Admin\\Documents',
        'C:\\Program Files\\App\\config.ini',
      ];

      absolutePaths.forEach((filename) => {
        verifySafeInTempDir(filename);
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).not.toContain('\\');
        expect(sanitized).not.toContain(':');
      });
    });
  });

  describe('Null Byte Injection Protection', () => {
    it('should remove null bytes from filenames', () => {
      const maliciousFilenames = ['file.txt\0.exe', 'document\0.pdf', 'safe.pdf\0../../etc/passwd'];

      maliciousFilenames.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).not.toContain('\0');
        verifySafeInTempDir(filename);
      });
    });

    it('should handle multiple null bytes', () => {
      const filename = 'file\0\0\0.txt';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('file.txt');
      verifySafeInTempDir(filename);
    });
  });

  describe('Hidden Files and Special Cases', () => {
    it('should handle hidden files safely', () => {
      const testCases = [
        { input: '.bashrc', expected: 'bashrc' },
        { input: '.ssh', expected: 'ssh' },
        { input: '.env', expected: 'env' },
        { input: '.gitignore', expected: 'gitignore' },
      ];

      testCases.forEach(({ input, expected }) => {
        const sanitized = sanitizeFilename(input);
        verifySafeInTempDir(input);
        // Hidden files have leading dots trimmed, leaving the filename
        expect(sanitized).toBe(expected);
      });
    });

    it('should reject dangerous special filenames', () => {
      const dangerousNames = ['.', '..', '...', '....'];

      dangerousNames.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).toBe('attachment');
        verifySafeInTempDir(filename);
      });
    });

    it('should handle empty or invalid filenames', () => {
      const invalidFilenames: unknown[] = ['', '   ', '\t\n', null, undefined, 123];

      invalidFilenames.forEach((filename) => {
        const sanitized = sanitizeFilename(filename as string);
        expect(sanitized).toBe('attachment');
      });
    });
  });

  describe('Dangerous Character Removal', () => {
    it('should remove dangerous special characters', () => {
      const filename = 'file<>:"|?*.txt';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('file.txt');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain(':');
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain('|');
      expect(sanitized).not.toContain('?');
      expect(sanitized).not.toContain('*');
    });

    it('should handle filenames with only dangerous characters', () => {
      const filename = '<>:"|?*';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('attachment');
    });
  });

  describe('Windows Reserved Filenames', () => {
    it('should block basic Windows reserved device names', () => {
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL'];

      reservedNames.forEach((name) => {
        const sanitized = sanitizeFilename(name);
        expect(sanitized).toBe('attachment');
      });
    });

    it('should block Windows reserved device names with extensions', () => {
      const reservedWithExtensions = ['CON.txt', 'PRN.pdf', 'AUX.doc', 'NUL.exe'];

      reservedWithExtensions.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).toBe('attachment');
      });
    });

    it('should block COM1-9 and LPT1-9 device names', () => {
      const comLptNames = [
        'COM1',
        'COM2',
        'COM3',
        'COM4',
        'COM5',
        'COM6',
        'COM7',
        'COM8',
        'COM9',
        'LPT1',
        'LPT2',
        'LPT3',
        'LPT4',
        'LPT5',
        'LPT6',
        'LPT7',
        'LPT8',
        'LPT9',
      ];

      comLptNames.forEach((name) => {
        const sanitized = sanitizeFilename(name);
        expect(sanitized).toBe('attachment');
      });
    });

    it('should block COM/LPT device names with extensions', () => {
      const comLptWithExtensions = ['COM1.txt', 'COM5.pdf', 'LPT1.doc', 'LPT9.xlsx'];

      comLptWithExtensions.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).toBe('attachment');
      });
    });

    it('should handle case-insensitive reserved names', () => {
      const caseVariations = [
        'con',
        'Con',
        'CON',
        'cOn',
        'prn',
        'Prn',
        'PRN',
        'aux',
        'Aux',
        'AUX',
        'nul',
        'Nul',
        'NUL',
        'com1',
        'Com1',
        'COM1',
        'lpt1',
        'Lpt1',
        'LPT1',
      ];

      caseVariations.forEach((name) => {
        const sanitized = sanitizeFilename(name);
        expect(sanitized).toBe('attachment');
      });
    });

    it('should allow filenames that contain but are not reserved names', () => {
      const validFilenames = [
        'config.txt', // contains 'con' but not reserved
        'context.pdf', // contains 'con' but not reserved
        'printer.doc', // contains 'prn' but not reserved
        'auxiliary.txt', // contains 'aux' but not reserved
        'nullable.js', // contains 'nul' but not reserved
        'COM10.txt', // COM10 is not reserved (only COM1-9)
        'LPT0.txt', // LPT0 is not reserved (only LPT1-9)
        'COMMAND.exe', // contains 'COM' but not reserved
        'laptop.pdf', // contains 'lpt' but not reserved
      ];

      validFilenames.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).toBe(filename);
        expect(sanitized).not.toBe('attachment');
      });
    });
  });

  describe('Filename Length Limits', () => {
    it('should truncate very long filenames to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized).toMatch(/\.txt$/);
    });

    it('should preserve file extension when truncating', () => {
      const longName = 'b'.repeat(300) + '.pdf';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith('.pdf')).toBe(true);
    });

    it('should handle long filenames with long extensions', () => {
      const longName = 'c'.repeat(300) + '.verylongextension';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });

    it('should handle filenames with extremely long extensions (>= 255 chars)', () => {
      // Edge case: extension itself is >= 255 characters
      const extremelyLongExt = '.' + 'e'.repeat(255);
      const filename = 'file' + extremelyLongExt;
      const sanitized = sanitizeFilename(filename);

      // Should truncate to exactly 255 characters
      expect(sanitized.length).toBe(255);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });

    it('should handle filenames with extension > 255 chars and long base', () => {
      // Extension is 260 chars, base is 100 chars = total 360 chars
      const extremelyLongExt = '.' + 'x'.repeat(260);
      const filename = 'basename'.repeat(12) + extremelyLongExt;
      const sanitized = sanitizeFilename(filename);

      // Should truncate to exactly 255 characters
      expect(sanitized.length).toBe(255);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });

    it('should not have leading dots after truncation', () => {
      // Create a filename where truncation might result in a leading dot
      // For example: very long extension that causes base to become empty or start with dot
      const filename = 'a' + '.' + 'x'.repeat(254);
      const sanitized = sanitizeFilename(filename);

      // Should not start with a dot
      expect(sanitized).not.toMatch(/^\./);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });

    it('should handle edge case where truncation leaves only extension', () => {
      // Edge case: after truncation, only the extension remains
      const shortBase = 'f';
      const longExt = '.' + 'e'.repeat(254);
      const filename = shortBase + longExt;
      const sanitized = sanitizeFilename(filename);

      // Should not start with a leading dot
      expect(sanitized).not.toMatch(/^\./);
      expect(sanitized.length).toBeLessThanOrEqual(255);
      // Should not be empty
      expect(sanitized.length).toBeGreaterThan(0);
    });
  });

  describe('Valid Filenames', () => {
    it('should preserve valid simple filenames', () => {
      const validFilenames = ['document.pdf', 'report-2024.xlsx', 'image_001.png', 'notes.txt', 'data.json'];

      validFilenames.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).toBe(filename);
        verifySafeInTempDir(filename);
      });
    });

    it('should handle filenames with spaces', () => {
      const filename = 'my document.pdf';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('my document.pdf');
      verifySafeInTempDir(filename);
    });

    it('should handle filenames with hyphens and underscores', () => {
      const filename = 'my-important_file.txt';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('my-important_file.txt');
      verifySafeInTempDir(filename);
    });

    it('should handle filenames with numbers', () => {
      const filename = 'report-2024-01-31.pdf';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('report-2024-01-31.pdf');
      verifySafeInTempDir(filename);
    });
  });

  describe('Database Integration Security Tests', () => {
    it('should safely store and retrieve attachment with malicious filename', () => {
      createTestAccount('acc1');
      createTestEmail('email1', 'acc1', '../../../etc/passwd', 'attach-malicious');

      const attachment = db.getAttachment('attach-malicious');

      expect(attachment).toBeDefined();
      expect(attachment?.filename).toBe('../../../etc/passwd'); // DB stores original

      // Verify sanitization would make it safe
      const sanitized = sanitizeFilename(attachment!.filename);
      expect(sanitized).toBe('passwd');
      verifySafeInTempDir(attachment!.filename);
    });

    it('should handle attachment with null byte injection filename', () => {
      createTestAccount('acc2');
      createTestEmail('email2', 'acc2', 'safe.pdf\0.exe', 'attach-nullbyte');

      const attachment = db.getAttachment('attach-nullbyte');

      expect(attachment).toBeDefined();
      const sanitized = sanitizeFilename(attachment!.filename);
      expect(sanitized).not.toContain('\0');
      verifySafeInTempDir(attachment!.filename);
    });

    it('should handle attachment with Windows path traversal filename', () => {
      createTestAccount('acc3');
      createTestEmail('email3', 'acc3', '..\\..\\..\\Windows\\System32\\evil.dll', 'attach-windows');

      const attachment = db.getAttachment('attach-windows');

      expect(attachment).toBeDefined();
      const sanitized = sanitizeFilename(attachment!.filename);
      // After removing backslashes and trimming dots: WindowsSystem32evil.dll
      expect(sanitized).toBe('WindowsSystem32evil.dll');
      verifySafeInTempDir(attachment!.filename);
      // Most importantly: no path separators remain
      expect(sanitized).not.toContain('\\');
      expect(sanitized).not.toContain('/');
    });
  });

  describe('Edge Cases and Corner Cases', () => {
    it('should handle filenames with leading/trailing dots', () => {
      const filenames = ['...filename.txt', 'filename.txt...', '..filename..txt..'];

      filenames.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        // Leading/trailing dots are trimmed
        expect(sanitized).not.toMatch(/^\./);
        expect(sanitized).not.toMatch(/\.$/);
      });
    });

    it('should handle filenames with leading/trailing spaces', () => {
      const filename = '   document.pdf   ';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('document.pdf');
      expect(sanitized).not.toMatch(/^\s/);
      expect(sanitized).not.toMatch(/\s$/);
    });

    it('should handle filenames with mixed whitespace', () => {
      const filename = '\t\n  file.txt  \n\t';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('file.txt');
    });

    it('should handle Unicode filenames safely', () => {
      const unicodeFilenames = ['документ.pdf', '文档.txt', 'ملف.docx', 'αρχείο.xlsx'];

      unicodeFilenames.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized.length).toBeGreaterThan(0);
        expect(sanitized).not.toBe('attachment'); // Unicode should be preserved
        verifySafeInTempDir(filename);
      });
    });

    it('should handle filenames without extensions', () => {
      const filename = 'README';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('README');
      verifySafeInTempDir(filename);
    });

    it('should handle filenames with multiple dots', () => {
      const filename = 'archive.tar.gz';
      const sanitized = sanitizeFilename(filename);
      expect(sanitized).toBe('archive.tar.gz');
      verifySafeInTempDir(filename);
    });
  });

  describe('Combined Attack Vectors', () => {
    it('should handle multiple attack vectors combined', () => {
      const complexAttacks = [
        '../../../etc/passwd\0.exe',
        '..\\..\\Windows\\<system>.dll',
        '/etc/../../../root/.ssh/id_rsa\0',
        'C:\\..\\..\\..\\Windows\\|evil|.exe',
      ];

      complexAttacks.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        // Critical security checks: no path separators or null bytes
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
        expect(sanitized).not.toContain('\0');
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toContain('|');
        expect(sanitized).not.toContain(':');
        // Verify safe in temp dir
        verifySafeInTempDir(filename);
      });
    });

    it('should handle path traversal with encoded characters', () => {
      // Note: This tests the current implementation, which doesn't decode
      // If URL encoding becomes a concern, additional sanitization may be needed
      const filename = '..%2F..%2Fetc%2Fpasswd';
      const sanitized = sanitizeFilename(filename);
      // Critical: no actual path separators (encoded ones are treated as literals)
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('\\');
      // Verify the path is safe even with encoded characters
      verifySafeInTempDir(filename);
      // The encoded slashes remain as %2F which is safe
      expect(sanitized).toContain('%2F');
    });
  });
});
