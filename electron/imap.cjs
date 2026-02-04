const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;
const {
  saveEmail,
  updateAccountSync: _updateAccountSync,
  updateAccountQuota,
  migrateFolder: _migrateFolder,
  getMaxUidForFolder: _getMaxUidForFolder,
  getAllUidsForFolder: _getAllUidsForFolder,
  deleteEmailsByUid: _deleteEmailsByUid,
} = require('./db.cjs');
// Add db just for direct calls if needed, though we imported migrateFolder directly
const db = require('./db.cjs');
const {
  INBOX_FOLDER,
  SENT_FOLDER,
  SPAM_FOLDER,
  TRASH_FOLDER,
} = require('./folderConstants.cjs');

console.log('IMAP Module Loaded: Version LargeScaleSync_v1');

// Provider presets
const PROVIDERS = {
  gmx: {
    host: 'imap.gmx.net',
    port: 993,
    secure: true,
  },
  webde: {
    host: 'imap.web.de',
    port: 993,
    secure: true,
  },
  gmail: {
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
  },
};

/**
 * Factory function to create a configured ImapFlow client
 * @param {Object} account - Account configuration object
 * @returns {ImapFlow} Configured IMAP client
 */
function createImapClient(account) {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: true,
    auth: {
      user: account.username || account.email,
      pass: account.password,
    },
    logger: false,
  });
}

/**
 * Maps a server folder (box) to its DB name
 *
 * Behavior note: Uses box.name (leaf name) for matching special folder types like
 * 'sent', 'trash', 'junk'. This means INBOX subfolders like 'INBOX.Sent' are recognized
 * as special folders and mapped to 'Gesendet' (via name matching on 'Sent') rather than
 * 'Posteingang/Sent' (via INBOX subfolder handling). This behavior aligns with how
 * deleteEmail/setEmailFlag historically worked and provides more accurate folder detection.
 *
 * @param {Object} box - The mailbox object from client.list()
 * @param {string} box.path - Full path of the mailbox
 * @param {string} [box.name] - Leaf name of the mailbox (used for type matching)
 * @param {string} [box.specialUse] - Special use flag (e.g., '\\Sent')
 * @param {string} [box.delimiter] - Path delimiter (default: '/')
 * @returns {string} The mapped DB folder name
 */
function mapServerFolderToDbName(box) {
  const fullPath = box.path;
  const delimiter = box.delimiter || '/';
  let mappedName = null;

  // Check specialUse attribute (imapflow uses specialUse instead of attribs)
  if (box.specialUse) {
    const specialUse = box.specialUse.toLowerCase();
    if (specialUse.includes('\\sent') || specialUse.includes('sent')) {
      mappedName = SENT_FOLDER;
    } else if (specialUse.includes('\\trash') || specialUse.includes('trash')) {
      mappedName = TRASH_FOLDER;
    } else if (specialUse.includes('\\junk') || specialUse.includes('junk')) {
      mappedName = SPAM_FOLDER;
    }
  }

  // Name matching overrides (only if not already mapped)
  // BEHAVIORAL IMPROVEMENT: Use box.name (leaf name) for matching folder types, not the full path.
  // This is an intentional change that:
  //   1. Aligns folder detection with deleteEmail/setEmailFlag operations (which use leaf name matching)
  //   2. May map INBOX.Sent to 'Gesendet' (via name='Sent') instead of 'Posteingang/Sent' (via path)
  //   3. Provides more accurate special folder detection (e.g., recognizing 'INBOX.Trash' as Papierkorb)
  // This behavioral change is considered an improvement over path-based matching.
  const lower = (box.name || fullPath).toLowerCase();
  if (!mappedName) {
    if (lower === 'sent' || lower === 'gesendet') {
      mappedName = SENT_FOLDER;
    } else if (lower === 'trash' || lower === 'papierkorb') {
      mappedName = TRASH_FOLDER;
    } else if (lower === 'junk' || lower === 'spam') {
      mappedName = SPAM_FOLDER;
    } else if (lower === 'inbox') {
      mappedName = INBOX_FOLDER;
    } else {
      // For other folders, handle INBOX subfolders or normalize delimiters
      let prettyPath = fullPath;
      if (prettyPath.toUpperCase().startsWith('INBOX')) {
        const parts = fullPath.split(delimiter);
        if (parts[0].toUpperCase() === 'INBOX') {
          parts[0] = INBOX_FOLDER;
          prettyPath = parts.join('/');
        }
      } else {
        prettyPath = fullPath.split(delimiter).join('/');
      }
      mappedName = prettyPath;
    }
  }

  return mappedName;
}

