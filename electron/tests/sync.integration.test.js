import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { createRequire } from 'module';
import path from 'path';

// Setup mock state before any imports
const mockState = {
    serverEmails: [],
    shouldFailConnect: false
};

// Helper to set server emails
function setServerEmails(emails) {
    mockState.serverEmails = emails.map(e => ({
        uid: e.uid,
        subject: e.subject || '(No Subject)',
        from: e.from || 'test@example.com',
        body: e.body || '',
        date: e.date || new Date().toISOString(),
        flags: e.flags || []
    }));
}

function resetMockState() {
    mockState.serverEmails = [];
    mockState.shouldFailConnect = false;
}

// Mock ImapFlow class
class MockImapFlow {
    constructor(config) {
        this.config = config;
    }

    async connect() {
        if (mockState.shouldFailConnect) {
            throw new Error('Connection failed');
        }
    }

    async logout() {}

    async list() {
        return [{ name: 'INBOX', path: 'INBOX', specialUse: null }];
    }

    async getMailboxLock(path) {
        mockState.currentMailbox = { exists: mockState.serverEmails.length, name: path };
        return {
            release: () => { mockState.currentMailbox = null; }
        };
    }

    async messageFlagsAdd(uid, flags) {
        const email = mockState.serverEmails.find(e => e.uid === uid);
        if (email) {
            flags.forEach(f => { if (!email.flags.includes(f)) email.flags.push(f); });
        }
    }

    async messageFlagsRemove(uid, flags) {
        const email = mockState.serverEmails.find(e => e.uid === uid);
        if (email) {
            email.flags = email.flags.filter(f => !flags.includes(f));
        }
    }

    get capabilities() {
        return new Set(['IMAP4rev1', 'UIDPLUS']);
    }

    get mailbox() {
        return mockState.currentMailbox || { exists: 0 };
    }

    get imap() {
        return {
            seq: {
                fetch: (range, options) => {
                    const [start, end] = range.split(':').map(Number);
                    const emitter = new EventEmitter();
                    process.nextTick(() => {
                        for (let seq = start; seq <= end && seq <= mockState.serverEmails.length; seq++) {
                            const email = mockState.serverEmails[seq - 1];
                            if (email) {
                                emitter.emit('message', {
                                    on: (evt, cb) => {
                                        if (evt === 'attributes') cb({ uid: email.uid, flags: email.flags });
                                    }
                                });
                            }
                        }
                        emitter.emit('end');
                    });
                    return emitter;
                }
            },
            fetch: (uids, options) => {
                const uidList = Array.isArray(uids) ? uids : [uids];
                const emitter = new EventEmitter();

                // Process asynchronously to mimic real IMAP behavior
                setImmediate(() => {
                    let pendingMessages = 0;

                    for (const uid of uidList) {
                        const email = mockState.serverEmails.find(e => e.uid === uid);
                        if (email) {
                            pendingMessages++;
                            const msg = new EventEmitter();

                            // Emit the message event
                            emitter.emit('message', msg);

                            // Simulate async body streaming
                            setImmediate(() => {
                                const bodyStream = new EventEmitter();

                                // Emit body first (as imapflow does)
                                msg.emit('body', bodyStream, { which: '' });

                                // Then stream the data
                                setImmediate(() => {
                                    bodyStream.emit('data', Buffer.from(email.body));
                                    setImmediate(() => {
                                        bodyStream.emit('end');

                                        // After body ends, emit attributes
                                        setImmediate(() => {
                                            msg.emit('attributes', { uid: email.uid, flags: email.flags });

                                            // Finally, message ends
                                            setImmediate(() => {
                                                msg.emit('end');
                                                pendingMessages--;

                                                // Only emit fetch end when all messages are done
                                                if (pendingMessages === 0) {
                                                    setImmediate(() => emitter.emit('end'));
                                                }
                                            });
                                        });
                                    });
                                });
                            });
                        }
                    }

                    // If no messages found, emit end immediately
                    if (pendingMessages === 0) {
                        setImmediate(() => emitter.emit('end'));
                    }
                });

                return emitter;
            },
            getQuotaRoot: (inbox, cb) => process.nextTick(() => cb(null, null)),
            expunge: () => Promise.resolve()
        };
    }
}

