import { describe, it, expect } from 'vitest';
import { formatTimeAgo } from '../formatTimeAgo';

describe('formatTimeAgo', () => {
  describe('Edge Cases', () => {
    it('should handle null input', () => {
      const result = formatTimeAgo(null);
      expect(result).toBe(null);
    });

    it('should handle undefined input', () => {
      const result = formatTimeAgo(undefined);
      expect(result).toBe(null);
    });

    it('should handle NaN input', () => {
      const result = formatTimeAgo(NaN);
      expect(result).toBe(null);
    });

    it('should handle invalid number types', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = formatTimeAgo('not a number' as any);
      expect(result).toBe(null);
    });

    it('should handle zero timestamp', () => {
      const result = formatTimeAgo(0);
      expect(result).not.toBe(null);
      expect(typeof result).toBe('string');
    });

    it('should handle future timestamps', () => {
      const future = Date.now() + 10000; // 10 seconds in the future
      const result = formatTimeAgo(future);
      expect(result).toBe('Gerade eben');
    });
  });

  describe('Seconds Range (< 1 minute)', () => {
    it('should format timestamps less than 1 minute as "vor wenigen Sekunden"', () => {
      const now = Date.now();
      const timestamp = now - 30 * 1000; // 30 seconds ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Gerade eben');
    });

    it('should format 0 seconds as "vor wenigen Sekunden"', () => {
      const now = Date.now();
      const result = formatTimeAgo(now);
      expect(result).toBe('Gerade eben');
    });

    it('should format 59 seconds as "vor wenigen Sekunden"', () => {
      const now = Date.now();
      const timestamp = now - 59 * 1000; // 59 seconds ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Gerade eben');
    });
  });

  describe('Minutes Range (1-59 minutes)', () => {
    it('should format exactly 1 minute', () => {
      const now = Date.now();
      const timestamp = now - 1 * 60 * 1000; // 1 minute ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor einer Minute');
    });

    it('should format 2 minutes', () => {
      const now = Date.now();
      const timestamp = now - 2 * 60 * 1000; // 2 minutes ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 2 Minuten');
    });

    it('should format 5 minutes', () => {
      const now = Date.now();
      const timestamp = now - 5 * 60 * 1000; // 5 minutes ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 5 Minuten');
    });

    it('should format 30 minutes', () => {
      const now = Date.now();
      const timestamp = now - 30 * 60 * 1000; // 30 minutes ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 30 Minuten');
    });

    it('should format 59 minutes', () => {
      const now = Date.now();
      const timestamp = now - 59 * 60 * 1000; // 59 minutes ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 59 Minuten');
    });

    it('should use singular "Minute" for 1 minute', () => {
      const now = Date.now();
      const timestamp = now - 1 * 60 * 1000;
      const result = formatTimeAgo(timestamp);
      expect(result).toContain('Minute');
      expect(result).not.toContain('Minuten');
    });

    it('should use plural "Minuten" for multiple minutes', () => {
      const now = Date.now();
      const timestamp = now - 5 * 60 * 1000;
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 5 Minuten');
    });
  });

  describe('Hours Range (1-23 hours)', () => {
    it('should format exactly 1 hour', () => {
      const now = Date.now();
      const timestamp = now - 1 * 60 * 60 * 1000; // 1 hour ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor einer Stunde');
    });

    it('should format 2 hours', () => {
      const now = Date.now();
      const timestamp = now - 2 * 60 * 60 * 1000; // 2 hours ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 2 Stunden');
    });

    it('should format 12 hours', () => {
      const now = Date.now();
      const timestamp = now - 12 * 60 * 60 * 1000; // 12 hours ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 12 Stunden');
    });

    it('should format 23 hours', () => {
      const now = Date.now();
      const timestamp = now - 23 * 60 * 60 * 1000; // 23 hours ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 23 Stunden');
    });

    it('should use singular "Stunde" for 1 hour', () => {
      const now = Date.now();
      const timestamp = now - 1 * 60 * 60 * 1000;
      const result = formatTimeAgo(timestamp);
      expect(result).toContain('Stunde');
      expect(result).not.toContain('Stunden');
    });

    it('should use plural "Stunden" for multiple hours', () => {
      const now = Date.now();
      const timestamp = now - 5 * 60 * 60 * 1000;
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 5 Stunden');
    });
  });

  describe('Days Range (1-6 days)', () => {
    it('should format exactly 1 day', () => {
      const now = Date.now();
      const timestamp = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor einem Tag');
    });

    it('should format 2 days', () => {
      const now = Date.now();
      const timestamp = now - 2 * 24 * 60 * 60 * 1000; // 2 days ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 2 Tagen');
    });

    it('should format 3 days', () => {
      const now = Date.now();
      const timestamp = now - 3 * 24 * 60 * 60 * 1000; // 3 days ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 3 Tagen');
    });

    it('should format 6 days', () => {
      const now = Date.now();
      const timestamp = now - 6 * 24 * 60 * 60 * 1000; // 6 days ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 6 Tagen');
    });

    it('should use singular "Tag" for 1 day', () => {
      const now = Date.now();
      const timestamp = now - 1 * 24 * 60 * 60 * 1000;
      const result = formatTimeAgo(timestamp);
      expect(result).toContain('Tag');
      expect(result).not.toContain('Tagen');
    });

    it('should use plural "Tagen" for multiple days', () => {
      const now = Date.now();
      const timestamp = now - 5 * 24 * 60 * 60 * 1000;
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 5 Tagen');
    });
  });

  describe('Weeks Range (7+ days)', () => {
    it('should format exactly 7 days as "Vor einer Woche"', () => {
      const now = Date.now();
      const timestamp = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor einer Woche');
    });

    it('should format 14 days as "Vor 2 Wochen"', () => {
      const now = Date.now();
      const timestamp = now - 14 * 24 * 60 * 60 * 1000; // 14 days ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 2 Wochen');
    });

    it('should format 30 days as "Vor 4 Wochen"', () => {
      const now = Date.now();
      const timestamp = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 4 Wochen');
    });

    it('should format 365 days as "Vor 52 Wochen"', () => {
      const now = Date.now();
      const timestamp = now - 365 * 24 * 60 * 60 * 1000; // 1 year ago
      const result = formatTimeAgo(timestamp);
      expect(result).toBe('Vor 52 Wochen');
    });
  });

  describe('Boundary Testing', () => {
    it('should correctly transition from seconds to minutes', () => {
      const now = Date.now();

      // 59 seconds should be "Gerade eben"
      const justUnder = now - 59 * 1000;
      expect(formatTimeAgo(justUnder)).toBe('Gerade eben');

      // 60 seconds (1 minute) should be "Vor einer Minute"
      const justOver = now - 60 * 1000;
      expect(formatTimeAgo(justOver)).toBe('Vor einer Minute');
    });

    it('should correctly transition from minutes to hours', () => {
      const now = Date.now();

      // 59 minutes should be "Vor 59 Minuten"
      const justUnder = now - 59 * 60 * 1000;
      expect(formatTimeAgo(justUnder)).toBe('Vor 59 Minuten');

      // 60 minutes (1 hour) should be "Vor einer Stunde"
      const justOver = now - 60 * 60 * 1000;
      expect(formatTimeAgo(justOver)).toBe('Vor einer Stunde');
    });

    it('should correctly transition from hours to days', () => {
      const now = Date.now();

      // 23 hours should be "Vor 23 Stunden"
      const justUnder = now - 23 * 60 * 60 * 1000;
      expect(formatTimeAgo(justUnder)).toBe('Vor 23 Stunden');

      // 24 hours (1 day) should be "Vor einem Tag"
      const justOver = now - 24 * 60 * 60 * 1000;
      expect(formatTimeAgo(justOver)).toBe('Vor einem Tag');
    });

    it('should correctly transition from days to weeks', () => {
      const now = Date.now();

      // 6 days should be "Vor 6 Tagen"
      const justUnder = now - 6 * 24 * 60 * 60 * 1000;
      expect(formatTimeAgo(justUnder)).toBe('Vor 6 Tagen');

      // 7 days should be "Vor einer Woche"
      const justOver = now - 7 * 24 * 60 * 60 * 1000;
      expect(formatTimeAgo(justOver)).toBe('Vor einer Woche');
    });
  });

  describe('German Language Correctness', () => {
    it('should always use German words', () => {
      const testCases = [
        { time: 30 * 1000, expected: 'Gerade' }, // seconds
        { time: 5 * 60 * 1000, expected: 'Minuten' }, // minutes
        { time: 2 * 60 * 60 * 1000, expected: 'Stunden' }, // hours
        { time: 3 * 24 * 60 * 60 * 1000, expected: 'Tagen' }, // days
        { time: 10 * 24 * 60 * 60 * 1000, expected: 'Woche' }, // weeks
      ];

      testCases.forEach(({ time, expected }) => {
        const now = Date.now();
        const result = formatTimeAgo(now - time);
        expect(result).toContain(expected);
        // Should not contain English words
        expect(result).not.toContain('ago');
        expect(result).not.toContain('second');
        expect(result).not.toContain('minute');
        expect(result).not.toContain('hour');
        expect(result).not.toContain('day');
        expect(result).not.toContain('week');
      });
    });

    it('should use correct singular/plural forms', () => {
      const now = Date.now();

      // Singular forms
      expect(formatTimeAgo(now - 1 * 60 * 1000)).toBe('Vor einer Minute');
      expect(formatTimeAgo(now - 1 * 60 * 60 * 1000)).toBe('Vor einer Stunde');
      expect(formatTimeAgo(now - 1 * 24 * 60 * 60 * 1000)).toBe('Vor einem Tag');

      // Plural forms
      expect(formatTimeAgo(now - 2 * 60 * 1000)).toBe('Vor 2 Minuten');
      expect(formatTimeAgo(now - 2 * 60 * 60 * 1000)).toBe('Vor 2 Stunden');
      expect(formatTimeAgo(now - 2 * 24 * 60 * 60 * 1000)).toBe('Vor 2 Tagen');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should format recent email sync (30 seconds ago)', () => {
      const now = Date.now();
      const syncTime = now - 30 * 1000;
      const result = formatTimeAgo(syncTime);
      expect(result).toBe('Gerade eben');
    });

    it('should format email sync from this morning (3 hours ago)', () => {
      const now = Date.now();
      const syncTime = now - 3 * 60 * 60 * 1000;
      const result = formatTimeAgo(syncTime);
      expect(result).toBe('Vor 3 Stunden');
    });

    it('should format email sync from yesterday (1 day ago)', () => {
      const now = Date.now();
      const syncTime = now - 1 * 24 * 60 * 60 * 1000;
      const result = formatTimeAgo(syncTime);
      expect(result).toBe('Vor einem Tag');
    });

    it('should format old email sync (2 weeks ago)', () => {
      const now = Date.now();
      const syncTime = now - 14 * 24 * 60 * 60 * 1000;
      const result = formatTimeAgo(syncTime);
      expect(result).toBe('Vor 2 Wochen');
    });

    it('should format never-synced account (epoch timestamp)', () => {
      const result = formatTimeAgo(0);
      // Should return a string, not null
      expect(result).not.toBe(null);
      expect(typeof result).toBe('string');
    });
  });

  describe('Type Safety', () => {
    it('should return string or null, never undefined', () => {
      const testCases = [null, undefined, Date.now(), Date.now() - 1000, 0];

      testCases.forEach((testCase) => {
        const result = formatTimeAgo(testCase);
        expect(result === null || typeof result === 'string').toBe(true);
        expect(result).not.toBe(undefined);
      });
    });

    it('should always return string starting with "Vor" or "Gerade" for valid timestamps', () => {
      const testCases = [
        Date.now(),
        Date.now() - 30 * 1000,
        Date.now() - 5 * 60 * 1000,
        Date.now() - 2 * 60 * 60 * 1000,
        Date.now() - 3 * 24 * 60 * 60 * 1000,
        Date.now() - 10 * 24 * 60 * 60 * 1000,
      ];

      testCases.forEach((testCase) => {
        const result = formatTimeAgo(testCase);
        expect(result).not.toBe(null);
        expect(result).toMatch(/^(Vor |Gerade)/);
      });
    });
  });
});
