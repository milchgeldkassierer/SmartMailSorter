const Database = require('better-sqlite3');
const path = require('path');
const { INBOX_FOLDER } = require('./folderConstants.cjs');
const logger = require('./utils/logger.cjs');
const { encryptPassword, decryptPassword } = require('./utils/security.cjs');
// Electron import moved to lazy usage or injection

const DEFAULT_DB_NAME = 'smartmail.db';
let db;

function createSchema() {
  if (!db) return;
  // Create Accounts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      provider TEXT,
      imapHost TEXT,
      imapPort INTEGER,
      username TEXT,
      password TEXT, -- Note: In a real production app, use safeStorage (Electron)
      color TEXT,
      lastSyncUid INTEGER DEFAULT 0,
      storageUsed INTEGER DEFAULT 0,
      storageTotal INTEGER DEFAULT 0,
      lastSyncTime INTEGER DEFAULT NULL
    )
  `);

  // Migration for existing users (naive column addition)
  try {
    db.exec('ALTER TABLE accounts ADD COLUMN storageUsed INTEGER DEFAULT 0');
  } catch (_e) {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE accounts ADD COLUMN storageTotal INTEGER DEFAULT 0');
  } catch (_e) {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE accounts ADD COLUMN lastSyncTime INTEGER DEFAULT NULL');
  } catch (_e) {
    // Column already exists
  }

  // Create Emails Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      accountId TEXT,
      sender TEXT,
      senderEmail TEXT,
      subject TEXT,
      body TEXT,           -- Plain Text
      bodyHtml TEXT,       -- HTML Content
      date TEXT,
      folder TEXT DEFAULT '${INBOX_FOLDER}',  -- Physical Folder (Posteingang, Gesendet, etc.)
      smartCategory TEXT,                 -- Virtual AI Category (Rechnungen, Privat, etc.)
      isRead INTEGER,
      isFlagged INTEGER,
      hasAttachments INTEGER DEFAULT 0,
      aiSummary TEXT,
      aiReasoning TEXT,
      confidence REAL,
      uid INTEGER,
      FOREIGN KEY(accountId) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // Create Attachments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      emailId TEXT,
      filename TEXT,
      contentType TEXT,
      size INTEGER,
      data BLOB,
      FOREIGN KEY(emailId) REFERENCES emails(id) ON DELETE CASCADE
    )
  `);

  // Migrations for existing tables
  try {
    db.exec('ALTER TABLE emails ADD COLUMN bodyHtml TEXT');
  } catch (_e) {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE emails ADD COLUMN hasAttachments INTEGER DEFAULT 0');
  } catch (_e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE emails ADD COLUMN folder TEXT DEFAULT '${INBOX_FOLDER}'`);
  } catch (_e) {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE emails ADD COLUMN smartCategory TEXT');
  } catch (_e) {
    // Column already exists
  }
  // Create Categories Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY,
      type TEXT DEFAULT 'custom', -- 'system' or 'custom'
      icon TEXT
    )
  `);

  // Seed Defaults if empty
  const count = db.prepare('SELECT count(*) as c FROM categories').get().c;
  if (count === 0) {
    const defaults = [
      { name: 'Rechnungen', type: 'system' },
      { name: 'Newsletter', type: 'system' },
      { name: 'Privat', type: 'system' },
      { name: 'Geschäftlich', type: 'system' },
      { name: 'Kündigungen', type: 'system' },
      { name: 'Sonstiges', type: 'system' },
    ];
    const insert = db.prepare('INSERT INTO categories (name, type) VALUES (@name, @type)');
    defaults.forEach((cat) => insert.run(cat));
  }

  // SYNC/MIGRATION: Ensure categories used in emails (custom folders) exist in the categories table
  // This restores categories that might have been created before the categories table existed.
  try {
    const usedCategories = db
      .prepare('SELECT DISTINCT smartCategory FROM emails WHERE smartCategory IS NOT NULL AND smartCategory != ?')
      .all('');
    const insertIgnore = db.prepare(
      "INSERT OR IGNORE INTO categories (name, type, icon) VALUES (?, 'custom', 'folder-outline')"
    );

    usedCategories.forEach((row) => {
      insertIgnore.run(row.smartCategory);
    });
  } catch (e) {
    logger.error('Failed to sync categories from emails:', e);
  }

  // Create Notification Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      accountId TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      mutedCategories TEXT DEFAULT '[]',
      FOREIGN KEY(accountId) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);
}

