<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SmartMail AI Sorter (GMX-Style)

**An intelligent email management application that automatically categorizes your emails using AI.**

## Overview

SmartMail AI Sorter is a sophisticated desktop email client built with Electron that brings the power of artificial intelligence to email organization. Designed specifically for **German email power users** who manage high volumes of email across providers like GMX, Web.de, and other IMAP-compatible services, this application automatically sorts incoming mail into intelligent categories like Spam, Invoices, Newsletters, and Private conversations.

### Why SmartMailSorter?

Email overload is a universal problem, but German email users face unique challenges with providers that may have limited built-in filtering capabilities. SmartMailSorter solves this by:

- **Automated AI Categorization**: Leverages Google Gemini AI to intelligently classify emails based on content, sender patterns, and context
- **Local-First Architecture**: All email data is stored locally in SQLite, ensuring privacy and offline access
- **Real IMAP Integration**: Connects directly to your email provider via IMAP for authentic email synchronization
- **Multi-Provider Support**: Works with GMX, Web.de, Gmail, and any IMAP-compatible email service
- **Desktop Performance**: Built as an Electron application for native desktop performance and system integration

### Target Audience

This application is designed for:

- German email users managing multiple accounts across GMX, Web.de, or similar providers
- Power users who receive high volumes of email and need automated organization
- Privacy-conscious individuals who prefer local email storage over cloud-based solutions
- Developers interested in AI-powered email processing and Electron application development

### Technology Stack

- **Frontend**: React 19 with TypeScript (strict mode)
- **Desktop Framework**: Electron with native system integration
- **Database**: SQLite with better-sqlite3 for local email storage
- **AI Processing**: Google Gemini AI API for intelligent email categorization
- **Email Protocol**: IMAP via imapflow for authentic email synchronization
- **Email Parsing**: mailparser for robust MIME message handling

## Features

### 📧 IMAP Email Synchronization

- **Real-time Email Sync**: Connects directly to email providers via IMAP protocol using `imapflow`
- **Multi-Account Support**: Manage multiple email accounts (GMX, Web.de, Gmail, etc.) in a single interface
- **Incremental Sync**: Efficiently syncs only new messages to minimize bandwidth and processing time
- **Offline Access**: All synced emails are available offline after initial synchronization

### 💾 Local SQLite Storage

- **Privacy-First Design**: All email data stored locally using SQLite database with `better-sqlite3`
- **Fast Search**: Indexed database enables quick email retrieval and filtering
- **No Cloud Dependency**: Complete email archive accessible without internet connection
- **Data Ownership**: Full control over your email data with local storage

### 🤖 Multi-Provider AI Integration

- **Flexible AI Providers**: Support for multiple AI backends:
  - **Google Gemini**: `gemini-3-flash-preview`, `gemini-3-pro-preview`
  - **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`
  - **Anthropic Claude**: `claude-3-5-sonnet-20240620`, `claude-3-haiku-20240307`
- **Intelligent Categorization**: AI analyzes email content, sender patterns, and context for accurate classification
- **Confidence Scoring**: Each AI categorization includes a confidence score for transparency
- **AI Summaries**: Automatic generation of email summaries and reasoning for categorization decisions

### 🇩🇪 German Folder System

- **Native German Interface**: Built-in support for German email folder structure:
  - **Posteingang** (Inbox)
  - **Gesendet** (Sent)
  - **Spam** (Spam)
  - **Papierkorb** (Trash)
- **Smart Categories**: AI-powered virtual categories in German:
  - **Rechnungen** (Invoices)
  - **Newsletter** (Newsletters)
  - **Privat** (Private)
  - **Geschäftlich** (Business)
  - **Kündigungen** (Cancellations)
  - **Sonstiges** (Other)
- **Dual Organization**: Physical IMAP folders combined with virtual AI categories for flexible email organization

### 🏷️ Intelligent Email Categorization

- **Automatic Classification**: AI automatically categorizes emails as they arrive
- **Context-Aware Sorting**: Analyzes email content, subject lines, sender information, and patterns
- **Custom Categories**: Extensible category system for personalized email organization
- **Manual Override**: Users can manually recategorize emails and train the system
- **Flag Support**: Mark important emails with flags (Markierung) for quick access

### 📎 Attachment Handling

- **Attachment Detection**: Automatically identifies emails with attachments
- **Metadata Extraction**: Captures filename, size, and content type for each attachment
- **Visual Indicators**: Clear UI indicators for emails containing attachments
- **Efficient Storage**: Attachments are parsed and stored with associated email metadata

### 🔍 Search and Filtering

- **Full-Text Search**: Search across email subjects, bodies, and sender information
- **Category Filtering**: Filter emails by AI-assigned categories or physical folders
- **Date Range Filtering**: Find emails within specific time periods
- **Account Filtering**: View emails from specific accounts in multi-account setups
- **Combined Filters**: Apply multiple filters simultaneously for precise email discovery
- **Flag Filtering**: Quickly access flagged/marked emails
- **Read/Unread Status**: Filter by read status for inbox management

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
