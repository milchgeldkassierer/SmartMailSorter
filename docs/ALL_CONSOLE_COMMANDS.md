# SmartMailSorter - CLI Commands

## Tests

```bash
npm test                        # Backend/Electron Tests (vitest, environment: node)
npm run test:components         # Frontend/React Component Tests (vitest, environment: jsdom)
npm run test:all                # Alle Tests zusammen (backend + components sequentiell)
npm run test:all:coverage       # Alle Tests mit Coverage
npm run test:coverage           # Backend Tests mit Coverage
npm run test:components:coverage # Component Tests mit Coverage
npm run test:components:watch   # Component Tests im Watch-Modus
npm run test:workspace          # Backend Tests (Alias, mit rebuild)
npm run test:workspace:coverage # Backend Tests mit Coverage (Alias, mit rebuild)
```

### Einzelne Test-Dateien / Patterns

```bash
# Backend: Einzelne Test-Datei
npx vitest run electron/tests/searchParser.test.ts

# Components: Einzelne Test-Datei
npx vitest run -c vitest.config.components.ts src/components/__tests__/EmailList.test.tsx

# Nur Tests mit bestimmtem Namen (-t Flag)
npx vitest run -c vitest.config.components.ts src/components/__tests__/EmailList.test.tsx -t "special characters"

# Verbose Output
npx vitest run --reporter=verbose electron/tests/searchParser.test.ts
```

## Test-Environment: Vorbedingungen & Konfiguration

### Zwei getrennte vitest-Konfigurationen

| Config                        | Environment | Setup-Datei                         | Scope                                                                             |
| ----------------------------- | ----------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| `vitest.config.ts`            | `node`      | `electron/tests/vitest-setup.js`    | `electron/tests/**`, `src/services/__tests__/**`                                  |
| `vitest.config.components.ts` | `jsdom`     | `src/components/__tests__/setup.ts` | `src/components/__tests__/**`, `src/hooks/__tests__/**`, `src/utils/__tests__/**` |

### Backend Tests (vitest.config.ts)

- **Environment:** `node` (kein DOM verfügbar)
- **Setup:** `electron/tests/vitest-setup.js`
  - Patcht `require('imapflow')` mit MockImapFlow-Klasse
  - Stellt `global.__mockState` bereit (serverEmails, shouldFailConnect, shouldFailFetch, folderList, quotaResponse)
  - Exportiert Helfer: `resetMockState()`, `setServerEmails()`, `setConnectFailure()`, `setFetchFailure()`, `setFolderList()`, `setQuotaResponse()`
- **Vorbedingung:** `npm run rebuild:node` (better-sqlite3 muss für Node kompiliert sein)
- **Coverage-Thresholds:** lines 85%, functions 85%, branches 70%, statements 85%

### Component Tests (vitest.config.components.ts)

- **Environment:** `jsdom` (simuliertes DOM für React-Komponenten)
- **Plugin:** `@vitejs/plugin-react` (JSX-Transform)
- **Setup:** `src/components/__tests__/setup.ts`
  - Initialisiert i18next mit inline DE/EN Übersetzungen (kein Laden externer Dateien)
  - Setzt Sprache auf `de` vor jedem Test (`beforeEach`)
  - Importiert `@testing-library/jest-dom/vitest` (Custom Matchers wie `toBeInTheDocument()`)
  - Ruft `cleanup()` nach jedem Test auf (React Testing Library)
- **Vorbedingung:** Keine (kein native-Module-Rebuild nötig)
- **Coverage-Thresholds:** lines 80%, functions 80%, branches 75%

### Wichtige Hinweise

- `src/hooks/__tests__/**` und `src/utils/__tests__/**` laufen unter `jsdom` (Component-Config), NICHT unter Node
- Backend-Tests nutzen `globals: true` (describe, it, expect ohne Import)
- Component-Tests nutzen `globals: true` + jest-dom Matchers
- `better-sqlite3` muss je nach Ziel-Runtime unterschiedlich kompiliert werden:
  - `npm run rebuild:node` für Backend-Tests (vitest)
  - `npm run rebuild:electron` für Electron-App

## Build & Type-Check

```bash
npm run build                   # Vite Production Build
npx tsc --noEmit                # TypeScript Type-Check (ohne Output)
```

## Lint & Format

```bash
npm run lint                    # ESLint
npm run lint:fix                # ESLint mit Auto-Fix
npm run format:check            # Prettier Check
npm run format                  # Prettier Auto-Format
```

## Development

```bash
npm run dev                     # Vite Dev-Server (Port 3000)
npm run electron:dev            # Electron mit Hot-Reload (rebuild + concurrently vite + electron)
npm run preview                 # Vite Preview (nach Build)
```

## Electron

```bash
npm run electron:build          # Production Electron Build (vite build + electron-builder)
npm run rebuild:node            # better-sqlite3 für Node rebuilden (Tests)
npm run rebuild:electron        # better-sqlite3 für Electron rebuilden (App)
```
