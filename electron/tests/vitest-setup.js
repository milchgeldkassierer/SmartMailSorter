// Vitest setup file - patches modules before tests run
// This is needed because vi.mock() doesn't intercept CJS require() calls properly

const Module = require('module');
const originalRequire = Module.prototype.require;

// Global mock state
global.__mockState = {
  serverEmails: [],
  shouldFailConnect: false,
  shouldFailFetch: false,
  folderList: null, // Custom folder list for testing folder mapping
  quotaResponse: null, // Custom quota response for testing
};

// Mock ImapFlow class
class MockImapFlow {
  constructor(config) {
    this.config = config;
    this.connected = false;
    this.mailbox = null;
    this.capabilities = new Set(['IMAP4rev1', 'UIDPLUS', 'QUOTA']);
  }

  async connect() {
    if (global.__mockState.shouldFailConnect) {
      throw new Error('Connection failed');
    }
    this.connected = true;
  }

  async logout() {
    this.connected = false;
  }

  async list() {
    // Use custom folder list if provided, otherwise default to INBOX only
    if (global.__mockState.folderList) {
      return global.__mockState.folderList;
    }
    // Only return INBOX to simplify testing - sync will only sync one folder
    return [{ name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null }];
  }

  async getMailboxLock(mailboxName) {
    // Only INBOX has emails, other folders are empty
    const emailCount = mailboxName === 'INBOX' ? global.__mockState.serverEmails.length : 0;
    this.mailbox = { exists: emailCount, name: mailboxName };
    this.currentMailbox = mailboxName;
    return {
      release: () => {
        this.mailbox = null;
        this.currentMailbox = null;
      },
    };
  }

  async messageFlagsAdd(uid, flags, _options = {}) {
    const email = global.__mockState.serverEmails.find((e) => e.uid === uid);
    if (email) {
      if (!(email.flags instanceof Set)) {
        email.flags = new Set(email.flags || []);
      }
      flags.forEach((flag) => email.flags.add(flag));
    }
  }

  async messageFlagsRemove(uid, flags, _options = {}) {
    const email = global.__mockState.serverEmails.find((e) => e.uid === uid);
    if (email) {
      if (!(email.flags instanceof Set)) {
        email.flags = new Set(email.flags || []);
      }
      flags.forEach((flag) => email.flags.delete(flag));
    }
  }

  async *fetch(range, queryObject = {}, options = {}) {
    if (global.__mockState.shouldFailFetch) {
      throw new Error('Fetch failed');
    }

    const isUid = options && options.uid === true;
    const wantSource = queryObject && queryObject.source === true;

    let messages = [];

    if (isUid) {
      const uidList = range.split(',').map((u) => parseInt(u.trim()));
      messages = global.__mockState.serverEmails.filter((e) => uidList.includes(e.uid));
    } else {
      const parts = range.split(':');
      if (parts.length === 2) {
        const start = parseInt(parts[0]);
        const end = parts[1] === '*' ? global.__mockState.serverEmails.length : parseInt(parts[1]);
        messages = global.__mockState.serverEmails.slice(start - 1, end);
      } else {
        const seqList = range.split(',').map((s) => parseInt(s.trim()));
        messages = seqList.map((seq) => global.__mockState.serverEmails[seq - 1]).filter(Boolean);
      }
    }

    for (const email of messages) {
      const msg = {
        uid: email.uid,
        flags: email.flags instanceof Set ? email.flags : new Set(email.flags || []),
        seq: global.__mockState.serverEmails.indexOf(email) + 1,
      };

      if (wantSource && !email.noSource) {
        msg.source = Buffer.from(email.body || '');
      }

      yield msg;
    }
  }

  async getQuota(_mailbox) {
    if (global.__mockState.quotaResponse) {
      return global.__mockState.quotaResponse;
    }
    return null;
  }

  async messageMove(range, destination, options = {}) {
    // Mock move: just remove from current mailbox (simulates move to destination)
    const isUid = options.uid === true;
    const uidList = isUid ? [parseInt(range)] : [range];

    for (const uid of uidList) {
      const index = global.__mockState.serverEmails.findIndex((e) => e.uid === uid);
      if (index !== -1) {
        global.__mockState.serverEmails.splice(index, 1);
      }
    }
  }

  async messageDelete(range, options = {}) {
    const isUid = options.uid === true;
    const uidList = isUid ? [parseInt(range)] : [range];

    for (const uid of uidList) {
      const index = global.__mockState.serverEmails.findIndex((e) => e.uid === uid);
      if (index !== -1) {
        global.__mockState.serverEmails.splice(index, 1);
      }
    }
  }
}

// Intercept require calls
Module.prototype.require = function (id) {
  // Check if this is a test environment and we're requesting imapflow
  if (id === 'imapflow' && process.env.VITEST) {
    return { ImapFlow: MockImapFlow };
  }
  // Mock electron module to prevent circular dependency warnings from safeStorage
  if (id === 'electron' && process.env.VITEST) {
    return {
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (plaintext) => Buffer.from(`ENCRYPTED:${plaintext}`, 'utf-8'),
        decryptString: (encrypted) => encrypted.toString('utf-8').replace('ENCRYPTED:', ''),
      },
      app: {
        getPath: () => './test-data',
      },
    };
  }
  return originalRequire.apply(this, arguments);
};

// Export helper functions for tests
module.exports = {
  resetMockState() {
    global.__mockState.serverEmails = [];
    global.__mockState.shouldFailConnect = false;
    global.__mockState.shouldFailFetch = false;
    global.__mockState.folderList = null;
    global.__mockState.quotaResponse = null;
  },
  setServerEmails(emails) {
    global.__mockState.serverEmails = emails.map((email, index) => ({
      ...email,
      uid: email.uid || index + 1,
      flags: email.flags instanceof Set ? email.flags : new Set(email.flags || []),
    }));
  },
  setConnectFailure(fail) {
    global.__mockState.shouldFailConnect = fail;
  },
  setFetchFailure(fail) {
    global.__mockState.shouldFailFetch = fail;
  },
  setFolderList(folders) {
    // Set custom folder list for testing folder mapping
    // Example: [{ name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
    //          { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' }]
    global.__mockState.folderList = folders;
  },
  setQuotaResponse(quota) {
    // Set custom quota response for testing
    // Example: { storage: { usage: 1024000, limit: 10240000 } }
    global.__mockState.quotaResponse = quota;
  },
};
