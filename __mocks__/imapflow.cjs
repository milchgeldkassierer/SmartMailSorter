// Server state storage (shared with imapMockHelper)
let serverEmails = [];
let shouldFailConnect = false;
let shouldFailFetch = false;
let quotaInfo = null;

// Reset state function
function resetMockState() {
    serverEmails = [];
    shouldFailConnect = false;
    shouldFailFetch = false;
    quotaInfo = null;
}

// Set server emails
function setServerEmails(emails) {
    serverEmails = emails.map((email, index) => ({
        ...email,
        uid: email.uid || index + 1,
        flags: email.flags || [],
        attributes: {
            uid: email.uid || index + 1,
            flags: email.flags || []
        }
    }));
}

// Get server UIDs
function getServerUids() {
    return serverEmails.map(e => e.uid);
}

// Get message by UID
function getMessage(uid) {
    return serverEmails.find(e => e.uid === uid);
}

// Set connection failure
function setConnectFailure(fail) {
    shouldFailConnect = fail;
}

// Set fetch failure
function setFetchFailure(fail) {
    shouldFailFetch = fail;
}

// Set quota
function setQuota(used, total) {
    quotaInfo = { used, total };
}

// Mock IMAP connection for raw IMAP operations
class MockImapConnection {
    constructor() {
        this.seq = {
            fetch: (range, options) => {
                return this.mockSeqFetch(range, options);
            }
        };
    }

    mockSeqFetch(range, options) {
        const [start, end] = range.split(':').map(Number);
        const events = {
            messageHandlers: [],
            errorHandlers: [],
            endHandlers: []
        };

        // Simulate async fetch
        setTimeout(() => {
            if (shouldFailFetch) {
                events.errorHandlers.forEach(h => h(new Error('Fetch failed')));
                return;
            }

            // Get messages in the sequence range (1-based indexing)
            for (let seq = start; seq <= end && seq <= serverEmails.length; seq++) {
                const email = serverEmails[seq - 1]; // Convert to 0-based
                if (email) {
                    const msg = {
                        attributes: {
                            uid: email.uid,
                            flags: email.flags || []
                        }
                    };
                    events.messageHandlers.forEach(h => h(msg));
                }
            }

            events.endHandlers.forEach(h => h());
        }, 0);

        return {
            on: (event, handler) => {
                if (event === 'message') events.messageHandlers.push(handler);
            },
            once: (event, handler) => {
                if (event === 'error') events.errorHandlers.push(handler);
                if (event === 'end') events.endHandlers.push(handler);
            }
        };
    }

    fetch(uids, options) {
        const uidArray = Array.isArray(uids) ? uids : [uids];
        const events = {
            messageHandlers: [],
            errorHandlers: [],
            endHandlers: []
        };

        // Simulate async fetch
        setTimeout(() => {
            if (shouldFailFetch) {
                events.errorHandlers.forEach(h => h(new Error('Fetch failed')));
                return;
            }

            for (const uid of uidArray) {
                const email = serverEmails.find(e => e.uid === uid);
                if (email) {
                    const msg = {
                        parts: [],
                        attributes: {
                            uid: email.uid,
                            flags: email.flags || []
                        }
                    };

                    // Simulate body stream
                    const bodyStream = {
                        on: (event, handler) => {
                            if (event === 'data') {
                                const chunks = Buffer.from(email.body || '');
                                handler(chunks);
                            }
                        },
                        once: (event, handler) => {
                            if (event === 'end') handler();
                        }
                    };

                    events.messageHandlers.forEach(h => h(msg));

                    // Trigger body event
                    setTimeout(() => {
                        msg.parts.push({ which: '', body: email.body || '' });
                    }, 0);
                }
            }

            setTimeout(() => {
                events.endHandlers.forEach(h => h());
            }, 10);
        }, 0);

        return {
            on: (event, handler) => {
                if (event === 'message') events.messageHandlers.push(handler);
            },
            once: (event, handler) => {
                if (event === 'error') events.errorHandlers.push(handler);
                if (event === 'end') events.endHandlers.push(handler);
            }
        };
    }

    getQuotaRoot(mailbox, callback) {
        setTimeout(() => {
            if (quotaInfo) {
                callback(null, {
                    '': {
                        storage: [quotaInfo.used, quotaInfo.total]
                    }
                });
            } else {
                callback(null, null);
            }
        }, 0);
    }

    expunge(uid) {
        return Promise.resolve();
    }
}

// Mock ImapFlow class
class ImapFlow {
    constructor(config) {
        this.config = config;
        this.connected = false;
        this.mailbox = null;
        this.capabilities = new Set(['IMAP4rev1', 'UIDPLUS', 'QUOTA']);
    }

