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
 * Wrapper for node-imap fetch (Sequence Numbers)
 * imap-simple doesn't expose this directly.
 */
function fetchBatchSeq(connection, range) {
    return new Promise((resolve, reject) => {
        const results = [];
        try {
            // connection.imap is the node-imap instance
            // .seq.fetch() uses sequence numbers (1:5000) instead of UIDs
            const f = connection.imap.seq.fetch(range, { bodies: 'HEADER.FIELDS (UID)' });

            f.on('message', (msg) => {
                msg.on('attributes', (attrs) => {
                    results.push({ attributes: attrs });
                });
            });

            f.once('error', (err) => {
                reject(err);
            });

            f.once('end', () => {
                resolve(results);
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Wrapper for node-imap fetch (UIDs)
 * Bypasses SEARCH and directly fetches by UID.
 */
function fetchBatchUid(connection, uids) {
    return new Promise((resolve, reject) => {
        const messages = [];
        try {
            // connection.imap.fetch takes UIDs directly (string or array)
            const f = connection.imap.fetch(uids, { bodies: [''], markSeen: false });

            f.on('message', (msg) => {
                const message = { parts: [], attributes: null };

                msg.on('body', (stream, info) => {
                    const chunks = [];
                    stream.on('data', (chunk) => chunks.push(chunk));
                    stream.once('end', () => {
                        const body = Buffer.concat(chunks).toString('utf8');
                        message.parts.push({ which: info.which, body: body });
                    });
                });

                msg.on('attributes', (attrs) => {
                    message.attributes = attrs;
                });

                msg.once('end', () => {
                    messages.push(message);
                });
            });

            f.once('error', (err) => {
                console.error('[IMAP Raw] Fetch by UID error:', err);
                reject(err);
            });

            f.once('end', () => {
                resolve(messages);
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Helper to process a batch of fetch results and save them to DB
 */
async function processMessages(connection, messages, account, targetCategory) {
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
                    isRead: message.attributes.flags && message.attributes.flags.includes('\\Seen'),
                    isFlagged: message.attributes.flags && message.attributes.flags.includes('\\Flagged'),
                    hasAttachments: attachments.length > 0,
                    attachments: attachments,
                    uid: currentUid
                };

                if (targetCategory === 'Posteingang') {
                    email.isRead = message.attributes.flags && message.attributes.flags.includes('\\Seen');
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
    const config = {
        imap: {
            user: account.username || account.email,
            password: account.password,
            host: account.imapHost,
            port: account.imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 10000 // Increased timeout for initial connection
        }
    };

    try {
        const connection = await imaps.connect(config);
        console.log("IMAP Connected");

        // 1. Get all boxes
        const boxes = await connection.getBoxes();
        const folderMap = { 'INBOX': 'Posteingang' };

        try {
            console.log('[Quota] Checking storage quota...');
            // LOG CAPABILITIES
            try {
                // accessing private property _caps for debugging as serverSupports might be strict
                const caps = connection.imap._caps || [];
                console.log('[Quota Debug] Server Capabilities:', caps);
            } catch (e) { }

            await new Promise((resolve) => {
                connection.imap.getQuotaRoot('INBOX', (err, quotas) => {
                    console.log('[Quota Debug] Callback fired.');
                    if (err) {
                        console.log('[Quota Debug] Error:', err);
                    }
                    if (quotas) {
                        console.log('[Quota Debug] Quotas Object:', JSON.stringify(quotas));
                        for (let root in quotas) {
                            const storage = quotas[root]['storage'];
                            let used = 0;
                            let total = 0;
                            let valid = false;

                            // Handle Array format [used, total]
                            if (Array.isArray(storage) && storage.length === 2 && typeof storage[0] === 'number') {
                                used = storage[0];
                                total = storage[1];
                                valid = true;
                            }
                            // Handle Object format { usage: 123, limit: 456 }
                            else if (storage && typeof storage === 'object' && 'usage' in storage && 'limit' in storage) {
                                used = storage.usage;
                                total = storage.limit;
                                valid = true;
                            }

                            if (valid) {
                                console.log(`[Quota] Used: ${used}KB, Total: ${total}KB`);
                                updateAccountQuota(account.id, used, total);
                            } else {
                                console.log(`[Quota Debug] Root ${root} has unknown storage format:`, storage);
                            }
                        }
                    } else {
                        console.log('[Quota Debug] No quotas object returned.');
                    }
                    resolve();
                });
            });
        } catch (qErr) {
            console.warn('[Quota] Error fetching quota:', qErr);
        }

        const findSpecialFolders = (boxList, prefix = '') => {
            for (const key in boxList) {
                const box = boxList[key];
                const fullPath = prefix + key;

                if (box.attribs) {
                    if (box.attribs.some(a => typeof a === 'string' && a.toLowerCase().includes('\\sent'))) {
                        folderMap[fullPath] = 'Gesendet';
                    } else if (box.attribs.some(a => typeof a === 'string' && a.toLowerCase().includes('\\trash'))) {
                        folderMap[fullPath] = 'Papierkorb';
                    } else if (box.attribs.some(a => typeof a === 'string' && a.toLowerCase().includes('\\junk'))) {
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
                            const sep = box.delimiter || '/';
                            const parts = fullPath.split(sep);
                            if (parts[0].toUpperCase() === 'INBOX') parts[0] = 'Posteingang';
                            prettyPath = parts.join('/');
                        } else {
                            const sep = box.delimiter || '/';
                            prettyPath = fullPath.split(sep).join('/');
                        }
                        folderMap[fullPath] = prettyPath;
                    }
                }

                if (box.children) findSpecialFolders(box.children, fullPath + box.delimiter);
            }
        };

        findSpecialFolders(boxes);

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
            try {
                // Open box and capture metadata (messages count etc)
                const box = await connection.openBox(boxName);

                console.log(`[Sync] Accessing ${boxName} (Mapped: ${targetCategory})`);

                // --- ROBUST LARGE DATA SYNC STRATEGY ---
                // 1. Get total message count from the generic box object returned by openBox
                const totalMessages = box.messages.total;

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
                        // Fetch only UIDs for this sequence range
                        const headers = await fetchBatchSeq(connection, range);

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
                                    // Fetch FULL message content for these UIDs directly
                                    console.log(`[Sync Debug] Downloading chunk directly via fetchBatchUid...`);
                                    const messages = await fetchBatchUid(connection, chunkUids);

                                    if (!messages || messages.length === 0) {
                                        console.error(`[Sync Error] Fetched 0 messages for UIDs ${chunkUids[0]}..${chunkUids[chunkUids.length - 1]}`);
                                    } else {
                                        console.log(`[Sync Debug] Fetched ${messages.length} raw messages. Processing...`);
                                        const saved = await processMessages(connection, messages, account, targetCategory);
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
                console.error(`Error syncing folder ${boxName}:`, err);
            }
        } // End box loop

        connection.end();
        console.log(`Sync completed. Total new messages: ${totalNew}`);
        return { success: true, count: totalNew };

    } catch (error) {
        console.error('IMAP Error:', error);
        return { success: false, error: error.message };
    }
}

async function testConnection(account) {
    const config = {
        imap: {
            user: account.username || account.email,
            password: account.password,
            host: account.imapHost,
            port: account.imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 5000
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');
        connection.end();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteEmail(account, uid, dbFolder) {
    if (!uid) return { success: false, error: 'No UID' };

    const config = {
        imap: {
            user: account.username || account.email,
            password: account.password,
            host: account.imapHost,
            port: account.imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 5000
        }
    };

    try {
        const connection = await imaps.connect(config);

        // Resolve Server Path from DB Folder Name
        let serverPath = 'INBOX';
        if (dbFolder && dbFolder !== 'Posteingang') {
            const boxList = await connection.getBoxes();
            let foundPath = null;

            const findPath = (boxes, prefix = '') => {
                if (foundPath) return; // Stop if found
                for (const key in boxes) {
                    const box = boxes[key];
                    const fullPath = prefix + key;
                    let mappedName = fullPath; // Default

                    // Check Special Attributes
                    if (box.attribs) {
                        if (box.attribs.some(a => typeof a === 'string' && a.toLowerCase().includes('\\sent'))) mappedName = 'Gesendet';
                        else if (box.attribs.some(a => typeof a === 'string' && a.toLowerCase().includes('\\trash'))) mappedName = 'Papierkorb';
                        else if (box.attribs.some(a => typeof a === 'string' && a.toLowerCase().includes('\\junk'))) mappedName = 'Spam';
                    }

                    // Name matching overrides
                    const lower = key.toLowerCase();
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
                        return;
                    }

                    if (box.children) {
                        findPath(box.children, fullPath + (box.delimiter || '/'));
                    }
                }
            };

            findPath(boxList);

            if (foundPath) {
                serverPath = foundPath;
                console.log(`[Delete] Mapped DB folder '${dbFolder}' to Server folder '${serverPath}'`);
            } else {
                console.warn(`[Delete] Could not map '${dbFolder}' to server path. Defaulting to INBOX.`);
            }
        }

        await connection.openBox(serverPath);
        // Add \Deleted flag
        await connection.addFlags(uid, ['\\Deleted']);
        await connection.imap.expunge(uid);

        connection.end();
        return { success: true };
    } catch (error) {
        console.error('Delete Error:', error);
        return { success: false, error: error.message };
    }
}

async function setEmailFlag(account, uid, flag, value) {
    if (!uid) return { success: false, error: 'No UID' };

    const config = {
        imap: {
            user: account.username || account.email,
            password: account.password,
            host: account.imapHost,
            port: account.imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 5000
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        if (value) {
            await connection.addFlags(uid, [flag]);
        } else {
            await connection.delFlags(uid, [flag]);
        }

        connection.end();
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