// Register mock in Node's module cache before loading imap.cjs
const require = createRequire(import.meta.url);

// Manually inject the mock into the cache using a path that matches what imap.cjs will resolve
const mockPath = path.join(process.cwd(), 'node_modules', 'imapflow', 'lib', 'imap-flow.js');
require.cache[mockPath] = {
    id: mockPath,
    filename: mockPath,
    loaded: true,
    exports: { ImapFlow: MockImapFlow }
};

// Also inject at the package level
const mockPath2 = path.join(process.cwd(), 'node_modules', 'imapflow');
require.cache[mockPath2] = {
    id: mockPath2,
    filename: path.join(mockPath2, 'index.js'),
    loaded: true,
    exports: { ImapFlow: MockImapFlow }
};

// Mock electron before loading db
const electronPath = path.join(process.cwd(), 'node_modules', 'electron');
require.cache[electronPath] = {
    id: electronPath,
    filename: path.join(electronPath, 'index.js'),
    loaded: true,
    exports: {
        app: {
            getPath: () => './test-data'
        }
    }
};

// Mock mailparser
const mailparserPath = path.join(process.cwd(), 'node_modules', 'mailparser');
require.cache[mailparserPath] = {
    id: mailparserPath,
    filename: path.join(mailparserPath, 'index.js'),
    loaded: true,
    exports: {
        simpleParser: (rawBody) => {
            const subjectMatch = rawBody.match(/Subject: (.+)/);
            const fromMatch = rawBody.match(/From: (.+)/);
            const dateMatch = rawBody.match(/Date: (.+)/);
            const bodyMatch = rawBody.match(/\r?\n\r?\n([\s\S]+)$/);

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
        }
    }
};

