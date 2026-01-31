/**
 * Manual Security Verification Script
 *
 * This script performs manual verification of path traversal protection
 * by testing the sanitizeFilename() function with various malicious inputs.
 *
 * Test Cases:
 * 1. Path traversal attempts (Unix and Windows style)
 * 2. Absolute paths
 * 3. Null byte injection
 * 4. Hidden files
 * 5. Dangerous characters
 * 6. Valid filenames (control group)
 *
 * For each test, it verifies:
 * - The sanitized filename is safe
 * - The final path stays within os.tmpdir()
 * - No directory traversal is possible
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Copy of the sanitizeFilename function from main.cjs
function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return 'attachment';
    }

    // Extract basename to remove any directory components (../../../etc/passwd -> passwd)
    let sanitized = path.basename(filename);

    // Remove null bytes (file.txt\0.exe -> file.txt.exe)
    sanitized = sanitized.replace(/\0/g, '');

    // Remove any remaining path separators (both / and \)
    sanitized = sanitized.replace(/[/\\]/g, '');

    // Remove other potentially dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*]/g, '');

    // Trim whitespace and dots from start/end
    sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');

    // Reject dangerous filenames
    if (!sanitized || sanitized === '.' || sanitized === '..') {
        return 'attachment';
    }

    // Limit filename length (255 is typical filesystem limit)
    if (sanitized.length > 255) {
        const ext = path.extname(sanitized);
        const base = path.basename(sanitized, ext);
        sanitized = base.substring(0, 255 - ext.length) + ext;
    }

    return sanitized;
}

// Test cases with malicious filenames
const testCases = [
    // Path traversal - Unix style
    {
        input: '../../../etc/passwd',
        description: 'Unix path traversal',
        shouldBeSafe: true
    },
    {
        input: '../../../.bashrc',
        description: 'Unix path traversal to hidden file',
        shouldBeSafe: true
    },
    {
        input: '../../../../root/.ssh/id_rsa',
        description: 'Unix path traversal to SSH key',
        shouldBeSafe: true
    },

    // Path traversal - Windows style
    {
        input: '..\\..\\..\\Windows\\System32\\config',
        description: 'Windows path traversal',
        shouldBeSafe: true
    },
    {
        input: '..\\..\\..\\boot.ini',
        description: 'Windows path traversal to system file',
        shouldBeSafe: true
    },

    // Absolute paths - Unix
    {
        input: '/etc/passwd',
        description: 'Absolute Unix path',
        shouldBeSafe: true
    },
    {
        input: '/var/log/system.log',
        description: 'Absolute path to log file',
        shouldBeSafe: true
    },

    // Absolute paths - Windows
    {
        input: 'C:\\Windows\\System32\\config',
        description: 'Absolute Windows path with drive letter',
        shouldBeSafe: true
    },
    {
        input: 'C:\\Users\\Admin\\Desktop\\secret.txt',
        description: 'Absolute Windows user path',
        shouldBeSafe: true
    },

    // Null byte injection
    {
        input: 'safe.txt\0.exe',
        description: 'Null byte injection',
        shouldBeSafe: true
    },
    {
        input: 'document.pdf\0../../etc/passwd',
        description: 'Null byte with path traversal',
        shouldBeSafe: true
    },

    // Hidden files
    {
        input: '.bashrc',
        description: 'Hidden file (Unix)',
        shouldBeSafe: true
    },
    {
        input: '.ssh/id_rsa',
        description: 'Hidden directory with file',
        shouldBeSafe: true
    },

    // Dangerous characters
    {
        input: 'file<script>.txt',
        description: 'Filename with HTML tags',
        shouldBeSafe: true
    },
    {
        input: 'file|command.txt',
        description: 'Filename with pipe character',
        shouldBeSafe: true
    },
    {
        input: 'file:stream.txt',
        description: 'Filename with colon (Windows)',
        shouldBeSafe: true
    },

    // Edge cases
    {
        input: '.',
        description: 'Current directory reference',
        shouldBeSafe: true
    },
    {
        input: '..',
        description: 'Parent directory reference',
        shouldBeSafe: true
    },
    {
        input: '',
        description: 'Empty string',
        shouldBeSafe: true
    },
    {
        input: '   ',
        description: 'Whitespace only',
        shouldBeSafe: true
    },
    {
        input: '...',
        description: 'Multiple dots',
        shouldBeSafe: true
    },

    // Valid filenames (control group)
    {
        input: 'document.pdf',
        description: 'Normal PDF file',
        shouldBeSafe: true
    },
    {
        input: 'report-2024.xlsx',
        description: 'Normal Excel file with dash',
        shouldBeSafe: true
    },
    {
        input: 'photo_vacation.jpg',
        description: 'Normal image file with underscore',
        shouldBeSafe: true
    },
];

console.log('='.repeat(80));
console.log('MANUAL SECURITY VERIFICATION');
console.log('Path Traversal Protection Test');
console.log('='.repeat(80));
console.log();

const tmpDir = os.tmpdir();
const results = {
    passed: 0,
    failed: 0,
    details: []
};

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}/${testCases.length}: ${testCase.description}`);
    console.log(`  Input: "${testCase.input}"`);

    // Sanitize the filename
    const sanitized = sanitizeFilename(testCase.input);
    console.log(`  Sanitized: "${sanitized}"`);

    // Create the full path
    const fullPath = path.join(tmpDir, sanitized);
    console.log(`  Full path: ${fullPath}`);

    // Verify the path is within tmpdir
    const normalizedPath = path.normalize(fullPath);
    const normalizedTmpDir = path.normalize(tmpDir);
    const isWithinTmpDir = normalizedPath.startsWith(normalizedTmpDir);

    // Check for path traversal components in sanitized filename
    const hasTraversal = sanitized.includes('..') ||
                        sanitized.includes('/') ||
                        sanitized.includes('\\') ||
                        path.isAbsolute(sanitized);

    // Verify safety
    const isSafe = isWithinTmpDir && !hasTraversal;

    if (isSafe) {
        console.log(`  ✓ PASS - File would be created safely in temp directory`);
        results.passed++;
        results.details.push({
            test: testCase.description,
            input: testCase.input,
            sanitized: sanitized,
            status: 'PASS',
            reason: 'Path is confined to temp directory'
        });
    } else {
        console.log(`  ✗ FAIL - SECURITY RISK DETECTED!`);
        console.log(`    - Within tmpdir: ${isWithinTmpDir}`);
        console.log(`    - Has traversal: ${hasTraversal}`);
        results.failed++;
        results.details.push({
            test: testCase.description,
            input: testCase.input,
            sanitized: sanitized,
            status: 'FAIL',
            reason: `Path is not safe (within tmpdir: ${isWithinTmpDir}, has traversal: ${hasTraversal})`
        });
    }

    console.log();
});

// Summary
console.log('='.repeat(80));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(80));
console.log(`Total tests: ${testCases.length}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log();

if (results.failed > 0) {
    console.log('FAILED TESTS:');
    results.details
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
            console.log(`  - ${r.test}`);
            console.log(`    Input: "${r.input}"`);
            console.log(`    Sanitized: "${r.sanitized}"`);
            console.log(`    Reason: ${r.reason}`);
        });
    console.log();
}

// Additional verification: Test actual file creation
console.log('='.repeat(80));
console.log('PHYSICAL FILE CREATION TEST');
console.log('='.repeat(80));
console.log();

const testFilename = '../../../malicious.txt';
const sanitizedTest = sanitizeFilename(testFilename);
const testPath = path.join(tmpDir, sanitizedTest);

console.log(`Testing with malicious filename: "${testFilename}"`);
console.log(`Sanitized to: "${sanitizedTest}"`);
console.log(`Full path: ${testPath}`);

try {
    // Create a test file
    const testData = Buffer.from('This is a test attachment');
    fs.writeFileSync(testPath, testData);
    console.log(`✓ File created successfully at: ${testPath}`);

    // Verify it's in the temp directory
    const fileExists = fs.existsSync(testPath);
    const inTempDir = testPath.startsWith(tmpDir);

    console.log(`✓ File exists: ${fileExists}`);
    console.log(`✓ File is in temp directory: ${inTempDir}`);

    // Check that no file was created outside temp directory
    const maliciousPath = path.join(tmpDir, testFilename);
    const maliciousExists = fs.existsSync(maliciousPath);
    console.log(`✓ No file at malicious path: ${!maliciousExists}`);

    // Clean up
    fs.unlinkSync(testPath);
    console.log(`✓ Test file cleaned up`);

} catch (error) {
    console.log(`✗ Error during file creation test: ${error.message}`);
}

console.log();
console.log('='.repeat(80));

if (results.failed === 0) {
    console.log('✓ ALL SECURITY TESTS PASSED');
    console.log('✓ Path traversal protection is working correctly');
    console.log('✓ All attachments will be created only in temp directory');
    console.log('✓ Filenames are properly sanitized');
    process.exit(0);
} else {
    console.log('✗ SECURITY VERIFICATION FAILED');
    console.log(`✗ ${results.failed} test(s) failed`);
    console.log('✗ Path traversal vulnerability may still exist');
    process.exit(1);
}
