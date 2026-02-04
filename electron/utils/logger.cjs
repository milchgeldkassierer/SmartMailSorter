const log = require('electron-log');
const { app } = require('electron');

/**
 * Configure the logger for the application
 *
 * Environment-specific behavior:
 * - Development: Debug level logs to console and file
 * - Production: Info level logs to file only (console disabled for cleaner stdout)
 *
 * File rotation:
 * - Maximum file size: 10MB
 * - When limit is exceeded, current log is moved to main.log.old
 * - Log location: {userData}/logs/main.log (accessible for bug reports)
 */
function configureLogger() {
  // Determine if running in production (packaged app) or development
  const isProduction = app ? app.isPackaged : false;

  // Configure console transport
  // Production: Disable console output to avoid polluting stdout
  // Development: Enable verbose debug output for easier troubleshooting
  if (isProduction) {
    log.transports.console.level = false; // Disable console in production
  } else {
    log.transports.console.level = 'debug'; // Verbose console in development
  }

  // Configure file transport
  // Always log to file (info level in production, debug in development)
  log.transports.file.level = isProduction ? 'info' : 'debug';
  log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB - rotates to .old when exceeded
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

  // Set log file location (only when app is available)
  if (app) {
    const path = require('path');
    const userDataPath = app.getPath('userData');
    log.transports.file.resolvePathFn = () => path.join(userDataPath, 'logs', 'main.log');
  }

  return log;
}

// Initialize logger configuration
const logger = configureLogger();

/**
 * Log a debug message
 * @param {...any} args - Message and additional data to log
 */
function debug(...args) {
  logger.debug(...args);
}

/**
 * Log an info message
 * @param {...any} args - Message and additional data to log
 */
function info(...args) {
  logger.info(...args);
}

/**
 * Log a warning message
 * @param {...any} args - Message and additional data to log
 */
function warn(...args) {
  logger.warn(...args);
}

/**
 * Log an error message
 * @param {...any} args - Message and additional data to log
 */
function error(...args) {
  logger.error(...args);
}

module.exports = {
  debug,
  info,
  warn,
  error,
};
