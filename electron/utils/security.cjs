const path = require('path');

/**
 * Sanitize filename to prevent path traversal attacks
 * @param {string} filename - The original filename from email attachment
 * @returns {string} - Sanitized filename safe for use in file paths
 */
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

module.exports = {
    sanitizeFilename
};