function migratePasswordEncryption() {
  if (!db) return;

  try {
    // Check if encryption is available before attempting migration
    const { safeStorage } = require('electron');
    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('Password encryption migration skipped: safeStorage not available on this system');
      return;
    }
  } catch (_error) {
    logger.warn('Password encryption migration skipped: Electron safeStorage not available');
    return;
  }

  logger.info('Starting password encryption migration...');

  const migrationTransaction = db.transaction(() => {
    // Select all accounts
    const accounts = db.prepare('SELECT id, password FROM accounts').all();

    if (accounts.length === 0) {
      logger.info('No accounts to migrate');
      return;
    }

    const updateStmt = db.prepare('UPDATE accounts SET password = ? WHERE id = ?');
    let migratedCount = 0;
    let alreadyEncryptedCount = 0;

    for (const account of accounts) {
      if (!account.password) {
        continue;
      }

      try {
        // Check if password is already encrypted by attempting to decrypt
        // Encrypted passwords are stored as base64-encoded buffers
        const passwordBuffer = Buffer.from(account.password, 'base64');
        decryptPassword(passwordBuffer);

        // If decryption succeeded, password is already encrypted
        alreadyEncryptedCount++;
      } catch (_decryptError) {
        // Decryption failed, so password is plaintext - encrypt it
        try {
          const encryptedBuffer = encryptPassword(account.password);
          const encryptedBase64 = encryptedBuffer.toString('base64');
          updateStmt.run(encryptedBase64, account.id);
          migratedCount++;
        } catch (encryptError) {
          logger.error(`Failed to encrypt password for account ${account.id}:`, encryptError);
          throw encryptError; // Rollback transaction
        }
      }
    }

    logger.info(`Password migration complete: ${migratedCount} encrypted, ${alreadyEncryptedCount} already encrypted`);
  });

  try {
    migrationTransaction();
  } catch (error) {
    logger.error('Password encryption migration failed - transaction rolled back:', error);
  }
}

function init(appOrPath) {
  // Close existing database if reinitializing (for tests)
  if (db && typeof appOrPath === 'string' && appOrPath === ':memory:') {
    try {
      db.close();
    } catch (_e) {
      // Ignore close errors
    }
    db = null;
  }

  if (!db) {
    let fullPath;
    if (typeof appOrPath === 'string') {
      fullPath = appOrPath;
    } else if (appOrPath && appOrPath.getPath) {
      fullPath = path.join(appOrPath.getPath('userData'), DEFAULT_DB_NAME);
    } else {
      try {
        const { app } = require('electron');
        fullPath = path.join(app.getPath('userData'), DEFAULT_DB_NAME);
      } catch (_e) {
        fullPath = DEFAULT_DB_NAME;
      }
    }
    db = new Database(fullPath);
  }
  createSchema();
  migratePasswordEncryption();
}

// Account Methods
function getAccounts() {
  return db
    .prepare(
      `SELECT
        id, name, email, provider, imapHost, imapPort, username,
        color, lastSyncUid, storageUsed, storageTotal, lastSyncTime
      FROM accounts`
    )
    .all();
}

function getAccountWithPassword(accountId) {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);

  if (!account) {
    return undefined;
  }

  // Decrypt password if it exists
  if (account.password) {
    try {
      // Check if encryption is available before attempting to decrypt
      const { safeStorage } = require('electron');
      if (safeStorage.isEncryptionAvailable()) {
        const passwordBuffer = Buffer.from(account.password, 'base64');
        account.password = decryptPassword(passwordBuffer);
      }
      // If encryption not available, password is already plaintext (test environment)
    } catch (_error) {
      // If decryption fails, password might already be plaintext (test environment)
      // or this is a legacy account - use as-is
      logger.warn(`Failed to decrypt password for account ${accountId}, using as-is`);
    }
  }

  return account;
}

