const { contextBridge, ipcRenderer } = require('electron');

// Track wrapper functions so listeners can be properly removed
const notificationListenerMap = new Map();
const autoSyncListenerMap = new Map();

contextBridge.exposeInMainWorld('electron', {
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account) => ipcRenderer.invoke('add-account', account),
  deleteAccount: (id) => ipcRenderer.invoke('delete-account', id),
  getEmails: (accountId) => ipcRenderer.invoke('get-emails', accountId),
  getEmailsPaginated: (accountId, limit, offset) => ipcRenderer.invoke('get-emails-paginated', accountId, limit, offset),
  getEmailCount: (accountId) => ipcRenderer.invoke('get-email-count', accountId),
  getCategoryCounts: (accountId) => ipcRenderer.invoke('get-category-counts', accountId),
  getEmailAttachments: (emailId) => ipcRenderer.invoke('get-email-attachments', emailId),
  getEmailContent: (emailId) => ipcRenderer.invoke('get-email-content', emailId),
  openAttachment: (attachmentId) => ipcRenderer.invoke('open-attachment', attachmentId),
  syncAccount: (accountId) => ipcRenderer.invoke('sync-account', accountId),
  testConnection: (account) => ipcRenderer.invoke('test-connection', account),
  resetDb: () => ipcRenderer.invoke('reset-db'),
  deleteEmail: (data) => ipcRenderer.invoke('delete-email', data),
  updateEmailRead: (data) => ipcRenderer.invoke('update-email-read', data),
  updateEmailFlag: (data) => ipcRenderer.invoke('update-email-flag', data),
  moveEmail: (data) => ipcRenderer.invoke('move-email', data),
  updateEmailSmartCategory: (data) => ipcRenderer.invoke('update-email-smart-category', data),
  saveEmail: (email) => ipcRenderer.invoke('save-email', email),

  // Categories (account-scoped)
  getCategories: (accountId) => ipcRenderer.invoke('get-categories', accountId),
  addCategory: (name, type, accountId) => ipcRenderer.invoke('add-category', name, type, accountId),
  updateCategoryType: (name, type, accountId) => ipcRenderer.invoke('update-category-type', name, type, accountId),
  deleteSmartCategory: (categoryName, accountId) => ipcRenderer.invoke('delete-smart-category', categoryName, accountId),
  renameSmartCategory: (data) => ipcRenderer.invoke('rename-smart-category', data),

  // Advanced Search
  searchEmails: (query, accountId) => ipcRenderer.invoke('search-emails', query, accountId),
  getSavedFilters: () => ipcRenderer.invoke('get-filters'),
  saveFilter: (id, name, query) => ipcRenderer.invoke('save-filter', id, name, query),
  deleteFilter: (id) => ipcRenderer.invoke('delete-filter', id),
  getSearchHistory: () => ipcRenderer.invoke('get-search-history'),
  addSearchHistory: (id, query) => ipcRenderer.invoke('save-search-history', id, query),
  clearSearchHistory: () => ipcRenderer.invoke('clear-search-history'),

  // AI Settings
  saveAISettings: (settings) => ipcRenderer.invoke('ai-settings-save', settings),
  loadAISettings: () => ipcRenderer.invoke('ai-settings-load'),
  parseNaturalLanguageQuery: (query) => ipcRenderer.invoke('parse-natural-language-query', query),

  // AI call (routed through main process to avoid CORS)
  aiCall: (params) => ipcRenderer.invoke('ai-call', params),

  // Ollama
  ollamaDetect: () => ipcRenderer.invoke('ollama-detect'),

  // Notification Settings (Global + Per-Account)
  loadNotificationSettings: () => ipcRenderer.invoke('load-notification-settings'),
  saveNotificationSettings: (settings) => ipcRenderer.invoke('save-notification-settings', settings),
  updateBadgeCount: (count) => ipcRenderer.invoke('update-badge-count', count),

  // Event listeners
  onNotificationClicked: (callback) => {
    const wrapper = (_event, data) => callback(data);
    notificationListenerMap.set(callback, wrapper);
    ipcRenderer.on('notification-clicked', wrapper);
  },
  removeNotificationClickedListener: (callback) => {
    const wrapper = notificationListenerMap.get(callback);
    if (wrapper) {
      ipcRenderer.removeListener('notification-clicked', wrapper);
      notificationListenerMap.delete(callback);
    }
  },

  // Auto-Sync Settings
  getAutoSyncInterval: () => ipcRenderer.invoke('get-auto-sync-interval'),
  setAutoSyncInterval: (minutes) => ipcRenderer.invoke('set-auto-sync-interval', minutes),
  onAutoSyncCompleted: (callback) => {
    const wrapper = (_event, data) => callback(data);
    autoSyncListenerMap.set(callback, wrapper);
    ipcRenderer.on('auto-sync-completed', wrapper);
  },
  removeAutoSyncCompletedListener: (callback) => {
    const wrapper = autoSyncListenerMap.get(callback);
    if (wrapper) {
      ipcRenderer.removeListener('auto-sync-completed', wrapper);
      autoSyncListenerMap.delete(callback);
    }
  },

  // Categorization Feedback
  saveCategorizationFeedback: (feedback) => ipcRenderer.invoke('save-categorization-feedback', feedback),
  getCategorizationFeedback: (accountId, limit) => ipcRenderer.invoke('get-categorization-feedback', accountId, limit),
  getRecentFeedbackForSender: (accountId, senderEmail, limit) => ipcRenderer.invoke('get-recent-feedback-for-sender', accountId, senderEmail, limit),
  exportCategorizationFeedback: (accountId) => ipcRenderer.invoke('export-categorization-feedback', accountId),
  clearCategorizationFeedback: (accountId) => ipcRenderer.invoke('clear-categorization-feedback', accountId),

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
});
