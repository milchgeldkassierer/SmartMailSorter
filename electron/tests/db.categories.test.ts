import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Mock Electron to provide app.getPath
const electronPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../node_modules/electron/index.js'
);
(require.cache as any)[electronPath] = {
  exports: {
    app: {
      getPath: () => './test-data',
    },
  },
};

// Define interface for category-related db module methods
interface Category {
  name: string;
  type: string;
}

interface DbModule {
  init: (path: string) => void;
  getCategories: () => Category[];
  addCategory: (name: string, type?: string) => { changes: number };
  updateCategoryType: (name: string, newType: string) => { changes: number };
  deleteSmartCategory: (categoryName: string) => { changes: number };
  renameSmartCategory: (oldName: string, newName: string) => { success: boolean };
  addAccount: (account: {
    id: string;
    name: string;
    email: string;
    provider: string;
    imapHost: string;
    imapPort: number;
    username: string;
    password: string;
    color: string;
  }) => void;
  saveEmail: (email: {
    id: string;
    accountId: string;
    sender?: string;
    senderEmail?: string;
    subject?: string;
    body?: string;
    date?: string;
    smartCategory?: string;
    isRead?: boolean;
    isFlagged?: boolean;
    uid?: number;
  }) => void;
  getEmails: (accountId: string) => Array<{ id: string; smartCategory: string | null }>;
}

// Import the database module under test
const db: DbModule = require('../db.cjs');

