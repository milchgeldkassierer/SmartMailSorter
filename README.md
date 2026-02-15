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

#### 3. AI Services (`src/services/geminiService.ts`)

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
│   ├── tests/                   # Backend unit tests
│   └── utils/
│       ├── csp-config.cjs       # Content Security Policy configuration
│       ├── logger.cjs           # electron-log configuration
│       └── security.cjs         # Input sanitization utilities
├── src/                         # React renderer process
│   ├── App.tsx                  # Main React application
│   ├── components/              # React UI components
│   ├── contexts/                # React context providers (DialogContext)
│   ├── hooks/                   # Custom React hooks
│   ├── services/
│   │   └── geminiService.ts     # Multi-provider AI integration
│   ├── utils/                   # Shared utilities (sanitizeHtml, formatTimeAgo, emailHtml)
│   └── types.ts                 # TypeScript type definitions
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
6. **Content Security Policy**: Restricts script execution and resource loading in renderer process (see detailed section below)

#### Content Security Policy (CSP)

SmartMailSorter implements a **strict Content Security Policy** to provide defense-in-depth protection against Cross-Site Scripting (XSS) attacks and unauthorized code execution. The CSP is configured through two layers for maximum protection:

**Implementation Layers:**

1. **HTTP Headers** (`electron/main.cjs`): CSP headers are injected via `session.defaultSession.webRequest.onHeadersReceived()` in the main process
2. **Meta Tag** (`index.html`): A CSP meta tag provides fallback protection in case headers fail to apply

**CSP Directives Explained:**

| Directive | Production Value | Purpose |
|-----------|-----------------|---------|
| `default-src` | `'self'` | Default policy: only load resources from the application's origin |
| `script-src` | `'self' https://cdn.tailwindcss.com https://esm.sh` | Allow scripts from: app bundle, Tailwind CSS CDN, ES modules from esm.sh. **Blocks inline scripts and `eval()`** to prevent XSS |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com` | Allow styles from: app bundle, inline styles (required for React), Google Fonts, Tailwind CDN |
| `font-src` | `'self' https://fonts.gstatic.com` | Allow fonts from: app bundle, Google Fonts CDN |
| `connect-src` | `'self' https://api.openai.com https://generativelanguage.googleapis.com` | Restrict network connections to: app origin, OpenAI API, Google Gemini API. **Blocks connections to arbitrary external hosts** |
| `img-src` | `'self' data: https:` | Allow images from: app bundle, data URIs (inline images), HTTPS sources |
| `frame-src` | `'none'` | **Block all iframe embedding** to prevent clickjacking attacks |

**Why These Domains Are Whitelisted:**

- **`https://cdn.tailwindcss.com`**: Application uses Tailwind CSS via CDN for styling
- **`https://esm.sh`**: Application loads React and dependencies as ES modules from esm.sh CDN
- **`https://fonts.googleapis.com` / `https://fonts.gstatic.com`**: Application uses Inter font from Google Fonts
- **`https://api.openai.com`**: Required for OpenAI GPT models (gpt-4o, gpt-4o-mini, gpt-4-turbo)
- **`https://generativelanguage.googleapis.com`**: Required for Google Gemini AI models (gemini-3-flash-preview, gemini-3-pro-preview)

**Development vs Production:**

The CSP automatically adjusts based on the environment:

**Development Mode** (when `isDev` is true):
- Allows `http://localhost:3000` for Vite dev server
- Allows `ws://localhost:3000` for Hot Module Replacement (HMR)
- Permits `'unsafe-eval'` for development tooling
- Enables `'unsafe-inline'` for development convenience

**Production Mode** (packaged application):
- Strict CSP with no localhost or eval allowed
- Only whitelisted external domains permitted
- Maximum protection against XSS attacks

**Security Benefits:**

1. **XSS Mitigation**: Even if an attacker injects malicious HTML through email content, inline scripts are blocked by CSP
2. **Data Exfiltration Prevention**: The `connect-src` directive prevents XSS payloads from sending stolen data to attacker-controlled servers
3. **Code Injection Defense**: Blocks `eval()`, `Function()`, and inline event handlers that could execute arbitrary code
4. **Defense-in-Depth**: CSP provides a second layer of protection even if HTML sanitization is bypassed

