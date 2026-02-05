# End-to-End Verification Checklist
## AI API Key Storage Migration to safeStorage

### Automated Pre-Verification (Completed)
- [x] All previous subtasks completed successfully
- [x] Unit tests pass (22/22 tests in useAISettings.test.ts)
- [x] Build succeeds without errors
- [x] No API keys in built bundle
- [x] No process.env.API_KEY references in source code

### Manual Verification Steps

#### 1. Start the Application
```bash
npm run electron:dev
```
**Expected:** Application starts successfully without errors

#### 2. Open AI Settings and Enter API Key
- Navigate to AI Settings in the application
- Enter a test API key (e.g., "test-api-key-12345")
- Save the settings

**Expected:**
- Settings save successfully
- No errors in console
- Success message/indicator shown

#### 3. Verify Encrypted File Creation
Check the app userData directory for the encrypted file:
```bash
# On Linux:
ls -la ~/.config/smartmail-ai-sorter-gmx-style/ai-settings.encrypted

# On macOS:
ls -la ~/Library/Application\ Support/smartmail-ai-sorter-gmx-style/ai-settings.encrypted

# On Windows:
dir %APPDATA%\smartmail-ai-sorter-gmx-style\ai-settings.encrypted
```

**Expected:**
- File `ai-settings.encrypted` exists
- File is not empty
- File contains encrypted binary data (not plaintext JSON)

#### 4. Verify localStorage is Empty
Open DevTools (F12 or Ctrl+Shift+I) and run in Console:
```javascript
localStorage.getItem('smartmail_ai_settings')
```

**Expected:** Returns `null` (no data in localStorage)

#### 5. Restart the Application
- Close the application completely
- Start it again: `npm run electron:dev`
- Navigate to AI Settings

**Expected:**
- API key is loaded and displayed (masked or full, depending on UI)
- Settings are preserved from previous session

#### 6. Test Email Categorization
- Navigate to the email categorization feature
- Attempt to categorize a test email using the saved API key

**Expected:**
- Feature works correctly with the loaded API key
- No errors about missing API key
- (Note: If using a test key, it may fail API calls, but it should attempt to use the key)

#### 7. Verify XSS Protection
Open DevTools Console and attempt to read the API key:
```javascript
// Attempt 1: Direct localStorage access
console.log('localStorage:', localStorage.getItem('smartmail_ai_settings'));

// Attempt 2: Iterate all localStorage keys
for (let i = 0; i < localStorage.length; i++) {
    let key = localStorage.key(i);
    console.log(key + ': ' + localStorage.getItem(key));
}

// Attempt 3: Check if window.electron exposes keys directly
console.log('window.electron:', window.electron);
```

**Expected:**
- `localStorage.getItem('smartmail_ai_settings')` returns `null`
- No API keys visible in localStorage
- window.electron methods exist but don't expose raw keys without IPC calls

#### 8. Migration Test (if applicable)
If you have an old installation with localStorage data:
1. Manually add old data to localStorage:
```javascript
localStorage.setItem('smartmail_ai_settings', JSON.stringify({
    apiKey: 'old-test-key',
    provider: 'gemini',
    model: 'gemini-2.0-flash-exp'
}));
```
2. Refresh the app
3. Check that data is migrated to safeStorage
4. Verify localStorage is cleared after migration

**Expected:**
- Old data is automatically migrated
- localStorage is cleared after migration
- Encrypted file contains the migrated data

### Security Verification Summary

✅ **Protection Against XSS:**
- API keys are NOT stored in localStorage
- API keys are encrypted using Electron's safeStorage
- XSS attacks cannot access encrypted data

✅ **Protection Against Bundle Inspection:**
- No API keys hardcoded in JavaScript bundle
- No Vite define injection of environment variables
- process.env.API_KEY removed from all code paths

✅ **Data Encryption:**
- safeStorage uses OS-level encryption (Keychain on macOS, DPAPI on Windows, libsecret on Linux)
- Keys are encrypted at rest
- Only the main process can decrypt keys

### Verification Sign-Off

**Date:** _______________
**Verified By:** _______________

**All Checks Passed:** [ ] YES [ ] NO

**Issues Found:**
_______________________________________
_______________________________________
_______________________________________

**Notes:**
_______________________________________
_______________________________________
_______________________________________
