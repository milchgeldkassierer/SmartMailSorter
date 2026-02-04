import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { ImapAccount, Email } from '../../types';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Mock Electron to provide app.getPath
const electronPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../node_modules/electron/index.js');
(require.cache as any)[electronPath] = {
  exports: {
    app: {
      getPath: () => './test-data'
    }
  }
};

// Define interface for db module methods (email-focused)
interface DbModule {
  init: (path: string) => void;
  addAccount: (account: Partial<ImapAccount> & { id: string; username?: string; password?: string }) => void;
  saveEmail: (email: Partial<Email> & { id: string; accountId: string; attachments?: Array<{ id?: string; filename?: string; contentType?: string; size?: number; data?: Buffer }> }) => { changes: number };
  getEmails: (accountId: string) => Email[];
  getEmailContent: (emailId: string) => { body: string; bodyHtml: string | null } | undefined;
  deleteEmail: (id: string) => void;
  deleteEmailsByUid: (accountId: string, folder: string, uids: number[]) => number;
  updateEmailReadStatus: (id: string, isRead: boolean) => { changes: number };
  updateEmailFlagStatus: (id: string, isFlagged: boolean) => { changes: number };
  updateEmailSmartCategory: (id: string, smartCategory: string | null, aiSummary: string | null, aiReasoning: string | null, confidence: number) => { changes: number };
  getEmailAttachments: (emailId: string) => Array<{ id: string; filename: string; contentType: string; size: number }>;
  getAttachment: (id: string) => { id: string; emailId: string; filename: string; contentType: string; size: number; data: Buffer } | undefined;
}

// Import the database module under test
const db: DbModule = require('../db.cjs');

// Helper function to create a test account
function createTestAccount(id: string = 'test-account') {
  return {
    id,
    name: 'Test Account',
    email: 'test@example.com',
    provider: 'test',
    username: 'testuser',
    password: 'password',
    imapHost: 'imap.test.com',
    imapPort: 993,
    color: '#0000FF'
  };
}

// Helper function to create a test email
function createTestEmail(id: string, accountId: string, overrides: Partial<Email> = {}) {
  return {
    id,
    accountId,
    sender: 'Test Sender',
    senderEmail: 'sender@test.com',
    subject: 'Test Subject',
    body: 'Test body content',
    bodyHtml: '<p>Test body content</p>',
    date: new Date().toISOString(),
    folder: 'Posteingang',
    smartCategory: null,
    isRead: false,
    isFlagged: false,
    hasAttachments: false,
    uid: 100,
    ...overrides
  };
}