function addAccount(account) {
  // Encrypt password before saving
  let encryptedPassword = account.password;
  if (account.password) {
    try {
      // Check if encryption is available before attempting to encrypt
      const { safeStorage } = require('electron');
      if (safeStorage.isEncryptionAvailable()) {
        const encryptedBuffer = encryptPassword(account.password);
        encryptedPassword = encryptedBuffer.toString('base64');
      } else {
        logger.warn('Password encryption not available - storing password without encryption');
      }
    } catch (_error) {
      // If Electron safeStorage is not available (e.g., in tests), store plaintext
      logger.warn('Password encryption not available - storing password without encryption');
    }
  }

  const stmt = db.prepare(`
    INSERT INTO accounts (id, name, email, provider, imapHost, imapPort, username, password, color)
    VALUES (@id, @name, @email, @provider, @imapHost, @imapPort, @username, @password, @color)
  `);
  return stmt.run({
    ...account,
    password: encryptedPassword,
  });
}

function updateAccountSync(id, lastSyncUid, lastSyncTime) {
  const stmt = db.prepare('UPDATE accounts SET lastSyncUid = ?, lastSyncTime = ? WHERE id = ?');
  return stmt.run(lastSyncUid, lastSyncTime, id);
}

function updateAccountQuota(id, used, total) {
  const stmt = db.prepare('UPDATE accounts SET storageUsed = ?, storageTotal = ? WHERE id = ?');
  return stmt.run(used, total, id);
}

function deleteAccountDn(id) {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}

// Email Methods
function getEmails(accountId) {
  // OPTIMIZATION: Do NOT select body or bodyHtml (too large for list view)
  const emails = db
    .prepare(
      `
    SELECT 
      id, accountId, sender, senderEmail, subject, date, 
      folder, smartCategory, isRead, isFlagged, hasAttachments, 
      aiSummary, aiReasoning, confidence, uid 
    FROM emails 
    WHERE accountId = ? 
    ORDER BY date DESC
  `
    )
    .all(accountId);

  return emails.map((email) => ({
    ...email,
    isRead: Boolean(email.isRead),
    isFlagged: Boolean(email.isFlagged),
    hasAttachments: Boolean(email.hasAttachments),
  }));
}

function getEmailContent(emailId) {
  return db.prepare('SELECT body, bodyHtml FROM emails WHERE id = ?').get(emailId);
}

function getEmailAttachments(emailId) {
  return db.prepare('SELECT id, filename, contentType, size FROM attachments WHERE emailId = ?').all(emailId);
}

function getAttachment(id) {
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
}

const crypto = require('crypto');

