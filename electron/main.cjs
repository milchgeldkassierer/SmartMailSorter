const { app, BrowserWindow, ipcMain, safeStorage, session } = require('electron');
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
const notifications = require('./notifications.cjs');
const { sanitizeFilename } = require('./utils/security.cjs');
const { createCspHeaderHandler } = require('./utils/csp-config.cjs');
const { TRASH_FOLDER } = require('./folderConstants.cjs');

const isDev = !app.isPackaged;

// Auto-sync state
let autoSyncTimer = null;
let autoSyncDebounceTimer = null;
let isSyncing = false;

function startAutoSync(intervalMinutes) {
  stopAutoSync();
  if (!intervalMinutes || intervalMinutes <= 0) {
    logger.info('[AutoSync] Auto-sync disabled');
    return;
  }
  const intervalMs = intervalMinutes * 60 * 1000;
  logger.info(`[AutoSync] Starting auto-sync with interval: ${intervalMinutes} minutes`);
  autoSyncTimer = setInterval(() => {
    runAutoSync().catch((err) => {
      logger.error('[AutoSync] Unexpected error during auto-sync:', err);
    });
  }, intervalMs);
}

function stopAutoSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
    logger.info('[AutoSync] Auto-sync timer stopped');
  }
}

async function runAutoSync() {
  if (isSyncing) {
    logger.info('[AutoSync] Sync already in progress, skipping');
    return;
  }
  isSyncing = true;
  logger.info('[AutoSync] Starting automatic sync for all accounts');
  try {
    const accounts = db.getAccounts();
    for (const account of accounts) {
      try {
        const accountWithPassword = db.getAccountWithPassword(account.id);
        if (accountWithPassword) {
          await imap.syncAccount(accountWithPassword);
        }
      } catch (error) {
        logger.error(`[AutoSync] Failed to sync account ${account.id}:`, error);
      }
    }
  } finally {
    isSyncing = false;
    // Notify all renderer windows (always, even on failure, so UI can recover)
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('auto-sync-completed');
      }
    }
    logger.info('[AutoSync] Automatic sync completed');
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
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

  // Configure Content Security Policy
  try {
    session.defaultSession.webRequest.onHeadersReceived(createCspHeaderHandler(isDev));
    logger.debug('Content Security Policy configured successfully');
  } catch (error) {
    logger.error('Failed to configure Content Security Policy:', error);
  }

  // IPC Handlers
  ipcMain.handle('get-accounts', () => db.getAccounts());

  ipcMain.handle('add-account', async (event, account) => {
    // Save account with encrypted password
    db.addAccount(account);

    // Retrieve account with decrypted password for IMAP operations
    const accountWithPassword = db.getAccountWithPassword(account.id);

    // Initial sync using the account from DB (ensures encrypted/decrypted flow)
    const syncResult = await imap.syncAccount(accountWithPassword);

    // Badge count is updated inside imap.syncAccount

    // Return account without password for safe frontend state management
    const { password, ...accountWithoutPassword } = accountWithPassword;
    return { ...syncResult, account: accountWithoutPassword };
  });

  ipcMain.handle('delete-account', (event, id) => {
    db.deleteAccountDn(id);
    // Update badge count after account deletion
    const unreadCount = db.getTotalUnreadEmailCount();
    notifications.updateBadgeCount(unreadCount);
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

  ipcMain.handle('sync-account', async (event, accountId) => {
    if (isSyncing) {
      return {
        success: false,
        error: 'SYNC_IN_PROGRESS',
        message: 'Eine Synchronisation läuft bereits. Bitte warten.',
      };
    }
    // Retrieve account with decrypted password for IMAP operations
    const accountWithPassword = db.getAccountWithPassword(accountId);
    if (!accountWithPassword) {
      logger.error(`[IPC sync-account] Account not found: ${accountId}`);
      return { success: false, error: 'Account not found' };
    }
    isSyncing = true;
    try {
      return await imap.syncAccount(accountWithPassword);
    } finally {
      isSyncing = false;
    }
  });

  ipcMain.handle('test-connection', async (event, account) => {
    // SECURITY NOTE: This handler receives plaintext password from renderer
    // This is an intentional exception for testing NEW accounts during setup
    // The password is NOT saved to database - only used transiently for IMAP test
    // After successful test, user adds account via add-account which encrypts the password
    return await imap.testConnection(account);
  });

  ipcMain.handle('reset-db', () => {
    if (isSyncing) {
      return {
        success: false,
        error: 'SYNC_IN_PROGRESS',
        message: 'Kann nicht zurücksetzen während eine Synchronisation läuft.',
      };
    }
    // Clear debounce timer to prevent stale restart after reset
    if (autoSyncDebounceTimer) {
      clearTimeout(autoSyncDebounceTimer);
      autoSyncDebounceTimer = null;
    }
    stopAutoSync();
    db.resetDb();
    return { success: true };
  });

  ipcMain.handle('delete-email', async (event, { accountId, emailId, uid, folder }) => {
    // Retrieve account with decrypted password for IMAP operations
    const accountWithPassword = db.getAccountWithPassword(accountId);
    if (!accountWithPassword) {
      logger.error(`[IPC delete-email] Account not found: ${accountId}`);
      return { success: false, error: 'Account not found' };
    }
    // Move to Trash on server (or permanently delete if already in Trash)
    const result = await imap.deleteEmail(accountWithPassword, uid, folder);
    if (result.success) {
      if (result.movedToTrash) {
        // Move to trash in DB instead of deleting
        db.updateEmailFolder(emailId, TRASH_FOLDER);
      } else {
        // Permanently deleted (was already in Trash or no Trash folder found)
        db.deleteEmail(emailId);
      }
    }
    return result;
  });

  ipcMain.handle('update-email-read', async (event, { accountId, emailId, uid, isRead, folder }) => {
    // Retrieve account with decrypted password for IMAP operations
    const accountWithPassword = db.getAccountWithPassword(accountId);
    if (!accountWithPassword) {
      logger.error(`[IPC update-email-read] Account not found: ${accountId}`);
      return { success: false, error: 'Account not found' };
    }
    // Update server FIRST
    const result = await imap.setEmailFlag(accountWithPassword, uid, '\\Seen', isRead, folder);
    // Only update DB if server update succeeded
    if (result.success) {
      db.updateEmailReadStatus(emailId, isRead);
      // Update badge count after read status change
      const unreadCount = db.getTotalUnreadEmailCount();
      notifications.updateBadgeCount(unreadCount);
    }
    return result;
  });

  ipcMain.handle('update-email-flag', async (event, { accountId, emailId, uid, isFlagged, folder }) => {
    // Retrieve account with decrypted password for IMAP operations
    const accountWithPassword = db.getAccountWithPassword(accountId);
    if (!accountWithPassword) {
      logger.error(`[IPC update-email-flag] Account not found: ${accountId}`);
      return { success: false, error: 'Account not found' };
    }
    // Update server FIRST
    const result = await imap.setEmailFlag(accountWithPassword, uid, '\\Flagged', isFlagged, folder);
    // Only update DB if server update succeeded
    if (result.success) {
      db.updateEmailFlagStatus(emailId, isFlagged);
    }
    return result;
  });

  ipcMain.handle('move-email', (event, { emailId, target, type }) => {
    if (type === 'folder') {
      return db.updateEmailFolder(emailId, target);
    }
    // Default: smart category move
    return db.updateEmailSmartCategory(emailId, target, null, null, 0);
  });

  ipcMain.handle('update-email-smart-category', (event, { emailId, category, summary, reasoning, confidence }) => {
    const result = db.updateEmailSmartCategory(emailId, category, summary, reasoning, confidence);
    // Show queued notification now that we have the AI category
    notifications.processPendingNotification(emailId, category);
    return result;
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

  // Advanced Search IPC handlers
  ipcMain.handle('search-emails', (event, query, accountId) => {
    const results = db.searchEmails(query, accountId);

    // Auto-record search history for non-empty queries
    if (query && query.trim()) {
      const crypto = require('crypto');
      const searchId = crypto.randomUUID();
      db.addSearchHistory(searchId, query.trim());
    }

    return results;
  });
  ipcMain.handle('get-filters', () => db.getSavedFilters());
  ipcMain.handle('save-filter', (event, id, name, query) => db.addSavedFilter(id, name, query));
  ipcMain.handle('delete-filter', (event, id) => db.deleteSavedFilter(id));
  ipcMain.handle('get-search-history', () => db.getSearchHistory());
  ipcMain.handle('save-search-history', (event, id, query) => db.addSearchHistory(id, query));
  ipcMain.handle('clear-search-history', () => db.clearSearchHistory());

  // AI Settings safeStorage IPC handlers
  const AI_SETTINGS_FILE = path.join(app.getPath('userData'), 'ai-settings.encrypted');
  const AI_SETTINGS_FILE_PLAINTEXT = path.join(app.getPath('userData'), 'ai-settings.json');

  ipcMain.handle('ai-settings-save', async (event, settings) => {
    try {
      // Basic input validation
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid settings: expected an object');
      }
      if (typeof settings.provider !== 'string' || typeof settings.model !== 'string') {
        throw new Error('Invalid settings: provider and model must be strings');
      }
      if (settings.apiKey !== undefined && typeof settings.apiKey !== 'string') {
        throw new Error('Invalid settings: apiKey must be a string');
      }

      const settingsJson = JSON.stringify(settings);

      if (!safeStorage.isEncryptionAvailable()) {
        logger.warn('[IPC] safeStorage encryption is not available - falling back to plaintext storage');
        logger.warn(
          '[IPC] WARNING: AI settings will be stored unencrypted. This is not recommended for production use.'
        );
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
      const hasEncryptedFile = fs.existsSync(AI_SETTINGS_FILE);
      const hasPlaintextFile = fs.existsSync(AI_SETTINGS_FILE_PLAINTEXT);

      // Prefer encrypted file when encryption is available
      if (hasEncryptedFile && safeStorage.isEncryptionAvailable()) {
        const encrypted = fs.readFileSync(AI_SETTINGS_FILE);
        const decrypted = safeStorage.decryptString(encrypted);
        const settings = JSON.parse(decrypted);
        logger.debug('[IPC] AI settings loaded successfully (encrypted)');
        // Clean up any stale plaintext file since we have encrypted data
        if (hasPlaintextFile) {
          logger.warn('[IPC] Removing stale plaintext settings file in favor of encrypted file');
          fs.unlinkSync(AI_SETTINGS_FILE_PLAINTEXT);
        }
        return settings;
      }

      // Encrypted file exists but encryption is unavailable
      if (hasEncryptedFile && !safeStorage.isEncryptionAvailable()) {
        // Fall through to plaintext if available, otherwise error
        if (!hasPlaintextFile) {
          logger.error('[IPC] safeStorage encryption is not available, but encrypted file exists');
          throw new Error(
            'Encryption not available - cannot decrypt existing settings. Please set up platform keyring support.'
          );
        }
      }

      // Fall back to plaintext file
      if (hasPlaintextFile) {
        logger.warn('[IPC] Loading AI settings from plaintext file (unencrypted)');
        const settingsJson = fs.readFileSync(AI_SETTINGS_FILE_PLAINTEXT, 'utf8');
        const settings = JSON.parse(settingsJson);
        logger.debug('[IPC] AI settings loaded successfully (plaintext)');
        return settings;
      }

      logger.debug('[IPC] No AI settings file found');
      return null;
    } catch (error) {
      logger.error('[IPC] Failed to load AI settings:', error);
      throw error;
    }
  });

  // Natural Language Search IPC handler
  ipcMain.handle('parse-natural-language-query', async (event, query) => {
    try {
      if (!query || typeof query !== 'string' || query.trim() === '') {
        return '';
      }

      // Load AI settings
      let settings = null;
      const hasEncryptedFile = fs.existsSync(AI_SETTINGS_FILE);
      const hasPlaintextFile = fs.existsSync(AI_SETTINGS_FILE_PLAINTEXT);

      if (hasEncryptedFile && safeStorage.isEncryptionAvailable()) {
        const encrypted = fs.readFileSync(AI_SETTINGS_FILE);
        const decrypted = safeStorage.decryptString(encrypted);
        settings = JSON.parse(decrypted);
      } else if (hasPlaintextFile) {
        const settingsJson = fs.readFileSync(AI_SETTINGS_FILE_PLAINTEXT, 'utf8');
        settings = JSON.parse(settingsJson);
      }

      if (!settings || !settings.apiKey) {
        throw new Error('AI settings not configured');
      }

      // Prepare the prompt
      const systemInstruction = `Du bist ein Such-Query-Übersetzer für ein Email-System.

Deine Aufgabe: Wandle natürlichsprachige deutsche Suchanfragen in strukturierte Such-Operatoren um.

VERFÜGBARE OPERATOREN:
- from:EMAIL_ODER_NAME - Suche nach Absender
- to:EMAIL_ODER_NAME - Suche nach Empfänger
- subject:TEXT - Suche im Betreff
- category:KATEGORIE - Suche in Kategorie (z.B. Rechnungen, Newsletter, Spam, Privat, Geschäftlich)
- has:attachment - Nur Emails mit Anhängen
- before:YYYY-MM-DD - Emails vor diesem Datum
- after:YYYY-MM-DD - Emails nach diesem Datum

REGELN:
1. Erkenne die Absicht des Benutzers und wähle die passenden Operatoren
2. Für Zeitangaben wie "letzter Monat", "diese Woche", berechne das entsprechende Datum (heute ist ${new Date().toISOString().split('T')[0]})
3. Wenn keine Operatoren passen, gib den Suchtext als Freitext zurück
4. Kombiniere mehrere Operatoren mit Leerzeichen
5. Verwende keine Anführungszeichen um Werte, es sei denn der Wert enthält Leerzeichen

BEISPIELE:
- "Rechnungen von letztem Monat" → "category:Rechnungen after:2026-01-01"
- "Emails von Amazon" → "from:amazon"
- "Newsletter mit Anhängen" → "category:Newsletter has:attachment"
- "Betreff Rechnung" → "subject:Rechnung"
- "vor Januar 2026" → "before:2026-01-01"
- "meeting notes" → "meeting notes" (kein Operator)

Antworte NUR mit dem JSON-Objekt mit dem "query" Feld.`;

      const userPrompt = `Wandle diese Suchanfrage um: "${query}"`;

      let result;

      // Call AI provider based on settings
      const providerLower = settings.provider.toLowerCase();
      if (providerLower.includes('gemini')) {
        // Google Gemini API
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userPrompt }] }],
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Formatted search query with operators',
                    },
                  },
                  required: ['query'],
                },
              },
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error('Failed to extract text from Gemini response');
        }

        // Clean markdown formatting
        const cleanText = text
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        result = JSON.parse(cleanText);
      } else if (providerLower.includes('openai')) {
        // OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify({
            model: settings.model,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('OpenAI returned empty response');
        }

        result = JSON.parse(content);
      } else if (providerLower.includes('anthropic')) {
        // Anthropic Claude API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: settings.model,
            max_tokens: 256,
            system: systemInstruction,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        const content = data.content?.[0]?.text;

        if (!content) {
          throw new Error('Anthropic returned empty response');
        }

        // Clean markdown formatting
        const cleanContent = content
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        result = JSON.parse(cleanContent);
      } else {
        throw new Error(`Unknown AI provider: ${settings.provider}`);
      }

      // Extract query from result
      if (result && typeof result === 'object' && 'query' in result) {
        logger.info(`[NL Search] Converted "${query}" to "${result.query}"`);
        return result.query || '';
      }

      return '';
    } catch (error) {
      logger.error('[NL Search] Failed to parse natural language query:', error);
      throw error;
    }
  });

  // Notification Settings IPC handlers
  // Load notification settings (global + all accounts)
  ipcMain.handle('load-notification-settings', async () => {
    const accounts = db.getAccounts();
    const accountSettings = {};

    // Load per-account settings
    accounts.forEach((account) => {
      const settings = db.getNotificationSettings(account.id);
      accountSettings[account.id] = settings.enabled;
    });

    // Load global settings from app_settings (not notification_settings, which has FK constraint)
    const globalEnabled = db.getSetting('notifications_enabled');
    const mutedCategories = notifications.getMutedCategories();

    // Build categorySettings with all known categories (true = enabled, false = muted)
    const allCategories = db.getCategories();
    const categorySettings = {};
    // Include smart/custom categories from DB
    allCategories.forEach((cat) => {
      categorySettings[cat.name] = true;
    });
    // Include system folders (not stored in categories table)
    ['Posteingang', 'Gesendet', 'Spam', 'Papierkorb'].forEach((name) => {
      categorySettings[name] = true;
    });
    // Mark muted categories as false
    if (Array.isArray(mutedCategories)) {
      mutedCategories.forEach((name) => {
        categorySettings[name] = false;
      });
    }

    return {
      enabled: globalEnabled !== '0',
      accountSettings,
      categorySettings,
    };
  });

  // Save notification settings (global + per-account)
  ipcMain.handle('save-notification-settings', async (_event, settings) => {
    // Convert categorySettings Record<string, boolean> to mutedCategories array
    const mutedCategories = Object.entries(settings.categorySettings || {})
      .filter(([, enabled]) => !enabled)
      .map(([name]) => name);

    // Save global enabled + category settings in app_settings (avoids FK constraint)
    db.setSetting('notifications_enabled', settings.enabled ? '1' : '0');
    db.setSetting('notifications_muted_categories', JSON.stringify(mutedCategories));

    // Save per-account settings
    for (const [accountId, enabled] of Object.entries(settings.accountSettings)) {
      db.saveNotificationSettings(accountId, {
        enabled,
        mutedCategories: [],
      });
    }

    return { success: true };
  });

  ipcMain.handle('update-badge-count', (event, count) => {
    return notifications.updateBadgeCount(count);
  });

  // Auto-sync IPC handlers
  const MIN_SYNC_INTERVAL = 2;
  const MAX_SYNC_INTERVAL = 30;
  function sanitizeSyncInterval(value) {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.max(MIN_SYNC_INTERVAL, Math.min(MAX_SYNC_INTERVAL, parsed));
  }

  ipcMain.handle('get-auto-sync-interval', () => {
    const value = db.getSetting('auto_sync_interval_minutes');
    return value ? sanitizeSyncInterval(value) : 0;
  });

  ipcMain.handle('set-auto-sync-interval', (event, intervalMinutes) => {
    const sanitized = sanitizeSyncInterval(intervalMinutes);
    db.setSetting('auto_sync_interval_minutes', String(sanitized));
    // Debounce timer restart so rapid +/- clicks don't spam restarts
    if (autoSyncDebounceTimer) clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = setTimeout(() => {
      autoSyncDebounceTimer = null;
      startAutoSync(sanitized);
    }, 800);
    return { success: true };
  });

  // Start auto-sync with persisted interval
  const savedInterval = db.getSetting('auto_sync_interval_minutes');
  if (savedInterval) {
    startAutoSync(sanitizeSyncInterval(savedInterval));
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Quit the app when all windows are closed, even on macOS
  app.quit();
});

app.on('before-quit', () => {
  logger.info('App is quitting, cleaning up resources...');
  if (autoSyncDebounceTimer) {
    clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = null;
  }
  stopAutoSync();
});

app.on('will-quit', () => {
  db.close();
});
