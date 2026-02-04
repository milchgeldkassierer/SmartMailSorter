const log = require('electron-log');
const { app } = require('electron');

/**
 * Configure the logger for the application
 * - Development: Debug level, verbose console output
 * - Production: Info level, file output with rotation
 */
function configureLogger() {
  // Determine if running in production (packaged app) or development
  const isProduction = app ? app.isPackaged : false;

  // Set log level based on environment
  log.transports.console.level = isProduction ? 'info' : 'debug';
  log.transports.file.level = isProduction ? 'info' : 'debug';

  // Configure file output with rotation
  log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
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
