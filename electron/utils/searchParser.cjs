/**
 * Search Query Parser
 *
 * Parses search queries with operators like:
 * - from:sender
 * - to:recipient (parsed but not filtered — no recipient column in emails table)
 * - subject:text
 * - category:name
 * - has:attachment
 * - before:date
 * - after:date
 *
 * Example: "from:amazon category:Rechnungen after:2026-01-01 invoice"
 */

/**
 * Parse a search query string into structured search parameters
 * @param {string} query - The search query string
 * @returns {Object} Parsed search parameters
 */
function parseSearchQuery(query) {
  const result = {
    from: undefined,
    to: undefined,
    subject: undefined,
    category: undefined,
    hasAttachment: undefined,
    before: undefined,
    after: undefined,
    freeText: '',
  };

  if (!query || typeof query !== 'string') {
    return result;
  }

  // Trim the query
  query = query.trim();

  if (query === '') {
    return result;
  }

  // Regular expression to match operators with optional quoted values
  // Matches: operator:"quoted value" or operator:value (no quotes)
  // Note: \S+ is greedy and will match the next operator, but we validate below
  const operatorRegex = /(\w+):\s*"([^"]+)"|(\w+):\s*(\S+)/gi;

  let freeTextParts = [];
  let lastIndex = 0;
  let match;

  // Process all operator matches
  while ((match = operatorRegex.exec(query)) !== null) {
    // Extract free text before this operator
    const beforeOperator = query.substring(lastIndex, match.index).trim();
    if (beforeOperator) {
      freeTextParts.push(beforeOperator);
    }

    // Extract operator and value
    const operator = (match[1] || match[3]).toLowerCase();
    const value = (match[2] || match[4]).trim();

    // Skip if value is empty or looks like another operator (word:)
    // Exception: dates can have colons (e.g., 2026-01-01T10:30:00)
    if (!value || (value.match(/^\w+:/) && !value.match(/^\d{4}-\d{2}-\d{2}/))) {
      // Only skip past the operator itself, not the value (which might be another operator)
      // Find where the operator ends (operator + colon + optional whitespace)
      const operatorEnd = match.index + operator.length + 1; // +1 for the colon
      const whitespaceMatch = query.substring(operatorEnd).match(/^\s+/);
      const newLastIndex = operatorEnd + (whitespaceMatch ? whitespaceMatch[0].length : 0);

      // Update both our tracking variable and the regex's lastIndex
      lastIndex = newLastIndex;
      operatorRegex.lastIndex = newLastIndex;
      continue;
    }

    // Assign value to appropriate field
    switch (operator) {
      case 'from':
        result.from = value;
        break;
      case 'to':
        result.to = value;
        break;
      case 'subject':
        result.subject = value;
        break;
      case 'category':
        result.category = value;
        break;
      case 'has':
        // Handle both "attachment" and "attachments"
        if (value.toLowerCase() === 'attachment' || value.toLowerCase() === 'attachments') {
          result.hasAttachment = true;
        }
        break;
      case 'before':
        result.before = value;
        break;
      case 'after':
        result.after = value;
        break;
      default:
        // Unknown operator, treat as free text
        freeTextParts.push(match[0]);
        break;
    }

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last operator
  const remainingText = query.substring(lastIndex).trim();
  if (remainingText) {
    freeTextParts.push(remainingText);
  }

  // Join all free text parts
  result.freeText = freeTextParts.join(' ').trim();

  return result;
}

/**
 * Build SQL WHERE clause from parsed search parameters
 * PERFORMANCE: Conditions are ordered for optimal index usage:
 * 1. Exact matches first (accountId, category, hasAttachments) - use indexes efficiently
 * 2. Range queries (date) - use idx_emails_date
 * 3. LIKE queries last (senderEmail, subject, body) - partial index usage
 *
 * Indexes used:
 * - accountId = ? → idx_emails_accountId
 * - smartCategory = ? → idx_emails_smartCategory
 * - hasAttachments = 1 → idx_emails_hasAttachments
 * - date < ?/> ? → idx_emails_date
 * - senderEmail LIKE ? → idx_emails_senderEmail (partial, leading % limits optimization)
 * - subject LIKE ? → idx_emails_subject (partial, leading % limits optimization)
 * - body LIKE ? → Full scan (no index on body for size reasons)
 *
 * @param {Object} parsedQuery - Output from parseSearchQuery
 * @param {string} accountId - Optional account ID to filter by
 * @returns {Object} { where: string, params: array }
 */
function buildSearchWhereClause(parsedQuery, accountId = null) {
  /** Escape SQL LIKE wildcard characters so they match literally. */
  const escapeLike = (s) => s.replace(/[%_\\]/g, '\\$&');

  const conditions = [];
  const params = [];

  // OPTIMIZATION: Order conditions from most selective to least selective
  // This helps SQLite's query planner optimize execution

  // 1. Exact match filters (most selective) - use indexes efficiently
  if (accountId) {
    conditions.push('accountId = ?');
    params.push(accountId);
  }

  if (parsedQuery.category) {
    conditions.push('smartCategory = ?');
    params.push(parsedQuery.category);
  }

  if (parsedQuery.hasAttachment === true) {
    conditions.push('hasAttachments = 1');
  }

  // 2. Range queries - use idx_emails_date for efficient filtering
  // Note: before: and after: use strict inequality (< and >), meaning the
  // specified date itself is excluded. E.g. after:2026-01-15 matches dates
  // strictly after 2026-01-15, not including it.
  const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}/.test(d);

  if (parsedQuery.after) {
    if (isValidDate(parsedQuery.after)) {
      conditions.push('date > ?');
      params.push(parsedQuery.after);
    } else {
      console.warn(`Ignoring invalid after: date value "${parsedQuery.after}"`);
    }
  }

  if (parsedQuery.before) {
    if (isValidDate(parsedQuery.before)) {
      conditions.push('date < ?');
      params.push(parsedQuery.before);
    } else {
      console.warn(`Ignoring invalid before: date value "${parsedQuery.before}"`);
    }
  }

  // 3. LIKE queries - indexes help but leading % prevents full optimization
  if (parsedQuery.from) {
    conditions.push("senderEmail LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(parsedQuery.from)}%`);
  }

  if (parsedQuery.subject) {
    conditions.push("subject LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(parsedQuery.subject)}%`);
  }

  // To filter: not implemented — the emails table has no recipient column.
  // The to: operator is parsed by parseSearchQuery but intentionally ignored here.
  // It is also excluded from UI suggestions so users are not misled.
  if (parsedQuery.to) {
    console.warn('Search operator "to:" is not supported — no recipient column in emails table');
  }

  // 4. Free text search (least selective, requires scanning body field)
  // Note: body is not indexed due to size, so this will be slowest
  if (parsedQuery.freeText) {
    conditions.push("(subject LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')");
    params.push(`%${escapeLike(parsedQuery.freeText)}%`, `%${escapeLike(parsedQuery.freeText)}%`);
  }

  // Build WHERE clause
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { where, params };
}

module.exports = {
  parseSearchQuery,
  buildSearchWhereClause,
};
