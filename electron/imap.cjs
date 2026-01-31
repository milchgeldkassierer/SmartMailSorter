const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;
const { saveEmail, updateAccountSync, updateAccountQuota, migrateFolder, getMaxUidForFolder, getAllUidsForFolder, deleteEmailsByUid } = require('./db.cjs');
// Add db just for direct calls if needed, though we imported migrateFolder directly
const db = require('./db.cjs');

console.log("IMAP Module Loaded: Version LargeScaleSync_v1");

// Provider presets
const PROVIDERS = {
    gmx: {
        host: 'imap.gmx.net',
        port: 993,
        secure: true
    },
    webde: {
        host: 'imap.web.de',
        port: 993,
        secure: true
    },
    gmail: {
        host: 'imap.gmail.com',
        port: 993,
        secure: true
    }
};

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
        if (targetCategory !== 'Posteingang') {
            id = currentUid + '-' + targetCategory.replace(/\s+/g, '_') + '-' + account.id;
        }

        const all = message.parts.find(part => part.which === '');

        if (all) {
            try {
                const parsed = await simpleParser(all.body);
                const attachments = (parsed.attachments || []).map(att => ({
                    filename: att.filename || 'attachment',
                    contentType: att.contentType,
                    size: att.size,
                    data: att.content
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
                    uid: currentUid
                };

                if (targetCategory === 'Posteingang') {
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
                    uid: currentUid
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
                uid: currentUid
            });
        }
    }
    return savedCount;
}

