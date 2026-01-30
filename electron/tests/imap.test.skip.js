// Vitest globals are enabled in config

// Mock dependencies
const mockConnect = vi.fn();
const mockOpenBox = vi.fn();
const mockSearch = vi.fn();
const mockGetQuotaRoot = vi.fn();
const mockEnd = vi.fn();

// Mock Electron (required because imap imports db which imports electron)
vi.mock('electron', () => ({
    app: { getPath: () => 'tmp' }
}));

// Mock imap-simple using __mocks__
vi.mock('imap-simple');

// Import mocked module to control it
const imaps = require('imap-simple');
// const mockConnect = imaps.connect; // Already defined above

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

vi.mock('../db.cjs', () => ({
    saveEmail: mockSaveEmail,
    updateAccountSync: mockUpdateAccountSync,
    updateAccountQuota: mockUpdateAccountQuota
}));

// Require the module under test
const imap = require('../imap.cjs');

describe('IMAP Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup success path for connection
        mockConnect.mockResolvedValue({
            openBox: mockOpenBox,
            search: mockSearch,
            end: mockEnd,
            imap: {
                getQuotaRoot: mockGetQuotaRoot
            }
        });

        mockOpenBox.mockResolvedValue({});
        mockSearch.mockResolvedValue([]); // Default empty inbox
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
        expect(mockConnect).toHaveBeenCalled();
        expect(mockOpenBox).toHaveBeenCalledWith('INBOX');
        expect(mockSearch).toHaveBeenCalled();
        expect(mockEnd).toHaveBeenCalled();
        expect(mockUpdateAccountSync).toHaveBeenCalledWith('acc1', 50); // Should remain same
    });

    it('should process fetched emails', async () => {
        const account = { id: 'acc1', lastSyncUid: 10 };

        // Mock returning 1 email
        mockSearch.mockResolvedValue([{
            attributes: { uid: 15 },
            parts: [{ which: '', body: 'raw-body' }]
        }]);

        const result = await imap.syncAccount(account);

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
        expect(mockSaveEmail).toHaveBeenCalled();
        expect(mockUpdateAccountSync).toHaveBeenCalledWith('acc1', 15);
    });

    it('should fetch and update quota', async () => {
        const account = { id: 'acc1' };
        mockGetQuotaRoot.mockResolvedValue({
            storage: { used: 100, limit: 1000 }
        });

        await imap.syncAccount(account);

        expect(mockGetQuotaRoot).toHaveBeenCalled();
        // 100KB * 1024, 1000KB * 1024
        expect(mockUpdateAccountQuota).toHaveBeenCalledWith('acc1', 100 * 1024, 1000 * 1024);
    });

    it('testConnection should return success', async () => {
        const account = { email: 't@t.com', password: 'p' };
        const result = await imap.testConnection(account);

        expect(result.success).toBe(true);
        expect(mockConnect).toHaveBeenCalled();
        expect(mockEnd).toHaveBeenCalled();
    });

    it('testConnection should return error on failure', async () => {
        mockConnect.mockRejectedValue(new Error('Auth failed'));

        const result = await imap.testConnection({});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Auth failed');
    });
});
