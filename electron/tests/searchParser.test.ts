import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parseSearchQuery } = require('../utils/searchParser.cjs');

describe('searchParser', () => {
  describe('basic operator parsing', () => {
    it('should parse from: operator', () => {
      const result = parseSearchQuery('from:amazon test');
      expect(result.from).toBe('amazon');
      expect(result.freeText).toBe('test');
    });

    it('should parse to: operator', () => {
      const result = parseSearchQuery('to:john@example.com invoice');
      expect(result.to).toBe('john@example.com');
      expect(result.freeText).toBe('invoice');
    });

    it('should parse subject: operator', () => {
      const result = parseSearchQuery('subject:invoice test');
      expect(result.subject).toBe('invoice');
      expect(result.freeText).toBe('test');
    });

    it('should parse category: operator', () => {
      const result = parseSearchQuery('category:Rechnungen');
      expect(result.category).toBe('Rechnungen');
      expect(result.freeText).toBe('');
    });

    it('should parse has:attachment operator', () => {
      const result = parseSearchQuery('has:attachment from:amazon');
      expect(result.hasAttachment).toBe(true);
      expect(result.from).toBe('amazon');
    });

    it('should parse before: operator', () => {
      const result = parseSearchQuery('before:2026-01-01');
      expect(result.before).toBe('2026-01-01');
      expect(result.freeText).toBe('');
    });

    it('should parse after: operator', () => {
      const result = parseSearchQuery('after:2026-01-01');
      expect(result.after).toBe('2026-01-01');
      expect(result.freeText).toBe('');
    });
  });

  describe('quoted values', () => {
    it('should parse quoted values with spaces', () => {
      const result = parseSearchQuery('from:"John Doe" subject:"Monthly Report"');
      expect(result.from).toBe('John Doe');
      expect(result.subject).toBe('Monthly Report');
    });

    it('should handle mixed quoted and unquoted values', () => {
      const result = parseSearchQuery('from:"John Doe" to:jane category:Work urgent');
      expect(result.from).toBe('John Doe');
      expect(result.to).toBe('jane');
      expect(result.category).toBe('Work');
      expect(result.freeText).toBe('urgent');
    });
  });

  describe('multiple operators', () => {
    it('should parse multiple operators correctly', () => {
      const result = parseSearchQuery('from:amazon category:Rechnungen after:2026-01-01 has:attachment');
      expect(result.from).toBe('amazon');
      expect(result.category).toBe('Rechnungen');
      expect(result.after).toBe('2026-01-01');
      expect(result.hasAttachment).toBe(true);
      expect(result.freeText).toBe('');
    });

    it('should preserve free text between operators', () => {
      const result = parseSearchQuery('from:amazon invoice from:ebay receipt');
      // Last operator value should win
      expect(result.from).toBe('ebay');
      expect(result.freeText).toBe('invoice receipt');
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', () => {
      const result = parseSearchQuery('');
      expect(result.freeText).toBe('');
      expect(result.from).toBeUndefined();
    });

    it('should handle query with only free text', () => {
      const result = parseSearchQuery('urgent invoice payment');
      expect(result.freeText).toBe('urgent invoice payment');
      expect(result.from).toBeUndefined();
      expect(result.to).toBeUndefined();
    });

    it('should handle operator without value', () => {
      const result = parseSearchQuery('from: to:john');
      expect(result.from).toBeUndefined();
      expect(result.to).toBe('john');
    });

    it('should handle case-insensitive operators', () => {
      const result = parseSearchQuery('FROM:amazon TO:john SUBJECT:test');
      expect(result.from).toBe('amazon');
      expect(result.to).toBe('john');
      expect(result.subject).toBe('test');
    });

    it('should handle has:attachments (plural)', () => {
      const result = parseSearchQuery('has:attachments');
      expect(result.hasAttachment).toBe(true);
    });

    it('should trim whitespace from values', () => {
      const result = parseSearchQuery('from:  amazon   to: john  ');
      expect(result.from).toBe('amazon');
      expect(result.to).toBe('john');
    });
  });

  describe('date range parsing', () => {
    it('should parse date range with both before and after', () => {
      const result = parseSearchQuery('after:2026-01-01 before:2026-12-31');
      expect(result.after).toBe('2026-01-01');
      expect(result.before).toBe('2026-12-31');
    });

    it('should handle different date formats gracefully', () => {
      const result = parseSearchQuery('after:01/01/2026');
      expect(result.after).toBe('01/01/2026');
    });
  });

  describe('return structure', () => {
    it('should return all expected fields', () => {
      const result = parseSearchQuery('from:test');
      expect(result).toHaveProperty('from');
      expect(result).toHaveProperty('to');
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('hasAttachment');
      expect(result).toHaveProperty('before');
      expect(result).toHaveProperty('after');
      expect(result).toHaveProperty('freeText');
    });
  });
});