describe('Database Email Operations', () => {
  const accountId = 'email-test-account';

  beforeEach(() => {
    // Initialize with in-memory DB for test isolation
    db.init(':memory:');
    // Create a test account for email operations
    db.addAccount(createTestAccount(accountId));
  });

  describe('saveEmail', () => {
    it('should save a basic email', () => {
      const email = createTestEmail('email-1', accountId);

      db.saveEmail(email);
      const emails = db.getEmails(accountId);

      expect(emails).toHaveLength(1);
      expect(emails[0].id).toBe('email-1');
      expect(emails[0].sender).toBe('Test Sender');
      expect(emails[0].senderEmail).toBe('sender@test.com');
      expect(emails[0].subject).toBe('Test Subject');
      expect(emails[0].uid).toBe(100);
    });

    it('should save email with all fields', () => {
      const email = createTestEmail('email-2', accountId, {
        sender: 'Full Sender',
        senderEmail: 'full@test.com',
        subject: 'Full Subject',
        folder: 'Gesendet',
        smartCategory: 'Rechnungen',
        isRead: true,
        isFlagged: true,
        hasAttachments: true,
        aiSummary: 'This is an AI summary',
        aiReasoning: 'AI reasoning explanation',
        confidence: 0.95,
        uid: 200
      });

      db.saveEmail(email);
      const emails = db.getEmails(accountId);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Full Sender');
      expect(emails[0].folder).toBe('Gesendet');
      expect(emails[0].smartCategory).toBe('Rechnungen');
      expect(emails[0].isRead).toBe(true);
      expect(emails[0].isFlagged).toBe(true);
      expect(emails[0].hasAttachments).toBe(true);
      expect(emails[0].aiSummary).toBe('This is an AI summary');
      expect(emails[0].aiReasoning).toBe('AI reasoning explanation');
      expect(emails[0].confidence).toBe(0.95);
    });

    it('should apply default values for missing fields', () => {
      const minimalEmail = {
        id: 'minimal-email',
        accountId
      };

      db.saveEmail(minimalEmail);
      const emails = db.getEmails(accountId);

      expect(emails).toHaveLength(1);
      expect(emails[0].sender).toBe('Unknown');
      expect(emails[0].subject).toBe('(No Subject)');
      expect(emails[0].folder).toBe('Posteingang');
      expect(emails[0].isRead).toBe(false);
      expect(emails[0].isFlagged).toBe(false);
    });

    it('should replace existing email with same id (upsert)', () => {
      const email1 = createTestEmail('email-upsert', accountId, { subject: 'Original Subject' });
      const email2 = createTestEmail('email-upsert', accountId, { subject: 'Updated Subject' });

      db.saveEmail(email1);
      db.saveEmail(email2);

      const emails = db.getEmails(accountId);
      expect(emails).toHaveLength(1);
      expect(emails[0].subject).toBe('Updated Subject');
    });

    it('should save email with attachments', () => {
      const emailWithAttachments = {
        ...createTestEmail('email-with-attachments', accountId),
        hasAttachments: true,
        attachments: [
          {
            id: 'att-1',
            filename: 'document.pdf',
            contentType: 'application/pdf',
            size: 1024,
            data: Buffer.from('fake pdf content')
          },
          {
            id: 'att-2',
            filename: 'image.png',
            contentType: 'image/png',
            size: 2048,
            data: Buffer.from('fake image content')
          }
        ]
      };

      db.saveEmail(emailWithAttachments);
      const attachments = db.getEmailAttachments('email-with-attachments');

      expect(attachments).toHaveLength(2);
      expect(attachments[0].filename).toBe('document.pdf');
      expect(attachments[1].filename).toBe('image.png');
    });
  });

  describe('getEmails', () => {
    it('should return empty array for account with no emails', () => {
      const emails = db.getEmails(accountId);
      expect(emails).toEqual([]);
    });

    it('should return emails sorted by date descending', () => {
      const oldDate = new Date('2024-01-01').toISOString();
      const newDate = new Date('2024-06-15').toISOString();
      const newestDate = new Date('2024-12-25').toISOString();

      db.saveEmail(createTestEmail('email-old', accountId, { date: oldDate }));
      db.saveEmail(createTestEmail('email-new', accountId, { date: newDate }));
      db.saveEmail(createTestEmail('email-newest', accountId, { date: newestDate }));

      const emails = db.getEmails(accountId);

      expect(emails).toHaveLength(3);
      expect(emails[0].id).toBe('email-newest');
      expect(emails[1].id).toBe('email-new');
      expect(emails[2].id).toBe('email-old');
    });

    it('should only return emails for specified account', () => {
      // Create second account
      db.addAccount(createTestAccount('other-account'));

      db.saveEmail(createTestEmail('email-acc1', accountId));
      db.saveEmail(createTestEmail('email-acc2', 'other-account'));

      const emailsAcc1 = db.getEmails(accountId);
      const emailsAcc2 = db.getEmails('other-account');

      expect(emailsAcc1).toHaveLength(1);
      expect(emailsAcc1[0].id).toBe('email-acc1');
      expect(emailsAcc2).toHaveLength(1);
      expect(emailsAcc2[0].id).toBe('email-acc2');
    });

    it('should convert boolean fields correctly', () => {
      db.saveEmail(createTestEmail('email-bools', accountId, {
        isRead: true,
        isFlagged: true,
        hasAttachments: true
      }));

      const emails = db.getEmails(accountId);

      expect(typeof emails[0].isRead).toBe('boolean');
      expect(typeof emails[0].isFlagged).toBe('boolean');
      expect(typeof emails[0].hasAttachments).toBe('boolean');
      expect(emails[0].isRead).toBe(true);
      expect(emails[0].isFlagged).toBe(true);
      expect(emails[0].hasAttachments).toBe(true);
    });

    it('should not include body/bodyHtml in results (performance optimization)', () => {
      db.saveEmail(createTestEmail('email-no-body', accountId, {
        body: 'Large body content',
        bodyHtml: '<p>Large HTML content</p>'
      }));

      const emails = db.getEmails(accountId);

      // The getEmails query excludes body and bodyHtml for performance
      expect(emails[0]).not.toHaveProperty('body');
      expect(emails[0]).not.toHaveProperty('bodyHtml');
    });
  });

  describe('getEmailContent', () => {
    it('should return body and bodyHtml for an email', () => {
      db.saveEmail(createTestEmail('email-content', accountId, {
        body: 'Plain text body',
        bodyHtml: '<p>HTML body</p>'
      }));

      const content = db.getEmailContent('email-content');

      expect(content).toBeDefined();
      expect(content?.body).toBe('Plain text body');
      expect(content?.bodyHtml).toBe('<p>HTML body</p>');
    });

    it('should return undefined for non-existent email', () => {
      const content = db.getEmailContent('non-existent');
      expect(content).toBeUndefined();
    });

    it('should handle email with null bodyHtml', () => {
      db.saveEmail({
        id: 'email-no-html',
        accountId,
        body: 'Plain text only'
      });

      const content = db.getEmailContent('email-no-html');

      expect(content).toBeDefined();
      expect(content?.body).toBe('Plain text only');
      expect(content?.bodyHtml).toBeNull();
    });
  });

  describe('deleteEmail', () => {
    it('should delete an email by id', () => {
      db.saveEmail(createTestEmail('email-to-delete', accountId));

      let emails = db.getEmails(accountId);
      expect(emails).toHaveLength(1);

      db.deleteEmail('email-to-delete');

      emails = db.getEmails(accountId);
      expect(emails).toHaveLength(0);
    });

    it('should only delete the specified email', () => {
      db.saveEmail(createTestEmail('email-keep', accountId));
      db.saveEmail(createTestEmail('email-delete', accountId));

      db.deleteEmail('email-delete');

      const emails = db.getEmails(accountId);
      expect(emails).toHaveLength(1);
      expect(emails[0].id).toBe('email-keep');
    });

    it('should handle deleting non-existent email gracefully', () => {
      // Should not throw
      expect(() => db.deleteEmail('non-existent')).not.toThrow();
    });
  });

  describe('deleteEmailsByUid', () => {
    beforeEach(() => {
      // Create multiple emails with different UIDs and folders
      db.saveEmail(createTestEmail('email-uid-100', accountId, { uid: 100, folder: 'Posteingang' }));
      db.saveEmail(createTestEmail('email-uid-101', accountId, { uid: 101, folder: 'Posteingang' }));
      db.saveEmail(createTestEmail('email-uid-102', accountId, { uid: 102, folder: 'Posteingang' }));
      db.saveEmail(createTestEmail('email-uid-200', accountId, { uid: 200, folder: 'Gesendet' }));
    });

    it('should delete multiple emails by UID for specific folder', () => {
      const deletedCount = db.deleteEmailsByUid(accountId, 'Posteingang', [100, 101]);

      expect(deletedCount).toBe(2);
      const emails = db.getEmails(accountId);
      expect(emails).toHaveLength(2);
      expect(emails.map(e => e.uid)).toContain(102);
      expect(emails.map(e => e.uid)).toContain(200);
    });

    it('should only delete from specified folder', () => {
      const deletedCount = db.deleteEmailsByUid(accountId, 'Posteingang', [200]);

      expect(deletedCount).toBe(0);
      const emails = db.getEmails(accountId);
      expect(emails).toHaveLength(4);
    });

    it('should only delete from specified account', () => {
      // Create second account with same UIDs
      db.addAccount(createTestAccount('other-account'));
      db.saveEmail(createTestEmail('other-email', 'other-account', { uid: 100, folder: 'Posteingang' }));

      const deletedCount = db.deleteEmailsByUid(accountId, 'Posteingang', [100]);

      expect(deletedCount).toBe(1);
      // Other account's email should still exist
      const otherEmails = db.getEmails('other-account');
      expect(otherEmails).toHaveLength(1);
    });

    it('should return 0 when empty array provided', () => {
      const deletedCount = db.deleteEmailsByUid(accountId, 'Posteingang', []);
      expect(deletedCount).toBe(0);
    });

    it('should return 0 for non-existent UIDs', () => {
      const deletedCount = db.deleteEmailsByUid(accountId, 'Posteingang', [999, 998]);
      expect(deletedCount).toBe(0);
    });
  });

  describe('updateEmailReadStatus', () => {
    it('should mark email as read', () => {
      db.saveEmail(createTestEmail('email-read', accountId, { isRead: false }));

      const result = db.updateEmailReadStatus('email-read', true);

      expect(result.changes).toBe(1);
      const emails = db.getEmails(accountId);
      expect(emails[0].isRead).toBe(true);
    });

    it('should mark email as unread', () => {
      db.saveEmail(createTestEmail('email-unread', accountId, { isRead: true }));

      const result = db.updateEmailReadStatus('email-unread', false);

      expect(result.changes).toBe(1);
      const emails = db.getEmails(accountId);
      expect(emails[0].isRead).toBe(false);
    });

    it('should return 0 changes for non-existent email', () => {
      const result = db.updateEmailReadStatus('non-existent', true);
      expect(result.changes).toBe(0);
    });
  });

  describe('updateEmailFlagStatus', () => {
    it('should flag an email', () => {
      db.saveEmail(createTestEmail('email-flag', accountId, { isFlagged: false }));

      const result = db.updateEmailFlagStatus('email-flag', true);

      expect(result.changes).toBe(1);
      const emails = db.getEmails(accountId);
      expect(emails[0].isFlagged).toBe(true);
    });

    it('should unflag an email', () => {
      db.saveEmail(createTestEmail('email-unflag', accountId, { isFlagged: true }));

      const result = db.updateEmailFlagStatus('email-unflag', false);

      expect(result.changes).toBe(1);
      const emails = db.getEmails(accountId);
      expect(emails[0].isFlagged).toBe(false);
    });

    it('should return 0 changes for non-existent email', () => {
      const result = db.updateEmailFlagStatus('non-existent', true);
      expect(result.changes).toBe(0);
    });
  });

  describe('updateEmailSmartCategory', () => {
    it('should update smart category and AI fields', () => {
      db.saveEmail(createTestEmail('email-categorize', accountId));

      const result = db.updateEmailSmartCategory(
        'email-categorize',
        'Rechnungen',
        'Invoice for subscription renewal',
        'Contains payment details and due date',
        0.92
      );

      expect(result.changes).toBe(1);
      const emails = db.getEmails(accountId);
      expect(emails[0].smartCategory).toBe('Rechnungen');
      expect(emails[0].aiSummary).toBe('Invoice for subscription renewal');
      expect(emails[0].aiReasoning).toBe('Contains payment details and due date');
      expect(emails[0].confidence).toBe(0.92);
    });

    it('should clear category when set to null', () => {
      db.saveEmail(createTestEmail('email-clear-cat', accountId, {
        smartCategory: 'Newsletter',
        aiSummary: 'Old summary',
        aiReasoning: 'Old reasoning',
        confidence: 0.8
      }));

      const result = db.updateEmailSmartCategory('email-clear-cat', null, null, null, 0);

      expect(result.changes).toBe(1);
      const emails = db.getEmails(accountId);
      expect(emails[0].smartCategory).toBeNull();
      expect(emails[0].aiSummary).toBeNull();
      expect(emails[0].aiReasoning).toBeNull();
      expect(emails[0].confidence).toBe(0);
    });

    it('should update category for specific email only', () => {
      db.saveEmail(createTestEmail('email-cat-1', accountId, { smartCategory: 'Privat' }));
      db.saveEmail(createTestEmail('email-cat-2', accountId, { smartCategory: 'Privat' }));

      db.updateEmailSmartCategory('email-cat-1', 'Geschäftlich', 'Business related', 'Work context', 0.9);

      const emails = db.getEmails(accountId);
      const email1 = emails.find(e => e.id === 'email-cat-1');
      const email2 = emails.find(e => e.id === 'email-cat-2');

      expect(email1?.smartCategory).toBe('Geschäftlich');
      expect(email2?.smartCategory).toBe('Privat');
    });

    it('should return 0 changes for non-existent email', () => {
      const result = db.updateEmailSmartCategory('non-existent', 'Rechnungen', 'Summary', 'Reasoning', 0.9);
      expect(result.changes).toBe(0);
    });

    it('should handle various category values', () => {
      const categories = ['Rechnungen', 'Newsletter', 'Privat', 'Geschäftlich', 'Kündigungen', 'Sonstiges'];

      categories.forEach((category, index) => {
        const emailId = `email-cat-${index}`;
        db.saveEmail(createTestEmail(emailId, accountId));
        db.updateEmailSmartCategory(emailId, category, `Summary for ${category}`, 'Reasoning', 0.85);
      });

      const emails = db.getEmails(accountId);
      expect(emails).toHaveLength(categories.length);

      categories.forEach((category, index) => {
        const email = emails.find(e => e.id === `email-cat-${index}`);
        expect(email?.smartCategory).toBe(category);
      });
    });
  });

  describe('getAttachment', () => {
    it('should get attachment by id including data', () => {
      const attachmentData = Buffer.from('This is test file content');
      const emailWithAttachment = {
        ...createTestEmail('email-get-attach', accountId),
        hasAttachments: true,
        attachments: [
          {
            id: 'attachment-to-get',
            filename: 'testfile.txt',
            contentType: 'text/plain',
            size: attachmentData.length,
            data: attachmentData
          }
        ]
      };

      db.saveEmail(emailWithAttachment);

      const attachment = db.getAttachment('attachment-to-get');

      expect(attachment).toBeDefined();
      expect(attachment?.id).toBe('attachment-to-get');
      expect(attachment?.filename).toBe('testfile.txt');
      expect(attachment?.contentType).toBe('text/plain');
      expect(attachment?.size).toBe(attachmentData.length);
      expect(attachment?.data).toBeDefined();
      expect(Buffer.isBuffer(attachment?.data)).toBe(true);
    });

    it('should return undefined for non-existent attachment', () => {
      const attachment = db.getAttachment('non-existent-attachment');
      expect(attachment).toBeUndefined();
    });

    it('should get correct attachment when multiple exist', () => {
      const emailWithMultiple = {
        ...createTestEmail('email-multi-attach', accountId),
        hasAttachments: true,
        attachments: [
          {
            id: 'attach-first',
            filename: 'first.pdf',
            contentType: 'application/pdf',
            size: 1000,
            data: Buffer.from('pdf content')
          },
          {
            id: 'attach-second',
            filename: 'second.png',
            contentType: 'image/png',
            size: 2000,
            data: Buffer.from('png content')
          }
        ]
      };

      db.saveEmail(emailWithMultiple);

      const first = db.getAttachment('attach-first');
      const second = db.getAttachment('attach-second');

      expect(first?.filename).toBe('first.pdf');
      expect(second?.filename).toBe('second.png');
    });
  });

  describe('saveEmail with attachment defaults', () => {
    it('should apply default values for attachment fields', () => {
      const emailWithMinimalAttachment = {
        ...createTestEmail('email-min-attach', accountId),
        hasAttachments: true,
        attachments: [
          {
            // No id, filename, contentType, size, or data - should use defaults
          }
        ]
      };

      db.saveEmail(emailWithMinimalAttachment);
      const attachments = db.getEmailAttachments('email-min-attach');

      expect(attachments).toHaveLength(1);
      // Should have generated an id
      expect(attachments[0].id).toBeDefined();
      // Default filename
      expect(attachments[0].filename).toBe('unnamed');
      // Default content type
      expect(attachments[0].contentType).toBe('application/octet-stream');
      // Default size
      expect(attachments[0].size).toBe(0);
    });
  });
});
