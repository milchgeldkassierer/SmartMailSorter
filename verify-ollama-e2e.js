#!/usr/bin/env node

/**
 * End-to-End Verification Script for Ollama Integration
 *
 * This script programmatically verifies the Ollama integration without requiring
 * manual GUI interaction. It tests:
 * 1. Ollama API connectivity
 * 2. Model listing
 * 3. Email categorization via Ollama
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

// Test 1: Verify Ollama is running
async function testOllamaConnection() {
  logStep(1, 'Testing Ollama connection...');

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logError(`Ollama API returned status ${response.status}`);
      return false;
    }

    const data = await response.json();
    logSuccess(`Ollama is running and accessible`);
    logSuccess(`Found ${data.models?.length || 0} models`);
    return true;
  } catch (error) {
    logError(`Failed to connect to Ollama: ${error.message}`);
    logWarning('Make sure Ollama is running (ollama serve)');
    return false;
  }
}

// Test 2: List available models
async function testListModels() {
  logStep(2, 'Listing available Ollama models...');

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logError(`Failed to list models: status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const models = data.models || [];

    if (models.length === 0) {
      logWarning('No models found. Pull a model with: ollama pull llama3');
      return null;
    }

    const modelNames = models.map(m => m.name);
    logSuccess(`Available models: ${modelNames.join(', ')}`);
    return modelNames[0]; // Return first model for testing
  } catch (error) {
    logError(`Failed to list models: ${error.message}`);
    return null;
  }
}

// Test 3: Test email categorization
async function testEmailCategorization(modelName) {
  logStep(3, `Testing email categorization with ${modelName}...`);

  const testEmail = {
    sender: 'newsletter@example.com',
    subject: 'Weekly Tech News - AI Advances',
    body: 'Here are this week\'s top tech stories: 1. New AI model released...',
  };

  const systemPrompt = 'You are an email categorization assistant. Respond with JSON only.';
  const userPrompt = `Categorize this email into one of these categories: Newsletter, Work, Personal, Finance, Shopping, Travel, Social, Other.

Email:
From: ${testEmail.sender}
Subject: ${testEmail.subject}
Body: ${testEmail.body}

Respond with JSON: {"category": "category_name", "summary": "brief summary"}`;

  try {
    const startTime = Date.now();

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        format: 'json',
        stream: false,
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      logError(`Categorization failed: status ${response.status}`);
      return false;
    }

    const data = await response.json();
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Parse the response
    let result;
    try {
      result = JSON.parse(data.message.content);
    } catch (e) {
      logError(`Failed to parse JSON response: ${data.message.content}`);
      return false;
    }

    logSuccess(`Categorization completed in ${duration}s`);
    logSuccess(`Category: ${result.category}`);
    logSuccess(`Summary: ${result.summary}`);

    if (parseFloat(duration) > 10) {
      logWarning(`Performance warning: categorization took ${duration}s (target: <10s)`);
    } else {
      logSuccess(`Performance: within target (<10s)`);
    }

    return true;
  } catch (error) {
    logError(`Categorization failed: ${error.message}`);
    return false;
  }
}

// Test 4: Verify implementation files
async function testImplementationFiles() {
  logStep(4, 'Verifying implementation files...');

  const fs = await import('fs/promises');
  const path = await import('path');

  const checks = [
    {
      file: 'src/types.ts',
      pattern: /OLLAMA\s*=\s*['"]Ollama['"]/,
      description: 'OLLAMA enum in types.ts',
    },
    {
      file: 'electron/main.cjs',
      pattern: /ipcMain\.handle\(['"]ollama-detect['"]/,
      description: 'ollama-detect IPC handler',
    },
    {
      file: 'electron/main.cjs',
      pattern: /ipcMain\.handle\(['"]ollama-list-models['"]/,
      description: 'ollama-list-models IPC handler',
    },
    {
      file: 'src/electron.d.ts',
      pattern: /ollamaDetect.*Promise/,
      description: 'ollamaDetect TypeScript declaration',
    },
    {
      file: 'src/services/geminiService.ts',
      pattern: /LLMProvider\.OLLAMA/,
      description: 'OLLAMA provider in callLLM',
    },
    {
      file: 'src/components/tabs/SmartSortTab.tsx',
      pattern: /ollamaStatus/,
      description: 'Ollama status in SmartSortTab',
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

// Main execution
async function main() {
  log('\n=== Ollama Integration E2E Verification ===\n', 'blue');

  const results = {
    connection: false,
    models: false,
    categorization: false,
    implementation: false,
  };

  // Test 1: Connection
  results.connection = await testOllamaConnection();
  if (!results.connection) {
    logError('\n✗ Verification failed: Ollama is not running');
    process.exit(1);
  }

  // Test 2: List models
  const modelName = await testListModels();
  results.models = modelName !== null;
  if (!results.models) {
    logError('\n✗ Verification failed: No models available');
    process.exit(1);
  }

  // Test 3: Email categorization
  results.categorization = await testEmailCategorization(modelName);

  // Test 4: Implementation files
  results.implementation = await testImplementationFiles();

  // Summary
  log('\n=== Verification Summary ===\n', 'blue');
  const allPassed = Object.values(results).every(r => r);

  if (allPassed) {
    logSuccess('✓ All verification checks passed!');
    logSuccess('✓ Ollama integration is working correctly');
    log('\nManual verification steps:', 'blue');
    log('1. Start the app: npm run electron:dev');
    log('2. Go to Settings > Smart Sort tab');
    log('3. Select "Ollama" provider - verify green checkmark');
    log('4. Verify model dropdown shows your installed models');
    log('5. Verify API key field is hidden');
    log('6. Save settings and test email categorization');
    process.exit(0);
  } else {
    logError('\n✗ Some verification checks failed');
    process.exit(1);
  }
}

main().catch(error => {
  logError(`\nUnexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
