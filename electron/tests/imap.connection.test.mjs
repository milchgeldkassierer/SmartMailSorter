import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the setup helpers that control global mock state
const { resetMockState, setConnectFailure } = await import('./vitest-setup.js');

// Mock Electron before importing imap module
vi.mock('electron', () => ({
    app: { getPath: () => 'tmp' }
}));

// Mock DB module
vi.mock('../db.cjs', () => ({
    saveEmail: vi.fn(),
    updateAccountSync: vi.fn(),
    updateAccountQuota: vi.fn(),
    getAllUidsForFolder: vi.fn().mockReturnValue([]),
    deleteEmailsByUid: vi.fn().mockReturnValue(0),
    migrateFolder: vi.fn(),
    getMaxUidForFolder: vi.fn().mockReturnValue(0)
}));

// Mock mailparser
vi.mock('mailparser', () => ({
    simpleParser: vi.fn().mockResolvedValue({
        subject: 'Test',
        from: { text: 'Test', value: [{ address: 'test@test.com' }] },
        text: 'Body',
        date: new Date()
    })
}));

// Import imap module after mocks are set up (uses vitest-setup.js patched require)
const imap = await import('../imap.cjs');

describe('IMAP Connection Tests', () => {
    beforeEach(() => {
        // Reset mock state before each test
        resetMockState();
        vi.clearAllMocks();
    });

    afterEach(() => {
        resetMockState();
        vi.clearAllMocks();
    });

    describe('testConnection', () => {
        describe('Success scenarios', () => {
            it('should return success when connection is established', async () => {
                const account = {
                    email: 'test@example.com',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                expect(result).toHaveProperty('success');
                expect(result.success).toBe(true);
                expect(result).not.toHaveProperty('error');
            });

            it('should return success with different account configurations', async () => {
                const accounts = [
                    {
                        email: 'user@gmail.com',
                        password: 'appPassword',
                        imapHost: 'imap.gmail.com',
                        imapPort: 993
                    },
                    {
                        email: 'user@gmx.net',
                        password: 'pass',
                        imapHost: 'imap.gmx.net',
                        imapPort: 993
                    },
                    {
                        email: 'user@web.de',
                        password: 'pass',
                        imapHost: 'imap.web.de',
                        imapPort: 993
                    }
                ];

                for (const account of accounts) {
                    resetMockState(); // Reset between accounts
                    const result = await imap.testConnection(account);
                    expect(result.success).toBe(true);
                }
            });

            it('should handle account with username field', async () => {
                const account = {
                    email: 'user@example.com',
                    username: 'customUsername',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                // The connection should succeed regardless of username vs email
                expect(result.success).toBe(true);
            });

            it('should handle account without username field (uses email)', async () => {
                const account = {
                    email: 'user@example.com',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);
                expect(result.success).toBe(true);
            });

            it('should successfully complete the connection test flow', async () => {
                // Test that the full flow works: connect -> getMailboxLock -> release -> logout
                const account = {
                    email: 'test@example.com',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                // Success indicates all steps completed
                expect(result).toEqual({ success: true });
            });
        });

        describe('Connection failure scenarios', () => {
            it('should return failure when connection fails', async () => {
                setConnectFailure(true);

                const account = {
                    email: 'test@example.com',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            it('should return error message when connection fails', async () => {
                setConnectFailure(true);

                const account = {
                    email: 'test@example.com',
                    password: 'password123',
                    imapHost: 'nonexistent.host.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                expect(result.success).toBe(false);
                expect(result).toHaveProperty('error');
                expect(typeof result.error).toBe('string');
            });

            it('should handle connection failure gracefully', async () => {
                setConnectFailure(true);

                const account = {
                    email: 'test@example.com',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 12345
                };

                // Should not throw, but return failure object
                const result = await imap.testConnection(account);

                expect(result).toBeDefined();
                expect(result.success).toBe(false);
            });
        });

        describe('Authentication failure scenarios', () => {
            it('should return failure when authentication fails', async () => {
                setConnectFailure(true);

                const account = {
                    email: 'test@example.com',
                    password: 'wrongPassword',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            it('should handle empty password', async () => {
                setConnectFailure(true);

                const account = {
                    email: 'test@example.com',
                    password: '',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                expect(result.success).toBe(false);
            });
        });

        describe('Return value structure', () => {
            it('should return object with success=true on successful connection', async () => {
                const account = {
                    email: 'test@example.com',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                expect(typeof result).toBe('object');
                expect(result.success).toBe(true);
            });

            it('should return object with success=false and error on failure', async () => {
                setConnectFailure(true);

                const account = {
                    email: 'test@example.com',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                expect(typeof result).toBe('object');
                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            it('should not include error property on success', async () => {
                const account = {
                    email: 'test@example.com',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                expect(result).not.toHaveProperty('error');
            });

            it('should include error message string on failure', async () => {
                setConnectFailure(true);

                const account = {
                    email: 'test@example.com',
                    password: 'password123',
                    imapHost: 'imap.example.com',
                    imapPort: 993
                };

                const result = await imap.testConnection(account);

                expect(typeof result.error).toBe('string');
                expect(result.error.length).toBeGreaterThan(0);
            });
        });
    });

    describe('PROVIDERS configuration', () => {
        it('should export PROVIDERS object', () => {
            expect(imap.PROVIDERS).toBeDefined();
            expect(typeof imap.PROVIDERS).toBe('object');
        });

        it('should have GMX provider correctly configured', () => {
            expect(imap.PROVIDERS.gmx).toBeDefined();
            expect(imap.PROVIDERS.gmx.host).toBe('imap.gmx.net');
            expect(imap.PROVIDERS.gmx.port).toBe(993);
            expect(imap.PROVIDERS.gmx.secure).toBe(true);
        });

        it('should have Web.de provider correctly configured', () => {
            expect(imap.PROVIDERS.webde).toBeDefined();
            expect(imap.PROVIDERS.webde.host).toBe('imap.web.de');
            expect(imap.PROVIDERS.webde.port).toBe(993);
            expect(imap.PROVIDERS.webde.secure).toBe(true);
        });

        it('should have Gmail provider correctly configured', () => {
            expect(imap.PROVIDERS.gmail).toBeDefined();
            expect(imap.PROVIDERS.gmail.host).toBe('imap.gmail.com');
            expect(imap.PROVIDERS.gmail.port).toBe(993);
            expect(imap.PROVIDERS.gmail.secure).toBe(true);
        });

        it('should have all providers using secure connections (SSL/TLS)', () => {
            for (const [name, config] of Object.entries(imap.PROVIDERS)) {
                expect(config.secure).toBe(true);
            }
        });

        it('should have all providers using standard IMAPS port 993', () => {
            for (const [name, config] of Object.entries(imap.PROVIDERS)) {
                expect(config.port).toBe(993);
            }
        });

        it('should have unique hosts for each provider', () => {
            const hosts = Object.values(imap.PROVIDERS).map(p => p.host);
            const uniqueHosts = new Set(hosts);
            expect(uniqueHosts.size).toBe(hosts.length);
        });

        it('should have valid hostname format for all providers', () => {
            const hostnamePattern = /^[a-z0-9.-]+$/;
            for (const [name, config] of Object.entries(imap.PROVIDERS)) {
                expect(config.host).toMatch(hostnamePattern);
                expect(config.host).toContain('imap.');
            }
        });

        it('should have required properties for each provider', () => {
            const requiredProps = ['host', 'port', 'secure'];

            for (const [name, config] of Object.entries(imap.PROVIDERS)) {
                for (const prop of requiredProps) {
                    expect(config).toHaveProperty(prop);
                }
            }
        });

        it('should have at least 3 providers defined', () => {
            const providerCount = Object.keys(imap.PROVIDERS).length;
            expect(providerCount).toBeGreaterThanOrEqual(3);
        });

        it('should have gmx, webde, and gmail as provider keys', () => {
            expect(imap.PROVIDERS).toHaveProperty('gmx');
            expect(imap.PROVIDERS).toHaveProperty('webde');
            expect(imap.PROVIDERS).toHaveProperty('gmail');
        });
    });

    describe('Connection parameters', () => {
        it('should accept account with all required fields', async () => {
            const account = {
                email: 'test@example.com',
                password: 'password123',
                imapHost: 'imap.example.com',
                imapPort: 993
            };

            const result = await imap.testConnection(account);

            // Should not throw and should return a result
            expect(result).toBeDefined();
            expect(result).toHaveProperty('success');
        });

        it('should work with different port numbers', async () => {
            const account = {
                email: 'test@example.com',
                password: 'password123',
                imapHost: 'imap.example.com',
                imapPort: 143 // Non-SSL port
            };

            const result = await imap.testConnection(account);
            expect(result).toHaveProperty('success');
        });

        it('should work with custom IMAP hosts', async () => {
            const account = {
                email: 'test@custom-domain.com',
                password: 'password123',
                imapHost: 'mail.custom-domain.com',
                imapPort: 993
            };

            const result = await imap.testConnection(account);
            expect(result).toHaveProperty('success');
        });

        it('should handle account with optional username field', async () => {
            const accountWithUsername = {
                email: 'display@example.com',
                username: 'actual_user',
                password: 'password123',
                imapHost: 'imap.example.com',
                imapPort: 993
            };

            const result = await imap.testConnection(accountWithUsername);
            expect(result).toHaveProperty('success');
        });
    });

    describe('Error handling', () => {
        it('should catch and wrap connection errors', async () => {
            setConnectFailure(true);

            const account = {
                email: 'test@example.com',
                password: 'password123',
                imapHost: 'imap.example.com',
                imapPort: 993
            };

            // Should not throw, should return error object
            let error = null;
            let result = null;
            try {
                result = await imap.testConnection(account);
            } catch (e) {
                error = e;
            }

            expect(error).toBeNull();
            expect(result).toBeDefined();
            expect(result.success).toBe(false);
        });

        it('should return structured error response', async () => {
            setConnectFailure(true);

            const account = {
                email: 'test@example.com',
                password: 'password123',
                imapHost: 'imap.example.com',
                imapPort: 993
            };

            const result = await imap.testConnection(account);

            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('error');
        });

        it('should handle repeated connection attempts', async () => {
            const account = {
                email: 'test@example.com',
                password: 'password123',
                imapHost: 'imap.example.com',
                imapPort: 993
            };

            // Multiple connection attempts should all work
            const result1 = await imap.testConnection(account);
            const result2 = await imap.testConnection(account);
            const result3 = await imap.testConnection(account);

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(result3.success).toBe(true);
        });

        it('should recover from failed connection on retry', async () => {
            const account = {
                email: 'test@example.com',
                password: 'password123',
                imapHost: 'imap.example.com',
                imapPort: 993
            };

            // First attempt fails
            setConnectFailure(true);
            const result1 = await imap.testConnection(account);
            expect(result1.success).toBe(false);

            // Second attempt succeeds
            setConnectFailure(false);
            const result2 = await imap.testConnection(account);
            expect(result2.success).toBe(true);
        });
    });

    describe('Function interface', () => {
        it('should export testConnection function', () => {
            expect(typeof imap.testConnection).toBe('function');
        });

        it('should return a Promise', () => {
            const account = {
                email: 'test@example.com',
                password: 'password123',
                imapHost: 'imap.example.com',
                imapPort: 993
            };

            const result = imap.testConnection(account);
            expect(result).toBeInstanceOf(Promise);
        });

        it('should have testConnection accepting account parameter', () => {
            const funcStr = imap.testConnection.toString();
            expect(funcStr).toContain('account');
        });
    });
});
