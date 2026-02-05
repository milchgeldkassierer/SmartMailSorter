import {
  ImapAccount,
  SyncResult,
  Email,
  EmailOperationResult,
  CategoryOperationResult,
  Attachment,
  Category,
  AISettings,
} from './types';

export {};

declare global {
  interface Window {
    electron: {
      getAccounts: () => Promise<ImapAccount[]>;
      addAccount: (account: ImapAccount) => Promise<SyncResult>;
      deleteAccount: (id: string) => Promise<boolean>;
      getEmails: (accountId: string) => Promise<Email[]>;
      syncAccount: (account: ImapAccount) => Promise<SyncResult>;
      testConnection: (account: ImapAccount) => Promise<{ success: boolean; error?: string }>;
      resetDb: () => Promise<boolean>;
      deleteEmail: (data: {
        account: ImapAccount;
        emailId: string;
        uid: number;
        folder?: string;
      }) => Promise<EmailOperationResult>;
      updateEmailRead: (data: {
        account: ImapAccount;
        emailId: string;
        uid: number;
        isRead: boolean;
        folder?: string;
      }) => Promise<EmailOperationResult>;
      updateEmailFlag: (data: {
        account: ImapAccount;
        emailId: string;
        uid: number;
        isFlagged: boolean;
        folder?: string;
      }) => Promise<EmailOperationResult>;
      moveEmail: (data: { emailId: string; category: string }) => Promise<EmailOperationResult>;
      updateEmailSmartCategory: (data: {
        emailId: string;
        category: string;
        summary?: string;
        reasoning?: string;
        confidence?: number;
      }) => Promise<EmailOperationResult>;
      saveEmail: (email: Email) => Promise<void>;

      // Categories
      getCategories: () => Promise<Category[]>;
      addCategory: (name: string, type?: string) => Promise<CategoryOperationResult>;
      updateCategoryType: (name: string, type: string) => Promise<CategoryOperationResult>;
      deleteSmartCategory: (categoryName: string) => Promise<CategoryOperationResult>;
      renameSmartCategory: (data: { oldName: string; newName: string }) => Promise<CategoryOperationResult>;

      // Attachments & Content
      getEmailAttachments: (emailId: string) => Promise<Attachment[]>;
      getEmailContent: (emailId: string) => Promise<{ body: string | null; bodyHtml: string | null }>;
      openAttachment: (attachmentId: string) => Promise<{ success: boolean; message?: string }>;

      // External links
      openExternal: (url: string) => Promise<{ success: boolean; error?: string; message?: string }>;

      // Debug
      log: (msg: string) => void;

      // AI Settings (safeStorage)
      saveAISettings: (settings: AISettings) => Promise<{ success: boolean; encrypted?: boolean; warning?: string }>;
      loadAISettings: () => Promise<AISettings | null>;
    };
  }
}
