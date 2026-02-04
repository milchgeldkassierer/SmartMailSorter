<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1MLJpHIpnT5wX2k-wh_Xj8og2kFNsePet

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## TypeScript Configuration

This project uses **TypeScript strict mode** for enhanced type safety and better error detection during development.

### What is Strict Mode?

TypeScript strict mode (`"strict": true` in `tsconfig.json`) enables a comprehensive set of type-checking rules that help catch common programming errors before runtime:

- **strictNullChecks**: Prevents `null` and `undefined` from being assigned where not explicitly allowed
- **strictFunctionTypes**: Ensures function parameter types are checked correctly
- **strictBindCallApply**: Validates that `bind`, `call`, and `apply` are used with correct arguments
- **strictPropertyInitialization**: Ensures class properties are properly initialized
- **noImplicitThis**: Requires explicit typing for `this` expressions
- **noImplicitAny**: Prevents variables from implicitly having the `any` type
- **alwaysStrict**: Emits `"use strict"` in generated JavaScript

### Benefits

Enabling strict mode provides several important advantages:

1. **Early Error Detection**: Catches entire classes of bugs during development instead of at runtime
2. **Better IDE Support**: Enables more accurate autocomplete and inline documentation
3. **Improved Code Quality**: Encourages explicit typing and reduces ambiguous code
4. **Easier Refactoring**: Type errors guide you through breaking changes when refactoring
5. **Reduced Technical Debt**: Prevents accumulation of type-unsafe patterns

### Type Checking

To run type checking manually:

```bash
npx tsc --noEmit
```

All tests include type checking to ensure type safety is maintained across the codebase.

## Logging System

This application uses **electron-log** for structured logging throughout the Electron main process. This provides automatic log rotation, environment-specific behavior, and easy access to logs for troubleshooting.

### Log Levels

The logging system supports four severity levels:

- **debug**: Verbose output for development and troubleshooting (e.g., sync progress, detailed state changes)
- **info**: Operational messages about normal application behavior
- **warn**: Warning messages about non-critical issues
- **error**: Error messages for failures and exceptions

### Environment-Specific Behavior

#### Development Mode

When running with `npm run dev`:
- **Console**: Debug-level logs appear in the terminal
- **File**: Debug-level logs are written to log files
- All verbose sync and debug output is visible for easier development

#### Production Mode

When running the packaged application:
- **Console**: Disabled (to avoid polluting stdout)
- **File**: Info-level logs only (debug logs are disabled)
- Cleaner log output focused on operational events and errors

### Finding Log Files

Log files are automatically created and rotated in the application's user data directory:

**Location:** `{userData}/logs/main.log`

The actual path depends on your operating system:

- **Linux:** `~/.config/SmartMailSorter/logs/main.log`
- **macOS:** `~/Library/Application Support/SmartMailSorter/logs/main.log`
- **Windows:** `%APPDATA%/SmartMailSorter/logs/main.log`

**Log Rotation:**
- Maximum file size: 10MB
- When the limit is reached, the current log is automatically moved to `main.log.old`
- Only one backup file is kept (newest 20MB of logs total)

### Troubleshooting with Debug Logs

#### In Development

Debug logs are enabled by default when running `npm run dev`. You'll see verbose output in your terminal including:

- IMAP sync progress and ranges
- Email processing details
- Database operations
- IPC communication details

#### In Production

To enable debug logs in a packaged application for troubleshooting:

1. Edit `electron/utils/logger.cjs`
2. Change the file transport level from `'info'` to `'debug'`:
   ```javascript
   log.transports.file.level = 'debug'; // Force debug logs in production
   ```
3. Rebuild the application

Alternatively, users can be asked to share their log files from the locations above when reporting bugs. The logs will contain info-level events which are usually sufficient for diagnosing issues.

### Attaching Logs to Bug Reports

When reporting issues, include the log file from your user data directory:

1. Navigate to the log file location (see "Finding Log Files" above)
2. Attach both `main.log` and `main.log.old` (if it exists) to your bug report
3. These files contain timestamped events that help diagnose production issues