**Adding New External Resources:**

If you need to add a new external CDN or API endpoint:

1. **Update CSP Headers** in `electron/main.cjs`:
   ```javascript
   const cspDirectives = [
     // ... existing directives ...
     "script-src 'self' https://cdn.tailwindcss.com https://esm.sh https://new-cdn.example.com",
   ];
   ```

2. **Update CSP Meta Tag** in `index.html`:
   ```html
   <meta http-equiv="Content-Security-Policy"
         content="...; script-src 'self' https://cdn.tailwindcss.com https://esm.sh https://new-cdn.example.com; ..." />
   ```

3. **Update Tests** in `electron/tests/security.csp.test.ts` to verify the new domain is allowed

4. **Document the Change**: Update this README section to explain why the new domain is whitelisted

**Important**: Never add `'unsafe-inline'` to `script-src` or `'unsafe-eval'` in production, as this defeats the purpose of CSP and allows XSS attacks.

**Note on Password Storage**: Account passwords are currently stored in plaintext in SQLite for development convenience. **For production use, implement Electron's `safeStorage` API** to encrypt passwords using OS-level credential storage (Keychain on macOS, Credential Vault on Windows, Secret Service on Linux).

## ⚙️ Configuration

This section details the core configuration elements of SmartMailSorter, including database setup, AI provider configuration, and the German folder naming conventions.

### Database Configuration

SmartMailSorter uses **SQLite** with the `better-sqlite3` library for local email storage, providing fast, reliable, and privacy-focused data persistence.

#### Database Location

The SQLite database file is automatically created in the **Electron user data directory**:

- **Windows**: `%APPDATA%\SmartMailSorter\smartmail.db`
- **macOS**: `~/Library/Application Support/SmartMailSorter/smartmail.db`
- **Linux**: `~/.config/SmartMailSorter/smartmail.db`

The database is created automatically on first launch. No manual setup is required.

#### Database Schema Overview

The application uses a relational schema with four core tables:

**1. `accounts` Table**
Stores email account configuration and sync state:
```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,              -- Unique account identifier
  name TEXT,                        -- Display name (e.g., "Work Email")
  email TEXT,                       -- Email address
  provider TEXT,                    -- Provider name (GMX, Web.de, Gmail, Custom)
  imapHost TEXT,                    -- IMAP server hostname
  imapPort INTEGER,                 -- IMAP port (typically 993 for SSL)
  username TEXT,                    -- IMAP username
  password TEXT,                    -- IMAP password (plaintext in dev)
  color TEXT,                       -- UI color identifier
  lastSyncUid INTEGER DEFAULT 0,    -- Last synced email UID (for incremental sync)
  storageUsed INTEGER DEFAULT 0,    -- Used storage in bytes
  storageTotal INTEGER DEFAULT 0    -- Total storage quota in bytes
)
```

**2. `emails` Table**
Stores email metadata and content:
```sql
CREATE TABLE emails (
  id TEXT PRIMARY KEY,              -- Unique email identifier
  accountId TEXT,                   -- Foreign key to accounts table
  sender TEXT,                      -- Sender display name
  senderEmail TEXT,                 -- Sender email address
  subject TEXT,                     -- Email subject
  body TEXT,                        -- Plain text body
  bodyHtml TEXT,                    -- HTML body content
  date TEXT,                        -- ISO 8601 timestamp
  folder TEXT DEFAULT 'Posteingang',-- Physical IMAP folder (German)
  smartCategory TEXT,               -- AI-assigned virtual category (German)
  isRead INTEGER,                   -- Read status (0/1)
  isFlagged INTEGER,                -- Flag status (0/1)
  hasAttachments INTEGER DEFAULT 0, -- Attachment indicator (0/1)
  aiSummary TEXT,                   -- AI-generated email summary
  aiReasoning TEXT,                 -- AI categorization reasoning
  confidence REAL,                  -- AI confidence score (0.0-1.0)
  uid INTEGER,                      -- IMAP server UID
  FOREIGN KEY(accountId) REFERENCES accounts(id) ON DELETE CASCADE
)
```

