import { describe, it, expect, beforeEach, vi } from 'vitest';

// Tell vitest to use __mocks__/imapflow.cjs
vi.mock('imapflow');

// Mock electron
vi.mock('electron', () => ({
    app: { getPath: () => './test-data' }
}));

// Mock mailparser
vi.mock('mailparser', () => ({
    simpleParser: vi.fn((rawBody) => {
        const bodyStr = rawBody.toString();
        const subjectMatch = bodyStr.match(/Subject: (.+)/);
        const fromMatch = bodyStr.match(/From: (.+)/);
        const dateMatch = bodyStr.match(/Date: (.+)/);
        const bodyMatch = bodyStr.match(/\r?\n\r?\n([\s\S]+)$/);

        const subject = subjectMatch ? subjectMatch[1] : '(No Subject)';
        const from = fromMatch ? fromMatch[1] : 'test@example.com';
        const date = dateMatch ? new Date(dateMatch[1]) : new Date();
        const body = bodyMatch ? bodyMatch[1].trim() : '';

        return Promise.resolve({
            subject,
            from: { text: from, value: [{ address: from.replace(/[<>]/g, '') }] },
            text: body,
            html: null,
            date,
            attachments: []
        });
    })
}));

// Import the mock helpers from the __mocks__ directory
const { setServerEmails, resetMockState } = await import('imapflow');

// Import the modules AFTER mocks are set up
const db = await import('../db.cjs');
const imap = await import('../imap.cjs');

// Helper function to create test accounts
function createTestAccount(overrides = {}) {
    return {
        id: overrides.id || 'test-account-1',
        email: overrides.email || 'test@example.com',
        username: overrides.username || 'test@example.com',
        password: overrides.password || 'testpass',
        imapHost: overrides.imapHost || 'imap.test.com',
        imapPort: overrides.imapPort || 993,
        ...overrides
    };
}

// Helper to add account to database
function addAccountToDb(account) {
    db.default.addAccount({
        id: account.id,
        email: account.email,
        name: account.name || account.email,
        provider: account.provider || 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.username,
        password: account.password,
        color: account.color || '#000000'
    });
}