async function syncAccount(account) {
    console.log(`Starting sync for account: ${account.email}`);

    const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: {
            user: account.username || account.email,
            pass: account.password
        },
        logger: false
    });

    try {
        await client.connect();
        console.log("IMAP Connected");

        // 1. Get all mailboxes
        const mailboxes = await client.list();
        const folderMap = { 'INBOX': 'Posteingang' };

        try {
            console.log('[Quota] Checking storage quota...');
            // LOG CAPABILITIES
            try {
                const caps = client.capabilities || new Set();
                console.log('[Quota Debug] Server Capabilities:', Array.from(caps));
            } catch (e) { }

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

        const findSpecialFolders = (boxList, prefix = '') => {
            for (const box of boxList) {
                const key = box.path;
                const fullPath = prefix + key;
                const delimiter = box.delimiter || '/';

                // Check specialUse attribute (imapflow uses specialUse instead of attribs)
                if (box.specialUse) {
                    const specialUse = box.specialUse.toLowerCase();
                    if (specialUse.includes('\\sent') || specialUse.includes('sent')) {
                        folderMap[fullPath] = 'Gesendet';
                    } else if (specialUse.includes('\\trash') || specialUse.includes('trash')) {
                        folderMap[fullPath] = 'Papierkorb';
                    } else if (specialUse.includes('\\junk') || specialUse.includes('junk')) {
                        folderMap[fullPath] = 'Spam';
                    }
                }

                const lower = key.toLowerCase();
                if (!folderMap[fullPath]) {
                    if (lower === 'sent' || lower === 'gesendet') folderMap[fullPath] = 'Gesendet';
                    else if (lower === 'trash' || lower === 'papierkorb') folderMap[fullPath] = 'Papierkorb';
                    else if (lower === 'junk' || lower === 'spam') folderMap[fullPath] = 'Spam';
                    else if (lower !== 'inbox') {
                        let prettyPath = fullPath;
                        if (prettyPath.toUpperCase().startsWith('INBOX')) {
                            const parts = fullPath.split(delimiter);
                            if (parts[0].toUpperCase() === 'INBOX') parts[0] = 'Posteingang';
                            prettyPath = parts.join('/');
                        } else {
                            prettyPath = fullPath.split(delimiter).join('/');
                        }
                        folderMap[fullPath] = prettyPath;
                    }
                }

                // imapflow returns flat list with path, so no children to recurse
            }
        };

        findSpecialFolders(mailboxes);

        // Migration step for folder naming
        for (const [fullPath, prettyName] of Object.entries(folderMap)) {
            const parts = fullPath.split(/[./]/);
            const oldLeafName = parts[parts.length - 1];
            if (oldLeafName && prettyName !== oldLeafName && prettyName.startsWith('Posteingang/')) {
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
                                    flags: message.flags || []
                                }
                            });
                        }

                            // Extract server UIDs from this batch
                            const batchServerUids = headers.map(m => m.attributes ? m.attributes.uid : null).filter(u => u != null);

                            // Add to reconciliation set
                            batchServerUids.forEach(u => allServerUids.add(u));

                            console.log(`[Sync Debug] Range ${range}: Fetched ${headers.length} headers, extracted ${batchServerUids.length} UIDs.`);

                            // Identify which ones are missing locally
                            const missingInBatch = batchServerUids.filter(uid => !localUidSet.has(uid));
                            console.log(`[Sync Debug] Range ${range}: ${missingInBatch.length} missing locally.`);

                            if (missingInBatch.length > 0) {
                                console.log(`[Sync] ${boxName}: Range ${range} has ${missingInBatch.length} new messages.`);

                                // Download missing messages in smaller chunks
                                missingInBatch.sort((a, b) => a - b); // Process in order

                                for (let i = 0; i < missingInBatch.length; i += MSG_FETCH_BATCH_SIZE) {
                                    const chunkUids = missingInBatch.slice(i, i + MSG_FETCH_BATCH_SIZE);
                                    console.log(`[Sync] Downloading ${chunkUids.length} messages... (UIDs ${chunkUids[0]}..${chunkUids[chunkUids.length - 1]})`);

                                try {
                                    // Fetch FULL message content for these UIDs directly using native client.fetch()
                                    console.log(`[Sync Debug] Downloading chunk directly via client.fetch()...`);
                                    const messages = [];
                                    const uidRange = chunkUids.join(',');

                                    for await (const message of client.fetch(uidRange, {
                                        source: true,  // Fetch full raw email source
                                        flags: true
                                    }, { uid: true })) {
                                        // ImapFlow returns message with source buffer directly
                                        const msg = {
                                            parts: [],
                                            attributes: {
                                                uid: message.uid,
                                                flags: message.flags || []
                                            }
                                        };

                                        // Add body part only if source exists (handles missing body parts)
                                        if (message.source) {
                                            msg.parts.push({
                                                which: '',
                                                body: message.source.toString('utf8')
                                            });
                                        }

                                        messages.push(msg);
                                    }

                                        if (!messages || messages.length === 0) {
                                            console.error(`[Sync Error] Fetched 0 messages for UIDs ${chunkUids[0]}..${chunkUids[chunkUids.length - 1]}`);
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
                    // 1. Identify local orphans (UIDs present locally but not on server)
                    const localOrphans = localUids.filter(uid => !allServerUids.has(uid));

                    if (localOrphans.length > 0) {
                        console.log(`[Sync] Found ${localOrphans.length} orphaned emails in ${boxName} (deleted on server). removing locally...`);
                        const deletedCount = db.deleteEmailsByUid(account.id, targetCategory, localOrphans);
                        console.log(`[Sync] Deleted ${deletedCount} local emails.`);
                    } else {
                        console.log(`[Sync] No orphans found in ${boxName}. Local DB matches server.`);
                    }

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
    const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: {
            user: account.username || account.email,
            pass: account.password
        },
        logger: false
    });

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

    const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: {
            user: account.username || account.email,
            pass: account.password
        },
        logger: false
    });

    try {
        await client.connect();

        // Resolve Server Path from DB Folder Name
        let serverPath = 'INBOX';
        if (dbFolder && dbFolder !== 'Posteingang') {
            const boxList = await client.list();
            let foundPath = null;

            for (const box of boxList) {
                const fullPath = box.path;
                let mappedName = fullPath; // Default

                // Check specialUse attribute (imapflow uses specialUse instead of attribs)
                if (box.specialUse) {
                    const specialUse = box.specialUse.toLowerCase();
                    if (specialUse.includes('\\sent') || specialUse.includes('sent')) mappedName = 'Gesendet';
                    else if (specialUse.includes('\\trash') || specialUse.includes('trash')) mappedName = 'Papierkorb';
                    else if (specialUse.includes('\\junk') || specialUse.includes('junk')) mappedName = 'Spam';
                }

                // Name matching overrides
                const lower = box.name.toLowerCase();
                if (mappedName === fullPath) { // If not mapped by attribute yet
                    if (lower === 'sent' || lower === 'gesendet') mappedName = 'Gesendet';
                    else if (lower === 'trash' || lower === 'papierkorb') mappedName = 'Papierkorb';
                    else if (lower === 'junk' || lower === 'spam') mappedName = 'Spam';
                    else if (fullPath.toUpperCase().startsWith('INBOX')) {
                        // Handle Subfolders: INBOX.Amazon -> Posteingang/Amazon
                        const sep = box.delimiter || '/';
                        // Normalize separators to / for DB
                        const parts = fullPath.split(sep);
                        if (parts[0].toUpperCase() === 'INBOX') {
                            parts[0] = 'Posteingang';
                            mappedName = parts.join('/');
                        }
                    }
                }

                if (mappedName === dbFolder) {
                    foundPath = fullPath;
                    break;
                }
            }

            if (foundPath) {
                serverPath = foundPath;
                console.log(`[Delete] Mapped DB folder '${dbFolder}' to Server folder '${serverPath}'`);
            } else {
                console.warn(`[Delete] Could not map '${dbFolder}' to server path. Defaulting to INBOX.`);
            }
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

async function setEmailFlag(account, uid, flag, value) {
    if (!uid) return { success: false, error: 'No UID' };

    const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: {
            user: account.username || account.email,
            pass: account.password
        },
        logger: false
    });

    try {
        await client.connect();

        // Get mailbox lock for INBOX
        const lock = await client.getMailboxLock('INBOX');

        try {
            if (value) {
                await client.messageFlagsAdd(uid, [flag]);
            } else {
                await client.messageFlagsRemove(uid, [flag]);
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
    PROVIDERS
};
