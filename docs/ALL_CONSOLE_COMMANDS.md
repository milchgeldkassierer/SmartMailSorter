# SmartMailSorter - CLI Commands

## Tests

```bash
npm test                        # Backend/Electron Tests (vitest)
npm run test:components         # Frontend/React Component Tests
npm run test:all                # Alle Tests zusammen
npm run test:all:coverage       # Alle Tests mit Coverage
npm run test:coverage           # Backend Tests mit Coverage
npm run test:components:coverage # Component Tests mit Coverage
npm run test:components:watch   # Component Tests im Watch-Modus
```

## Build & Type-Check

```bash
npm run build                   # Vite Production Build
npx tsc --noEmit                # TypeScript Type-Check
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
npm run dev                     # Vite Dev-Server
npm run electron:dev            # Electron mit Hot-Reload
npm run preview                 # Vite Preview (nach Build)
```

## Electron

```bash
npm run electron:build          # Production Electron Build
npm run rebuild:node            # better-sqlite3 für Node rebuilden
npm run rebuild:electron        # better-sqlite3 für Electron rebuilden
```