/**
 * Finds the server folder path that corresponds to a given DB folder name
 * @param {ImapFlow} client - Connected IMAP client
 * @param {string} dbFolder - The DB folder name to find
 * @returns {Promise<string|null>} The server folder path, or null if not found
 */
async function findServerFolderForDbName(client, dbFolder) {
  if (!dbFolder || dbFolder === INBOX_FOLDER) {
    return 'INBOX';
  }

  const boxList = await client.list();

  for (const box of boxList) {
    const mappedName = mapServerFolderToDbName(box);
    if (mappedName === dbFolder) {
      return box.path;
    }
  }

  return null;
}

/**
 * Helper to process a batch of fetch results and save them to DB
 */
async function processMessages(client, messages, account, targetCategory) {
  let savedCount = 0;

  // Reverse to process newest first in this batch if desired, or just simple loop
  for (const message of messages) {
    if (!message.attributes || !message.attributes.uid) continue;

    const currentUid = message.attributes.uid;
    // Construct unique ID for DB
    let id = currentUid + '-' + account.id;
    if (targetCategory !== INBOX_FOLDER) {
      id = currentUid + '-' + targetCategory.replace(/\s+/g, '_') + '-' + account.id;
    }

    const all = message.parts.find((part) => part.which === '');

    if (all) {
      try {
        const parsed = await simpleParser(all.body);
        const attachments = (parsed.attachments || []).map((att) => ({
          filename: att.filename || 'attachment',
          contentType: att.contentType,
          size: att.size,
          data: att.content,
        }));

        const email = {
          id: id,
          accountId: account.id,
          sender: parsed.from?.text || 'Unknown',
          senderEmail: parsed.from?.value?.[0]?.address || '',
          subject: parsed.subject || '(No Subject)',
          body: parsed.text || '',
          bodyHtml: parsed.html || null,
          date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
          folder: targetCategory,
          smartCategory: null,
          isRead: message.attributes.flags?.has('\\Seen') || false,
          isFlagged: message.attributes.flags?.has('\\Flagged') || false,
          hasAttachments: attachments.length > 0,
          attachments: attachments,
          uid: currentUid,
        };

        if (targetCategory === INBOX_FOLDER) {
          email.isRead = message.attributes.flags?.has('\\Seen') || false;
        }

        saveEmail(email);
        savedCount++;
      } catch (parseErr) {
        console.error(`[IMAP] Failed to parse message UID ${currentUid}:`, parseErr.message);
        // Save Error Placeholder
        saveEmail({
          id: id,
          accountId: account.id,
          sender: 'System Error',
          senderEmail: 'error@local',
          subject: `Error loading email UID ${currentUid}`,
          body: `Failed to parse email. Error: ${parseErr.message}`,
          bodyHtml: `<p style="color:red">Failed to parse email.</p><p>Error: ${parseErr.message}</p>`,
          date: new Date().toISOString(),
          folder: targetCategory,
          smartCategory: 'System Error',
          isRead: true,
          isFlagged: true,
          hasAttachments: false,
          uid: currentUid,
        });
      }
    } else {
      console.error(`[IMAP] Sync Warning: Message UID ${currentUid} returned no body part.`);
      saveEmail({
        id: id,
        accountId: account.id,
        sender: 'System Error',
        senderEmail: 'error@local',
        subject: `Empty Body UID ${currentUid}`,
        body: `The server returned no content for this email.`,
        bodyHtml: `<p style="color:red">The server returned no content for this email.</p>`,
        date: new Date().toISOString(),
        folder: targetCategory,
        smartCategory: 'System Error',
        isRead: true,
        isFlagged: false,
        hasAttachments: false,
        uid: currentUid,
      });
    }
  }
  return savedCount;
}

/**
 * Checks the account storage quota from the IMAP server
 * @param {ImapFlow} client - Connected IMAP client
 * @param {number} accountId - Account ID for database update
 * @returns {Promise<Object|null>} Quota info object or null on failure
 */