describe('IMAP Sync Integration Tests', () => {
    beforeEach(() => {
        // Initialize with in-memory database
        db.default.init(':memory:');
        // Reset mock server state
        resetMockState();
    });

    describe('Basic Sync Flow', () => {
        it('should successfully sync an empty mailbox', async () => {
            setServerEmails([]);

            const account = createTestAccount({
                id: 'test-account-empty',
                email: 'empty@test.com'
            });

            addAccountToDb(account);

            const result = await imap.default.syncAccount(account);

            if (!result.success) {
                console.error('Sync failed with error:', result.error);
            }

            expect(result.success).toBe(true);
            expect(result.count).toBe(0);

            const emails = db.default.getEmails(account.id);
            expect(emails).toHaveLength(0);
        });

        it('should sync a single email correctly', async () => {
            const emailDate = new Date('2024-01-15T10:30:00Z');
            setServerEmails([{
                uid: 1,
                subject: 'Test Email Subject',
                from: 'sender@example.com',
                body: `Subject: Test Email Subject
From: sender@example.com
Date: ${emailDate.toISOString()}

This is the email body content.`,
                date: emailDate.toISOString(),
                flags: ['\\Seen']
            }]);

            const account = createTestAccount({
                id: 'test-account-single',
                email: 'single@test.com'
            });

            addAccountToDb(account);

            const result = await imap.default.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const emails = db.default.getEmails(account.id);
            expect(emails).toHaveLength(1);

            const savedEmail = emails[0];
            expect(savedEmail.subject).toBe('Test Email Subject');
            expect(savedEmail.senderEmail).toBe('sender@example.com');
            expect(savedEmail.uid).toBe(1);
            expect(savedEmail.isRead).toBe(true);
            expect(savedEmail.folder).toBe('Posteingang');
        });

        it('should sync multiple emails correctly', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'First Email',
                    from: 'sender1@example.com',
                    body: `Subject: First Email
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

First email body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Second Email',
                    from: 'sender2@example.com',
                    body: `Subject: Second Email
From: sender2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Second email body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: ['\\Seen', '\\Flagged']
                },
                {
                    uid: 3,
                    subject: 'Third Email',
                    from: 'sender3@example.com',
                    body: `Subject: Third Email
From: sender3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

Third email body`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ];
            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-multiple',
                email: 'multiple@test.com'
            });

            addAccountToDb(account);

            const result = await imap.default.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(3);

            const savedEmails = db.default.getEmails(account.id);
            expect(savedEmails).toHaveLength(3);

            const emailByUid = (uid) => savedEmails.find(e => e.uid === uid);

            const firstEmail = emailByUid(1);
            expect(firstEmail.subject).toBe('First Email');
            expect(firstEmail.senderEmail).toBe('sender1@example.com');
            expect(firstEmail.isRead).toBe(false);
            expect(firstEmail.isFlagged).toBe(false);

            const secondEmail = emailByUid(2);
            expect(secondEmail.subject).toBe('Second Email');
            expect(secondEmail.senderEmail).toBe('sender2@example.com');
            expect(secondEmail.isRead).toBe(true);
            expect(secondEmail.isFlagged).toBe(true);

            const thirdEmail = emailByUid(3);
            expect(thirdEmail.subject).toBe('Third Email');
            expect(thirdEmail.senderEmail).toBe('sender3@example.com');
        });

        it('should preserve existing emails and only sync new ones', async () => {
            const account = createTestAccount({
                id: 'test-account-incremental',
                email: 'incremental@test.com'
            });

            addAccountToDb(account);

            setServerEmails([
                {
                    uid: 1,
                    subject: 'Existing Email 1',
                    from: 'existing1@example.com',
                    body: `Subject: Existing Email 1
From: existing1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Existing email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Existing Email 2',
                    from: 'existing2@example.com',
                    body: `Subject: Existing Email 2
From: existing2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Existing email 2 body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                }
            ]);

            const result1 = await imap.default.syncAccount(account);
            expect(result1.count).toBe(2);

            setServerEmails([
                {
                    uid: 1,
                    subject: 'Existing Email 1',
                    from: 'existing1@example.com',
                    body: `Subject: Existing Email 1
From: existing1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Existing email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Existing Email 2',
                    from: 'existing2@example.com',
                    body: `Subject: Existing Email 2
From: existing2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Existing email 2 body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'New Email 3',
                    from: 'new3@example.com',
                    body: `Subject: New Email 3
From: new3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

New email 3 body`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ]);

            const result2 = await imap.default.syncAccount(account);

            expect(result2.success).toBe(true);
            expect(result2.count).toBe(1);

            const savedEmails = db.default.getEmails(account.id);
            expect(savedEmails).toHaveLength(3);

            const newEmail = savedEmails.find(e => e.uid === 3);
            expect(newEmail).toBeDefined();
            expect(newEmail.subject).toBe('New Email 3');
        });

        it('should sync 50+ emails with mixed flag states', async () => {
            const emailCount = 60;
            const emails = [];

            for (let i = 1; i <= emailCount; i++) {
                const date = new Date('2024-01-15T10:00:00Z');
                date.setMinutes(date.getMinutes() + i);
                const dateStr = date.toISOString();

                let flags = [];
                if (i % 4 === 0) {
                    flags = ['\\Seen', '\\Flagged'];
                } else if (i % 3 === 0) {
                    flags = ['\\Seen'];
                } else if (i % 2 === 0) {
                    flags = ['\\Flagged'];
                }

                emails.push({
                    uid: i,
                    subject: `Mixed State Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Mixed State Email ${i}
From: sender${i}@example.com
Date: ${dateStr}

Email body content ${i}`,
                    date: dateStr,
                    flags: flags
                });
            }

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-mixed-batch',
                email: 'mixedbatch@test.com'
            });

            addAccountToDb(account);

            const result = await imap.default.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(60);

            const savedEmails = db.default.getEmails(account.id);
            expect(savedEmails).toHaveLength(60);

            const unreadUnflagged = savedEmails.filter(e => !e.isRead && !e.isFlagged);
            const unreadFlagged = savedEmails.filter(e => !e.isRead && e.isFlagged);
            const readUnflagged = savedEmails.filter(e => e.isRead && !e.isFlagged);
            const readFlagged = savedEmails.filter(e => e.isRead && e.isFlagged);

            expect(unreadUnflagged.length).toBeGreaterThan(0);
            expect(unreadFlagged.length).toBeGreaterThan(0);
            expect(readUnflagged.length).toBeGreaterThan(0);
            expect(readFlagged.length).toBeGreaterThan(0);

            expect(unreadUnflagged.length + unreadFlagged.length + readUnflagged.length + readFlagged.length).toBe(60);

            const email1 = savedEmails.find(e => e.uid === 1);
            expect(email1.subject).toBe('Mixed State Email 1');
            expect(email1.isRead).toBe(false);
            expect(email1.isFlagged).toBe(false);

            const email2 = savedEmails.find(e => e.uid === 2);
            expect(email2.isRead).toBe(false);
            expect(email2.isFlagged).toBe(true);

            const email3 = savedEmails.find(e => e.uid === 3);
            expect(email3.isRead).toBe(true);
            expect(email3.isFlagged).toBe(false);

            const email4 = savedEmails.find(e => e.uid === 4);
            expect(email4.isRead).toBe(true);
            expect(email4.isFlagged).toBe(true);

            const email60 = savedEmails.find(e => e.uid === 60);
            expect(email60).toBeDefined();
            expect(email60.subject).toBe('Mixed State Email 60');
            expect(email60.isRead).toBe(true);
            expect(email60.isFlagged).toBe(true);
        });
    });
});
