import { describe, it, expect } from 'vitest';
import { highlightMatches, extractSearchTerms, escapeRegex } from '../highlightMatches';

describe('highlightMatches', () => {
  describe('Basic Highlighting', () => {
    it('should wrap matching term in <mark> tags', () => {
      const text = 'Hello World';
      const query = 'hello';
      const result = highlightMatches(text, query);

      expect(result).toBe('<mark>Hello</mark> World');
    });

    it('should handle case-insensitive matching', () => {
      const text = 'HELLO world Hello';
      const query = 'hello';
      const result = highlightMatches(text, query);

      expect(result).toBe('<mark>HELLO</mark> world <mark>Hello</mark>');
    });

    it('should highlight multiple occurrences', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const query = 'the';
      const result = highlightMatches(text, query);

      expect(result).toBe('<mark>The</mark> quick brown fox jumps over <mark>the</mark> lazy dog');
    });

    it('should highlight multiple different terms', () => {
      const text = 'Invoice from Amazon for payment';
      const query = 'invoice payment';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Invoice</mark>');
      expect(result).toContain('<mark>payment</mark>');
    });

    it('should preserve original case in highlighted text', () => {
      const text = 'Hello HELLO hello';
      const query = 'hello';
      const result = highlightMatches(text, query);

      expect(result).toBe('<mark>Hello</mark> <mark>HELLO</mark> <mark>hello</mark>');
    });
  });

  describe('Search Operator Handling', () => {
    it('should exclude from: operator values', () => {
      const text = 'Email from Amazon about invoice';
      const query = 'from:amazon invoice';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>invoice</mark>');
      expect(result).not.toContain('<mark>amazon</mark>');
      expect(result).not.toContain('<mark>Amazon</mark>');
    });

    it('should exclude to: operator values', () => {
      const text = 'Send email to support about issue';
      const query = 'to:support email';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>email</mark>');
      expect(result).not.toContain('<mark>support</mark>');
    });

    it('should exclude subject: operator values', () => {
      const text = 'Meeting scheduled for tomorrow';
      const query = 'subject:meeting scheduled';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>scheduled</mark>');
      expect(result).not.toContain('<mark>Meeting</mark>');
    });

    it('should exclude category: operator values', () => {
      const text = 'Invoice from last month';
      const query = 'category:Rechnungen invoice';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Invoice</mark>');
      expect(result).not.toContain('<mark>Rechnungen</mark>');
    });

    it('should exclude has:attachment operator', () => {
      const text = 'Email with attachment included';
      const query = 'has:attachment email';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Email</mark>');
      expect(result).not.toContain('<mark>attachment</mark>');
    });

    it('should exclude before: and after: date operators', () => {
      const text = 'Messages from last year';
      const query = 'before:2026-01-01 after:2025-01-01 messages';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Messages</mark>');
    });

    it('should handle quoted operator values', () => {
      const text = 'Important meeting scheduled tomorrow';
      const query = 'subject:"important meeting" tomorrow';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>tomorrow</mark>');
      expect(result).not.toContain('<mark>important</mark>');
      expect(result).not.toContain('<mark>meeting</mark>');
    });

    it('should handle multiple operators', () => {
      const text = 'Invoice email from Amazon';
      const query = 'from:amazon to:me category:Rechnungen invoice email';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Invoice</mark>');
      expect(result).toContain('<mark>email</mark>');
      expect(result).not.toContain('<mark>Amazon</mark>');
    });
  });

  describe('Special Characters', () => {
    it('should handle text with periods', () => {
      const text = 'Email from test.user@example.com';
      const query = 'email';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Email</mark>');
    });

    it('should handle search terms with periods', () => {
      const text = 'Visit example.com for more info';
      const query = 'example.com';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>example.com</mark>');
    });

    it('should handle text with parentheses', () => {
      const text = 'Invoice (paid) from vendor';
      const query = 'invoice';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Invoice</mark>');
    });

    it('should handle search terms with brackets', () => {
      const text = 'Item [123] in stock';
      const query = '[123]';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>[123]</mark>');
    });

    it('should handle text with dollar signs', () => {
      const text = 'Total cost: $100';
      const query = '$100';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>$100</mark>');
    });

    it('should handle text with plus signs', () => {
      const text = 'Result: 2+2=4';
      const query = '2+2';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>2+2</mark>');
    });

    it('should handle text with asterisks', () => {
      const text = 'Important notice: ***URGENT***';
      const query = '***URGENT***';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>***URGENT***</mark>');
    });
  });

  describe('HTML Content', () => {
    it('should HTML-escape text containing HTML tags for XSS safety', () => {
      const text = '<p>Hello <strong>World</strong></p>';
      const query = 'hello';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Hello</mark>');
      expect(result).not.toContain('<strong>');
      expect(result).toContain('&lt;strong&gt;');
    });

    it('should HTML-escape text containing links', () => {
      const text = '<a href="https://example.com">Visit site</a>';
      const query = 'visit';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Visit</mark>');
      expect(result).not.toContain('<a href');
      expect(result).toContain('&lt;a href');
    });

    it('should HTML-escape complex HTML structure', () => {
      const text = '<div><h2>Invoice Details</h2><p>Amount: $100</p></div>';
      const query = 'invoice amount';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Invoice</mark>');
      expect(result).toContain('<mark>Amount</mark>');
      expect(result).not.toContain('<div>');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null text input', () => {
      const result = highlightMatches(null, 'query');
      expect(result).toBe('');
    });

    it('should handle undefined text input', () => {
      const result = highlightMatches(undefined, 'query');
      expect(result).toBe('');
    });

    it('should handle empty text string', () => {
      const result = highlightMatches('', 'query');
      expect(result).toBe('');
    });

    it('should handle null query input', () => {
      const result = highlightMatches('Hello World', null);
      expect(result).toBe('Hello World');
    });

    it('should handle undefined query input', () => {
      const result = highlightMatches('Hello World', undefined);
      expect(result).toBe('Hello World');
    });

    it('should handle empty query string', () => {
      const result = highlightMatches('Hello World', '');
      expect(result).toBe('Hello World');
    });

    it('should handle whitespace-only query', () => {
      const result = highlightMatches('Hello World', '   \n\t  ');
      expect(result).toBe('Hello World');
    });

    it('should handle text with no matches', () => {
      const result = highlightMatches('Hello World', 'xyz');
      expect(result).toBe('Hello World');
    });

    it('should handle query with only operators', () => {
      const result = highlightMatches('Hello World', 'from:test to:user');
      expect(result).toBe('Hello World');
    });

    it('should handle very long text', () => {
      const longText = 'Hello '.repeat(1000) + 'World';
      const result = highlightMatches(longText, 'world');

      expect(result).toContain('<mark>World</mark>');
      expect(result.split('<mark>').length).toBe(2); // Only one match for 'World'
    });

    it('should handle Unicode characters', () => {
      const text = 'Rechnung für Benutzer 世界';
      const query = 'rechnung 世界';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Rechnung</mark>');
      expect(result).toContain('<mark>世界</mark>');
    });

    it('should handle emojis', () => {
      const text = 'Great work! 🎉 Congratulations 🎊';
      const query = 'great';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Great</mark>');
      expect(result).toContain('🎉');
    });
  });

  describe('Real-World Use Cases', () => {
    it('should highlight invoice search', () => {
      const text = 'Invoice #12345 from Amazon - Total: $99.99';
      const query = 'from:amazon invoice total';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Invoice</mark>');
      expect(result).toContain('<mark>Total</mark>');
      expect(result).not.toContain('<mark>Amazon</mark>');
    });

    it('should highlight meeting search', () => {
      const text = 'Re: Meeting scheduled for tomorrow at 2pm';
      const query = 'subject:meeting scheduled tomorrow';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>scheduled</mark>');
      expect(result).toContain('<mark>tomorrow</mark>');
      expect(result).not.toContain('<mark>Meeting</mark>');
    });

    it('should highlight newsletter search', () => {
      const text = 'Weekly Newsletter - Special Offers Inside!';
      const query = 'category:Newsletter special offers';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Special</mark>');
      expect(result).toContain('<mark>Offers</mark>');
      expect(result).not.toContain('<mark>Newsletter</mark>');
    });

    it('should highlight attachment search', () => {
      const text = 'Document attached - Please review';
      const query = 'has:attachment document review';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Document</mark>');
      expect(result).toContain('<mark>review</mark>');
      expect(result).not.toContain('<mark>attached</mark>');
    });

    it('should highlight German language search', () => {
      const text = 'Rechnung von letztem Monat über 100 Euro';
      const query = 'rechnung monat euro';
      const result = highlightMatches(text, query);

      expect(result).toContain('<mark>Rechnung</mark>');
      expect(result).toContain('<mark>Monat</mark>');
      expect(result).toContain('<mark>Euro</mark>');
    });
  });
});