function saveEmail(email) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO emails (
      id, accountId, sender, senderEmail, subject, body, bodyHtml, date, 
      folder, smartCategory, isRead, isFlagged, hasAttachments, aiSummary, aiReasoning, confidence, uid
    ) VALUES (
      :id, :accountId, :sender, :senderEmail, :subject, :body, :bodyHtml, :date,
      :folder, :smartCategory, :isRead, :isFlagged, :hasAttachments, :aiSummary, :aiReasoning, :confidence, :uid
    )
  `);

  const result = stmt.run({
    id: email.id,
    accountId: email.accountId,
    sender: email.sender || 'Unknown',
    senderEmail: email.senderEmail || '',
    subject: email.subject || '(No Subject)',
    body: email.body || '',
    bodyHtml: email.bodyHtml || null,
    date: email.date || new Date().toISOString(),
    folder: email.folder || INBOX_FOLDER,
    smartCategory: email.smartCategory || null,
    isRead: email.isRead ? 1 : 0,
    isFlagged: email.isFlagged ? 1 : 0,
    hasAttachments: email.hasAttachments ? 1 : 0,
    aiSummary: email.aiSummary || null,
    aiReasoning: email.aiReasoning || null,
    confidence: email.confidence || 0,
    uid: email.uid || 0,
  });

  // Save Attachments if present
  if (email.attachments && email.attachments.length > 0) {
    const insertAttach = db.prepare(`
        INSERT OR REPLACE INTO attachments (id, emailId, filename, contentType, size, data)
        VALUES (@id, @emailId, @filename, @contentType, @size, @data)
      `);

    for (const att of email.attachments) {
      insertAttach.run({
        id: att.id || crypto.randomUUID(),
        emailId: email.id,
        filename: att.filename || 'unnamed',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        data: att.data || null, // Buffer
      });
    }
  }

  return result;
}

function updateEmailSmartCategory(id, smartCategory, aiSummary, aiReasoning, confidence) {
  const stmt = db.prepare(`
        UPDATE emails 
        SET smartCategory = @smartCategory, aiSummary = @aiSummary, aiReasoning = @aiReasoning, confidence = @confidence
        WHERE id = @id
    `);
  return stmt.run({ id, smartCategory, aiSummary, aiReasoning, confidence });
}

function deleteEmail(id) {
  db.prepare('DELETE FROM emails WHERE id = ?').run(id);
}

function deleteEmailsByUid(accountId, folder, uids) {
  if (!uids || uids.length === 0) return 0;
  const deleteStmt = db.prepare('DELETE FROM emails WHERE accountId = ? AND folder = ? AND uid = ?');

  // Transaction for performance
  const deleteMany = db.transaction((ids) => {
    let count = 0;
    for (const uid of ids) {
      count += deleteStmt.run(accountId, folder, uid).changes;
    }
    return count;
  });

  return deleteMany(uids);
}

function updateEmailReadStatus(id, isRead) {
  const stmt = db.prepare('UPDATE emails SET isRead = ? WHERE id = ?');
  return stmt.run(isRead ? 1 : 0, id);
}

function updateEmailFlagStatus(id, isFlagged) {
  const stmt = db.prepare('UPDATE emails SET isFlagged = ? WHERE id = ?');
  return stmt.run(isFlagged ? 1 : 0, id);
}

function resetDb() {
  db.exec('DROP TABLE IF EXISTS emails');
  db.exec('DROP TABLE IF EXISTS accounts');
  createSchema(); // Re-create tables immediately
}

// --- Category Methods ---

function _getCategories() {
  return db
    .prepare('SELECT name FROM categories ORDER BY name ASC')
    .all()
    .map((c) => c.name);
}

function _addCategory(name) {
  try {
    const stmt = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)');
    stmt.run(name, 'custom');
    return true;
  } catch (_e) {
    // Ignore duplicates
    return false;
  }
}

function deleteSmartCategory(categoryName) {
  logger.info(`[DB] Deleting category "${categoryName}"`);

  // 1. Remove from categories table
  const delStmt = db.prepare('DELETE FROM categories WHERE name = ?');
  delStmt.run(categoryName);

  // 2. Untag emails
  const stmt = db.prepare('UPDATE emails SET smartCategory = NULL WHERE smartCategory = ?');
  const info = stmt.run(categoryName);

  logger.info(`[DB] Deleted category. Emails affected: ${info.changes}`);
  return { success: true, changes: info.changes };
}

function renameSmartCategory(oldName, newName) {
  logger.info(`[DB] Renaming category from "${oldName}" to "${newName}"`);

  // Transaction to ensure consistency
  const transaction = db.transaction(() => {
    // 1. Create new category
    try {
      db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)').run(newName, 'custom');
    } catch (_e) {} // Exists? ignore

    // 2. Update emails
    db.prepare('UPDATE emails SET smartCategory = ? WHERE smartCategory = ?').run(newName, oldName);

    // 3. Delete old category
    db.prepare('DELETE FROM categories WHERE name = ?').run(oldName);
  });

  transaction();
  return { success: true };
}

function close() {
  if (db) {
    try {
      db.close();
    } catch (_e) {
      // Ignore close errors
    }
    db = null;
  }
}

// --- Notification Settings Methods ---

function getNotificationSettings(accountId) {
  const settings = db.prepare('SELECT enabled, mutedCategories FROM notification_settings WHERE accountId = ?').get(accountId);

  if (!settings) {
    // Return defaults if no settings exist yet
    return {
      enabled: true,
      mutedCategories: [],
    };
  }

  let mutedCategories = [];
  try {
    mutedCategories = JSON.parse(settings.mutedCategories || '[]');
    if (!Array.isArray(mutedCategories)) {
      mutedCategories = [];
    }
  } catch (_e) {
    // Fallback to empty array if stored value is corrupted
  }

  return {
    enabled: Boolean(settings.enabled),
    mutedCategories,
  };
}

function saveNotificationSettings(accountId, settings) {
  const mutedCategoriesJson = JSON.stringify(settings.mutedCategories || []);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO notification_settings (accountId, enabled, mutedCategories)
    VALUES (?, ?, ?)
  `);
  return stmt.run(accountId, settings.enabled ? 1 : 0, mutedCategoriesJson);
}

