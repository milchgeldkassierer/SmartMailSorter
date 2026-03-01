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
const { LLMProviders } = require('./providerConstants.cjs');

const isDev = !app.isPackaged;

// Auto-sync state
let autoSyncTimer = null;
let autoSyncDebounceTimer = null;
let isSyncing = false;

/** Start the periodic auto-sync timer for all accounts. */
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

/** Stop the auto-sync timer if running. */
function stopAutoSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
    logger.info('[AutoSync] Auto-sync timer stopped');
  }
}

/** Run a single auto-sync cycle for all accounts with debounce protection. */
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

/** Create the main application BrowserWindow with IPC handlers. */
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
    return db.searchEmails(query, accountId);
  });
  ipcMain.handle('get-filters', () => db.getSavedFilters());
  ipcMain.handle('save-filter', (event, id, name, query) => {
    return db.upsertSavedFilter(id, name, query);
  });
  ipcMain.handle('delete-filter', (event, id) => db.deleteSavedFilter(id));
  ipcMain.handle('get-search-history', () => db.getSearchHistory());
  ipcMain.handle('save-search-history', (event, id, query) => db.addSearchHistory(id, query));
  ipcMain.handle('clear-search-history', () => db.clearSearchHistory());

  // AI Settings safeStorage IPC handlers
  const AI_SETTINGS_FILE = path.join(app.getPath('userData'), 'ai-settings.encrypted');
  const AI_SETTINGS_FILE_PLAINTEXT = path.join(app.getPath('userData'), 'ai-settings.json');
  const OLLAMA_BASE_URL = 'http://localhost:11434';

  ipcMain.handle('ai-settings-save', async (event, settings) => {
    try {
      // Basic input validation
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid settings: expected an object');
      }
      if (typeof settings.provider !== 'string' || typeof settings.model !== 'string') {
        throw new Error('Invalid settings: provider and model must be strings');
      }
      settings.provider = settings.provider.trim();
      settings.model = settings.model.trim();
      if (!settings.provider || !settings.model) {
        throw new Error('Invalid settings: provider and model must be non-empty strings');
      }
      const allowedProviders = Object.values(LLMProviders);
      if (!allowedProviders.includes(settings.provider)) {
        throw new Error(`Invalid settings: unknown provider "${settings.provider}". Allowed: ${allowedProviders.join(', ')}`);
      }
      if (settings.apiKey !== undefined && typeof settings.apiKey !== 'string') {
        throw new Error('Invalid settings: apiKey must be a string');
      }
      if (settings.apiKey) settings.apiKey = settings.apiKey.trim();

      // Validate API key with a lightweight test call (only if settings changed)
      const isOllama = settings.provider === LLMProviders.OLLAMA;
      if (!isOllama && !settings.apiKey) {
        throw new Error(`Missing API key for ${settings.provider}`);
      }
      if (!isOllama && settings.apiKey) {
        let existingSettings = null;
        try {
          existingSettings = loadAISettings();
        } catch (e) {
          logger.warn('[IPC] Could not load existing settings for comparison:', e.message);
        }
        const needsValidation =
          !existingSettings ||
          existingSettings.apiKey !== settings.apiKey ||
          existingSettings.provider !== settings.provider ||
          existingSettings.model !== settings.model;
        if (needsValidation) {
          try {
            await callAIProvider(settings, 'Reply with exactly: {"ok":true}', 'Test');
            logger.info('[IPC] AI API key validated successfully');
          } catch (validationError) {
            const msg = validationError instanceof Error ? validationError.message : String(validationError);
            const msgLower = msg.toLowerCase();
            if (
              msg.includes('401') ||
              msg.includes('403') ||
              msgLower.includes('api key not valid') ||
              msgLower.includes('incorrect api key')
            ) {
              throw new Error(`Invalid API key for ${settings.provider}: Authentication failed`);
            }
            // Other errors (network, rate limit) are not key-related - allow save
            logger.warn('[IPC] API key validation skipped due to non-auth error:', msg);
          }
        } else {
          logger.info('[IPC] Settings unchanged, skipping validation');
        }
      }

      const sanitized = { provider: settings.provider, model: settings.model, apiKey: settings.apiKey };
      const settingsJson = JSON.stringify(sanitized);

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

  ipcMain.handle('ollama-detect', async () => {
    try {
      logger.debug('[Ollama] Detecting running Ollama instance...');
      const response = await fetchWithTimeout(
        OLLAMA_BASE_URL + '/api/tags',
        {
          method: 'GET',
        },
        5000
      );

      if (!response.ok) {
        logger.warn(`[Ollama] API returned status ${response.status}`);
        return { available: false, models: [] };
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.models)) {
        logger.warn('[Ollama] Unexpected response shape from /api/tags:', JSON.stringify(data).slice(0, 200));
        return { available: true, models: [] };
      }
      const models = data.models
        .filter((m) => typeof m?.name === 'string' && m.name.trim().length > 0)
        .map((m) => m.name.trim());
      if (models.length !== data.models.length) {
        logger.warn(`[Ollama] Filtered out ${data.models.length - models.length} models with invalid names`);
      }
      logger.info(`[Ollama] Detected ${models.length} available models: ${models.join(', ')}`);
      return { available: true, models };
    } catch (error) {
      logger.debug('[Ollama] Ollama not available:', error.message);
      return { available: false, models: [] };
    }
  });

  // --- AI Provider Helpers ---

  /** Fetch with AbortController timeout to prevent hung UI */
  function fetchWithTimeout(url, options, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .catch((err) => {
        if (err.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
        throw err;
      })
      .finally(() => clearTimeout(timer));
  }

  /** Load AI settings from encrypted or plaintext file */
  function loadAISettings() {
    const hasEncryptedFile = fs.existsSync(AI_SETTINGS_FILE);
    const hasPlaintextFile = fs.existsSync(AI_SETTINGS_FILE_PLAINTEXT);

    if (hasEncryptedFile && safeStorage.isEncryptionAvailable()) {
      const encrypted = fs.readFileSync(AI_SETTINGS_FILE);
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted);
    }
    if (hasPlaintextFile) {
      return JSON.parse(fs.readFileSync(AI_SETTINGS_FILE_PLAINTEXT, 'utf8'));
    }
    return null;
  }

  /** Load AI settings and validate they are configured (throws if not) */
  function loadAndValidateAISettings() {
    const settings = loadAISettings();
    if (!settings) {
      throw new Error('AI settings not configured');
    }
    if (typeof settings.provider !== 'string' || !settings.provider.trim()) {
      throw new Error('AI settings must include a valid provider');
    }
    settings.provider = settings.provider.trim();
    const allowedProviders = Object.values(LLMProviders);
    if (!allowedProviders.includes(settings.provider)) {
      throw new Error(`Invalid provider "${settings.provider}". Allowed: ${allowedProviders.join(', ')}`);
    }
    if (typeof settings.model !== 'string' || !settings.model.trim()) {
      throw new Error('AI settings must include a valid model');
    }
    settings.model = settings.model.trim();
    const isOllama = settings.provider === LLMProviders.OLLAMA;
    if (settings.apiKey) settings.apiKey = settings.apiKey.trim();
    if (!isOllama && !settings.apiKey) {
      throw new Error(`Missing API key for ${settings.provider}`);
    }
    return settings;
  }

  /** Clean markdown code fences from AI response text */
  function cleanMarkdown(text) {
    return text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
  }

  /** Call Google Gemini API and return parsed JSON.
   *  NOTE: This function is only used for NL search queries via the parse-natural-language-query
   *  IPC handler. The responseSchema is hardcoded to the search-query format. For email
   *  categorization, Gemini is called directly from the renderer via the Google GenAI SDK. */
  async function callGeminiApi(settings, systemInstruction, userPrompt) {
    if (!/^[a-zA-Z0-9._-]+$/.test(settings.model)) throw new Error('Invalid model name');
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: { query: { type: 'string', description: 'Formatted search query with operators' } },
              required: ['query'],
            },
          },
        }),
      }
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorBody.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Failed to extract text from Gemini response');
    return JSON.parse(cleanMarkdown(text));
  }

  /** Call OpenAI API and return parsed JSON */
  async function callOpenAIApi(settings, systemInstruction, userPrompt, jsonSchema) {
    const responseFormat = jsonSchema
      ? { type: 'json_schema', json_schema: { name: 'response', strict: true, schema: jsonSchema } }
      : { type: 'json_object' };
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        response_format: responseFormat,
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody.slice(0, 200)}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty response');
    return JSON.parse(content);
  }

  /** Call Anthropic Claude API and return parsed JSON */
  async function callAnthropicApi(settings, systemInstruction, userPrompt, jsonSchema) {
    const system = jsonSchema
      ? `${systemInstruction}\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`
      : systemInstruction;
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 4096,
        system: system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorBody.slice(0, 200)}`);
    }
    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) throw new Error('Anthropic returned empty response');
    return JSON.parse(cleanMarkdown(content));
  }

  /** Call Ollama local API and return parsed JSON */
  async function callOllamaApi(settings, systemInstruction, userPrompt, jsonSchema) {
    let response;
    try {
      response = await fetchWithTimeout(
        OLLAMA_BASE_URL + '/api/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.model,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userPrompt },
            ],
            stream: false,
            format: jsonSchema || 'json',
          }),
        },
        120000
      );
    } catch (err) {
      if (err.message && err.message.includes('timed out')) {
        throw new Error(`Ollama request timed out after 120s. Try a smaller model or ensure Ollama is fully loaded.`);
      }
      throw err;
    }
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorBody.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = data.message?.content;
    if (!text) throw new Error('Failed to extract text from Ollama response');
    try {
      return JSON.parse(cleanMarkdown(text));
    } catch (e) {
      throw new Error(`Ollama returned invalid JSON: ${text.slice(0, 200)}`);
    }
  }

  /**
   * Normalize a Gemini SDK schema to standard JSON Schema.
   * Gemini uses uppercase type names (STRING, OBJECT, ARRAY, etc.);
   * JSON Schema and all other providers require lowercase.
   */
  function normalizeJsonSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;
    const out = Array.isArray(schema) ? [] : {};
    for (const [key, value] of Object.entries(schema)) {
      if (key === 'type' && typeof value === 'string') {
        out[key] = value.toLowerCase();
      } else if (typeof value === 'object' && value !== null) {
        out[key] = normalizeJsonSchema(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  /** Route to the correct AI provider based on settings */
  async function callAIProvider(settings, systemInstruction, userPrompt, jsonSchema) {
    const normalizedSchema = jsonSchema ? normalizeJsonSchema(jsonSchema) : null;
    switch (settings.provider) {
      case LLMProviders.GEMINI:
        if (normalizedSchema) {
          throw new Error('Gemini provider does not support custom JSON schemas via IPC. Gemini categorization uses the renderer SDK.');
        }
        return callGeminiApi(settings, systemInstruction, userPrompt);
      case LLMProviders.OPENAI:
        return callOpenAIApi(settings, systemInstruction, userPrompt, normalizedSchema);
      case LLMProviders.ANTHROPIC:
        return callAnthropicApi(settings, systemInstruction, userPrompt, normalizedSchema);
      case LLMProviders.OLLAMA:
        return callOllamaApi(settings, systemInstruction, userPrompt, normalizedSchema);
      default:
        throw new Error(`Unknown AI provider: ${settings.provider}`);
    }
  }

  // Natural Language Search IPC handler
  ipcMain.handle('parse-natural-language-query', async (event, query) => {
    try {
      if (!query || typeof query !== 'string' || query.trim() === '') {
        return '';
      }
      if (query.length > 500) {
        throw new Error('Search query too long (max 500 characters)');
      }

      const settings = loadAndValidateAISettings();

      const systemInstruction = `Du bist ein Such-Query-Übersetzer für ein Email-System.

