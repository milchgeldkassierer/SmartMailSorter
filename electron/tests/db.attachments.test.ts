import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { ImapAccount, Email } from '../../types';

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

// Define interface for attachment
interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  size: number;
  data?: Buffer | null;
}

// Define interface for db module methods
interface DbModule {
  init: (path: string) => void;
  addAccount: (account: Partial<ImapAccount> & { id: string; username?: string; password?: string }) => void;
  getAccounts: () => Array<ImapAccount & { username?: string; password?: string; lastSyncUid?: number }>;
  saveEmail: (
    email: Partial<Email> & { id: string; accountId: string; attachments?: Array<Partial<Attachment>> }
  ) => void;
  getEmails: (accountId: string) => Email[];
  getEmailAttachments: (emailId: string) => Array<Omit<Attachment, 'data' | 'emailId'>>;
  getAttachment: (id: string) => Attachment | undefined;
}

// Import the database module under test
const db: DbModule = require('../db.cjs');

// Import folder constants
const { INBOX_FOLDER } = require('../folderConstants.cjs');

describe('Database Attachments Module', () => {
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

  // Helper to create a test email
  const createTestEmail = (id: string, accountId: string, attachments?: Array<Partial<Attachment>>) => {
    const email = {
      id,
      accountId,
      sender: 'Test Sender',
      senderEmail: 'sender@test.com',
      subject: 'Test Email',
      body: 'Test body content',
      date: new Date().toISOString(),
      folder: INBOX_FOLDER,
      isRead: false,
      isFlagged: false,
      hasAttachments: attachments ? attachments.length > 0 : false,
      uid: 100,
      attachments,
    };
    db.saveEmail(email);
    return email;
  };

  beforeEach(() => {
    // Initialize with in-memory DB for test isolation
    db.init(':memory:');
  });

  describe('getEmailAttachments', () => {
    it('should return empty array for email without attachments', () => {
      createTestAccount('acc1');
      createTestEmail('email1', 'acc1');

      const attachments = db.getEmailAttachments('email1');

      expect(attachments).toEqual([]);
    });

    it('should return attachments for email with single attachment', () => {
      createTestAccount('acc2');
      const attachment = {
        id: 'attach1',
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024,
        data: Buffer.from('PDF content'),
      };
      createTestEmail('email2', 'acc2', [attachment]);

      const attachments = db.getEmailAttachments('email2');

      expect(attachments).toHaveLength(1);
      expect(attachments[0].id).toBe('attach1');
      expect(attachments[0].filename).toBe('document.pdf');
      expect(attachments[0].contentType).toBe('application/pdf');
      expect(attachments[0].size).toBe(1024);
      // getEmailAttachments should NOT return data (for performance)
      expect(attachments[0]).not.toHaveProperty('data');
    });

    it('should return multiple attachments for email', () => {
      createTestAccount('acc3');
      const attachments = [
        {
          id: 'attach2',
          filename: 'image.png',
          contentType: 'image/png',
          size: 2048,
          data: Buffer.from('PNG data'),
        },
        {
          id: 'attach3',
          filename: 'report.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 4096,
          data: Buffer.from('Excel data'),
        },
        {
          id: 'attach4',
          filename: 'notes.txt',
          contentType: 'text/plain',
          size: 256,
          data: Buffer.from('Text content'),
        },
      ];
      createTestEmail('email3', 'acc3', attachments);

      const result = db.getEmailAttachments('email3');

      expect(result).toHaveLength(3);
      expect(result.map((a) => a.filename)).toContain('image.png');
      expect(result.map((a) => a.filename)).toContain('report.xlsx');
      expect(result.map((a) => a.filename)).toContain('notes.txt');
    });

    it('should return empty array for non-existent email', () => {
      const attachments = db.getEmailAttachments('non-existent-email');

      expect(attachments).toEqual([]);
    });
  });

  describe('getAttachment', () => {
    it('should return full attachment with data', () => {
      createTestAccount('acc4');
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff]);
      const attachment = {
        id: 'attach5',
        filename: 'binary.bin',
        contentType: 'application/octet-stream',
        size: 5,
        data: binaryData,
      };
      createTestEmail('email4', 'acc4', [attachment]);

      const result = db.getAttachment('attach5');

      expect(result).toBeDefined();
      expect(result?.id).toBe('attach5');
      expect(result?.emailId).toBe('email4');
      expect(result?.filename).toBe('binary.bin');
      expect(result?.contentType).toBe('application/octet-stream');
      expect(result?.size).toBe(5);
      expect(result?.data).toEqual(binaryData);
    });

    it('should return undefined for non-existent attachment', () => {
      const result = db.getAttachment('non-existent-attachment');

      expect(result).toBeUndefined();
    });

    it('should return attachment with null data if saved without data', () => {
      createTestAccount('acc5');
      const attachment = {
        id: 'attach6',
        filename: 'empty.txt',
        contentType: 'text/plain',
        size: 0,
        // No data field
      };
      createTestEmail('email5', 'acc5', [attachment]);

      const result = db.getAttachment('attach6');

      expect(result).toBeDefined();
      expect(result?.filename).toBe('empty.txt');
      expect(result?.data).toBeNull();
    });
  });

  describe('attachment saving via saveEmail', () => {
    it('should save email with attachments and set hasAttachments flag', () => {
      createTestAccount('acc6');
      const attachment = {
        id: 'attach7',
        filename: 'test.txt',
        contentType: 'text/plain',
        size: 100,
        data: Buffer.from('Test content'),
      };

      db.saveEmail({
        id: 'email6',
        accountId: 'acc6',
        sender: 'Sender',
        senderEmail: 'sender@test.com',
        subject: 'Email with attachment',
        body: 'Body',
        date: new Date().toISOString(),
        isRead: false,
        isFlagged: false,
        hasAttachments: true,
        uid: 101,
        attachments: [attachment],
      });

      const emails = db.getEmails('acc6');
      expect(emails).toHaveLength(1);
      expect(emails[0].hasAttachments).toBe(true);

      const attachments = db.getEmailAttachments('email6');
      expect(attachments).toHaveLength(1);
    });

    it('should auto-generate attachment id if not provided', () => {
      createTestAccount('acc7');
      const attachment = {
        filename: 'auto-id.txt',
        contentType: 'text/plain',
        size: 50,
        data: Buffer.from('Data'),
      };
      createTestEmail('email7', 'acc7', [attachment]);

      const attachments = db.getEmailAttachments('email7');

      expect(attachments).toHaveLength(1);
      expect(attachments[0].id).toBeDefined();
      expect(attachments[0].id.length).toBeGreaterThan(0);
    });

    it('should use default values for missing attachment properties', () => {
      createTestAccount('acc8');
      const attachment = {
        id: 'attach8',
        // Missing filename, contentType, size
      };
      createTestEmail('email8', 'acc8', [attachment]);

      const result = db.getAttachment('attach8');

      expect(result).toBeDefined();
      expect(result?.filename).toBe('unnamed');
      expect(result?.contentType).toBe('application/octet-stream');
      expect(result?.size).toBe(0);
    });

    it('should replace attachments when email is re-saved', () => {
      createTestAccount('acc9');

      // First save with one attachment
      const attachment1 = {
        id: 'attach9',
        filename: 'original.txt',
        contentType: 'text/plain',
        size: 100,
        data: Buffer.from('Original'),
      };
      createTestEmail('email9', 'acc9', [attachment1]);

      // Re-save with a different attachment (same ID)
      const attachment2 = {
        id: 'attach9',
        filename: 'updated.txt',
        contentType: 'text/plain',
        size: 200,
        data: Buffer.from('Updated content'),
      };
      db.saveEmail({
        id: 'email9',
        accountId: 'acc9',
        sender: 'Sender',
        senderEmail: 'sender@test.com',
        subject: 'Updated',
        body: 'Body',
        date: new Date().toISOString(),
        isRead: false,
        isFlagged: false,
        hasAttachments: true,
        uid: 100,
        attachments: [attachment2],
      });

      const result = db.getAttachment('attach9');

      expect(result?.filename).toBe('updated.txt');
      expect(result?.size).toBe(200);
    });

    it('should handle large binary attachments', () => {
      createTestAccount('acc10');
      // Create a 1MB buffer
      const largeData = Buffer.alloc(1024 * 1024, 0xab);
      const attachment = {
        id: 'attach10',
        filename: 'large-file.bin',
        contentType: 'application/octet-stream',
        size: largeData.length,
        data: largeData,
      };
      createTestEmail('email10', 'acc10', [attachment]);

      const result = db.getAttachment('attach10');

      expect(result).toBeDefined();
      expect(result?.size).toBe(1024 * 1024);
      expect(result?.data?.length).toBe(1024 * 1024);
      expect(result?.data?.[0]).toBe(0xab);
    });
  });

  describe('attachment isolation', () => {
    it('should only return attachments for the specified email', () => {
      createTestAccount('acc11');

      // Create two emails with attachments
      createTestEmail('email11a', 'acc11', [
        { id: 'attach11a', filename: 'file-a.txt', contentType: 'text/plain', size: 10 },
      ]);
      createTestEmail('email11b', 'acc11', [
        { id: 'attach11b', filename: 'file-b.txt', contentType: 'text/plain', size: 20 },
      ]);

      const attachmentsA = db.getEmailAttachments('email11a');
      const attachmentsB = db.getEmailAttachments('email11b');

      expect(attachmentsA).toHaveLength(1);
      expect(attachmentsA[0].filename).toBe('file-a.txt');

      expect(attachmentsB).toHaveLength(1);
      expect(attachmentsB[0].filename).toBe('file-b.txt');
    });
  });
});
