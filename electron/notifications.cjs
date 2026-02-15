const { Notification, app, BrowserWindow } = require('electron');
const { getNotificationSettings } = require('./db.cjs');
const logger = require('./utils/logger.cjs');

/**
 * Check if a notification should be shown for an email based on user settings
 * @param {Object} email - The email object
 * @param {string} email.smartCategory - AI-assigned category
 * @param {string} accountId - The account ID
 * @returns {boolean} True if notification should be shown
 */
function shouldNotify(email, accountId) {
  try {
    const settings = getNotificationSettings(accountId);

    // Check if notifications are enabled for this account
    if (!settings.enabled) {
      logger.debug(`Notifications disabled for account ${accountId}`);
      return false;
    }

    // Check if this category is muted
    if (email.smartCategory && settings.mutedCategories.includes(email.smartCategory)) {
      logger.debug(`Notifications muted for category ${email.smartCategory}`);
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
    if (!Notification.isSupported()) {
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

module.exports = {
  showNotification,
  shouldNotify,
  updateBadgeCount,
};
