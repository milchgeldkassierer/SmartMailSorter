import {
  ImapAccount,
  SyncResult,
  Email,
  EmailOperationResult,
  CategoryOperationResult,
  Attachment,
  Category,
  AISettings,
  NotificationSettings,
  NotificationOperationResult,
} from './types';

export {};

declare global {
  interface Window {
    electron: {
      getAccounts: () => Promise<ImapAccount[]>;
      addAccount: (account: ImapAccount) => Promise<SyncResult>;
      deleteAccount: (id: string) => Promise<boolean>;
      getEmails: (accountId: string) => Promise<Email[]>;
      syncAccount: (accountId: string) => Promise<SyncResult>;
      testConnection: (account: ImapAccount) => Promise<{ success: boolean; error?: string }>;
      resetDb: () => Promise<{ success: boolean; error?: string; message?: string } | boolean>;
      deleteEmail: (data: {
        accountId: string;
        emailId: string;
        uid: number;
        folder?: string;
      }) => Promise<EmailOperationResult>;
      updateEmailRead: (data: {
        accountId: string;
        emailId: string;
        uid: number;
        isRead: boolean;
        folder?: string;
      }) => Promise<EmailOperationResult>;
      updateEmailFlag: (data: {
        accountId: string;
        emailId: string;
        uid: number;
        isFlagged: boolean;
        folder?: string;
      }) => Promise<EmailOperationResult>;
      moveEmail: (data: {
        emailId: string;
        target: string;
        type: 'folder' | 'smartCategory';
      }) => Promise<EmailOperationResult>;
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

      // Advanced Search
      searchEmails: (query: string, accountId?: string) => Promise<Email[]>;
      getSavedFilters: () => Promise<Array<{ id: string; name: string; query: string; createdAt: string }>>;
      saveFilter: (id: string, name: string, query: string) => Promise<void>;
      deleteFilter: (id: string) => Promise<void>;
      getSearchHistory: () => Promise<Array<{ id: string; query: string; timestamp: number }>>;
      addSearchHistory: (id: string, query: string) => Promise<{ success: boolean; changes: number }>;
      clearSearchHistory: () => Promise<{ success: boolean; changes: number }>;

      // AI Settings (safeStorage)
      saveAISettings: (settings: AISettings) => Promise<{ success: boolean; encrypted?: boolean; warning?: string }>;
      loadAISettings: () => Promise<AISettings | null>;
      parseNaturalLanguageQuery: (query: string) => Promise<string>;

      // Notification Settings
      loadNotificationSettings: () => Promise<NotificationSettings | null>;
      saveNotificationSettings: (settings: NotificationSettings) => Promise<NotificationOperationResult>;
      updateBadgeCount: (count: number) => Promise<void>;

      // Auto-Sync
      getAutoSyncInterval: () => Promise<number>;
      setAutoSyncInterval: (minutes: number) => Promise<{ success: boolean; error?: string }>;
      onAutoSyncCompleted: (callback: () => void) => void;
      removeAutoSyncCompletedListener: (callback: () => void) => void;

      // Event listeners
      onNotificationClicked: (callback: (data: { emailId: string }) => void) => void;
      removeNotificationClickedListener: (callback: (data: { emailId: string }) => void) => void;
    };
  }
}
