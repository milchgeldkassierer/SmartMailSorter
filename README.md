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

## 🏗️ Architecture

SmartMailSorter is built on a robust Electron architecture that separates concerns between the UI layer and system-level operations. This section provides a technical overview of how the application is structured and how data flows through the system.

### Electron Process Architecture

The application follows Electron's standard **two-process architecture** for security and stability:

#### Main Process (`electron/main.cjs`)

The main process is the application's backend and serves as the entry point for the Electron app. It has full access to Node.js APIs and system resources:

- **Window Management**: Creates and manages the BrowserWindow instance for the UI
- **IPC Communication**: Handles all IPC (Inter-Process Communication) requests from the renderer via `ipcMain.handle()`
- **System Integration**: Manages file system operations, external URL handling, and attachment opening
- **Process Lifecycle**: Initializes the database, sets up error handlers, and manages application startup/shutdown
- **Security Layer**: Implements context isolation and sandboxing to protect against malicious code execution

**Key IPC Handlers:**
- `get-accounts`, `add-account`, `delete-account`: Account management
- `get-emails`, `get-email-content`, `get-email-attachments`: Email retrieval
- `sync-account`, `test-connection`: IMAP operations
- `open-attachment`, `open-external-url`: System integration with security validation
- `delete-email`, `update-email-read`, `update-email-flag`: Email operations
- `categorize-emails`: AI categorization triggers

#### Renderer Process (React Frontend)

The renderer process runs the React application in a sandboxed Chromium environment:

- **UI Rendering**: React 19 components with TypeScript strict mode
- **Context Isolation**: No direct Node.js access; all system operations go through IPC
- **Preload Script**: `electron/preload.cjs` exposes a safe `window.electron` API for IPC communication
- **State Management**: React hooks and context for application state
- **Security**: Content Security Policy and no `nodeIntegration` prevent XSS attacks

### Key Components

#### 1. Database Layer (`electron/db.cjs`)

The database layer provides all data persistence using **SQLite with better-sqlite3**:

**Database Schema:**
- **`accounts` table**: Stores email account credentials, IMAP settings, sync state, and storage quotas
- **`emails` table**: Contains email metadata (sender, subject, body, HTML, dates, flags, folders, AI categories)
- **`attachments` table**: Stores attachment metadata and binary data (BLOB)
- **`categories` table**: Defines both system-provided and user-created categories

**Key Features:**
- **Synchronous API**: `better-sqlite3` provides synchronous database operations for simpler code flow
- **Foreign Key Cascade**: Account deletion automatically removes associated emails and attachments
- **Migration Support**: Automatic column additions for backward compatibility with existing databases
- **Indexed Queries**: Optimized for fast email retrieval and filtering

**Core Methods:**
- Account CRUD: `getAccounts()`, `addAccount()`, `deleteAccountDn()`, `updateAccountSync()`, `updateAccountQuota()`
- Email Operations: `getEmails()`, `saveEmail()`, `deleteEmail()`, `getEmailContent()`, `updateEmailRead()`, `updateEmailFlag()`
- Attachment Handling: `getAttachment()`, `getEmailAttachments()`
- Category Management: `getCategories()`, `addCategory()`, `deleteCategory()`

#### 2. IMAP Integration (`electron/imap.cjs`)

The IMAP module handles all email synchronization using **ImapFlow**:

**Features:**
- **Multi-Folder Sync**: Supports syncing Inbox, Sent, Spam, and Trash folders
- **Incremental Sync**: Tracks `lastSyncUid` per account to sync only new messages
- **Large-Scale Performance**: Optimized batch processing for accounts with thousands of emails
- **Folder Mapping**: Intelligent mapping between server folders and German folder names (`mapServerFolderToDbName`)
- **Server Operations**: Delete emails, mark as read/unread, toggle flags directly on IMAP server
- **Connection Management**: Automatic connection handling with error recovery

**Provider Presets:**
Built-in configuration for popular German email providers:
- **GMX**: `imap.gmx.net:993`
- **Web.de**: `imap.web.de:993`
- **Gmail**: `imap.gmail.com:993`
- Custom IMAP servers supported with manual configuration

**Sync Process:**
1. Connect to IMAP server with account credentials
2. Retrieve list of mailboxes and map to DB folder names
3. For each folder, fetch UIDs greater than `lastSyncUid`
4. Fetch email headers and bodies in batches
5. Parse MIME messages with `mailparser` (simpleParser)
6. Extract attachments and store in database
7. Update `lastSyncUid` to track sync state

**Key Functions:**
- `syncAccount(account)`: Performs full multi-folder sync
- `testConnection(account)`: Validates IMAP credentials
- `deleteEmail(account, uid, folder)`: Removes email from server
- `setEmailFlag(account, uid, folder, flag, value)`: Updates server flags
- `processMessages(client, messages, account, folder)`: Batch email processing

#### 3. AI Services (`services/geminiService.ts`)

The AI service provides **multi-provider AI integration** for email categorization:

