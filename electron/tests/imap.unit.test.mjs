import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { resetMockState, setServerEmails } from './vitest-setup.js';

// Use CommonJS require to ensure we get the SAME module instances as imap.cjs
const require = createRequire(import.meta.url);

// Mock electron
vi.mock('electron', () => ({
  app: { getPath: () => './test-data' },
}));

// Use CJS require to get the same module instances that imap.cjs uses
const db = require('../db.cjs');
const imap = require('../imap.cjs');

describe('IMAP Module', () => {
  beforeEach(() => {
    db.init(':memory:');
    resetMockState();
  });

  it('should export all required functions', () => {
    expect(typeof imap.syncAccount).toBe('function');
    expect(typeof imap.testConnection).toBe('function');
    expect(typeof imap.deleteEmail).toBe('function');
    expect(typeof imap.setEmailFlag).toBe('function');
    expect(typeof imap.PROVIDERS).toBe('object');
  });

  it('should have correct PROVIDERS configuration', () => {
    expect(imap.PROVIDERS.gmx).toBeDefined();
    expect(imap.PROVIDERS.gmx.host).toBe('imap.gmx.net');
    expect(imap.PROVIDERS.gmx.port).toBe(993);
    expect(imap.PROVIDERS.gmx.secure).toBe(true);

    expect(imap.PROVIDERS.webde).toBeDefined();
    expect(imap.PROVIDERS.webde.host).toBe('imap.web.de');

    expect(imap.PROVIDERS.gmail).toBeDefined();
    expect(imap.PROVIDERS.gmail.host).toBe('imap.gmail.com');
  });

  it('should have function signatures that match expected interface', () => {
    // Verify syncAccount accepts account parameter
    const syncAccountStr = imap.syncAccount.toString();
    expect(syncAccountStr).toContain('account');

    // Verify testConnection accepts account parameter
    const testConnectionStr = imap.testConnection.toString();
    expect(testConnectionStr).toContain('account');

    // Verify deleteEmail accepts account, uid, dbFolder
    const deleteEmailStr = imap.deleteEmail.toString();
    expect(deleteEmailStr).toContain('account');
    expect(deleteEmailStr).toContain('uid');

    // Verify setEmailFlag accepts account, uid, flag, value
    const setEmailFlagStr = imap.setEmailFlag.toString();
    expect(setEmailFlagStr).toContain('account');
    expect(setEmailFlagStr).toContain('uid');
    expect(setEmailFlagStr).toContain('flag');
  });

  it('should test connection and return success/failure', async () => {
    const account = {
      email: 'test@test.com',
      password: 'pass',
      imapHost: 'imap.test.com',
      imapPort: 993,
    };

    const result = await imap.testConnection(account);

    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  it('should sync account and return result', async () => {
    setServerEmails([]);

    const account = {
      id: 'test-id',
      email: 'test@test.com',
      password: 'pass',
      imapHost: 'imap.test.com',
      imapPort: 993,
    };

    db.addAccount({
      id: account.id,
      email: account.email,
      name: account.email,
      provider: 'test',
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      username: account.email,
      password: account.password,
      color: '#000000',
    });

    const result = await imap.syncAccount(account);

    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  it('should verify flags are checked using .has() not .includes()', () => {
    const messageWithSet = {
      attributes: {
        uid: 100,
        flags: new Set(['\\Seen', '\\Flagged']),
      },
    };

    const isRead = messageWithSet.attributes.flags?.has('\\Seen') || false;
    const isFlagged = messageWithSet.attributes.flags?.has('\\Flagged') || false;

    expect(isRead).toBe(true);
    expect(isFlagged).toBe(true);

    expect(typeof messageWithSet.attributes.flags.includes).toBe('undefined');
    expect(typeof messageWithSet.attributes.flags.has).toBe('function');
  });

  it('should handle edge cases in flag checking', () => {
    const msg1 = { attributes: { flags: undefined } };
    expect(msg1.attributes.flags?.has('\\Seen') || false).toBe(false);

    const msg2 = { attributes: { flags: null } };
    expect(msg2.attributes.flags?.has('\\Seen') || false).toBe(false);

    const msg3 = { attributes: { flags: new Set() } };
    expect(msg3.attributes.flags?.has('\\Seen') || false).toBe(false);

    const msg4 = { attributes: { flags: new Set(['\\Seen']) } };
    expect(msg4.attributes.flags?.has('\\Seen') || false).toBe(true);
    expect(msg4.attributes.flags?.has('\\Flagged') || false).toBe(false);

    const msg5 = { attributes: { flags: new Set(['\\Seen', '\\Flagged', '\\Draft']) } };
    expect(msg5.attributes.flags?.has('\\Seen') || false).toBe(true);
    expect(msg5.attributes.flags?.has('\\Flagged') || false).toBe(true);
  });

  describe('Folder path resolution', () => {
    it('should use box.path (not box.name) for folder keys', () => {
      const mockBoxList = [
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Bondora', path: 'INBOX.Bondora', delimiter: '.', specialUse: null },
        { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null },
        { name: 'Paypal', path: 'INBOX.Paypal', delimiter: '.', specialUse: null },
      ];

      const folderMap = { INBOX: 'Posteingang' };

      for (const box of mockBoxList) {
        const key = box.path;
        const fullPath = key;
        const delimiter = box.delimiter || '/';

        if (!folderMap[fullPath]) {
          if (fullPath.toUpperCase().startsWith('INBOX') && fullPath !== 'INBOX') {
            const parts = fullPath.split(delimiter);
            if (parts[0].toUpperCase() === 'INBOX') parts[0] = 'Posteingang';
            folderMap[fullPath] = parts.join('/');
          }
        }
      }

      expect(folderMap['INBOX']).toBe('Posteingang');
      expect(folderMap['INBOX.Bondora']).toBe('Posteingang/Bondora');
      expect(folderMap['INBOX.Amazon']).toBe('Posteingang/Amazon');
      expect(folderMap['INBOX.Paypal']).toBe('Posteingang/Paypal');

      expect(folderMap['Bondora']).toBeUndefined();
      expect(folderMap['Amazon']).toBeUndefined();
      expect(folderMap['Paypal']).toBeUndefined();
    });

    it('should handle different folder delimiter formats', () => {
      const testCases = [
        { name: 'Subfolder', path: 'INBOX.Subfolder', delimiter: '.' },
        { name: 'Subfolder', path: 'INBOX/Subfolder', delimiter: '/' },
        { name: 'Deep', path: 'INBOX.Parent.Deep', delimiter: '.' },
      ];

      for (const box of testCases) {
        const key = box.path;
        expect(key).toBe(box.path);
        expect(key).not.toBe(box.name);
        expect(key.toUpperCase().startsWith('INBOX')).toBe(true);
      }
    });

    it('should map folder paths to display names correctly', () => {
      const folderMap = {};

      const mockBoxList = [
        { name: 'Sent', path: 'Sent', delimiter: '/', specialUse: '\\Sent' },
        { name: 'Trash', path: 'Trash', delimiter: '/', specialUse: '\\Trash' },
        { name: 'Spam', path: 'Junk', delimiter: '/', specialUse: '\\Junk' },
        { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null },
      ];

      for (const box of mockBoxList) {
        const key = box.path;

        if (box.specialUse) {
          const specialUse = box.specialUse.toLowerCase();
          if (specialUse.includes('\\sent')) folderMap[key] = 'Gesendet';
          else if (specialUse.includes('\\trash')) folderMap[key] = 'Papierkorb';
          else if (specialUse.includes('\\junk')) folderMap[key] = 'Spam';
        }

        if (!folderMap[key]) {
          if (key.toUpperCase().startsWith('INBOX.')) {
            const parts = key.split('.');
            parts[0] = 'Posteingang';
            folderMap[key] = parts.join('/');
          }
        }
      }

      expect(folderMap['Sent']).toBe('Gesendet');
      expect(folderMap['Trash']).toBe('Papierkorb');
      expect(folderMap['Junk']).toBe('Spam');
      expect(folderMap['INBOX.Amazon']).toBe('Posteingang/Amazon');
    });
  });

  describe('checkAccountQuota helper', () => {
    it('should be exported as a function', () => {
      expect(typeof imap.checkAccountQuota).toBe('function');
    });

    it('should parse quota response and return quota info', async () => {
      const { setQuotaResponse } = await import('./vitest-setup.js');

      // Set mock quota response
      setQuotaResponse({
        storage: {
          used: 1024000,  // 1000 KB in bytes
          limit: 10240000, // 10000 KB in bytes
        },
      });

      const account = {
        id: 'test-quota-account',
        email: 'quota@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      // Create mock client
      const mockClient = {
        capabilities: new Set(['IMAP4rev1', 'QUOTA']),
        async getQuota(_mailbox) {
          return {
            storage: {
              used: 1024000,
              limit: 10240000,
            },
          };
        },
      };

      const result = await imap.checkAccountQuota(mockClient, account.id);

      expect(result).not.toBeNull();
      expect(result.usedKB).toBe(1000);
      expect(result.totalKB).toBe(10000);
    });

    it('should return null when quota has no storage property', async () => {
      const mockClient = {
        capabilities: new Set(['IMAP4rev1', 'QUOTA']),
        async getQuota(_mailbox) {
          return { foo: 'bar' };
        },
      };

      const result = await imap.checkAccountQuota(mockClient, 'test-account');

      expect(result).toBeNull();
    });

    it('should return null when quota storage has no valid limit', async () => {
      const mockClient = {
        capabilities: new Set(['IMAP4rev1', 'QUOTA']),
        async getQuota(_mailbox) {
          return {
            storage: {
              used: 1024000,
              limit: 0,
            },
          };
        },
      };

      const result = await imap.checkAccountQuota(mockClient, 'test-account');

      expect(result).toBeNull();
    });

    it('should return null when getQuota returns null', async () => {
      const mockClient = {
        capabilities: new Set(['IMAP4rev1']),
        async getQuota(_mailbox) {
          return null;
        },
      };

      const result = await imap.checkAccountQuota(mockClient, 'test-account');

      expect(result).toBeNull();
    });

    it('should handle getQuota errors gracefully', async () => {
      const mockClient = {
        capabilities: new Set(['IMAP4rev1', 'QUOTA']),
        async getQuota(_mailbox) {
          throw new Error('Quota not supported');
        },
      };

      const result = await imap.checkAccountQuota(mockClient, 'test-account');

      expect(result).toBeNull();
    });

    it('should round bytes to KB correctly', async () => {
      const mockClient = {
        capabilities: new Set(['IMAP4rev1', 'QUOTA']),
        async getQuota(_mailbox) {
          return {
            storage: {
              used: 1536,  // 1.5 KB = 1536 bytes
              limit: 2560, // 2.5 KB = 2560 bytes
            },
          };
        },
      };

      const result = await imap.checkAccountQuota(mockClient, 'test-account');

      expect(result).not.toBeNull();
      expect(result.usedKB).toBe(2);  // Math.round(1536/1024) = 2
      expect(result.totalKB).toBe(3); // Math.round(2560/1024) = 3
    });
  });

  describe('buildFolderMap helper', () => {
    it('should be exported as a function', () => {
      expect(typeof imap.buildFolderMap).toBe('function');
    });

    it('should build folder map with INBOX as default', () => {
      const mailboxes = [];
      const folderMap = imap.buildFolderMap(mailboxes);

      expect(folderMap).toHaveProperty('INBOX');
      expect(folderMap.INBOX).toBe('Posteingang');
    });

    it('should map special folders correctly', () => {
      const mailboxes = [
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' },
        { name: 'Trash', path: 'Trash', delimiter: '.', specialUse: '\\Trash' },
        { name: 'Junk', path: 'Junk', delimiter: '.', specialUse: '\\Junk' },
      ];

      const folderMap = imap.buildFolderMap(mailboxes);

      expect(folderMap.INBOX).toBe('Posteingang');
      expect(folderMap.Sent).toBe('Gesendet');
      expect(folderMap.Trash).toBe('Papierkorb');
      expect(folderMap.Junk).toBe('Spam');
    });

    it('should map INBOX subfolders correctly', () => {
      const mailboxes = [
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null },
        { name: 'Paypal', path: 'INBOX.Paypal', delimiter: '.', specialUse: null },
      ];

      const folderMap = imap.buildFolderMap(mailboxes);

      expect(folderMap['INBOX.Amazon']).toBe('Posteingang/Amazon');
      expect(folderMap['INBOX.Paypal']).toBe('Posteingang/Paypal');
    });

    it('should handle folders with / delimiter', () => {
      const mailboxes = [
        { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
        { name: 'Work', path: 'INBOX/Work', delimiter: '/', specialUse: null },
      ];

      const folderMap = imap.buildFolderMap(mailboxes);

      expect(folderMap['INBOX/Work']).toBe('Posteingang/Work');
    });

    it('should handle nested folders', () => {
      const mailboxes = [
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Deep', path: 'INBOX.Parent.Deep', delimiter: '.', specialUse: null },
      ];

      const folderMap = imap.buildFolderMap(mailboxes);

      expect(folderMap['INBOX.Parent.Deep']).toBe('Posteingang/Parent/Deep');
    });

    it('should handle mixed special and regular folders', () => {
      const mailboxes = [
        { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
        { name: 'Sent', path: 'INBOX.Sent', delimiter: '.', specialUse: '\\Sent' },
        { name: 'Archive', path: 'INBOX.Archive', delimiter: '.', specialUse: null },
      ];

      const folderMap = imap.buildFolderMap(mailboxes);

      expect(folderMap['INBOX.Sent']).toBe('Gesendet');
      expect(folderMap['INBOX.Archive']).toBe('Posteingang/Archive');
    });

    it('should handle empty mailbox list', () => {
      const mailboxes = [];
      const folderMap = imap.buildFolderMap(mailboxes);

      expect(Object.keys(folderMap)).toHaveLength(1);
      expect(folderMap.INBOX).toBe('Posteingang');
    });
  });

  describe('migrateFolders helper', () => {
    beforeEach(() => {
      db.init(':memory:');
    });

    it('should be exported as a function', () => {
      expect(typeof imap.migrateFolders).toBe('function');
    });

    it('should not throw when given empty folder map', () => {
      const folderMap = {};
      expect(() => imap.migrateFolders(folderMap)).not.toThrow();
    });

    it('should not throw when given only INBOX', () => {
      const folderMap = { INBOX: 'Posteingang' };
      expect(() => imap.migrateFolders(folderMap)).not.toThrow();
    });

    it('should handle folder map with subfolders', () => {
      const folderMap = {
        INBOX: 'Posteingang',
        'INBOX.Amazon': 'Posteingang/Amazon',
        'INBOX.Paypal': 'Posteingang/Paypal',
      };

      expect(() => imap.migrateFolders(folderMap)).not.toThrow();
    });

    it('should handle folder map with special folders', () => {
      const folderMap = {
        INBOX: 'Posteingang',
        Sent: 'Gesendet',
        Trash: 'Papierkorb',
        Junk: 'Spam',
      };

      expect(() => imap.migrateFolders(folderMap)).not.toThrow();
    });

    it('should handle folder map with nested folders', () => {
      const folderMap = {
        INBOX: 'Posteingang',
        'INBOX.Work.Projects': 'Posteingang/Work/Projects',
      };

      expect(() => imap.migrateFolders(folderMap)).not.toThrow();
    });

    it('should handle folder map with various delimiters', () => {
      const folderMap = {
        INBOX: 'Posteingang',
        'INBOX.Folder1': 'Posteingang/Folder1',
        'INBOX/Folder2': 'Posteingang/Folder2',
      };

      expect(() => imap.migrateFolders(folderMap)).not.toThrow();
    });
  });

  describe('fetchUidBatch helper', () => {
    beforeEach(() => {
      db.init(':memory:');
      resetMockState();
    });

    it('should be exported as a function', () => {
      expect(typeof imap.fetchUidBatch).toBe('function');
    });

    it('should fetch UIDs and flags for a sequence range', async () => {
      setServerEmails([
        { uid: 100, body: 'Email 1', flags: ['\\Seen'] },
        { uid: 200, body: 'Email 2', flags: [] },
        { uid: 300, body: 'Email 3', flags: ['\\Flagged'] },
      ]);

      const account = {
        id: 'test-account',
        email: 'test@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        auth: { user: account.email, pass: account.password },
      });

      await client.connect();
      await client.getMailboxLock('INBOX');

      const result = await imap.fetchUidBatch(client, '1:3');

      expect(result).toHaveProperty('uids');
      expect(result).toHaveProperty('headers');
      expect(result.uids).toHaveLength(3);
      expect(result.uids).toContain(100);
      expect(result.uids).toContain(200);
      expect(result.uids).toContain(300);
      expect(result.headers).toHaveLength(3);

      await client.logout();
    });

    it('should handle empty sequence range', async () => {
      setServerEmails([]);

      const account = {
        id: 'test-account',
        email: 'test@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        auth: { user: account.email, pass: account.password },
      });

      await client.connect();
      await client.getMailboxLock('INBOX');

      const result = await imap.fetchUidBatch(client, '1:10');

      expect(result.uids).toHaveLength(0);
      expect(result.headers).toHaveLength(0);

      await client.logout();
    });

    it('should extract UIDs correctly from message attributes', async () => {
      setServerEmails([
        { uid: 42, body: 'Test email', flags: ['\\Seen'] },
      ]);

      const account = {
        id: 'test-account',
        email: 'test@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        auth: { user: account.email, pass: account.password },
      });

      await client.connect();
      await client.getMailboxLock('INBOX');

      const result = await imap.fetchUidBatch(client, '1:1');

      expect(result.uids).toEqual([42]);
      expect(result.headers[0].attributes.uid).toBe(42);

      await client.logout();
    });

    it('should handle flags correctly', async () => {
      setServerEmails([
        { uid: 100, body: 'Email 1', flags: ['\\Seen', '\\Flagged'] },
        { uid: 200, body: 'Email 2', flags: [] },
      ]);

      const account = {
        id: 'test-account',
        email: 'test@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        auth: { user: account.email, pass: account.password },
      });

      await client.connect();
      await client.getMailboxLock('INBOX');

      const result = await imap.fetchUidBatch(client, '1:2');

      expect(result.headers[0].attributes.flags).toContain('\\Seen');
      expect(result.headers[0].attributes.flags).toContain('\\Flagged');
      expect(result.headers[1].attributes.flags).toHaveLength(0);

      await client.logout();
    });
  });

  describe('downloadMessageBatch helper', () => {
    beforeEach(() => {
      db.init(':memory:');
      resetMockState();
    });

    it('should be exported as a function', () => {
      expect(typeof imap.downloadMessageBatch).toBe('function');
    });

    it('should download and process messages successfully', async () => {
      setServerEmails([
        {
          uid: 100,
          body: 'From: sender@test.com\r\nTo: recipient@test.com\r\nSubject: Test Email 1\r\n\r\nBody of email 1',
          flags: ['\\Seen'],
        },
        {
          uid: 200,
          body: 'From: sender2@test.com\r\nTo: recipient@test.com\r\nSubject: Test Email 2\r\n\r\nBody of email 2',
          flags: [],
        },
      ]);

      const account = {
        id: 'test-account',
        email: 'test@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        auth: { user: account.email, pass: account.password },
      });

      await client.connect();
      await client.getMailboxLock('INBOX');

      const saved = await imap.downloadMessageBatch(client, [100, 200], account, 'Posteingang');

      expect(saved).toBe(2);

      const emails = db.getEmails(account.id);
      expect(emails).toHaveLength(2);

      await client.logout();
    });

    it('should handle empty chunk and return 0', async () => {
      setServerEmails([]);

      const account = {
        id: 'test-account',
        email: 'test@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        auth: { user: account.email, pass: account.password },
      });

      await client.connect();
      await client.getMailboxLock('INBOX');

      const saved = await imap.downloadMessageBatch(client, [999], account, 'Posteingang');

      expect(saved).toBe(0);

      await client.logout();
    });

    it('should handle fetch errors gracefully', async () => {
      const { setFetchFailure } = await import('./vitest-setup.js');

      setServerEmails([
        { uid: 100, body: 'Test email', flags: [] },
      ]);

      const account = {
        id: 'test-account',
        email: 'test@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        auth: { user: account.email, pass: account.password },
      });

      await client.connect();
      await client.getMailboxLock('INBOX');

      setFetchFailure(true);

      const saved = await imap.downloadMessageBatch(client, [100], account, 'Posteingang');

      expect(saved).toBe(0);

      setFetchFailure(false);
      await client.logout();
    });

    it('should process batch of different sizes', async () => {
      const emails = [];
      for (let i = 1; i <= 10; i++) {
        emails.push({
          uid: i * 10,
          body: `From: sender${i}@test.com\r\nTo: recipient@test.com\r\nSubject: Email ${i}\r\n\r\nBody ${i}`,
          flags: [],
        });
      }
      setServerEmails(emails);

      const account = {
        id: 'test-account',
        email: 'test@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        auth: { user: account.email, pass: account.password },
      });

      await client.connect();
      await client.getMailboxLock('INBOX');

      const saved = await imap.downloadMessageBatch(client, [10, 20, 30, 40, 50], account, 'Posteingang');

      expect(saved).toBe(5);

      const dbEmails = db.getEmails(account.id);
      expect(dbEmails).toHaveLength(5);

      await client.logout();
    });

    it('should handle messages without body source', async () => {
      setServerEmails([
        { uid: 100, body: '', flags: [], noSource: true },
      ]);

      const account = {
        id: 'test-account',
        email: 'test@test.com',
        password: 'pass',
        imapHost: 'imap.test.com',
        imapPort: 993,
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.email,
        password: account.password,
        color: '#000000',
      });

      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        auth: { user: account.email, pass: account.password },
      });

      await client.connect();
      await client.getMailboxLock('INBOX');

      const saved = await imap.downloadMessageBatch(client, [100], account, 'Posteingang');

      expect(saved).toBe(0);

      await client.logout();
    });
  });

  describe('reconcileOrphans helper', () => {
    beforeEach(() => {
      db.init(':memory:');
      resetMockState();
    });

    it('should be exported as a function', () => {
      expect(typeof imap.reconcileOrphans).toBe('function');
    });

    it('should delete orphaned local emails not on server', () => {
      const account = {
        id: 'test-account',
        email: 'test@test.com',
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: account.email,
        password: 'pass',
        color: '#000000',
      });

      db.saveEmail({
        accountId: account.id,
        uid: 100,
        folder: 'Posteingang',
        sender: 'test1@test.com',
        subject: 'Email 1',
        timestamp: new Date().toISOString(),
        body: 'Body 1',
        isRead: false,
        isFlagged: false,
      });

      db.saveEmail({
        accountId: account.id,
        uid: 200,
        folder: 'Posteingang',
        sender: 'test2@test.com',
        subject: 'Email 2',
        timestamp: new Date().toISOString(),
        body: 'Body 2',
        isRead: false,
        isFlagged: false,
      });

      db.saveEmail({
        accountId: account.id,
        uid: 300,
        folder: 'Posteingang',
        sender: 'test3@test.com',
        subject: 'Email 3',
        timestamp: new Date().toISOString(),
        body: 'Body 3',
        isRead: false,
        isFlagged: false,
      });

      const localUids = [100, 200, 300];
      const serverUids = new Set([100, 300]);

      const deletedCount = imap.reconcileOrphans(
        localUids,
        serverUids,
        account.id,
        'Posteingang',
        'INBOX'
      );

      expect(deletedCount).toBe(1);

      const remainingEmails = db.getEmails(account.id);
      expect(remainingEmails).toHaveLength(2);
      expect(remainingEmails.find((e) => e.uid === 100)).toBeDefined();
      expect(remainingEmails.find((e) => e.uid === 300)).toBeDefined();
      expect(remainingEmails.find((e) => e.uid === 200)).toBeUndefined();
    });

    it('should return 0 when no orphans found', () => {
      const account = {
        id: 'test-account',
        email: 'test@test.com',
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: account.email,
        password: 'pass',
        color: '#000000',
      });

      const localUids = [100, 200, 300];
      const serverUids = new Set([100, 200, 300, 400]);

      const deletedCount = imap.reconcileOrphans(
        localUids,
        serverUids,
        account.id,
        'Posteingang',
        'INBOX'
      );

      expect(deletedCount).toBe(0);
    });

    it('should handle empty local UIDs', () => {
      const account = {
        id: 'test-account',
        email: 'test@test.com',
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: account.email,
        password: 'pass',
        color: '#000000',
      });

      const localUids = [];
      const serverUids = new Set([100, 200, 300]);

      const deletedCount = imap.reconcileOrphans(
        localUids,
        serverUids,
        account.id,
        'Posteingang',
        'INBOX'
      );

      expect(deletedCount).toBe(0);
    });

    it('should handle empty server UIDs', () => {
      const account = {
        id: 'test-account',
        email: 'test@test.com',
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: account.email,
        password: 'pass',
        color: '#000000',
      });

      db.saveEmail({
        accountId: account.id,
        uid: 100,
        folder: 'Posteingang',
        sender: 'test1@test.com',
        subject: 'Email 1',
        timestamp: new Date().toISOString(),
        body: 'Body 1',
        isRead: false,
        isFlagged: false,
      });

      db.saveEmail({
        accountId: account.id,
        uid: 200,
        folder: 'Posteingang',
        sender: 'test2@test.com',
        subject: 'Email 2',
        timestamp: new Date().toISOString(),
        body: 'Body 2',
        isRead: false,
        isFlagged: false,
      });

      const localUids = [100, 200];
      const serverUids = new Set([]);

      const deletedCount = imap.reconcileOrphans(
        localUids,
        serverUids,
        account.id,
        'Posteingang',
        'INBOX'
      );

      expect(deletedCount).toBe(2);

      const remainingEmails = db.getEmails(account.id);
      expect(remainingEmails).toHaveLength(0);
    });

    it('should handle multiple orphans', () => {
      const account = {
        id: 'test-account',
        email: 'test@test.com',
      };

      db.addAccount({
        id: account.id,
        email: account.email,
        name: account.email,
        provider: 'test',
        imapHost: 'imap.test.com',
        imapPort: 993,
        username: account.email,
        password: 'pass',
        color: '#000000',
      });

      for (let i = 1; i <= 10; i++) {
        db.saveEmail({
          accountId: account.id,
          uid: i * 10,
          folder: 'Posteingang',
          sender: `test${i}@test.com`,
          subject: `Email ${i}`,
          timestamp: new Date().toISOString(),
          body: `Body ${i}`,
          isRead: false,
          isFlagged: false,
        });
      }

      const localUids = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const serverUids = new Set([10, 30, 50, 70, 90]);

      const deletedCount = imap.reconcileOrphans(
        localUids,
        serverUids,
        account.id,
        'Posteingang',
        'INBOX'
      );

      expect(deletedCount).toBe(5);

      const remainingEmails = db.getEmails(account.id);
      expect(remainingEmails).toHaveLength(5);
    });
  });
});