async function checkAccountQuota(client, accountId) {
  try {
    console.log('[Quota] Checking storage quota...');
    // LOG CAPABILITIES
    try {
      const caps = client.capabilities || new Set();
      console.log('[Quota Debug] Server Capabilities:', Array.from(caps));
    } catch (_e) {}

    // Use ImapFlow's getQuota() method
    const quota = await client.getQuota('INBOX');
    console.log('[Quota Debug] Quota response received.');

    if (quota && quota.storage) {
      console.log('[Quota Debug] Quota Object:', JSON.stringify(quota));
      // Convert bytes to KB (ImapFlow returns bytes, DB expects KB)
      const usedKB = Math.round((quota.storage.used || 0) / 1024);
      const totalKB = Math.round((quota.storage.limit || 0) / 1024);

      if (totalKB > 0) {
        console.log(`[Quota] Used: ${usedKB}KB, Total: ${totalKB}KB`);
        updateAccountQuota(accountId, usedKB, totalKB);
        return { usedKB, totalKB };
      } else {
        console.log('[Quota Debug] No valid storage limits returned.');
      }
    } else {
      console.log('[Quota Debug] No quota object or storage property returned.');
    }
    return null;
  } catch (qErr) {
    console.warn('[Quota] Error fetching quota:', qErr);
    return null;
  }
}

/**
 * Builds a folder map from IMAP mailboxes
 * @param {Array} mailboxes - Array of mailbox objects from IMAP server
 * @returns {Object} Folder map with server paths as keys and DB folder names as values
 */
function buildFolderMap(mailboxes) {
  const folderMap = { INBOX: INBOX_FOLDER };

  for (const box of mailboxes) {
    const serverPath = box.path;
    const mappedName = mapServerFolderToDbName(box);
    folderMap[serverPath] = mappedName;
  }

  return folderMap;
}

/**
 * Handles folder renaming migration
 * @param {Object} folderMap - Folder map with server paths as keys and DB folder names as values
 */
function migrateFolders(folderMap) {
  for (const [fullPath, prettyName] of Object.entries(folderMap)) {
    const parts = fullPath.split(/[./]/);
    const oldLeafName = parts[parts.length - 1];
    if (oldLeafName && prettyName !== oldLeafName && prettyName.startsWith(INBOX_FOLDER + '/')) {
      db.migrateFolder(oldLeafName, prettyName);
    }
  }
}

/**
 * Fetches UIDs and flags for a sequence range from the IMAP server
 * @param {ImapFlow} client - Connected IMAP client with mailbox lock
 * @param {string} seqRange - Sequence range string (e.g., '1:5000')
 * @returns {Promise<{uids: number[], headers: Array}>} Object containing array of UIDs and headers with flags
 */
async function fetchUidBatch(client, seqRange) {
  const headers = [];
  for await (const message of client.fetch(seqRange, { uid: false, flags: true })) {
    headers.push({
      attributes: {
        uid: message.uid,
        flags: message.flags || [],
      },
    });
  }

  // Extract server UIDs from this batch
  const batchServerUids = headers
    .map((m) => (m.attributes ? m.attributes.uid : null))
    .filter((u) => u != null);

  console.log(
    `[Sync Debug] Range ${seqRange}: Fetched ${headers.length} headers, extracted ${batchServerUids.length} UIDs.`
  );

  return { uids: batchServerUids, headers: headers };
}

/**
 * Downloads and processes a batch of messages by UID
 * @param {ImapFlow} client - Connected IMAP client with mailbox lock
 * @param {number[]} chunkUids - Array of UIDs to download
 * @param {Object} account - Account configuration object
 * @param {string} targetCategory - Target folder/category for saving messages
 * @returns {Promise<number>} Number of messages successfully saved
 */