    async connect() {
        if (shouldFailConnect) {
            throw new Error('Connection failed');
        }
        this.connected = true;
    }

    async logout() {
        this.connected = false;
    }

    async list() {
        return [
            {
                name: 'INBOX',
                path: 'INBOX',
                delimiter: '/',
                specialUse: null
            },
            {
                name: 'Sent',
                path: 'Sent',
                delimiter: '/',
                specialUse: '\\Sent'
            },
            {
                name: 'Trash',
                path: 'Trash',
                delimiter: '/',
                specialUse: '\\Trash'
            }
        ];
    }

    async getMailboxLock(mailboxName) {
        this.mailbox = {
            exists: serverEmails.length,
            name: mailboxName
        };
        return {
            release: () => {
                this.mailbox = null;
            }
        };
    }

    async messageFlagsAdd(uid, flags) {
        const email = serverEmails.find(e => e.uid === uid);
        if (email) {
            flags.forEach(flag => {
                if (!email.flags.includes(flag)) {
                    email.flags.push(flag);
                }
            });
        }
    }

    async messageFlagsRemove(uid, flags) {
        const email = serverEmails.find(e => e.uid === uid);
        if (email) {
            email.flags = email.flags.filter(f => !flags.includes(f));
        }
    }

    // Modern ImapFlow fetch() API - returns async iterator
    async *fetch(range, options = {}) {
        if (shouldFailFetch) {
            throw new Error('Fetch failed');
        }

        const isUid = options.uid === true;
        const wantSource = options.source === true;

        // Parse range (can be "1:5", "1,2,3", "1:*", etc.)
        let messages = [];

        if (isUid) {
            // Fetching by UIDs
            const uidList = range.split(',').map(u => parseInt(u.trim()));
            messages = serverEmails.filter(e => uidList.includes(e.uid));
        } else {
            // Fetching by sequence numbers (1-based)
            const parts = range.split(':');
            if (parts.length === 2) {
                const start = parseInt(parts[0]);
                const end = parts[1] === '*' ? serverEmails.length : parseInt(parts[1]);
                messages = serverEmails.slice(start - 1, end);
            } else {
                // Single number or comma-separated
                const seqList = range.split(',').map(s => parseInt(s.trim()));
                messages = seqList.map(seq => serverEmails[seq - 1]).filter(Boolean);
            }
        }

        // Yield each message
        for (const email of messages) {
            const msg = {
                uid: email.uid,
                flags: email.flags || [],
                seq: serverEmails.indexOf(email) + 1
            };

            if (wantSource) {
                // Return full email source as buffer
                msg.source = Buffer.from(email.body || '');
            }

            yield msg;
        }
    }

    // Modern ImapFlow getQuota() API
    async getQuota(mailbox) {
        if (quotaInfo) {
            return {
                storage: {
                    used: quotaInfo.used,
                    limit: quotaInfo.total
                }
            };
        }
        return null;
    }

    // Modern ImapFlow messageDelete() API
    async messageDelete(range, options = {}) {
        const isUid = options.uid === true;
        const uidList = isUid ? [parseInt(range)] : [range];

        // Remove from serverEmails
        for (const uid of uidList) {
            const index = serverEmails.findIndex(e => e.uid === uid);
            if (index !== -1) {
                serverEmails.splice(index, 1);
            }
        }
    }
}

// Mock connection class for imap-simple compatibility
class MockImapSimpleConnection {
    constructor() {
        this.state = 'disconnected';
    }

    connect() {
        if (shouldFailConnect) {
            throw new Error('Connection failed');
        }
        this.state = 'connected';
    }

    end() {
        this.state = 'disconnected';
    }

    openBox(folder, readOnly, callback) {
        setTimeout(() => {
            callback(null, { name: folder });
        }, 0);
    }

    getBoxes(callback) {
        setTimeout(() => {
            callback(null, {
                INBOX: { attribs: [] },
                Sent: { attribs: ['\\Sent'] },
                Trash: { attribs: ['\\Trash'] }
            });
        }, 0);
    }

    search(criteria, callback) {
        setTimeout(() => {
            callback(null, getServerUids());
        }, 0);
    }

    addFlags(uid, flags, callback) {
        setTimeout(() => {
            callback(null);
        }, 0);
    }

    delFlags(uid, flags, callback) {
        setTimeout(() => {
            callback(null);
        }, 0);
    }

    expunge(callback) {
        setTimeout(() => {
            callback(null);
        }, 0);
    }
}

module.exports = {
    ImapFlow,
    MockImapConnection,
    MockImapSimpleConnection,
    resetMockState,
    setServerEmails,
    getServerUids,
    getMessage,
    setConnectFailure,
    setFetchFailure,
    setQuota
};
