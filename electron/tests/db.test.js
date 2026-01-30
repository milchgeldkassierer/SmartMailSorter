import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

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

// Import the database module under test
const db = require('../db.cjs');

describe('Database Module', () => {
    beforeEach(() => {
        // Initialize with in-memory DB for test isolation
        // This exercises the DI path in db.cjs
        db.init(':memory:');
    });

    it('should add and retrieve accounts', () => {
        const account = {
            id: 'acc1',
            name: 'Test Account',
            email: 'test@example.com',
            provider: 'test',
            username: 'testuser',
            password: 'password',
            imapHost: 'imap.test.com',
            imapPort: 993,
            color: '#0000FF'
        };

        db.addAccount(account);
        const accounts = db.getAccounts();

        expect(accounts).toHaveLength(1);
        expect(accounts[0].email).toBe('test@example.com');
        expect(accounts[0].name).toBe('Test Account');
        expect(accounts[0].imapHost).toBe('imap.test.com');
    });

    it('should save and retrieve emails', () => {
        // First add an account (foreign key requirement)
        const account = {
            id: 'acc2',
            name: 'Test',
            email: 't@t.com',
            provider: 'test',
            imapHost: 'imap.test.com',
            imapPort: 993,
            username: 'test',
            password: 'pass',
            color: '#000000'
        };
        db.addAccount(account);

        const email = {
            id: 'email1',
            accountId: 'acc2',
            sender: 'Sender',
            senderEmail: 'sender@test.com',
            subject: 'Subject',
            body: 'Body',
            date: new Date().toISOString(),
            category: 'Inbox',
            isRead: false,
            isFlagged: false,
            uid: 100
        };

        db.saveEmail(email);
        const emails = db.getEmails('acc2');

        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe('Subject');
        expect(emails[0].sender).toBe('Sender');
        expect(emails[0].uid).toBe(100);
    });

    it('should update account quota', () => {
        const account = {
            id: 'acc3',
            name: 'Test',
            email: 't@t.com',
            provider: 'test',
            imapHost: 'imap.test.com',
            imapPort: 993,
            username: 'test',
            password: 'pass',
            color: '#000000'
        };
        db.addAccount(account);

        db.updateAccountQuota('acc3', 1000, 5000);
        const accounts = db.getAccounts();
        const updated = accounts.find(a => a.id === 'acc3');

        expect(updated.storageUsed).toBe(1000);
        expect(updated.storageTotal).toBe(5000);
    });
});