async function downloadMessageBatch(client, chunkUids, account, targetCategory) {
  console.log(
    `[Sync] Downloading ${chunkUids.length} messages... (UIDs ${chunkUids[0]}..${chunkUids[chunkUids.length - 1]})`
  );

  try {
    // Fetch FULL message content for these UIDs directly using native client.fetch()
    console.log(`[Sync Debug] Downloading chunk directly via client.fetch()...`);
    const messages = [];
    const uidRange = chunkUids.join(',');

    for await (const message of client.fetch(
      uidRange,
      {
        source: true, // Fetch full raw email source
        flags: true,
      },
      { uid: true }
    )) {
      // ImapFlow returns message with source buffer directly
      const msg = {
        parts: [],
        attributes: {
          uid: message.uid,
          flags: message.flags || [],
        },
      };

      // Add body part only if source exists (handles missing body parts)
      if (message.source) {
        msg.parts.push({
          which: '',
          body: message.source.toString('utf8'),
        });
      }

      messages.push(msg);
    }

    if (!messages || messages.length === 0) {
      console.error(
        `[Sync Error] Fetched 0 messages for UIDs ${chunkUids[0]}..${chunkUids[chunkUids.length - 1]}`
      );
      return 0;
    } else {
      console.log(`[Sync Debug] Fetched ${messages.length} raw messages. Processing...`);
      const saved = await processMessages(client, messages, account, targetCategory);
      console.log(`[Sync Debug] Saved ${saved} messages from this chunk.`);
      return saved;
    }
  } catch (fetchErr) {
    console.error(`[Sync] Failed to fetch message chunk ${chunkUids.join(',')}:`, fetchErr);
    return 0;
  }
}

/**
 * Reconciles local emails with server state by removing orphaned messages
 * @param {number[]} localUids - Array of UIDs present in local database
 * @param {Set<number>} allServerUids - Set of all UIDs present on server
 * @param {number} accountId - Account ID for database operations
 * @param {string} targetCategory - Target folder/category name
 * @param {string} boxName - Server mailbox name (for logging)
 * @returns {number} Number of orphaned emails deleted
 */
function reconcileOrphans(localUids, allServerUids, accountId, targetCategory, boxName) {
  const localOrphans = localUids.filter((uid) => !allServerUids.has(uid));

  if (localOrphans.length > 0) {
    console.log(
      `[Sync] Found ${localOrphans.length} orphaned emails in ${boxName} (deleted on server). removing locally...`
    );
    const deletedCount = db.deleteEmailsByUid(accountId, targetCategory, localOrphans);
    console.log(`[Sync] Deleted ${deletedCount} local emails.`);
    return deletedCount;
  } else {
    console.log(`[Sync] No orphans found in ${boxName}. Local DB matches server.`);
    return 0;
  }
}

