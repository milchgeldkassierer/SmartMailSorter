const { Notification, app, BrowserWindow } = require('electron');
const { getNotificationSettings, getSetting } = require('./db.cjs');
const logger = require('./utils/logger.cjs');

/**
 * Safely parse muted categories JSON from settings, returning [] on failure.
 */
function getMutedCategories() {
  const json = getSetting('notifications_muted_categories');
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    logger.warn('[Notifications] Invalid muted categories JSON, defaulting to []');
    return [];
  }
}

/**
 * Check if a notification should be shown for an email based on user settings
 * @param {Object} email - The email object
 * @param {string} email.smartCategory - AI-assigned category
 * @param {string} accountId - The account ID
 * @returns {boolean} True if notification should be shown
 */
function shouldNotify(email, accountId) {
  try {
    // Check global settings first (stored in app_settings)
    const globalEnabled = getSetting('notifications_enabled');
    if (globalEnabled === '0') {
      logger.debug('Notifications globally disabled');
      return false;
    }

    // Check if this category/folder is globally muted
    const mutedCategories = getMutedCategories();
    // Check IMAP folder (e.g. Spam, Papierkorb)
    if (email.folder && mutedCategories.includes(email.folder)) {
      logger.debug(`Notifications muted for folder ${email.folder}`);
      return false;
    }
    // Check AI-assigned smart category (e.g. Rechnungen, Newsletter)
    if (email.smartCategory && mutedCategories.includes(email.smartCategory)) {
      logger.debug(`Notifications muted for category ${email.smartCategory}`);
      return false;
    }

    // Check per-account settings
    const accountSettings = getNotificationSettings(accountId);
    if (!accountSettings.enabled) {
      logger.debug(`Notifications disabled for account ${accountId}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking notification settings:', error);
    // Default to not showing notification on error
    return false;
  }
}

/**
 * Show a desktop notification for a new email
 * @param {Object} email - The email object
 * @param {string} email.id - Email ID
 * @param {string} email.sender - Sender name
 * @param {string} email.subject - Email subject
 * @param {string} email.smartCategory - AI-assigned category
 * @param {string} accountId - The account ID
 */
function showNotification(email, accountId) {
  try {
    // Check if we should show notification
    if (!shouldNotify(email, accountId)) {
      return;
    }

    // Respect OS-level Do Not Disturb settings
    if (!Notification || !Notification.isSupported()) {
      logger.warn('Notifications not supported on this system');
      return;
    }

    // Build notification body with category if available
    let body = email.subject || '(No Subject)';
    if (email.smartCategory) {
      body = `${email.smartCategory} • ${body}`;
    }

    // Create notification
    const notification = new Notification({
      title: email.sender || 'New Email',
      body: body,
      silent: false,
      // Store email ID in notification for click handling
      tag: email.id,
    });

    // Handle notification click
    notification.on('click', () => {
      logger.debug(`Notification clicked for email ${email.id}`);

      // Focus the application window
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        const mainWindow = windows[0];
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();

        // Send IPC event to renderer to navigate to the email
        mainWindow.webContents.send('notification-clicked', { emailId: email.id });
      }
    });

    // Show the notification
    notification.show();
    logger.info(`Notification shown for email: ${email.subject} from ${email.sender}`);
  } catch (error) {
    logger.error('Error showing notification:', error);
  }
}

/**
 * Update the application badge count (dock/taskbar icon)
 * @param {number} count - The unread email count
 */
function updateBadgeCount(count) {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      // macOS and Linux support setBadgeCount
      app.setBadgeCount(count);
      logger.debug(`Badge count updated to ${count}`);
    } else if (process.platform === 'win32') {
      // Windows uses overlay icon (not implemented here, would require icon images)
      // app.setOverlayIcon() requires icon paths, which is more complex
      // For now, just log on Windows
      logger.debug(`Badge count update requested (${count}) - Windows overlay icons not yet implemented`);
    }
  } catch (error) {
    logger.error('Error updating badge count:', error);
  }
}

// --- Notification Queue ---
// Emails arrive without smartCategory (AI categorization happens later).
// Queue notifications so category-based muting can be applied after categorization.
const FLUSH_DELAY_MS = 10000;
const pendingNotifications = new Map(); // emailId -> { email, accountId, timer }

/**
 * Queue a notification for a new email. The notification will be shown
 * after AI categorization updates it, or after a timeout if uncategorized.
 */
function queueNotification(email, accountId) {
  // Quick checks that don't depend on AI category
  try {
    const globalEnabled = getSetting('notifications_enabled');
    if (globalEnabled === '0') return;
    const accountSettings = getNotificationSettings(accountId);
    if (!accountSettings.enabled) return;
    // Skip immediately if the IMAP folder is muted (e.g. Spam, Papierkorb)
    if (email.folder) {
      const mutedCategories = getMutedCategories();
      if (mutedCategories.includes(email.folder)) return;
    }
  } catch (_e) {
    return;
  }

  // Set a fallback timer to show notification even if categorization never happens
  const timer = setTimeout(() => {
    const pending = pendingNotifications.get(email.id);
    if (pending) {
      pendingNotifications.delete(email.id);
      showNotification(pending.email, pending.accountId);
    }
  }, FLUSH_DELAY_MS);

  pendingNotifications.set(email.id, { email, accountId, timer });
}

/**
 * Process a pending notification after AI categorization.
 * Called when update-email-smart-category sets the category.
 */
function processPendingNotification(emailId, smartCategory) {
  const pending = pendingNotifications.get(emailId);
  if (!pending) return;

  clearTimeout(pending.timer);
  pendingNotifications.delete(emailId);

  // Update email with the assigned category before showing
  pending.email.smartCategory = smartCategory;
  showNotification(pending.email, pending.accountId);
}

/**
 * Flush all pending notifications immediately (e.g., when AI is disabled).
 */
function flushPendingNotifications() {
  for (const [emailId, pending] of pendingNotifications) {
    clearTimeout(pending.timer);
    pendingNotifications.delete(emailId);
    showNotification(pending.email, pending.accountId);
  }
}

module.exports = {
  showNotification,
  shouldNotify,
  updateBadgeCount,
  queueNotification,
  processPendingNotification,
  flushPendingNotifications,
  getMutedCategories,
};
