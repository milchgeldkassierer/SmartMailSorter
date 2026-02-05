#!/bin/bash
# Automated Verification Script for AI API Key Storage Migration
# This script verifies the implementation programmatically where possible

set -e

echo "=================================================="
echo "AI API Key Storage Migration - Automated Verification"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track pass/fail
TOTAL=0
PASSED=0
FAILED=0

check() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $2"
        FAILED=$((FAILED + 1))
    fi
}

echo "1. Verifying IPC Handlers in main.cjs..."
grep -q "ipcMain.handle('ai-settings-save'" ./electron/main.cjs
check $? "ai-settings-save handler exists"

grep -q "ipcMain.handle('ai-settings-load'" ./electron/main.cjs
check $? "ai-settings-load handler exists"

grep -q "ipcMain.handle('ai-settings-check'" ./electron/main.cjs
check $? "ai-settings-check handler exists"

grep -q "ipcMain.handle('ai-settings-delete'" ./electron/main.cjs
check $? "ai-settings-delete handler exists"

grep -q "safeStorage.encryptString" ./electron/main.cjs
check $? "Encryption implemented in main.cjs"

grep -q "safeStorage.decryptString" ./electron/main.cjs
check $? "Decryption implemented in main.cjs"

echo ""
echo "2. Verifying Preload Script..."
grep -q "saveAISettings:" ./electron/preload.cjs
check $? "saveAISettings exposed in preload"

grep -q "loadAISettings:" ./electron/preload.cjs
check $? "loadAISettings exposed in preload"

grep -q "checkAISettings:" ./electron/preload.cjs
check $? "checkAISettings exposed in preload"

grep -q "deleteAISettings:" ./electron/preload.cjs
check $? "deleteAISettings exposed in preload"

echo ""
echo "3. Verifying TypeScript Definitions..."
grep -q "saveAISettings:" ./electron.d.ts
check $? "saveAISettings type definition exists"

grep -q "loadAISettings:" ./electron.d.ts
check $? "loadAISettings type definition exists"

grep -q "checkAISettings:" ./electron.d.ts
check $? "checkAISettings type definition exists"

grep -q "deleteAISettings:" ./electron.d.ts
check $? "deleteAISettings type definition exists"

echo ""
echo "4. Verifying useAISettings Hook..."
grep -q "window.electron.loadAISettings" ./hooks/useAISettings.ts
check $? "Hook uses window.electron.loadAISettings"

grep -q "window.electron.saveAISettings" ./hooks/useAISettings.ts
check $? "Hook uses window.electron.saveAISettings"

grep -q "localStorage.getItem(STORAGE_KEY)" ./hooks/useAISettings.ts
check $? "Migration reads from localStorage"

grep -q "localStorage.removeItem(STORAGE_KEY)" ./hooks/useAISettings.ts
check $? "Migration removes from localStorage"

echo ""
echo "5. Verifying Old Code Removed..."
! grep -q "process\.env\.API_KEY" ./services/geminiService.ts
check $? "No process.env.API_KEY in geminiService.ts"

! grep -q "process\.env\.GEMINI_API_KEY" ./vite.config.ts
check $? "No process.env.GEMINI_API_KEY in vite.config.ts"

! grep -q "define:" ./vite.config.ts
check $? "No Vite define injection in vite.config.ts"

echo ""
echo "6. Verifying Tests..."
if [ -f "./hooks/__tests__/useAISettings.test.ts" ]; then
    grep -q "window.electron" ./hooks/__tests__/useAISettings.test.ts
    check $? "Tests mock window.electron"

    echo -e "${YELLOW}   Running unit tests...${NC}"
    npm run test:components -- hooks/__tests__/useAISettings.test.ts > /tmp/test-output.log 2>&1
    check $? "All useAISettings tests pass"
else
    echo -e "${YELLOW}   Tests file not found, skipping${NC}"
fi

echo ""
echo "7. Security Checks..."
echo -e "${YELLOW}   Building project...${NC}"
npm run build > /tmp/build-output.log 2>&1
check $? "Build succeeds"

# Check for actual API key patterns (not just the variable name)
! grep -r "AIza[0-9A-Za-z_-]\{35\}" ./dist/ 2>/dev/null
check $? "No Google API keys in bundle"

! grep -r "sk-[0-9A-Za-z]\{32,\}" ./dist/ 2>/dev/null
check $? "No OpenAI API keys in bundle"

echo ""
echo "=================================================="
echo "Verification Summary"
echo "=================================================="
echo -e "Total Checks: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
if [ ${FAILED} -gt 0 ]; then
    echo -e "${RED}Failed: ${FAILED}${NC}"
else
    echo -e "${GREEN}Failed: ${FAILED}${NC}"
fi
echo ""

if [ ${FAILED} -eq 0 ]; then
    echo -e "${GREEN}✓ All automated checks passed!${NC}"
    echo ""
    echo "=================================================="
    echo "Manual Verification Required"
    echo "=================================================="
    echo "Please perform the following manual checks:"
    echo ""
    echo "1. Start the app: npm run electron:dev"
    echo "2. Open AI Settings and enter a test API key"
    echo "3. Verify ai-settings.encrypted file is created in userData directory"
    echo "4. Restart the app and verify the key is loaded"
    echo "5. Open DevTools and verify localStorage is empty:"
    echo "   localStorage.getItem('smartmail_ai_settings') // should return null"
    echo ""
    echo "See e2e-verification-checklist.md for detailed manual verification steps."
    exit 0
else
    echo -e "${RED}✗ Some automated checks failed!${NC}"
    echo "Please review the failures above before proceeding with manual verification."
    exit 1
fi
