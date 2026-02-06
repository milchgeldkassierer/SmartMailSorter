/**
 * Content Security Policy Configuration
 *
 * Centralized CSP configuration that is used by both the main process
 * and security tests to ensure consistency and avoid duplication.
 */

/**
 * Get CSP directives based on environment
 * @param {boolean} isDev - Whether running in development mode
 * @returns {string[]} Array of CSP directive strings
 */
function getCspDirectives(isDev) {
  return isDev
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:3000 https://cdn.tailwindcss.com https://esm.sh",
        "style-src 'self' 'unsafe-inline' http://localhost:3000 https://fonts.googleapis.com https://cdn.tailwindcss.com",
        "img-src 'self' data: http://localhost:3000 https:",
        "connect-src 'self' http://localhost:3000 ws://localhost:3000 https://api.openai.com https://generativelanguage.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
      ]
    : [
        "default-src 'self'",
        "script-src 'self' https://cdn.tailwindcss.com https://esm.sh",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "frame-src 'none'",
      ];
}

/**
 * Create a CSP header handler for Electron's webRequest.onHeadersReceived
 * @param {boolean} isDev - Whether running in development mode
 * @returns {Function} Handler function that adds CSP headers to responses
 */
function createCspHeaderHandler(isDev) {
  const cspDirectives = getCspDirectives(isDev);

  return (details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives.join('; ')],
      },
    });
  };
}

module.exports = {
  getCspDirectives,
  createCspHeaderHandler,
};
