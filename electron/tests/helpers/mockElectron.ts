import Module from 'module';

// Save original require for restoration
const originalRequire = Module.prototype.require;

/**
 * Sets up a mock for Electron's safeStorage and app modules by intercepting
 * Module.prototype.require. Returns a controller object with a setter for
 * mockEncryptionAvailable. Vitest isolates each test file, so no teardown
 * is needed.
 */
export function setupElectronMock(initialEncryptionAvailable = true) {
  let mockEncryptionAvailable = initialEncryptionAvailable;

  Module.prototype.require = function (id: string) {
    if (id === 'electron' && process.env.VITEST) {
      return {
        safeStorage: {
          isEncryptionAvailable: () => mockEncryptionAvailable,
          encryptString: (plaintext: string) => {
            if (!mockEncryptionAvailable) {
              throw new Error('Encryption not available');
            }
            // Simulate encryption by creating a buffer with a prefix and the plaintext
            // In real Electron, this would be OS-level encryption
            const encrypted = Buffer.from(`ENCRYPTED:${plaintext}`, 'utf-8');
            return encrypted;
          },
          decryptString: (encrypted: Buffer) => {
            if (!mockEncryptionAvailable) {
              throw new Error('Encryption not available');
            }
            // Simulate decryption by removing the prefix
            const decrypted = encrypted.toString('utf-8').replace('ENCRYPTED:', '');
            return decrypted;
          },
        },
        app: {
          getPath: () => './test-data',
        },
      };
    }
    return originalRequire.apply(this, arguments as unknown as [string]);
  };

  return {
    setEncryptionAvailable(value: boolean) {
      mockEncryptionAvailable = value;
    },
    getEncryptionAvailable() {
      return mockEncryptionAvailable;
    },
  };
}
