const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger.cjs');

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const db = require('./db.cjs');
const imap = require('./imap.cjs');
const { sanitizeFilename } = require('./utils/security.cjs');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, '../public/favicon.ico'), // Fallback if public exists
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Initialize Database
  db.init(app);

  // IPC Handlers
  ipcMain.handle('get-accounts', () => db.getAccounts());

  ipcMain.handle('add-account', async (event, account) => {
    db.addAccount(account);
    // Initial sync
    return await imap.syncAccount(account);
  });

  ipcMain.handle('delete-account', (event, id) => {
    db.deleteAccountDn(id);
    return true;
  });

  ipcMain.handle('get-emails', (event, accountId) => db.getEmails(accountId));
  ipcMain.handle('get-email-attachments', (event, emailId) => db.getEmailAttachments(emailId));
  ipcMain.handle('get-email-content', (event, emailId) => {
    logger.debug(`[IPC] Fetching content for ${emailId}`);
    const result = db.getEmailContent(emailId);
    logger.debug(`[IPC] Found content length: Body=${result?.body?.length}, HTML=${result?.bodyHtml?.length}`);
    return result;
  });

  ipcMain.handle('open-attachment', async (event, attachmentId) => {
    try {
      const att = db.getAttachment(attachmentId);
      if (!att) {
        return { success: false, message: 'Attachment not found' };
      }

      const fs = require('fs');
      const os = require('os');
      // Create temp file with sanitized filename to prevent path traversal
      const safeFilename = sanitizeFilename(att.filename);
      const tempPath = path.join(os.tmpdir(), safeFilename);
      fs.writeFileSync(tempPath, att.data);

      const { shell } = require('electron');
      const result = await shell.openPath(tempPath);

      // shell.openPath returns a string - empty string means success
      if (result) {
        return { success: false, message: `Failed to open: ${result}` };
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to open attachment' };
    }
  });

  ipcMain.handle('open-external-url', async (event, url) => {
    // Validate URL structure and protocol using URL constructor
    // This prevents malformed URLs, null bytes, newlines, and other injection vectors
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      // Invalid URL structure
      return { success: false, error: 'INVALID_URL', message: 'Invalid URL format' };
    }

    // Allow http, https, mailto, and tel protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return {
        success: false,
        error: 'UNSUPPORTED_PROTOCOL',
        message: `Protocol '${parsed.protocol}' is not allowed. Supported: ${allowedProtocols.join(', ')}`,
      };
    }

    // Use normalized URL from parser
    url = parsed.href;

    // For mailto and tel links, use shell.openExternal on all platforms
    if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') {
      const { shell } = require('electron');
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        logger.error(`Failed to open ${parsed.protocol} link:`, error);
        return {
          success: false,
          error: 'OPEN_FAILED',
          message: `Failed to open ${parsed.protocol} link`,
        };
      }
    }

    // For http/https URLs, check if running in WSL
    const isWSL = await (async () => {
      try {
        const fs = require('fs');
        // Check for WSL-specific environment variable (fastest)
        if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
          return true;
        }
        // Check /proc/version for "Microsoft" or "WSL" markers
        if (fs.existsSync('/proc/version')) {
          const version = fs.readFileSync('/proc/version', 'utf8');
          return /microsoft|wsl/i.test(version);
        }
        return false;
      } catch {
        return false;
      }
    })();
    if (isWSL) {
      // In WSL, use rundll32.exe to open URL in Windows default browser
      // rundll32 url.dll,FileProtocolHandler is the standard Windows method for opening URLs
      // The URL is passed as a separate argument, preventing command injection
      const { execFile } = require('child_process');
      return new Promise((resolve) => {
        execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], (error) => {
          if (error) {
            logger.error('WSL browser open error:', error);
            resolve({ success: false, error: 'WSL_OPEN_FAILED', message: 'Failed to open URL in Windows browser' });
          } else {
            resolve({ success: true });
          }
        });
      });
    } else {
      // Standard approach for native Windows/Mac/Linux
      const { shell } = require('electron');
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        logger.error('Failed to open external URL:', error);
        return { success: false, error: 'OPEN_FAILED', message: 'Failed to open URL' };
      }
    }
  });

  ipcMain.handle('sync-account', async (event, account) => {
    return await imap.syncAccount(account);
  });

  ipcMain.handle('test-connection', async (event, account) => {
    return await imap.testConnection(account);
  });

  ipcMain.handle('reset-db', () => {
    db.resetDb();
    return true;
  });

  ipcMain.handle('delete-email', async (event, { account, emailId, uid, folder }) => {
    // Delete from DB
    db.deleteEmail(emailId);
    // Delete from Server
    return await imap.deleteEmail(account, uid, folder);
  });

  ipcMain.handle('update-email-read', async (event, { account, emailId, uid, isRead, folder }) => {
    db.updateEmailReadStatus(emailId, isRead);
    return await imap.setEmailFlag(account, uid, '\\Seen', isRead, folder);
  });

  ipcMain.handle('update-email-flag', async (event, { account, emailId, uid, isFlagged, folder }) => {
    db.updateEmailFlagStatus(emailId, isFlagged);
    return await imap.setEmailFlag(account, uid, '\\Flagged', isFlagged, folder);
  });

  ipcMain.handle('move-email', (event, { emailId, category }) => {
    // Move is local category change only (for now)
    return db.updateEmailCategory(emailId, category, null, null, 0);
  });

  ipcMain.handle('update-email-smart-category', (event, { emailId, category, summary, reasoning, confidence }) => {
    return db.updateEmailSmartCategory(emailId, category, summary, reasoning, confidence);
  });

  ipcMain.handle('save-email', (event, email) => db.saveEmail(email));

  ipcMain.handle('get-categories', () => db.getCategories());
  ipcMain.handle('add-category', (event, name, type) => db.addCategory(name, type));
  ipcMain.handle('update-category-type', (event, name, type) => db.updateCategoryType(name, type));

  ipcMain.handle('delete-smart-category', (event, categoryName) => {
    return db.deleteSmartCategory(categoryName);
  });

  ipcMain.handle('rename-smart-category', (event, { oldName, newName }) => {
    return db.renameSmartCategory(oldName, newName);
  });

  // AI Settings safeStorage IPC handlers
  const AI_SETTINGS_FILE = path.join(app.getPath('userData'), 'ai-settings.encrypted');
  const AI_SETTINGS_FILE_PLAINTEXT = path.join(app.getPath('userData'), 'ai-settings.json');

  ipcMain.handle('ai-settings-save', async (event, settings) => {
    try {
      const settingsJson = JSON.stringify(settings);

      if (!safeStorage.isEncryptionAvailable()) {
        logger.warn('[IPC] safeStorage encryption is not available - falling back to plaintext storage');
        logger.warn('[IPC] WARNING: AI settings will be stored unencrypted. This is not recommended for production use.');
        fs.writeFileSync(AI_SETTINGS_FILE_PLAINTEXT, settingsJson);
        logger.debug('[IPC] AI settings saved successfully (plaintext fallback)');
        return { success: true, encrypted: false, warning: 'Settings stored unencrypted due to platform limitations' };
      }

      const encrypted = safeStorage.encryptString(settingsJson);
      fs.writeFileSync(AI_SETTINGS_FILE, encrypted);
      logger.debug('[IPC] AI settings saved successfully (encrypted)');
      return { success: true, encrypted: true };
    } catch (error) {
      logger.error('[IPC] Failed to save AI settings:', error);
      throw error;
    }
  });

  ipcMain.handle('ai-settings-load', async () => {
    try {
      // Check for plaintext fallback file first
      if (fs.existsSync(AI_SETTINGS_FILE_PLAINTEXT)) {
        logger.warn('[IPC] Loading AI settings from plaintext file (unencrypted)');
        const settingsJson = fs.readFileSync(AI_SETTINGS_FILE_PLAINTEXT, 'utf8');
        const settings = JSON.parse(settingsJson);
        logger.debug('[IPC] AI settings loaded successfully (plaintext)');
        return settings;
      }

      // Check for encrypted file
      if (!fs.existsSync(AI_SETTINGS_FILE)) {
        logger.debug('[IPC] No AI settings file found');
        return null;
      }

      if (!safeStorage.isEncryptionAvailable()) {
        logger.error('[IPC] safeStorage encryption is not available, but encrypted file exists');
        logger.error('[IPC] Cannot decrypt settings. Platform does not support encryption.');
        throw new Error('Encryption not available - cannot decrypt existing settings. Please set up platform keyring support.');
      }

      const encrypted = fs.readFileSync(AI_SETTINGS_FILE);
      const decrypted = safeStorage.decryptString(encrypted);
      const settings = JSON.parse(decrypted);
      logger.debug('[IPC] AI settings loaded successfully (encrypted)');
      return settings;
    } catch (error) {
      logger.error('[IPC] Failed to load AI settings:', error);
      throw error;
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