Deine Aufgabe: Wandle natürlichsprachige deutsche Suchanfragen in strukturierte Such-Operatoren um.

VERFÜGBARE OPERATOREN:
- from:EMAIL_ODER_NAME - Suche nach Absender
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
      const result = await callAIProvider(settings, systemInstruction, userPrompt);

      if (result && typeof result === 'object' && 'query' in result) {
        logger.info('[NL Search] Query converted successfully');
        return result.query || '';
      }

      return '';
    } catch (error) {
      logger.error('[NL Search] Failed to parse natural language query:', error);
      throw new Error('AI query conversion failed');
    }
  });

  // Generic AI call handler - routes through main process to avoid CORS issues
  ipcMain.handle('ai-call', async (event, args) => {
    if (!args || typeof args !== 'object') throw new Error('Invalid ai-call payload: expected an object');
    const { systemInstruction, userPrompt, jsonSchema } = args;
    if (!systemInstruction || typeof systemInstruction !== 'string' || !systemInstruction.trim())
      throw new Error('Invalid systemInstruction');
    if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) throw new Error('Invalid userPrompt');
    if (systemInstruction.length > 10000) throw new Error('systemInstruction too long (max 10000 characters)');
    if (userPrompt.length > 200000) throw new Error('userPrompt too long (max 200000 characters)');
    if (jsonSchema !== undefined && (typeof jsonSchema !== 'object' || jsonSchema === null))
      throw new Error('Invalid jsonSchema: expected an object');

    const settings = loadAndValidateAISettings();
    return await callAIProvider(settings, systemInstruction, userPrompt, jsonSchema || null);
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
  /** Clamp sync interval to valid range (1-30 minutes). */
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
