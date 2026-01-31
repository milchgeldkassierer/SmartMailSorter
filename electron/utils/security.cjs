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

    // Block Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
    if (WINDOWS_RESERVED.test(sanitized)) {
        return 'attachment';
    }

    // Reject dangerous filenames
    if (!sanitized || sanitized === '.' || sanitized === '..') {
        return 'attachment';
    }

    // Limit filename length (255 is typical filesystem limit)
    if (sanitized.length > 255) {
        const ext = path.extname(sanitized);

        // If extension itself is >= 255 chars, just truncate the whole filename
        if (ext.length >= 255) {
            sanitized = sanitized.substring(0, 255);
        } else {
            // Normal case: preserve extension, truncate base name
            const base = path.basename(sanitized, ext);
            sanitized = base.substring(0, 255 - ext.length) + ext;
        }

        // Trim any leading dots that may have appeared after truncation
        sanitized = sanitized.replace(/^\.+/, '');

        // If trimming made it empty, use fallback
        if (!sanitized) {
            return 'attachment';
        }
    }

    return sanitized;
}

module.exports = {
    sanitizeFilename
};
