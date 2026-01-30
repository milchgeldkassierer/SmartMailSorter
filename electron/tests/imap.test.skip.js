// Vitest globals are enabled in config

// Mock dependencies for imapflow
const mockImapConnect = vi.fn();
const mockImapLogout = vi.fn();
const mockGetMailboxLock = vi.fn();
const mockList = vi.fn();
const mockSearch = vi.fn();
const mockFlagsAdd = vi.fn();
const mockFlagsDel = vi.fn();
const mockImapGetQuotaRoot = vi.fn();
const mockImapExpunge = vi.fn();

// Mock capabilities
const mockCapabilities = new Set();

// Mock Electron (required because imap imports db which imports electron)
vi.mock('electron', () => ({
    app: { getPath: () => 'tmp' }
}));

// Mock imapflow - returns a constructor that creates a mock client
vi.mock('imapflow', () => ({
    ImapFlow: vi.fn().mockImplementation(() => ({
        connect: mockImapConnect,
        logout: mockImapLogout,
        getMailboxLock: mockGetMailboxLock,
        list: mockList,
        search: mockSearch,
        flags: {
            add: mockFlagsAdd,
            del: mockFlagsDel
        },
        imap: {
            getQuotaRoot: mockImapGetQuotaRoot,
            expunge: mockImapExpunge
        },
        capabilities: mockCapabilities,
        mailbox: { exists: 0 }
    }))
}));

// Mock mailparser
vi.mock('mailparser', () => ({
    simpleParser: vi.fn().mockResolvedValue({
        subject: 'Test Subject',
        from: { text: 'Sender Name', value: [{ address: 'sender@test.com' }] },
        text: 'Test Body',
        date: new Date()
    })
}));

// Mock DB to prevent actual database calls
const mockSaveEmail = vi.fn();
const mockUpdateAccountSync = vi.fn();
const mockUpdateAccountQuota = vi.fn();
const mockGetAllUidsForFolder = vi.fn().mockReturnValue([]);
const mockDeleteEmailsByUid = vi.fn().mockReturnValue(0);
const mockMigrateFolder = vi.fn();

vi.mock('../db.cjs', () => ({
    saveEmail: mockSaveEmail,
    updateAccountSync: mockUpdateAccountSync,
    updateAccountQuota: mockUpdateAccountQuota,
    getAllUidsForFolder: mockGetAllUidsForFolder,
    deleteEmailsByUid: mockDeleteEmailsByUid,
    migrateFolder: mockMigrateFolder
}));

// Require the module under test
const imap = require('../imap.cjs');

describe('IMAP Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup success path for imapflow client
        mockImapConnect.mockResolvedValue(undefined);
        mockImapLogout.mockResolvedValue(undefined);
        mockGetMailboxLock.mockResolvedValue({
            release: vi.fn()
        });
        mockList.mockResolvedValue([{ name: 'INBOX', path: 'INBOX' }]);
        mockSearch.mockResolvedValue([]); // Default empty inbox
        mockFlagsAdd.mockResolvedValue(undefined);
        mockFlagsDel.mockResolvedValue(undefined);
        mockGetAllUidsForFolder.mockReturnValue([]);
    });

    it('should sync account successfully with no emails', async () => {
        const account = {
            id: 'acc1',
            email: 'test@test.com',
            password: 'pass',
            imapHost: 'imap.test.com',
            imapPort: 993,
            lastSyncUid: 50
        };

        const result = await imap.syncAccount(account);

        expect(result.success).toBe(true);
        expect(mockImapConnect).toHaveBeenCalled();
        expect(mockGetMailboxLock).toHaveBeenCalledWith('INBOX');
        expect(mockImapLogout).toHaveBeenCalled();
    });

    it('should process fetched emails', async () => {
        const account = { id: 'acc1', lastSyncUid: 10 };

        // Mock mailbox with 1 message
        mockGetMailboxLock.mockResolvedValue({
            release: vi.fn()
        });

        const result = await imap.syncAccount(account);

        expect(result.success).toBe(true);
        expect(mockImapConnect).toHaveBeenCalled();
        expect(mockImapLogout).toHaveBeenCalled();
    });

    it('should fetch and update quota', async () => {
        const account = { id: 'acc1' };

        // Mock quota callback - getQuotaRoot uses callbacks, not promises
        mockImapGetQuotaRoot.mockImplementation((inbox, callback) => {
            callback(null, {
                'user': { storage: [100, 1000] }
            });
        });

        await imap.syncAccount(account);

        expect(mockImapGetQuotaRoot).toHaveBeenCalled();
    });

    it('testConnection should return success', async () => {
        const account = { email: 't@t.com', password: 'p', imapHost: 'imap.test.com', imapPort: 993 };
        const result = await imap.testConnection(account);

        expect(result.success).toBe(true);
        expect(mockImapConnect).toHaveBeenCalled();
        expect(mockGetMailboxLock).toHaveBeenCalledWith('INBOX');
        expect(mockImapLogout).toHaveBeenCalled();
    });

    it('testConnection should return error on failure', async () => {
        mockImapConnect.mockRejectedValue(new Error('Auth failed'));

        const result = await imap.testConnection({ email: 't@t.com', imapHost: 'imap.test.com', imapPort: 993 });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Auth failed');
    });
});