**3. `attachments` Table**
Stores email attachments as BLOBs:
```sql
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,              -- Unique attachment identifier
  emailId TEXT,                     -- Foreign key to emails table
  filename TEXT,                    -- Original filename
  contentType TEXT,                 -- MIME type
  size INTEGER,                     -- Size in bytes
  data BLOB,                        -- Binary attachment data
  FOREIGN KEY(emailId) REFERENCES emails(id) ON DELETE CASCADE
)
```

**4. `categories` Table**
Defines system and custom email categories:
```sql
CREATE TABLE categories (
  name TEXT PRIMARY KEY,            -- Category name (German)
  type TEXT DEFAULT 'custom',       -- 'system' or 'custom'
  icon TEXT                         -- Icon identifier
)
```

**Default System Categories:**
- `Rechnungen` (Invoices) - system
- `Newsletter` (Newsletters) - system
- `Privat` (Private) - system
- `Geschäftlich` (Business) - system
- `Kündigungen` (Cancellations) - system
- `Sonstiges` (Other) - system

#### Schema Migrations

The database automatically applies column migrations on startup to ensure backward compatibility. If new columns are added in updates, existing databases will be upgraded automatically using `ALTER TABLE` statements with safe defaults.

**Migration Strategy:**
- Column additions wrapped in try-catch blocks (ignore errors if column exists)
- Foreign key cascade deletes ensure referential integrity
- Sync process migrates custom categories from `emails.smartCategory` to `categories` table

### AI Provider Configuration

SmartMailSorter supports **three major AI providers** for email categorization. You can configure your preferred provider and model through the application settings.

#### Supported AI Providers

**1. Google Gemini** (Default)
- **Models Available:**
  - `gemini-3-flash-preview` - Fast, cost-effective categorization (recommended)
  - `gemini-3-pro-preview` - Higher accuracy with extended reasoning
- **API Key Setup:**
  1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
  2. Create or sign in to your Google account
  3. Generate a new API key
  4. Copy the key and paste it into SmartMailSorter Settings → AI Configuration
- **Environment Variable (Optional):**
  ```bash
  export API_KEY=your_gemini_api_key_here
  ```
- **Rate Limits:** Generous free tier with rate limiting on high usage

**2. OpenAI**
- **Models Available:**
  - `gpt-4o` - Latest GPT-4 optimized model (recommended)
  - `gpt-4o-mini` - Faster, lower-cost version
  - `gpt-4-turbo` - High-performance GPT-4 variant
- **API Key Setup:**
  1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
  2. Create an account and add billing information
  3. Generate a new secret key
  4. Copy the key and paste it into SmartMailSorter Settings → AI Configuration
- **Environment Variable (Optional):**
  ```bash
  export OPENAI_API_KEY=your_openai_api_key_here
  ```
- **Rate Limits:** Based on usage tier and billing plan

**3. Anthropic Claude**
- **Models Available:**
  - `claude-3-5-sonnet-20240620` - Balanced performance and accuracy (recommended)
  - `claude-3-haiku-20240307` - Fast, cost-effective option
