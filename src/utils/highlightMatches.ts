/**
 * Highlight matching search terms in plain text by wrapping them in <mark> tags.
 *
 * IMPORTANT: This function accepts plain text only, NOT HTML. It escapes all HTML
 * entities in the input before applying highlights, so passing sanitized HTML will
 * double-escape it. For HTML content, use a DOM-based approach instead.
 *
 * This function handles:
 * - Case-insensitive matching
 * - Multiple search terms
 * - Special regex characters in search terms
 * - HTML escaping to prevent XSS via dangerouslySetInnerHTML
 *
 * @param text - The plain text content to search within (NOT HTML)
 * @param searchQuery - The search query containing terms to highlight
 * @returns HTML string with matching terms wrapped in <mark> tags
 *
 * @example
 * ```typescript
 * const highlighted = highlightMatches('Hello World', 'hello');
 * // Returns: '<mark>Hello</mark> World'
 *
 * const highlighted2 = highlightMatches('Invoice from Amazon', 'from: amazon invoice');
 * // Returns: '<mark>Invoice</mark> from <mark>Amazon</mark>'
 * ```
 */
export function highlightMatches(text: string | null | undefined, searchQuery: string | null | undefined): string {
  // Handle null/undefined/empty input
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim() === '') {
    return escapeHtml(text);
  }

  // Extract search terms from query, removing operators
  const terms = extractSearchTerms(searchQuery);

  if (terms.length === 0) {
    return escapeHtml(text);
  }

  // HTML-escape the text first to prevent XSS via dangerouslySetInnerHTML
  const safeText = escapeHtml(text);

  // Escape special regex characters in each term
  const escapedTerms = terms.map((term) => escapeRegex(term));

  // Create a regex pattern that matches any of the terms (case-insensitive)
  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

  // Replace matches with <mark> wrapped version
  const highlighted = safeText.replace(pattern, '<mark>$1</mark>');

  return highlighted;
}

/**
 * Extract actual search terms from a search query by removing operators.
 *
 * @param query - The search query string
 * @returns Array of search terms without operators
 *
 * @example
 * ```typescript
 * extractSearchTerms('from:amazon category:Rechnungen invoice');
 * // Returns: ['invoice']
 *
 * extractSearchTerms('hello world');
 * // Returns: ['hello', 'world']
 *
 * extractSearchTerms('subject:"important meeting" urgent');
 * // Returns: ['urgent']  (operator + quoted value are removed)
 * ```
 */
export function extractSearchTerms(query: string): string[] {
  // List of search operators to exclude
  const operators = ['from:', 'to:', 'subject:', 'category:', 'has:', 'before:', 'after:'];

  // Remove operators and their values
  let cleanedQuery = query;

  operators.forEach((operator) => {
    // Match operator followed by quoted value or unquoted word
    const regex = new RegExp(`${escapeRegex(operator)}("([^"]+)"|\\S+)`, 'gi');
    cleanedQuery = cleanedQuery.replace(regex, '');
  });

  // Split remaining text by whitespace and filter out empty strings
  const terms = cleanedQuery
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);

  return terms;
}

/**
 * Escape special regex characters in a string.
 *
 * @param str - The string to escape
 * @returns String with regex special characters escaped
 *
 * @example
 * ```typescript
 * escapeRegex('hello.world');
 * // Returns: 'hello\\.world'
 *
 * escapeRegex('test[123]');
 * // Returns: 'test\\[123\\]'
 * ```
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