describe('extractSearchTerms', () => {
  describe('Basic Extraction', () => {
    it('should extract simple search terms', () => {
      const terms = extractSearchTerms('hello world');
      expect(terms).toEqual(['hello', 'world']);
    });

    it('should extract single term', () => {
      const terms = extractSearchTerms('invoice');
      expect(terms).toEqual(['invoice']);
    });

    it('should handle extra whitespace', () => {
      const terms = extractSearchTerms('  hello   world  ');
      expect(terms).toEqual(['hello', 'world']);
    });

    it('should handle empty query', () => {
      const terms = extractSearchTerms('');
      expect(terms).toEqual([]);
    });
  });

  describe('Operator Removal', () => {
    it('should remove from: operator', () => {
      const terms = extractSearchTerms('from:amazon invoice');
      expect(terms).toEqual(['invoice']);
    });

    it('should remove to: operator', () => {
      const terms = extractSearchTerms('to:support email');
      expect(terms).toEqual(['email']);
    });

    it('should remove subject: operator', () => {
      const terms = extractSearchTerms('subject:meeting tomorrow');
      expect(terms).toEqual(['tomorrow']);
    });

    it('should remove category: operator', () => {
      const terms = extractSearchTerms('category:Rechnungen invoice');
      expect(terms).toEqual(['invoice']);
    });

    it('should remove has: operator', () => {
      const terms = extractSearchTerms('has:attachment document');
      expect(terms).toEqual(['document']);
    });

    it('should remove before: operator', () => {
      const terms = extractSearchTerms('before:2026-01-01 messages');
      expect(terms).toEqual(['messages']);
    });

    it('should remove after: operator', () => {
      const terms = extractSearchTerms('after:2025-01-01 emails');
      expect(terms).toEqual(['emails']);
    });

    it('should remove multiple operators', () => {
      const terms = extractSearchTerms('from:amazon to:me category:Rechnungen invoice');
      expect(terms).toEqual(['invoice']);
    });

    it('should remove quoted operator values', () => {
      const terms = extractSearchTerms('subject:"important meeting" tomorrow');
      expect(terms).toEqual(['tomorrow']);
    });

    it('should handle query with only operators', () => {
      const terms = extractSearchTerms('from:test to:user category:inbox');
      expect(terms).toEqual([]);
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle uppercase operators', () => {
      const terms = extractSearchTerms('FROM:amazon invoice');
      expect(terms).toEqual(['invoice']);
    });

    it('should handle mixed case operators', () => {
      const terms = extractSearchTerms('FrOm:amazon invoice');
      expect(terms).toEqual(['invoice']);
    });
  });
});

