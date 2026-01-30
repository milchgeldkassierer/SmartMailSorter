const { vi } = require('vitest');

// ImapFlow is a class that needs to be mocked
// The mock should allow test files to control the instance behavior

class MockImapFlow {
    constructor() {
        this.connect = vi.fn();
        this.logout = vi.fn();
        this.getMailbox = vi.fn();
        this.mailboxOpen = vi.fn();
        this.search = vi.fn();
        this.fetch = vi.fn();
        this.fetchOne = vi.fn();
    }
}

module.exports = {
    ImapFlow: vi.fn().mockImplementation(() => new MockImapFlow()),
};
