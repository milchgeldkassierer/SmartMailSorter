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
if (require.cache) {
  require.cache[electronPath] = {
    exports: {
      app: {
        getPath: () => './test-data',
      },
    },
  } as NodeModule;
}

// Define interface for category-related db module methods
interface Category {
  name: string;
  type: string;
}

interface DbModule {
  init: (path: string) => void;
  getCategories: (accountId?: string) => Category[];
  addCategory: (name: string, type?: string, accountId?: string) => { changes: number };
  updateCategoryType: (name: string, newType: string, accountId?: string) => { changes: number };
  deleteSmartCategory: (categoryName: string, accountId?: string) => { changes: number };
  renameSmartCategory: (oldName: string, newName: string, accountId?: string) => { success: boolean };
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

const TEST_ACCOUNT = {
  id: 'test-account-1',
  name: 'Test',
  email: 'test@test.com',
  provider: 'test',
  imapHost: 'imap.test.com',
  imapPort: 993,
  username: 'test',
  password: 'pass',
  color: '#000000',
};

describe('Database Categories Module', () => {
  beforeEach(() => {
    // Initialize with in-memory DB for test isolation
    // This exercises the DI path in db.cjs
    db.init(':memory:');
    // Categories are account-scoped — create a test account to seed defaults
    db.addAccount(TEST_ACCOUNT);
  });

  describe('getCategories', () => {
    it('should return default system categories after initialization', () => {
      const categories = db.getCategories(TEST_ACCOUNT.id);

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
      const categories = db.getCategories(TEST_ACCOUNT.id);

      expect(categories.length).toBeGreaterThan(0);
      categories.forEach((cat) => {
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('type');
        expect(typeof cat.name).toBe('string');
        expect(typeof cat.type).toBe('string');
      });
    });

    it('should have system type for default categories', () => {
      const categories = db.getCategories(TEST_ACCOUNT.id);

      const systemCategory = categories.find((c) => c.name === 'Rechnungen');
      expect(systemCategory?.type).toBe('system');
    });
  });

  describe('addCategory', () => {
    it('should add a new custom category', () => {
      const result = db.addCategory('MyCategory', 'custom', TEST_ACCOUNT.id);

      expect(result.changes).toBe(1);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      const myCategory = categories.find((c) => c.name === 'MyCategory');
      expect(myCategory).toBeDefined();
      expect(myCategory?.type).toBe('custom');
    });

    it('should add a category with specified type', () => {
      const result = db.addCategory('SystemCat', 'system', TEST_ACCOUNT.id);

      expect(result.changes).toBe(1);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      const systemCat = categories.find((c) => c.name === 'SystemCat');
      expect(systemCat).toBeDefined();
      expect(systemCat?.type).toBe('system');
    });

    it('should handle duplicate category gracefully', () => {
      db.addCategory('Duplicate', 'custom', TEST_ACCOUNT.id);

      // Second add of same name+accountId should be handled gracefully
      const result = db.addCategory('Duplicate', 'custom', TEST_ACCOUNT.id);
      // addCategory catches SQLITE_CONSTRAINT_UNIQUE and returns changes: 0
      expect(result.changes).toBe(0);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      const dupCount = categories.filter((c) => c.name === 'Duplicate').length;
      expect(dupCount).toBe(1);
    });

    it('should not duplicate existing system categories', () => {
      // Try to add a category with same name as system category
      const result = db.addCategory('Rechnungen', 'custom', TEST_ACCOUNT.id);
      expect(result.changes).toBe(0);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      const rechnungenCount = categories.filter((c) => c.name === 'Rechnungen').length;
      expect(rechnungenCount).toBe(1);
    });
  });

  describe('updateCategoryType', () => {
    it('should update an existing category type', () => {
      db.addCategory('TestCategory', 'custom', TEST_ACCOUNT.id);

      const result = db.updateCategoryType('TestCategory', 'system', TEST_ACCOUNT.id);

      expect(result.changes).toBe(1);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      const updated = categories.find((c) => c.name === 'TestCategory');
      expect(updated?.type).toBe('system');
    });

    it('should change system category to custom', () => {
      const result = db.updateCategoryType('Privat', 'custom', TEST_ACCOUNT.id);

      expect(result.changes).toBe(1);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      const privat = categories.find((c) => c.name === 'Privat');
      expect(privat?.type).toBe('custom');
    });

    it('should return 0 changes for non-existent category', () => {
      const result = db.updateCategoryType('NonExistent', 'custom', TEST_ACCOUNT.id);

      expect(result.changes).toBe(0);
    });
  });

  describe('deleteSmartCategory', () => {
    it('should delete a category from the database', () => {
      db.addCategory('ToDelete', 'custom', TEST_ACCOUNT.id);

      let categories = db.getCategories(TEST_ACCOUNT.id);
      expect(categories.find((c) => c.name === 'ToDelete')).toBeDefined();

      db.deleteSmartCategory('ToDelete', TEST_ACCOUNT.id);

      categories = db.getCategories(TEST_ACCOUNT.id);
      expect(categories.find((c) => c.name === 'ToDelete')).toBeUndefined();
    });

    it('should untag emails when deleting category', () => {
      db.addCategory('TempCategory', 'custom', TEST_ACCOUNT.id);
      db.saveEmail({
        id: 'email-cat-1',
        accountId: TEST_ACCOUNT.id,
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

      const result = db.deleteSmartCategory('TempCategory', TEST_ACCOUNT.id);

      expect(result.changes).toBe(1);

      const emails = db.getEmails(TEST_ACCOUNT.id);
      expect(emails[0].smartCategory).toBeNull();
    });

    it('should handle deleting non-existent category', () => {
      const result = db.deleteSmartCategory('NonExistent', TEST_ACCOUNT.id);
      expect(result.changes).toBe(0);
    });

    it('should handle deleting category with no emails', () => {
      db.addCategory('EmptyCategory', 'custom', TEST_ACCOUNT.id);

      const result = db.deleteSmartCategory('EmptyCategory', TEST_ACCOUNT.id);

      expect(result.changes).toBe(0);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      expect(categories.find((c) => c.name === 'EmptyCategory')).toBeUndefined();
    });
  });

  describe('renameSmartCategory', () => {
    it('should rename a category', () => {
      db.addCategory('OldName', 'custom', TEST_ACCOUNT.id);

      const result = db.renameSmartCategory('OldName', 'NewName', TEST_ACCOUNT.id);

      expect(result.success).toBe(true);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      expect(categories.find((c) => c.name === 'OldName')).toBeUndefined();
      expect(categories.find((c) => c.name === 'NewName')).toBeDefined();
    });

    it('should update emails when renaming category', () => {
      db.addCategory('OldCategory', 'custom', TEST_ACCOUNT.id);
      db.saveEmail({
        id: 'email-rename-1',
        accountId: TEST_ACCOUNT.id,
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

      db.renameSmartCategory('OldCategory', 'NewCategory', TEST_ACCOUNT.id);

      const emails = db.getEmails(TEST_ACCOUNT.id);
      expect(emails[0].smartCategory).toBe('NewCategory');
    });

    it('should handle renaming to existing category name', () => {
      db.addCategory('CategoryA', 'custom', TEST_ACCOUNT.id);
      db.addCategory('CategoryB', 'custom', TEST_ACCOUNT.id);

      const result = db.renameSmartCategory('CategoryA', 'CategoryB', TEST_ACCOUNT.id);

      expect(result.success).toBe(true);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      expect(categories.find((c) => c.name === 'CategoryA')).toBeUndefined();
      expect(categories.find((c) => c.name === 'CategoryB')).toBeDefined();
    });

    it('should handle renaming non-existent category', () => {
      const result = db.renameSmartCategory('NonExistent', 'NewName', TEST_ACCOUNT.id);

      expect(result.success).toBe(true);
    });

    it('should rename category with new category as custom type', () => {
      db.addCategory('SourceCat', 'system', TEST_ACCOUNT.id);

      db.renameSmartCategory('SourceCat', 'TargetCat', TEST_ACCOUNT.id);

      const categories = db.getCategories(TEST_ACCOUNT.id);
      const target = categories.find((c) => c.name === 'TargetCat');
      expect(target).toBeDefined();
      expect(target?.type).toBe('custom');
    });
  });
});