describe('escapeRegex', () => {
  describe('Special Character Escaping', () => {
    it('should escape period', () => {
      expect(escapeRegex('hello.world')).toBe('hello\\.world');
    });

    it('should escape asterisk', () => {
      expect(escapeRegex('test*')).toBe('test\\*');
    });

    it('should escape plus', () => {
      expect(escapeRegex('a+b')).toBe('a\\+b');
    });

    it('should escape question mark', () => {
      expect(escapeRegex('what?')).toBe('what\\?');
    });

    it('should escape caret', () => {
      expect(escapeRegex('^start')).toBe('\\^start');
    });

    it('should escape dollar sign', () => {
      expect(escapeRegex('end$')).toBe('end\\$');
    });

    it('should escape curly braces', () => {
      expect(escapeRegex('test{1,2}')).toBe('test\\{1,2\\}');
    });

    it('should escape parentheses', () => {
      expect(escapeRegex('(group)')).toBe('\\(group\\)');
    });

    it('should escape pipe', () => {
      expect(escapeRegex('a|b')).toBe('a\\|b');
    });

    it('should escape square brackets', () => {
      expect(escapeRegex('[abc]')).toBe('\\[abc\\]');
    });

    it('should escape backslash', () => {
      expect(escapeRegex('test\\path')).toBe('test\\\\path');
    });

    it('should escape multiple special characters', () => {
      expect(escapeRegex('$100.00 (paid)')).toBe('\\$100\\.00 \\(paid\\)');
    });

    it('should handle text with no special characters', () => {
      expect(escapeRegex('hello')).toBe('hello');
    });

    it('should handle empty string', () => {
      expect(escapeRegex('')).toBe('');
    });
  });
});
