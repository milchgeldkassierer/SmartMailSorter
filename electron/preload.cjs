const { contextBridge, ipcRenderer } = require('electron');

// Track wrapper functions so listeners can be properly removed
const notificationListenerMap = new Map();

contextBridge.exposeInMainWorld('electron', {
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account) => ipcRenderer.invoke('add-account', account),
  deleteAccount: (id) => ipcRenderer.invoke('delete-account', id),
  getEmails: (accountId) => ipcRenderer.invoke('get-emails', accountId),
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

  // Categories
  getCategories: () => ipcRenderer.invoke('get-categories'),
  addCategory: (name, type) => ipcRenderer.invoke('add-category', name, type),
  updateCategoryType: (name, type) => ipcRenderer.invoke('update-category-type', name, type),
  deleteSmartCategory: (categoryName) => ipcRenderer.invoke('delete-smart-category', categoryName),
  renameSmartCategory: (data) => ipcRenderer.invoke('rename-smart-category', data),

  // AI Settings
  saveAISettings: (settings) => ipcRenderer.invoke('ai-settings-save', settings),
  loadAISettings: () => ipcRenderer.invoke('ai-settings-load'),

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

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
});