// Now load the actual modules
const db = require('../db.cjs');
const imap = require('../imap.cjs');

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
    db.addAccount({
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
        db.init(':memory:');
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

            // Add account to database first (foreign key constraint)
            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(0);

            const emails = db.getEmails(account.id);
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

            // Add account to database first (foreign key constraint)
            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const emails = db.getEmails(account.id);
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

            // Add account to database first (foreign key constraint)
            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(3);

            const savedEmails = db.getEmails(account.id);
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

            // Add account to database first (foreign key constraint)
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

            const result1 = await imap.syncAccount(account);
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

            const result2 = await imap.syncAccount(account);

            expect(result2.success).toBe(true);
            expect(result2.count).toBe(1);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(3);

            const newEmail = savedEmails.find(e => e.uid === 3);
            expect(newEmail).toBeDefined();
            expect(newEmail.subject).toBe('New Email 3');
        });
    });

    describe('Batch Processing', () => {
        it('should sync 100+ emails in batches correctly', async () => {
            // Generate 150 emails to test batch processing
            const emailCount = 150;
            const emails = [];

            for (let i = 1; i <= emailCount; i++) {
                const date = new Date('2024-01-15T10:00:00Z');
                date.setDate(date.getDate() + ((i - 1) % 30));
                const dateStr = date.toISOString();

                emails.push({
                    uid: i,
                    subject: `Batch Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Batch Email ${i}\nFrom: sender${i}@example.com\nDate: ${dateStr}\n\nEmail body ${i}`,
                    date: dateStr,
                    flags: i % 3 === 0 ? ['\\Seen'] : []
                });
            }

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-batch-150',
                email: 'batch150@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(150);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(150);

            // Verify all UIDs are present
            const savedUids = new Set(savedEmails.map(e => e.uid));
            for (let i = 1; i <= emailCount; i++) {
                expect(savedUids.has(i)).toBe(true);
            }

            // Verify email content
            const firstEmail = savedEmails.find(e => e.uid === 1);
            expect(firstEmail.subject).toBe('Batch Email 1');
            expect(firstEmail.senderEmail).toBe('sender1@example.com');

            const lastEmail = savedEmails.find(e => e.uid === 150);
            expect(lastEmail.subject).toBe('Batch Email 150');
            expect(lastEmail.senderEmail).toBe('sender150@example.com');

            // Verify read flags were correctly processed
            const readEmails = savedEmails.filter(e => e.isRead);
            expect(readEmails.length).toBe(50); // Every 3rd email (150/3 = 50)
        });

        it('should handle batch processing across sequence ranges (1:5000, 5001:10000)', async () => {
            // Create emails that span across typical batch boundaries
            // We test with 5200 emails which crosses the 5000 boundary
            const emailCount = 5200;
            const emails = [];

            for (let i = 1; i <= emailCount; i++) {
                emails.push({
                    uid: i,
                    subject: `Large Batch Email ${i}`,
                    from: `bulk${i}@example.com`,
                    body: `Subject: Large Batch Email ${i}\nFrom: bulk${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody ${i}`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-large-batch',
                email: 'largebatch@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(5200);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(5200);

            // Verify emails from both sides of the 5000 boundary
            const emailAt4999 = savedEmails.find(e => e.uid === 4999);
            expect(emailAt4999).toBeDefined();
            expect(emailAt4999.subject).toBe('Large Batch Email 4999');

            const emailAt5000 = savedEmails.find(e => e.uid === 5000);
            expect(emailAt5000).toBeDefined();
            expect(emailAt5000.subject).toBe('Large Batch Email 5000');

            const emailAt5001 = savedEmails.find(e => e.uid === 5001);
            expect(emailAt5001).toBeDefined();
            expect(emailAt5001.subject).toBe('Large Batch Email 5001');

            const emailAt5200 = savedEmails.find(e => e.uid === 5200);
            expect(emailAt5200).toBeDefined();
            expect(emailAt5200.subject).toBe('Large Batch Email 5200');
        });

        it('should handle incremental sync with batch processing for large mailboxes', async () => {
            // Start with 3000 emails
            const initialEmails = [];
            for (let i = 1; i <= 3000; i++) {
                initialEmails.push({
                    uid: i,
                    subject: `Initial Email ${i}`,
                    from: `initial${i}@example.com`,
                    body: `Subject: Initial Email ${i}\nFrom: initial${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody ${i}`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(initialEmails);

            const account = createTestAccount({
                id: 'test-account-incremental-large',
                email: 'incrementallarge@test.com'
            });

            addAccountToDb(account);

            // First sync - all 3000 emails
            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(3000);

            // Now add 200 more emails (simulating new arrivals)
            const updatedEmails = [...initialEmails];
            for (let i = 3001; i <= 3200; i++) {
                updatedEmails.push({
                    uid: i,
                    subject: `New Email ${i}`,
                    from: `new${i}@example.com`,
                    body: `Subject: New Email ${i}\nFrom: new${i}@example.com\nDate: ${new Date('2024-01-16T10:00:00Z').toISOString()}\n\nBody ${i}`,
                    date: new Date('2024-01-16T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(updatedEmails);

            // Second sync - only new emails
            const result2 = await imap.syncAccount(account);
            expect(result2.success).toBe(true);
            expect(result2.count).toBe(200);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(3200);

            // Verify both old and new emails are present
            const oldEmail = savedEmails.find(e => e.uid === 1);
            expect(oldEmail.subject).toBe('Initial Email 1');

            const newEmail = savedEmails.find(e => e.uid === 3200);
            expect(newEmail.subject).toBe('New Email 3200');
        });

        it('should handle batch processing with sparse UIDs', async () => {
            // Simulate a mailbox where some emails were deleted (sparse UIDs)
            // UIDs are not sequential: 1, 2, 5, 10, 50, 100, etc.
            const sparseUids = [1, 2, 5, 10, 50, 100, 500, 1000, 5000, 5100];
            const emails = sparseUids.map(uid => ({
                uid,
                subject: `Sparse Email ${uid}`,
                from: `sparse${uid}@example.com`,
                body: `Subject: Sparse Email ${uid}\nFrom: sparse${uid}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody ${uid}`,
                date: new Date('2024-01-15T10:00:00Z').toISOString(),
                flags: []
            }));

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-sparse',
                email: 'sparse@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(10);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(10);

            // Verify all sparse UIDs are present
            const savedUids = new Set(savedEmails.map(e => e.uid));
            for (const uid of sparseUids) {
                expect(savedUids.has(uid)).toBe(true);
            }

            // Verify specific sparse email
            const email5000 = savedEmails.find(e => e.uid === 5000);
            expect(email5000.subject).toBe('Sparse Email 5000');
        });
    });
});