describe('Database Categories Module', () => {
  beforeEach(() => {
    // Initialize with in-memory DB for test isolation
    // This exercises the DI path in db.cjs
    db.init(':memory:');
  });

  describe('getCategories', () => {
    it('should return default system categories after initialization', () => {
      const categories = db.getCategories();

      // Verify we have the default system categories
      expect(categories.length).toBeGreaterThanOrEqual(6);

      const categoryNames = categories.map((c) => c.name);
      expect(categoryNames).toContain('Rechnungen');
      expect(categoryNames).toContain('Newsletter');
      expect(categoryNames).toContain('Privat');
      expect(categoryNames).toContain('Geschäftlich');
      expect(categoryNames).toContain('Kündigungen');
      expect(categoryNames).toContain('Sonstiges');
    });

    it('should return categories with name and type properties', () => {
      const categories = db.getCategories();

      expect(categories.length).toBeGreaterThan(0);
      categories.forEach((cat) => {
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('type');
        expect(typeof cat.name).toBe('string');
        expect(typeof cat.type).toBe('string');
      });
    });

    it('should have system type for default categories', () => {
      const categories = db.getCategories();

      const systemCategory = categories.find((c) => c.name === 'Rechnungen');
      expect(systemCategory?.type).toBe('system');
    });
  });

  describe('addCategory', () => {
    it('should add a new custom category', () => {
      const result = db.addCategory('MyCategory');

      expect(result.changes).toBe(1);

      const categories = db.getCategories();
      const myCategory = categories.find((c) => c.name === 'MyCategory');
      expect(myCategory).toBeDefined();
      expect(myCategory?.type).toBe('custom');
    });

    it('should add a category with specified type', () => {
      const result = db.addCategory('SystemCat', 'system');

      expect(result.changes).toBe(1);

      const categories = db.getCategories();
      const systemCat = categories.find((c) => c.name === 'SystemCat');
      expect(systemCat).toBeDefined();
      expect(systemCat?.type).toBe('system');
    });

    it('should handle duplicate category gracefully', () => {
      db.addCategory('Duplicate');

      // Second add of same name should throw SQLITE_CONSTRAINT_PRIMARYKEY
      // (name is the primary key, not just unique constraint)
      try {
        db.addCategory('Duplicate');
        // If it doesn't throw, verify no duplicates
        const categories = db.getCategories();
        const dupCount = categories.filter((c) => c.name === 'Duplicate').length;
        expect(dupCount).toBe(1);
      } catch (err: unknown) {
        // Expected: Primary key violation for duplicate names
        expect((err as { code: string }).code).toBe('SQLITE_CONSTRAINT_PRIMARYKEY');
      }
    });

    it('should not duplicate existing system categories', () => {
      // Try to add a category with same name as system category
      // Should throw SQLITE_CONSTRAINT_PRIMARYKEY since name is PK
      try {
        db.addCategory('Rechnungen');
        // If it doesn't throw, verify count
        const categories = db.getCategories();
        const rechnungenCount = categories.filter((c) => c.name === 'Rechnungen').length;
        expect(rechnungenCount).toBe(1);
      } catch (err: unknown) {
        expect((err as { code: string }).code).toBe('SQLITE_CONSTRAINT_PRIMARYKEY');
      }
    });
  });

  describe('updateCategoryType', () => {
    it('should update an existing category type', () => {
      // First add a custom category
      db.addCategory('TestCategory', 'custom');

      // Update it to system
      const result = db.updateCategoryType('TestCategory', 'system');

      expect(result.changes).toBe(1);

      const categories = db.getCategories();
      const updated = categories.find((c) => c.name === 'TestCategory');
      expect(updated?.type).toBe('system');
    });

    it('should change system category to custom', () => {
      // Update a default system category
      const result = db.updateCategoryType('Privat', 'custom');

      expect(result.changes).toBe(1);

      const categories = db.getCategories();
      const privat = categories.find((c) => c.name === 'Privat');
      expect(privat?.type).toBe('custom');
    });

    it('should return 0 changes for non-existent category', () => {
      const result = db.updateCategoryType('NonExistent', 'custom');

      expect(result.changes).toBe(0);
    });
  });

  describe('deleteSmartCategory', () => {
    it('should delete a category from the database', () => {
      // Add a category first
      db.addCategory('ToDelete');

      // Verify it exists
      let categories = db.getCategories();
      expect(categories.find((c) => c.name === 'ToDelete')).toBeDefined();

      // Delete it
      db.deleteSmartCategory('ToDelete');

      // Verify it's gone
      categories = db.getCategories();
      expect(categories.find((c) => c.name === 'ToDelete')).toBeUndefined();
    });

    it('should untag emails when deleting category', () => {
      // Add an account and email with category
      const account = {
        id: 'acc-cat-1',
        name: 'Test',
        email: 't@t.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'test',
        password: 'pass',
        color: '#000000',
      };
      db.addAccount(account);

      // Add a category and email with that category
      db.addCategory('TempCategory');
      db.saveEmail({
        id: 'email-cat-1',
        accountId: 'acc-cat-1',
        sender: 'Test Sender',
        senderEmail: 'sender@test.com',
        subject: 'Test Subject',
        body: 'Test Body',
        date: new Date().toISOString(),
        smartCategory: 'TempCategory',
        isRead: false,
        isFlagged: false,
        uid: 1,
      });

      // Delete the category
      const result = db.deleteSmartCategory('TempCategory');

      // Should affect 1 email
      expect(result.changes).toBe(1);

      // Verify email's category is now null
      const emails = db.getEmails('acc-cat-1');
      expect(emails[0].smartCategory).toBeNull();
    });

    it('should handle deleting non-existent category', () => {
      // Should not throw
      const result = db.deleteSmartCategory('NonExistent');
      expect(result.changes).toBe(0);
    });

    it('should handle deleting category with no emails', () => {
      db.addCategory('EmptyCategory');

      const result = db.deleteSmartCategory('EmptyCategory');

      // 0 emails affected
      expect(result.changes).toBe(0);

      // Category should be gone
      const categories = db.getCategories();
      expect(categories.find((c) => c.name === 'EmptyCategory')).toBeUndefined();
    });
  });

  describe('renameSmartCategory', () => {
    it('should rename a category', () => {
      db.addCategory('OldName');

      const result = db.renameSmartCategory('OldName', 'NewName');

      expect(result.success).toBe(true);

      const categories = db.getCategories();
      expect(categories.find((c) => c.name === 'OldName')).toBeUndefined();
      expect(categories.find((c) => c.name === 'NewName')).toBeDefined();
    });

    it('should update emails when renaming category', () => {
      // Setup account and email
      const account = {
        id: 'acc-rename-1',
        name: 'Test',
        email: 't@t.com',
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: 'test',
        password: 'pass',
        color: '#000000',
      };
      db.addAccount(account);

      db.addCategory('OldCategory');
      db.saveEmail({
        id: 'email-rename-1',
        accountId: 'acc-rename-1',
        sender: 'Test Sender',
        senderEmail: 'sender@test.com',
        subject: 'Test Subject',
        body: 'Test Body',
        date: new Date().toISOString(),
        smartCategory: 'OldCategory',
        isRead: false,
        isFlagged: false,
        uid: 1,
      });

      // Rename the category
      db.renameSmartCategory('OldCategory', 'NewCategory');

      // Verify email has new category
      const emails = db.getEmails('acc-rename-1');
      expect(emails[0].smartCategory).toBe('NewCategory');
    });

    it('should handle renaming to existing category name', () => {
      db.addCategory('CategoryA');
      db.addCategory('CategoryB');

      // Rename A to B (B already exists)
      const result = db.renameSmartCategory('CategoryA', 'CategoryB');

      expect(result.success).toBe(true);

      // A should be gone, B should exist
      const categories = db.getCategories();
      expect(categories.find((c) => c.name === 'CategoryA')).toBeUndefined();
      expect(categories.find((c) => c.name === 'CategoryB')).toBeDefined();
    });

    it('should handle renaming non-existent category', () => {
      // Should not throw, still returns success
      const result = db.renameSmartCategory('NonExistent', 'NewName');

      expect(result.success).toBe(true);
    });

    it('should rename category with new category as custom type', () => {
      db.addCategory('SourceCat', 'system');

      db.renameSmartCategory('SourceCat', 'TargetCat');

      const categories = db.getCategories();
      const target = categories.find((c) => c.name === 'TargetCat');
      expect(target).toBeDefined();
      expect(target?.type).toBe('custom');
    });
  });
});
