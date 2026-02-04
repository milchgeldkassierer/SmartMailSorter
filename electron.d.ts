import { ImapAccount, SyncResult } from './types';

export { };

declare global {
    interface Window {
        electron: {
            getAccounts: () => Promise<ImapAccount[]>;
            addAccount: (account: ImapAccount) => Promise<ImapAccount>;
            deleteAccount: (id: string) => Promise<boolean>;
            getEmails: (accountId: string) => Promise<any[]>;
            syncAccount: (account: ImapAccount) => Promise<SyncResult>;
            testConnection: (account: ImapAccount) => Promise<{ success: boolean; error?: string }>;
            resetDb: () => Promise<boolean>;
            deleteEmail: (data: { account: any, emailId: string, uid: number }) => Promise<any>;
            updateEmailRead: (data: { account: any, emailId: string, uid: number, isRead: boolean, folder?: string }) => Promise<any>;
            updateEmailFlag: (data: { account: any, emailId: string, uid: number, isFlagged: boolean, folder?: string }) => Promise<any>;
            moveEmail: (data: { emailId: string, category: string }) => Promise<any>;
            updateEmailSmartCategory: (data: { emailId: string, category: string, summary?: string, reasoning?: string, confidence?: number }) => Promise<any>;
            saveEmail: (email: any) => Promise<void>;

            // Categories
            getCategories: () => Promise<{ name: string, type: string }[]>;
            addCategory: (name: string, type?: string) => Promise<any>;
            updateCategoryType: (name: string, type: string) => Promise<any>;
            deleteSmartCategory: (categoryName: string) => Promise<any>;
            renameSmartCategory: (data: { oldName: string, newName: string }) => Promise<{ success: boolean }>;

            // Attachments & Content
            getEmailAttachments: (emailId: string) => Promise<any[]>;
            getEmailContent: (emailId: string) => Promise<{ body: string | null, bodyHtml: string | null }>;
            openAttachment: (attachmentId: string) => Promise<void>;

            // External links
            openExternal: (url: string) => Promise<{ success: boolean; error?: string; message?: string }>;

            // Debug
            log: (msg: string) => void;
        };
    }
}