- **API Key Setup:**
  1. Visit [Anthropic Console](https://console.anthropic.com/)
  2. Create an account and verify your email
  3. Navigate to API Keys section
  4. Generate a new API key
  5. Copy the key and paste it into SmartMailSorter Settings → AI Configuration
- **Environment Variable (Optional):**
  ```bash
  export ANTHROPIC_API_KEY=your_anthropic_api_key_here
  ```
- **Rate Limits:** Based on usage tier

#### API Key Configuration

**Option 1: Settings UI (Recommended)**
1. Launch SmartMailSorter
2. Navigate to **Settings** → **AI Configuration**
3. Select your preferred provider from the dropdown
4. Choose a model from the available options
5. Paste your API key
6. Click **Save Settings**

**Option 2: Environment Variables**
Set the appropriate environment variable before launching the application:

```bash
# Linux/macOS
export API_KEY=your_gemini_api_key_here
npm start

# Windows (PowerShell)
$env:API_KEY="your_gemini_api_key_here"
npm start

# Windows (Command Prompt)
set API_KEY=your_gemini_api_key_here
npm start
```

**Security Note:** API keys are stored in the SQLite database or read from environment variables. For production deployments, consider using Electron's `safeStorage` API or system keychains for enhanced security.

#### AI Model Selection Guide

Choose the right model based on your needs:

| Provider | Model | Speed | Cost | Accuracy | Best For |
|----------|-------|-------|------|----------|----------|
| **Gemini** | `gemini-3-flash-preview` | ⚡⚡⚡ Fast | 💰 Low | ⭐⭐⭐ Good | High-volume email processing |
| **Gemini** | `gemini-3-pro-preview` | ⚡⚡ Medium | 💰💰 Medium | ⭐⭐⭐⭐ Excellent | Complex categorization needs |
| **OpenAI** | `gpt-4o-mini` | ⚡⚡⚡ Fast | 💰 Low | ⭐⭐⭐ Good | Budget-conscious users |
| **OpenAI** | `gpt-4o` | ⚡⚡ Medium | 💰💰💰 High | ⭐⭐⭐⭐⭐ Best | Maximum accuracy required |
| **Claude** | `claude-3-haiku` | ⚡⚡⚡ Fast | 💰 Low | ⭐⭐⭐ Good | Fast, reliable categorization |
| **Claude** | `claude-3-5-sonnet` | ⚡⚡ Medium | 💰💰 Medium | ⭐⭐⭐⭐ Excellent | Balanced performance |

**Recommendation:** Start with `gemini-3-flash-preview` for its excellent balance of speed, cost, and accuracy.

### German Folder Naming System

SmartMailSorter is designed specifically for German email users and uses **German folder names** throughout the application. This section explains the dual-layer organization system.

#### Physical IMAP Folders (Server-Side)

These folders correspond to **actual folders on your email server** and are synced via IMAP:

| German Name | English Translation | IMAP Purpose |
|-------------|---------------------|--------------|
| **Posteingang** | Inbox | New, unread emails |
| **Gesendet** | Sent | Emails you've sent |
| **Spam** | Spam | Suspected spam messages |
| **Papierkorb** | Trash | Deleted emails |

**Constants in Code:**
```typescript
export const INBOX_FOLDER = 'Posteingang';
export const SENT_FOLDER = 'Gesendet';
export const SPAM_FOLDER = 'Spam';
export const TRASH_FOLDER = 'Papierkorb';
export const SYSTEM_FOLDERS = [INBOX_FOLDER, SENT_FOLDER, SPAM_FOLDER, TRASH_FOLDER];
```

These folders are **read-only to AI categorization** - they represent the physical structure of your email account.

#### Virtual AI Categories (Application-Side)

SmartMailSorter overlays **virtual categories** on top of physical folders using AI classification. These categories are stored in the `emails.smartCategory` column and do not modify the server-side folder structure.

**Default AI Categories:**

| German Name | English Translation | Description | Typical Examples |
|-------------|---------------------|-------------|------------------|
| **Rechnungen** | Invoices | Bills, receipts, invoices | Amazon orders, utility bills, tax documents |
| **Newsletter** | Newsletters | Marketing emails, subscriptions | Company updates, promotional emails, digests |
| **Privat** | Private | Personal communications | Family emails, friend messages, personal invitations |
| **Geschäftlich** | Business | Work-related emails | Client correspondence, meeting invites, project updates |
| **Kündigungen** | Cancellations | Service cancellations, terminations | Subscription cancellations, contract terminations |
| **Sonstiges** | Other | Unclassified or miscellaneous | Emails that don't fit other categories |

**Enum Definition:**
```typescript
export enum DefaultEmailCategory {
  INBOX = 'Posteingang',
  SENT = 'Gesendet',
  SPAM = 'Spam',
  TRASH = 'Papierkorb',
  INVOICE = 'Rechnungen',
  NEWSLETTER = 'Newsletter',
  PRIVATE = 'Privat',
  BUSINESS = 'Geschäftlich',
  CANCELLATION = 'Kündigungen',
  OTHER = 'Sonstiges',
}
```

#### Dual Organization Example

An email might have:
- **Physical Folder:** `Posteingang` (stored in IMAP folder on server)
- **Smart Category:** `Rechnungen` (AI-assigned virtual category)

This allows you to:
1. **Filter by physical folder** to see what's in your Inbox, Sent, etc.
2. **Filter by AI category** to see all invoices across all folders
3. **Combine filters** to see "Invoices in my Inbox" or "Business emails in Sent"

#### Custom Categories

Users can create **custom categories** beyond the default system categories:

1. Navigate to **Settings** → **Categories**
2. Click **Add Category**
3. Enter a German name (e.g., "Versicherung" for Insurance)
4. Choose an icon
5. Click **Save**

Custom categories are stored in the `categories` table with `type = 'custom'` and can be deleted by users. System categories cannot be deleted.

#### Category Localization

While the current implementation uses German names throughout, the architecture supports future localization:
- Category names are stored as data, not hard-coded
- UI labels can be mapped to translations
- The `categories` table can be extended with locale fields

**Future Enhancement:** Add support for English, French, and Spanish folder names with user-selectable language preferences.

## 🚀 Getting Started

This section provides complete setup instructions for running SmartMailSorter locally on your development machine.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version **18.x or higher** (LTS recommended)
  - Check your version: `node --version`
  - Download from [nodejs.org](https://nodejs.org/)
- **npm**: Version **8.x or higher** (comes with Node.js)
  - Check your version: `npm --version`
- **Build Tools**: Required for native module compilation (better-sqlite3)
  - **Windows**: Install [Windows Build Tools](https://github.com/felixrieseberg/windows-build-tools) or Visual Studio Build Tools
  - **macOS**: Install Xcode Command Line Tools: `xcode-select --install`
  - **Linux**: Install `build-essential`: `sudo apt-get install build-essential`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/SmartMailSorter.git
   cd SmartMailSorter
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

   This will install all required packages including Electron, React, and native modules.

3. **Rebuild native modules for Electron:**

   SmartMailSorter uses `better-sqlite3`, a native Node.js module that must be compiled for Electron's runtime:

   ```bash
   npm run rebuild:electron
   ```

   This command uses `electron-rebuild` to recompile `better-sqlite3` against Electron's Node.js headers, ensuring compatibility with the Electron environment.

   > **Note**: This step is **critical**. If you skip it, you'll encounter errors like "Module did not self-register" when the app tries to access the database.

4. **Configure AI API credentials:**

   Create a `.env.local` file in the project root with your AI provider API key:

   ```bash
   # For Google Gemini (recommended)
   GEMINI_API_KEY=your_gemini_api_key_here

   # For OpenAI (optional)
   OPENAI_API_KEY=your_openai_api_key_here

   # For Anthropic Claude (optional)
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

   **To get API keys:**
   - **Google Gemini**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **OpenAI**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Anthropic**: Visit [Anthropic Console](https://console.anthropic.com/)

### Development Workflow

#### Running the Application

To start the application in development mode:

```bash
npm run electron:dev
```

This command does the following:
1. Rebuilds native modules for Electron (`npm run rebuild:electron`)
2. Starts the Vite development server on port 3000
3. Waits for the dev server to be ready
4. Launches the Electron application pointing to `http://localhost:3000`

The Electron window will automatically reload when you make changes to React components, and the main process will need to be manually restarted (Ctrl+C and re-run) when you modify `electron/*.cjs` files.

**Hot Module Replacement (HMR):**
- React component changes trigger instant hot reloading
- CSS/styling changes apply without full page reload
- Main process changes require application restart

#### Running Tests

SmartMailSorter uses **Vitest** with a workspace configuration for organizing tests across different concerns. The test suite is split into separate configurations to isolate unit tests from component tests.

**Test Structure:**

The project uses a **Vitest workspace** (`vitest.workspace.ts`) that defines multiple test projects:
- **Unit Tests** (`vitest.config.ts`): Tests for backend logic, database operations, IMAP sync, and AI services
- **Component Tests** (`vitest.config.components.ts`): React component tests with `@testing-library/react` and JSDOM

This separation allows you to:
- Run backend tests without loading React Testing Library overhead
- Test components in isolation with proper browser environment simulation
- Parallelize test execution across different test suites

**Running Tests:**

```bash
# Run all tests (default configuration)
npm test

# Run with coverage report
npm run test:coverage

# Run component tests only
npm run test:components

# Watch mode for component tests
npm run test:components:watch

# Run all test suites (unit + components)
npm run test:all

# Run with full coverage report for all suites
npm run test:all:coverage

# Run tests using workspace configuration
npm run test:workspace
```

**Before running tests**, ensure native modules are compiled for Node.js:

```bash
npm run rebuild:node
```

This is necessary because tests run in the Node.js environment, not Electron, so `better-sqlite3` must be compiled against Node.js headers.

**Type Checking:**

To manually verify TypeScript type correctness across the entire codebase:

```bash
npx tsc --noEmit
```

This runs the TypeScript compiler in check-only mode without emitting output files, catching type errors that may not be caught by tests alone. Type checking is especially important in strict mode to ensure null safety and proper type narrowing.

#### Code Quality Tools

```bash
# Lint TypeScript/JavaScript files
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check
```

### Building for Production

To create a production build of the application:

```bash
npm run electron:build
```

This command:
1. Runs `npm run build` to create an optimized production build of the React frontend (output to `dist/`)
2. Runs `electron-builder` to package the application into a distributable format

**Build Output:**

The packaged application will be created in the `dist-electron/` directory with platform-specific installers:

- **Windows**: `.exe` installer (NSIS)
- **macOS**: `.dmg` disk image and `.app` bundle
- **Linux**: `.AppImage`, `.deb`, or `.rpm` (depending on configuration)

**Build Configuration:**

Electron Builder configuration is defined in `package.json` under the `"build"` key. You can customize:
- Application icon
- Installer settings
- Code signing (for macOS and Windows)
- File associations
- Auto-updater configuration

**Platform-Specific Builds:**

To build for a specific platform:

```bash
# Build for Windows only
npm run electron:build -- --win

# Build for macOS only
npm run electron:build -- --mac

# Build for Linux only
npm run electron:build -- --linux
```

### Troubleshooting

#### "Module did not self-register" Error

This error occurs when `better-sqlite3` is compiled for the wrong runtime (Node.js vs Electron).

**Solution:**
- If running the app: `npm run rebuild:electron`
- If running tests: `npm run rebuild:node`

#### Port 3000 Already in Use

If another application is using port 3000, you'll need to either:
- Stop the other application
- Or modify the Vite configuration in `vite.config.ts` to use a different port

#### Electron Window Opens But Shows Blank Screen

This usually means the Vite dev server hasn't started yet. The `wait-on` package should handle this automatically, but if you see this issue:
1. Check if Vite is running on `http://localhost:3000`
2. Check the terminal for Vite startup errors
3. Try restarting the development server

#### Native Module Compilation Failures

If `npm run rebuild:electron` fails:
- **Windows**: Ensure Visual Studio Build Tools are installed
- **macOS**: Run `xcode-select --install` to install Command Line Tools
- **Linux**: Install `build-essential` and `python3`
- Check that your Node.js version is 18.x or higher

For more detailed logs during rebuild:
```bash
npm run rebuild:electron -- --verbose
```

### Development Tips

1. **Database Location**: The SQLite database is stored in your OS's application data directory:
   - **Linux**: `~/.config/SmartMailSorter/smartmail.db`
   - **macOS**: `~/Library/Application Support/SmartMailSorter/smartmail.db`
   - **Windows**: `%APPDATA%/SmartMailSorter/smartmail.db`

2. **Clearing Data**: To start fresh, delete the database file and restart the application.

3. **DevTools**: Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS) to open Chrome DevTools in the Electron renderer process.

4. **Main Process Debugging**: Add `debugger` statements in `electron/*.cjs` files and run with:
   ```bash
   NODE_ENV=development electron --inspect .
   ```
   Then connect to `chrome://inspect` in Chrome.

5. **Log Files**: Check log files for debugging (see [Logging System](#logging-system) section):
   - Development mode: Logs appear in terminal
   - Production mode: Check `{userData}/logs/main.log`

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