async function syncAccount(account) {
  console.log(`Starting sync for account: ${account.email}`);

  const client = createImapClient(account);

  try {
    await client.connect();
    console.log('IMAP Connected');

    // 1. Get all mailboxes
    const mailboxes = await client.list();
    const folderMap = { INBOX: INBOX_FOLDER };

    try {
      console.log('[Quota] Checking storage quota...');
      // LOG CAPABILITIES
      try {
        const caps = client.capabilities || new Set();
        console.log('[Quota Debug] Server Capabilities:', Array.from(caps));
      } catch (_e) {}

      // Use ImapFlow's getQuota() method
      const quota = await client.getQuota('INBOX');
      console.log('[Quota Debug] Quota response received.');

      if (quota && quota.storage) {
        console.log('[Quota Debug] Quota Object:', JSON.stringify(quota));
        // Convert bytes to KB (ImapFlow returns bytes, DB expects KB)
        const usedKB = Math.round((quota.storage.used || 0) / 1024);
        const totalKB = Math.round((quota.storage.limit || 0) / 1024);

        if (totalKB > 0) {
          console.log(`[Quota] Used: ${usedKB}KB, Total: ${totalKB}KB`);
          updateAccountQuota(account.id, usedKB, totalKB);
        } else {
          console.log('[Quota Debug] No valid storage limits returned.');
        }
      } else {
        console.log('[Quota Debug] No quota object or storage property returned.');
      }
    } catch (qErr) {
      console.warn('[Quota] Error fetching quota:', qErr);
    }

    // Build folder map using helper function
    for (const box of mailboxes) {
      const serverPath = box.path;
      const mappedName = mapServerFolderToDbName(box);
      folderMap[serverPath] = mappedName;
    }

    // Migration step for folder naming
    for (const [fullPath, prettyName] of Object.entries(folderMap)) {
      const parts = fullPath.split(/[./]/);
      const oldLeafName = parts[parts.length - 1];
      if (oldLeafName && prettyName !== oldLeafName && prettyName.startsWith(INBOX_FOLDER + '/')) {
        db.migrateFolder(oldLeafName, prettyName);
      }
    }

    console.log('Detected Folders to Sync:', folderMap);
    let totalNew = 0;

    for (const [boxName, targetCategory] of Object.entries(folderMap)) {
      let lock;
      try {
        // Get mailbox lock and capture metadata
        lock = await client.getMailboxLock(boxName);

        try {
          console.log(`[Sync] Accessing ${boxName} (Mapped: ${targetCategory})`);

          // --- ROBUST LARGE DATA SYNC STRATEGY ---
          // 1. Get total message count from client.mailbox
          const totalMessages = client.mailbox.exists;

          console.log(`[Sync] ${boxName}: Total messages on server: ${totalMessages}`);

          if (totalMessages === 0) {
            continue; // Empty box
          }

          // Load ALL local UIDs once for efficient lookup
          // Warning: For 100k emails, this array is large but manageable (approx 800KB-1MB RAM).
          const localUids = db.getAllUidsForFolder(account.id, targetCategory);
          const localUidSet = new Set(localUids);
          console.log(`[Sync] ${boxName}: Local messages DB has: ${localUids.length}`);

          // Config parameters
          const UID_FETCH_BATCH_SIZE = 5000;
          const MSG_FETCH_BATCH_SIZE = 50;

          // --- RECONCILIATION: Track all server UIDs to detect deletions ---
          const allServerUids = new Set();

          // Loop through sequence ranges (1-based index)
          for (let seqStart = 1; seqStart <= totalMessages; seqStart += UID_FETCH_BATCH_SIZE) {
            const seqEnd = Math.min(seqStart + UID_FETCH_BATCH_SIZE - 1, totalMessages);
            const range = `${seqStart}:${seqEnd}`;

            console.log(`[Sync] ${boxName}: Checking range ${range} for missing UIDs...`);

            try {
              // Fetch only UIDs for this sequence range using native ImapFlow fetch()
              const headers = [];
              for await (const message of client.fetch(range, { uid: false, flags: true })) {
                headers.push({
                  attributes: {
                    uid: message.uid,
                    flags: message.flags || [],
                  },
                });
              }

              // Extract server UIDs from this batch
              const batchServerUids = headers
                .map((m) => (m.attributes ? m.attributes.uid : null))
                .filter((u) => u != null);

              // Add to reconciliation set
              batchServerUids.forEach((u) => allServerUids.add(u));

              console.log(
                `[Sync Debug] Range ${range}: Fetched ${headers.length} headers, extracted ${batchServerUids.length} UIDs.`
              );

              // Identify which ones are missing locally
              const missingInBatch = batchServerUids.filter((uid) => !localUidSet.has(uid));
              console.log(`[Sync Debug] Range ${range}: ${missingInBatch.length} missing locally.`);

              if (missingInBatch.length > 0) {
                console.log(`[Sync] ${boxName}: Range ${range} has ${missingInBatch.length} new messages.`);

                // Download missing messages in smaller chunks
                missingInBatch.sort((a, b) => a - b); // Process in order

                for (let i = 0; i < missingInBatch.length; i += MSG_FETCH_BATCH_SIZE) {
                  const chunkUids = missingInBatch.slice(i, i + MSG_FETCH_BATCH_SIZE);
                  console.log(
                    `[Sync] Downloading ${chunkUids.length} messages... (UIDs ${chunkUids[0]}..${chunkUids[chunkUids.length - 1]})`
                  );

                  try {
                    // Fetch FULL message content for these UIDs directly using native client.fetch()
                    console.log(`[Sync Debug] Downloading chunk directly via client.fetch()...`);
                    const messages = [];
                    const uidRange = chunkUids.join(',');

                    for await (const message of client.fetch(
                      uidRange,
                      {
                        source: true, // Fetch full raw email source
                        flags: true,
                      },
                      { uid: true }
                    )) {
                      // ImapFlow returns message with source buffer directly
                      const msg = {
                        parts: [],
                        attributes: {
                          uid: message.uid,
                          flags: message.flags || [],
                        },
                      };

                      // Add body part only if source exists (handles missing body parts)
                      if (message.source) {
                        msg.parts.push({
                          which: '',
                          body: message.source.toString('utf8'),
                        });
                      }

                      messages.push(msg);
                    }

                    if (!messages || messages.length === 0) {
                      console.error(
                        `[Sync Error] Fetched 0 messages for UIDs ${chunkUids[0]}..${chunkUids[chunkUids.length - 1]}`
                      );
                    } else {
                      console.log(`[Sync Debug] Fetched ${messages.length} raw messages. Processing...`);
                      const saved = await processMessages(client, messages, account, targetCategory);
                      totalNew += saved;
                      console.log(`[Sync Debug] Saved ${saved} messages from this chunk.`);
                    }
                  } catch (fetchErr) {
                    console.error(`[Sync] Failed to fetch message chunk ${chunkUids.join(',')}:`, fetchErr);
                  }
                }
              }
            } catch (rangeErr) {
              console.error(`[Sync] Failed to fetch UIDs for sequence range ${range}:`, rangeErr);
            }
          }

          // --- RECONCILIATION PHASE ---
          reconcileOrphans(localUids, allServerUids, account.id, targetCategory, boxName);
        } catch (err) {
          console.error(`[Sync] Error syncing folder ${boxName}:`, err.message);
        }
      } catch (lockErr) {
        // Handle folder access errors (missing, renamed, or permission issues)
        console.warn(`[Sync] Skipping ${boxName} - cannot access folder: ${lockErr.message}`);
        if (lockErr.mailboxMissing) {
          console.warn(`[Sync] Folder ${boxName} no longer exists on server`);
        }
        // Continue to next folder instead of stopping entire sync
        continue;
      } finally {
        if (lock) lock.release();
      }
    } // End box loop

    await client.logout();
    console.log(`Sync completed. Total new messages: ${totalNew}`);
    return { success: true, count: totalNew };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('IMAP Error:', error);
    }
    return { success: false, error: error.message };
  }
}

