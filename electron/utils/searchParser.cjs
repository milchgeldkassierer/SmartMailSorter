/**
 * Search Query Parser
 *
 * Parses search queries with operators like:
 * - from:sender
 * - to:recipient
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
 * @param {Object} parsedQuery - Output from parseSearchQuery
 * @param {string} accountId - Optional account ID to filter by
 * @returns {Object} { where: string, params: array }
 */
function buildSearchWhereClause(parsedQuery, accountId = null) {
  const conditions = [];
  const params = [];

  // Account filter
  if (accountId) {
    conditions.push('accountId = ?');
    params.push(accountId);
  }

  // From filter
  if (parsedQuery.from) {
    conditions.push('senderEmail LIKE ?');
    params.push(`%${parsedQuery.from}%`);
  }

  // To filter (note: we don't store recipient emails in the current schema)
  // This would need to be added to the emails table if needed
  if (parsedQuery.to) {
    // For now, we'll skip this or add a TODO
    // conditions.push('recipientEmail LIKE ?');
    // params.push(`%${parsedQuery.to}%`);
  }

  // Subject filter
  if (parsedQuery.subject) {
    conditions.push('subject LIKE ?');
    params.push(`%${parsedQuery.subject}%`);
  }

  // Category filter
  if (parsedQuery.category) {
    conditions.push('smartCategory = ?');
    params.push(parsedQuery.category);
  }

  // Has attachment filter
  if (parsedQuery.hasAttachment === true) {
    conditions.push('hasAttachments = 1');
  }

  // Date range filters
  if (parsedQuery.before) {
    conditions.push('date < ?');
    params.push(parsedQuery.before);
  }

  if (parsedQuery.after) {
    conditions.push('date > ?');
    params.push(parsedQuery.after);
  }

  // Free text search (search in subject and body)
  if (parsedQuery.freeText) {
    conditions.push('(subject LIKE ? OR body LIKE ?)');
    params.push(`%${parsedQuery.freeText}%`, `%${parsedQuery.freeText}%`);
  }

  // Build WHERE clause
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { where, params };
}

module.exports = {
  parseSearchQuery,
  buildSearchWhereClause,
};
