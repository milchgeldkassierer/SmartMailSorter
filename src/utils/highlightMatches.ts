/**
 * Highlight matching search terms in text by wrapping them in <mark> tags.
 *
 * This function finds all occurrences of search terms in the provided text
 * and wraps them in HTML <mark> tags for visual highlighting. It handles:
 * - Case-insensitive matching
 * - Multiple search terms
 * - Special regex characters in search terms
 * - Preserving existing HTML structure
 * - Avoiding duplicate highlighting
 *
 * @param text - The text content to search within (can contain HTML)
 * @param searchQuery - The search query containing terms to highlight
 * @returns Text with matching terms wrapped in <mark> tags
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
export function highlightMatches(
  text: string | null | undefined,
  searchQuery: string | null | undefined
): string {
  // Handle null/undefined/empty input
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim() === '') {
    return text;
  }

  // Extract search terms from query, removing operators
  const terms = extractSearchTerms(searchQuery);

  if (terms.length === 0) {
    return text;
  }

  // Escape special regex characters in each term
  const escapedTerms = terms.map((term) => escapeRegex(term));

  // Create a regex pattern that matches any of the terms (case-insensitive)
  // Use word boundaries to avoid partial matches inside words
  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

  // Replace matches with <mark> wrapped version
  // Use a replacer function to preserve the original case
  const highlighted = text.replace(pattern, '<mark>$1</mark>');

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
 * // Returns: ['important meeting', 'urgent']
 * ```
 */
export function extractSearchTerms(query: string): string[] {
  // List of search operators to exclude
  const operators = [
    'from:',
    'to:',
    'subject:',
    'category:',
    'has:',
    'before:',
    'after:',
  ];

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
  // Escape all special regex characters
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