async function testConnection(account) {
  const client = createImapClient(account);

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    lock.release();
    await client.logout();
    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('IMAP Error:', error);
    }
    return { success: false, error: error.message };
  }
}

async function deleteEmail(account, uid, dbFolder) {
  if (!uid) return { success: false, error: 'No UID' };

  const client = createImapClient(account);

  try {
    await client.connect();

    // Resolve Server Path from DB Folder Name using helper
    const foundPath = await findServerFolderForDbName(client, dbFolder);
    const serverPath = foundPath || 'INBOX';

    if (foundPath) {
      console.log(`[Delete] Mapped DB folder '${dbFolder}' to Server folder '${serverPath}'`);
    } else if (dbFolder && dbFolder !== INBOX_FOLDER) {
      console.warn(`[Delete] Could not map '${dbFolder}' to server path. Defaulting to INBOX.`);
    }

    // Get mailbox lock for the target folder
    const lock = await client.getMailboxLock(serverPath);

    try {
      // Delete message using ImapFlow's messageDelete (marks as deleted and expunges)
      await client.messageDelete(uid, { uid: true });
    } finally {
      lock.release();
    }

    await client.logout();
    return { success: true };
  } catch (error) {
    console.error('Delete Error:', error);
    return { success: false, error: error.message };
  }
}

async function setEmailFlag(account, uid, flag, value, dbFolder) {
  if (!uid) return { success: false, error: 'No UID' };

  const client = createImapClient(account);

  try {
    await client.connect();

    // Resolve Server Path from DB Folder Name using helper
    const foundPath = await findServerFolderForDbName(client, dbFolder);
    const serverPath = foundPath || 'INBOX';

    if (foundPath) {
      console.log(`[Flag] Mapped DB folder '${dbFolder}' to Server folder '${serverPath}'`);
    } else if (dbFolder && dbFolder !== INBOX_FOLDER) {
      console.warn(`[Flag] Could not map '${dbFolder}' to server path. Defaulting to INBOX.`);
    }

    // Get mailbox lock for the target folder
    const lock = await client.getMailboxLock(serverPath);

    try {
      if (value) {
        await client.messageFlagsAdd(uid, [flag], { uid: true });
      } else {
        await client.messageFlagsRemove(uid, [flag], { uid: true });
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return { success: true };
  } catch (error) {
    console.error('Flag Update Error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  syncAccount,
  testConnection,
  deleteEmail,
  setEmailFlag,
  PROVIDERS,
  mapServerFolderToDbName,
  findServerFolderForDbName,
  checkAccountQuota,
  buildFolderMap,
  migrateFolders,
  fetchUidBatch,
  downloadMessageBatch,
  reconcileOrphans,
};
