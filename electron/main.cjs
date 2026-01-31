const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const db = require('./db.cjs');
const imap = require('./imap.cjs');

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
        console.log(`[IPC] Fetching content for ${emailId}`);
        const result = db.getEmailContent(emailId);
        console.log(`[IPC] Found content length: Body=${result?.body?.length}, HTML=${result?.bodyHtml?.length}`);
        return result;
    });

    ipcMain.handle('open-attachment', async (event, attachmentId) => {
        const att = db.getAttachment(attachmentId);
        if (!att) return false;

        const fs = require('fs');
        const os = require('os');
        // Create temp file
        const tempPath = path.join(os.tmpdir(), att.filename);
        fs.writeFileSync(tempPath, att.data);

        const { shell } = require('electron');
        await shell.openPath(tempPath);
        return true;
    });

    ipcMain.handle('save-attachment-as', async (event, attachmentId) => {
        const att = db.getAttachment(attachmentId);
        if (!att) return { success: false, error: 'Attachment not found' };

        const fs = require('fs').promises;

        const result = await dialog.showSaveDialog({
            defaultPath: att.filename,
            filters: [{ name: 'All Files', extensions: ['*'] }]
        });

        if (result.canceled) return { success: false, canceled: true };

        try {
            await fs.writeFile(result.filePath, att.data);
            return { success: true, path: result.filePath };
        } catch (err) {
            return { success: false, error: err.message };
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

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