**Supported Providers:**
- **Google Gemini**: `gemini-3-flash-preview` (fast, cost-effective), `gemini-3-pro-preview` (higher accuracy)
- **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`
- **Anthropic Claude**: `claude-3-5-sonnet-20240620`, `claude-3-haiku-20240307`

**Architecture:**
- **Unified Interface**: Single `callLLM()` function abstracts provider differences
- **JSON Schema Validation**: Enforces structured responses using provider-specific schema systems
- **Error Handling**: Graceful handling of rate limits (429 errors) and API failures
- **Response Parsing**: Multi-strategy text extraction for robust response handling

**Categorization Process:**
1. Batch emails (up to 100) for processing efficiency
2. Send email metadata (subject, sender, body preview) to AI with system instructions
3. AI analyzes content and assigns German category (Rechnungen, Newsletter, Privat, etc.)
4. Return category, confidence score, summary, and reasoning for each email
5. Store AI results in database for transparency and manual review

**Key Functions:**
- `categorizeEmails(emails, categories, settings)`: Batch categorization with confidence scoring
- `generateDemoEmails(count, settings)`: Generate realistic test emails for development
- `callLLM(prompt, systemInstruction, jsonSchema, settings)`: Core LLM interaction

**Optimization:**
- **Thinking Budget**: Limits reasoning tokens for faster responses (Gemini)
- **Batch Processing**: Reduces API calls by processing multiple emails per request
- **Confidence Scoring**: Allows users to review low-confidence categorizations

#### 4. Logging System (`electron/utils/logger.cjs`)

Centralized logging using **electron-log** for debugging and troubleshooting:

- **Environment-Aware**: Debug logs in development, info logs in production
- **Automatic Rotation**: 10MB max file size with one backup file
- **Structured Output**: Timestamped logs with severity levels (debug, info, warn, error)
- **Cross-Platform Paths**: Logs stored in OS-specific app data directories

See the [Logging System](#logging-system) section for detailed configuration and usage.

### Data Flow

Here's how email data flows through the application:

```
1. USER ACTION (Renderer Process)
   ↓
   User clicks "Sync Account" in React UI
   ↓
2. IPC COMMUNICATION (Preload Bridge)
   ↓
   window.electron.syncAccount(account) → ipcRenderer.invoke('sync-account', account)
   ↓
3. MAIN PROCESS (electron/main.cjs)
   ↓
   ipcMain.handle('sync-account') receives request
   ↓
4. IMAP SYNC (electron/imap.cjs)
   ↓
   • Connect to IMAP server (ImapFlow)
   • Fetch new emails (UID > lastSyncUid)
   • Parse MIME messages (mailparser)
   • Extract attachments
   ↓
5. DATABASE STORAGE (electron/db.cjs)
   ↓
   • saveEmail() inserts email record
   • Save attachments as BLOBs
   • Update lastSyncUid
   ↓
6. AI CATEGORIZATION (services/geminiService.ts)
   ↓
   • Batch emails for processing
   • Call AI provider API (Gemini/OpenAI/Claude)
   • Parse JSON response with category + confidence
   ↓
7. DATABASE UPDATE (electron/db.cjs)
   ↓
   • updateEmailCategory() sets smartCategory, aiSummary, aiReasoning, confidence
   ↓
8. UI UPDATE (Renderer Process)
   ↓
   • IPC response returns to React
   • State updates trigger re-render
   • User sees new emails with AI categories
```

**Key Data Flow Characteristics:**
- **Unidirectional**: Renderer → Main → IMAP/DB/AI → Main → Renderer
- **Asynchronous**: All IPC handlers return Promises for non-blocking operations
- **Transactional**: Database operations are wrapped in transactions for consistency
- **Security-First**: All external data (URLs, filenames) is sanitized before use

### File Structure Overview

```
SmartMailSorter/
├── electron/                    # Electron main process
│   ├── main.cjs                 # Application entry point, IPC handlers
│   ├── preload.cjs              # Secure IPC bridge (context isolation)
│   ├── db.cjs                   # SQLite database layer
│   ├── imap.cjs                 # IMAP email synchronization
│   ├── folderConstants.cjs      # German folder name constants
│   └── utils/
│       ├── logger.cjs           # electron-log configuration
│       └── security.cjs         # Input sanitization utilities
├── src/                         # React renderer process
│   ├── App.tsx                  # Main React application
│   ├── components/              # React UI components
│   ├── contexts/                # React context providers
│   ├── hooks/                   # Custom React hooks
│   └── types.ts                 # TypeScript type definitions
├── services/
│   └── geminiService.ts         # Multi-provider AI integration
├── public/                      # Static assets
├── dist/                        # Production build output
└── package.json                 # Dependencies and scripts
```

**Key Design Decisions:**
- **`.cjs` Extension**: Main process uses CommonJS for better Electron compatibility
- **`.ts/.tsx` Extension**: Renderer uses TypeScript for type safety
- **Separation of Concerns**: Database, IMAP, and AI logic separated into distinct modules
- **Security by Design**: Preload script enforces context isolation with no `nodeIntegration`
- **Type Safety**: Shared `types.ts` ensures consistent data structures across IPC boundaries

### Security Considerations

SmartMailSorter implements several security best practices:

1. **Context Isolation**: Renderer process has no direct Node.js access
2. **Input Sanitization**: All filenames and URLs are validated before use (`security.cjs`)
3. **Protocol Validation**: External URLs restricted to `http:`, `https:`, `mailto:`, `tel:`
4. **No Hardcoded Secrets**: API keys loaded from environment variables or user settings
5. **SQL Injection Prevention**: Parameterized queries via better-sqlite3
6. **Content Security Policy**: Restricts script execution in renderer process

**Note on Password Storage**: Account passwords are currently stored in plaintext in SQLite for development convenience. **For production use, implement Electron's `safeStorage` API** to encrypt passwords using OS-level credential storage (Keychain on macOS, Credential Vault on Windows, Secret Service on Linux).

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
