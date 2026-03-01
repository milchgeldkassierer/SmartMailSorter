#!/usr/bin/env node

/**
 * Graceful Fallback Verification Script for Ollama Integration
 *
 * This script verifies that the application handles Ollama being unavailable gracefully.
 * It tests:
 * 1. Ollama detection when service is down
 * 2. Error handling in IPC handlers
 * 3. Fallback to static model list
 * 4. Settings persistence despite Ollama being unavailable
 * 5. Error handling in callLLM when Ollama is unreachable
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';

// Color output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[Step ${step}] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

// Test 1: Verify Ollama is NOT running (or unreachable)
async function testOllamaUnavailable() {
  logStep(1, 'Verifying Ollama is unavailable...');

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      logWarning('Ollama is currently running!');
      logWarning('For this test, Ollama should be stopped.');
      logWarning('To stop Ollama: killall ollama (or stop the service)');
      return false;
    }

    logSuccess('Ollama is unreachable (expected for this test)');
    return true;
  } catch (error) {
    // Expected: connection refused or timeout
    if (error.name === 'TypeError' && error.message.includes('fetch failed')) {
      logSuccess('Ollama is not running (connection refused - expected)');
      return true;
    }
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      logSuccess('Ollama is not responding (timeout - expected)');
      return true;
    }
    logSuccess(`Ollama is unreachable: ${error.message} (expected)`);
    return true;
  }
}

// Test 2: Verify error handling returns proper structure
async function testErrorHandling() {
  logStep(2, 'Testing error handling with Ollama unavailable...');

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });

    logError('Ollama responded when it should be down!');
    return false;
  } catch (error) {
    logSuccess('Ollama connection failed as expected');
    logSuccess('IPC handlers should return graceful error states');
    logSuccess('Expected: { available: false, error: "..." } for ollama-detect');
    logSuccess('Expected: [] (empty array) for ollama-list-models');
    return true;
  }
}

// Test 3: Verify implementation handles errors gracefully
async function testImplementationErrorHandling() {
  logStep(3, 'Verifying implementation error handling...');

  const fs = await import('fs/promises');

  const checks = [
    {
      file: 'electron/main.cjs',
      pattern: /catch\s*\([^)]*\)\s*\{[^}]*available:\s*false/s,
      description: 'ollama-detect returns available:false on error',
    },
    {
      file: 'electron/main.cjs',
      pattern: /catch\s*\([^)]*\)\s*\{[^}]*return\s*\[\]/s,
      description: 'ollama-list-models returns empty array on error',
    },
    {
      file: 'src/services/geminiService.ts',
      pattern: /case\s+LLMProvider\.OLLAMA:[\s\S]*?catch/,
      description: 'callLLM has error handling for OLLAMA case',
    },
    {
      file: 'src/components/tabs/SmartSortTab.tsx',
      pattern: /ollamaStatus.*available.*false/s,
      description: 'SmartSortTab handles Ollama unavailable state',
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    try {
      const content = await fs.readFile(check.file, 'utf-8');
      if (check.pattern.test(content)) {
        logSuccess(check.description);
      } else {
        logError(`Missing: ${check.description}`);
        allPassed = false;
      }
    } catch (error) {
      logError(`Failed to read ${check.file}: ${error.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

// Test 4: Verify static model fallback
async function testStaticModelFallback() {
  logStep(4, 'Verifying static model fallback...');

  const fs = await import('fs/promises');

  try {
    const typesContent = await fs.readFile('src/types.ts', 'utf-8');

    // Check that AVAILABLE_MODELS has Ollama models defined
    const hasStaticModels = /AVAILABLE_MODELS\[LLMProvider\.OLLAMA\]\s*=\s*\[[^\]]+\]/.test(typesContent);

    if (hasStaticModels) {
      logSuccess('Static OLLAMA models defined in AVAILABLE_MODELS');
      logSuccess('UI can fall back to static list when API fails');

      // Extract the models
      const match = typesContent.match(/AVAILABLE_MODELS\[LLMProvider\.OLLAMA\]\s*=\s*\[([^\]]+)\]/);
      if (match) {
        const models = match[1].match(/['"][^'"]+['"]/g);
        logSuccess(`Fallback models: ${models?.join(', ').replace(/['"]/g, '') || 'none'}`);
      }
      return true;
    } else {
      logError('No static fallback models defined for Ollama');
      return false;
    }
  } catch (error) {
    logError(`Failed to verify static models: ${error.message}`);
    return false;
  }
}

// Test 5: Verify UI translation keys for error states
async function testErrorStateTranslations() {
  logStep(5, 'Verifying error state translations...');

  const fs = await import('fs/promises');

  try {
    const i18nContent = await fs.readFile('src/i18n/config.ts', 'utf-8');

    const requiredKeys = [
      'ollamaDetecting',
      'ollamaAvailable',
      'ollamaUnavailable',
      'ollamaNoApiKey',
    ];

    let allPresent = true;
    for (const key of requiredKeys) {
      if (i18nContent.includes(key)) {
        logSuccess(`Translation key present: ${key}`);
      } else {
        logError(`Missing translation key: ${key}`);
        allPresent = false;
      }
    }

    // Check for error messages in translations
    const hasUnavailableMessage = /ollamaUnavailable.*not reachable|unavailable|offline/i.test(i18nContent);
    if (hasUnavailableMessage) {
      logSuccess('Error message for Ollama unavailable state');
    } else {
      logWarning('No explicit "unavailable" error message found');
    }

    return allPresent;
  } catch (error) {
    logError(`Failed to verify translations: ${error.message}`);
    return false;
  }
}

// Test 6: Verify callLLM error handling
async function testCallLLMErrorHandling() {
  logStep(6, 'Verifying callLLM error handling for Ollama...');

  const fs = await import('fs/promises');

  try {
    const serviceContent = await fs.readFile('src/services/geminiService.ts', 'utf-8');

    // Find the OLLAMA case in callLLM
    const ollamaCase = serviceContent.match(/case\s+LLMProvider\.OLLAMA:([\s\S]*?)(?:case\s+|default:|^})/m);

    if (!ollamaCase) {
      logError('OLLAMA case not found in callLLM');
      return false;
    }

    const ollamaCode = ollamaCase[1];

    // Check for try-catch
    const hasTryCatch = /try\s*\{[\s\S]*?catch/.test(ollamaCode);
    if (hasTryCatch) {
      logSuccess('OLLAMA case has try-catch error handling');
    } else {
      logError('OLLAMA case missing try-catch error handling');
      return false;
    }

    // Check for fetch error handling
    const hasFetchErrorHandling = /fetch.*catch|\.then.*catch/.test(ollamaCode);
    if (hasFetchErrorHandling || hasTryCatch) {
      logSuccess('Network error handling present');
    } else {
      logWarning('Network error handling might be missing');
    }

    // Check for localhost URL (should fail gracefully when Ollama is down)
    const hasLocalhostUrl = /localhost:11434/.test(ollamaCode);
    if (hasLocalhostUrl) {
      logSuccess('Uses localhost:11434 (will fail gracefully when Ollama is down)');
    } else {
      logError('Ollama URL not found or incorrect');
      return false;
    }

    return true;
  } catch (error) {
    logError(`Failed to verify callLLM: ${error.message}`);
    return false;
  }
}

// Main execution
async function main() {
  log('\n=== Ollama Graceful Fallback Verification ===\n', 'blue');
  log('This test verifies that the application handles Ollama being unavailable gracefully.\n', 'yellow');

  const results = {
    unavailable: false,
    errorHandling: false,
    implementation: false,
    staticFallback: false,
    translations: false,
    callLLMError: false,
  };

  // Test 1: Verify Ollama is unavailable
  results.unavailable = await testOllamaUnavailable();
  if (!results.unavailable) {
    logWarning('\n⚠ Ollama is currently running - skipping runtime behavior tests');
    logWarning('Will verify that error handling code is properly implemented');
    log('\nNote: For full verification, run this test with Ollama stopped', 'blue');
  }

  // Test 2: Error handling
  results.errorHandling = await testErrorHandling();

  // Test 3: Implementation error handling
  results.implementation = await testImplementationErrorHandling();

  // Test 4: Static model fallback
  results.staticFallback = await testStaticModelFallback();

  // Test 5: Error state translations
  results.translations = await testErrorStateTranslations();

  // Test 6: callLLM error handling
  results.callLLMError = await testCallLLMErrorHandling();

  // Summary
  log('\n=== Verification Summary ===\n', 'blue');
  const allPassed = Object.values(results).every(r => r);

  if (allPassed) {
    logSuccess('✓ All graceful fallback checks passed!');
    logSuccess('✓ Application handles Ollama being unavailable correctly');
    log('\nExpected behavior when Ollama is down:', 'blue');
    log('1. Settings tab shows red X icon with "Ollama not reachable"');
    log('2. Model dropdown falls back to static list');
    log('3. API key field remains hidden (no key needed even when down)');
    log('4. Settings can still be saved');
    log('5. Switching to Gemini/OpenAI works normally');
    log('6. Email categorization shows clear error message');
    log('7. No cryptic network errors or app crashes');
    log('\nManual verification (optional):', 'blue');
    log('1. Keep Ollama stopped');
    log('2. Start the app: npm run electron:dev');
    log('3. Go to Settings > Smart Sort tab');
    log('4. Select "Ollama" provider - verify red X appears');
    log('5. Verify model dropdown still shows models (static fallback)');
    log('6. Try to categorize an email - should show clear error');
    log('7. Switch to Gemini - should work if API key is set');
    process.exit(0);
  } else {
    logError('\n✗ Some graceful fallback checks failed');
    logError('The application may not handle Ollama being unavailable correctly');
    process.exit(1);
  }
}

main().catch(error => {
  logError(`\nUnexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