function getUnreadEmailCount(accountId) {
  const result = db
    .prepare('SELECT COUNT(*) as count FROM emails WHERE accountId = ? AND isRead = 0')
    .get(accountId);
  return result ? result.count : 0;
}

function getTotalUnreadEmailCount() {
  const result = db
    .prepare('SELECT COUNT(*) as count FROM emails WHERE isRead = 0')
    .get();
  return result ? result.count : 0;
}

module.exports = {
  init,
  close,
  getAccounts,
  getAccountWithPassword,
  addAccount,
  updateAccountSync,
  getEmails,
  getEmailContent,
  saveEmail,
  deleteAccountDn,
  updateEmailSmartCategory,
  updateAccountQuota,
  deleteEmail,
  deleteEmailsByUid,
  updateEmailReadStatus,
  updateEmailFlagStatus,
  getEmailAttachments,
  getAttachment,
  getUnreadEmailCount,
  getTotalUnreadEmailCount,

  // New Category Methods
  getCategories: () => db.prepare('SELECT name, type FROM categories ORDER BY name').all(),
  addCategory: (name, type = 'custom') => {
    try {
      const stmt = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)');
      const info = stmt.run(name, type);
      return { success: true, changes: info.changes };
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // If it exists, we might want to ensure the type is correct?
        // For now, ignore. App.tsx will call updateCategoryType if needed.
        return { success: true, changes: 0 };
      }
      throw err;
    }
  },
  updateCategoryType: (name, newType) => {
    const stmt = db.prepare('UPDATE categories SET type = ? WHERE name = ?');
    const info = stmt.run(newType, name);
    return { success: true, changes: info.changes };
  },
  deleteSmartCategory,
  renameSmartCategory,
  getMaxUidForFolder: (accountId, folder) => {
    const stmt = db.prepare('SELECT MAX(uid) as maxUid FROM emails WHERE accountId = ? AND folder = ?');
    const res = stmt.get(accountId, folder);
    return res ? res.maxUid || 0 : 0;
  },
  getAllUidsForFolder: (accountId, folder) => {
    const stmt = db.prepare('SELECT uid FROM emails WHERE accountId = ? AND folder = ?');
    return stmt.all(accountId, folder).map((r) => r.uid);
  },
  migrateFolder,
  resetDb,

  // Notification Settings Methods
  getNotificationSettings,
  saveNotificationSettings,
};

function migrateFolder(oldName, newName) {
  const updateEmails = db.prepare('UPDATE emails SET folder = ? WHERE folder = ?');
  // Also update category if it exists as a "Smart Category" (which we treated physical folders as)
  const updateCategory = db.prepare('UPDATE categories SET name = ? WHERE name = ?');

  const transaction = db.transaction(() => {
    // 1. Update emails physical folder
    const info = updateEmails.run(newName, oldName);
    if (info.changes > 0) {
      logger.info(`[DB] Migrated ${info.changes} emails from ${oldName} to ${newName}`);
    }

    // 2. Update category name if present
    try {
      updateCategory.run(newName, oldName);
    } catch (err) {
      // If target category exists, just delete old one
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        db.prepare('DELETE FROM categories WHERE name = ?').run(oldName);
      }
    }
  });
  return transaction();
}
