const { describe, it, expect, vi, beforeEach } = require('vitest');

// Vitest globals are enabled in config

// Mock Electron just in case, though we shouldn't need it if DI works
vi.mock('electron', () => {
    return {
        app: {
            getPath: () => './test-data'
        }
    };
});

// Mock Better-SQLite3
// We need to unmock it if we want to use the real one with :memory:
// But db.cjs uses require('better-sqlite3').
// If we don't mock it, it uses the real one.
// We passed ':memory:' so it should be fine.

// Import the module under test using require
const db = require('../db.cjs');

describe('Database Module', () => {
    beforeEach(() => {
        // Initialize with in-memory DB via path string
        // This exercises the DI path in db.cjs
        db.init(':memory:');
    });

    it('should add and retrieve accounts', () => {
        const account = {
            id: 'acc1',
            name: 'Test Account',
            email: 'test@example.com',
            username: 'testuser',
            password: 'password',
            imapHost: 'imap.test.com',
            imapPort: 993,
            color: 'blue'
        };

        db.addAccount(account);
        const accounts = db.getAccounts();

        expect(accounts).toHaveLength(1);
        expect(accounts[0].email).toBe('test@example.com');
    });

    it('should save and retrieve emails', () => {
        const account = { id: 'acc1', name: 'Test', email: 't@t.com' };
        db.addAccount(account);

        const email = {
            id: 'email1',
            accountId: 'acc1',
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
        const emails = db.getEmails('acc1');

        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe('Subject');
    });

    it('should update account quota', () => {
        const account = { id: 'acc1', name: 'Test', email: 't@t.com' };
        db.addAccount(account);

        db.updateAccountQuota('acc1', 1000, 5000);
        const updated = db.getAccounts()[0];

        expect(updated.storageUsed).toBe(1000);
        expect(updated.storageTotal).toBe(5000);
    });
});
