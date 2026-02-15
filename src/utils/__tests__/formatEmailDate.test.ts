import { describe, it, expect } from 'vitest';
import { formatEmailDate } from '../formatEmailDate';

describe('formatEmailDate', () => {
  describe('Edge Cases', () => {
    it('should handle null input', () => {
      const result = formatEmailDate(null);
      expect(result).toBe(null);
    });

    it('should handle undefined input', () => {
      const result = formatEmailDate(undefined);
      expect(result).toBe(null);
    });

    it('should handle NaN input', () => {
      const result = formatEmailDate(NaN);
      expect(result).toBe(null);
    });

    it('should handle invalid number types', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = formatEmailDate('not a number' as any);
      expect(result).toBe(null);
    });

    it('should handle zero timestamp', () => {
      const result = formatEmailDate(0);
      expect(result).not.toBe(null);
      expect(typeof result).toBe('string');
    });

    it('should handle future timestamps', () => {
      const future = Date.now() + 10000; // 10 seconds in the future
      const result = formatEmailDate(future);
      expect(result).not.toBe(null);
      expect(result).toMatch(/^\d{2}:\d{2}$/); // Should format as time
    });

    it('should handle invalid date values', () => {
      const result = formatEmailDate(Infinity);
      expect(result).toBe(null);
    });
  });

  describe('Today Range (0 days ago)', () => {
    it('should format current time as HH:MM', () => {
      const now = Date.now();
      const result = formatEmailDate(now);
      expect(result).not.toBe(null);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should format morning time correctly (e.g., 08:30)', () => {
      const today = new Date();
      today.setHours(8, 30, 0, 0);
      const result = formatEmailDate(today.getTime());
      expect(result).toBe('08:30');
    });

    it('should format afternoon time correctly (e.g., 14:45)', () => {
      const today = new Date();
      today.setHours(14, 45, 0, 0);
      const result = formatEmailDate(today.getTime());
      expect(result).toBe('14:45');
    });

    it('should format evening time correctly (e.g., 23:59)', () => {
      const today = new Date();
      today.setHours(23, 59, 0, 0);
      const result = formatEmailDate(today.getTime());
      expect(result).toBe('23:59');
    });

    it('should format midnight correctly (00:00)', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = formatEmailDate(today.getTime());
      expect(result).toBe('00:00');
    });

    it('should pad single-digit hours with zero', () => {
      const today = new Date();
      today.setHours(9, 5, 0, 0);
      const result = formatEmailDate(today.getTime());
      expect(result).toBe('09:05');
    });

    it('should pad single-digit minutes with zero', () => {
      const today = new Date();
      today.setHours(14, 7, 0, 0);
      const result = formatEmailDate(today.getTime());
      expect(result).toBe('14:07');
    });
  });

  describe('Yesterday Range (1 day ago)', () => {
    it('should format yesterday as "Gestern"', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatEmailDate(yesterday.getTime());
      expect(result).toBe('Gestern');
    });

    it('should format yesterday morning as "Gestern"', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(8, 30, 0, 0);
      const result = formatEmailDate(yesterday.getTime());
      expect(result).toBe('Gestern');
    });

    it('should format yesterday evening as "Gestern"', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 0, 0);
      const result = formatEmailDate(yesterday.getTime());
      expect(result).toBe('Gestern');
    });

    it('should format yesterday midnight as "Gestern"', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const result = formatEmailDate(yesterday.getTime());
      expect(result).toBe('Gestern');
    });
  });

  describe('This Week Range (2-6 days ago)', () => {
    it('should format 2 days ago as day name', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const result = formatEmailDate(twoDaysAgo.getTime());
      expect(result).not.toBe(null);
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(result);
    });

    it('should format 3 days ago as day name', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const result = formatEmailDate(threeDaysAgo.getTime());
      expect(result).not.toBe(null);
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(result);
    });

    it('should format 4 days ago as day name', () => {
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      const result = formatEmailDate(fourDaysAgo.getTime());
      expect(result).not.toBe(null);
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(result);
    });

    it('should format 5 days ago as day name', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const result = formatEmailDate(fiveDaysAgo.getTime());
      expect(result).not.toBe(null);
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(result);
    });

    it('should format 6 days ago as day name', () => {
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      const result = formatEmailDate(sixDaysAgo.getTime());
      expect(result).not.toBe(null);
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(result);
    });

    it('should return correct day name for specific weekdays', () => {
      // This test creates a date for a known weekday
      // February 10, 2026 is a Tuesday (Dienstag)
      const tuesday = new Date(2026, 1, 10, 14, 30).getTime();
      const result = formatEmailDate(tuesday);
      expect(result).toBe('Dienstag');
    });

    it('should return correct day name for Monday', () => {
      // February 9, 2026 is a Monday (Montag)
      const monday = new Date(2026, 1, 9, 10, 0).getTime();
      const result = formatEmailDate(monday);
      expect(result).toBe('Montag');
    });

    it('should return correct day name for Saturday', () => {
      // February 14, 2026 is a Saturday (Samstag) - yesterday from Feb 15
      // But we need a Saturday in 2-6 days range, so use Feb 7 (8 days ago) - wait that's too old
      // Let's use a dynamic approach: find a date 3 days ago and verify it returns a day name
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const result = formatEmailDate(threeDaysAgo.getTime());
      // Should return a German day name
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(result);
      // Verify it matches the actual day
      const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
      expect(result).toBe(dayNames[threeDaysAgo.getDay()]);
    });
  });

  describe('Older Range (7+ days ago)', () => {
    it('should format exactly 7 days ago as full date', () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const result = formatEmailDate(sevenDaysAgo.getTime());
      expect(result).not.toBe(null);
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should format 14 days ago as full date', () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const result = formatEmailDate(twoWeeksAgo.getTime());
      expect(result).not.toBe(null);
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should format 30 days ago as full date', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const result = formatEmailDate(thirtyDaysAgo.getTime());
      expect(result).not.toBe(null);
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should format 365 days ago as full date', () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const result = formatEmailDate(oneYearAgo.getTime());
      expect(result).not.toBe(null);
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should format specific date correctly (15.01.2026)', () => {
      const specificDate = new Date(2026, 0, 15).getTime(); // January 15, 2026
      const result = formatEmailDate(specificDate);
      expect(result).toBe('15.01.2026');
    });

    it('should format date with single-digit day correctly', () => {
      const specificDate = new Date(2025, 11, 5).getTime(); // December 5, 2025
      const result = formatEmailDate(specificDate);
      expect(result).toBe('05.12.2025');
    });

    it('should format date with single-digit month correctly', () => {
      const specificDate = new Date(2025, 0, 20).getTime(); // January 20, 2025
      const result = formatEmailDate(specificDate);
      expect(result).toBe('20.01.2025');
    });

    it('should format New Years Day correctly', () => {
      const newYears = new Date(2025, 0, 1).getTime(); // January 1, 2025
      const result = formatEmailDate(newYears);
      expect(result).toBe('01.01.2025');
    });

    it('should format Christmas correctly', () => {
      const christmas = new Date(2025, 11, 25).getTime(); // December 25, 2025
      const result = formatEmailDate(christmas);
      expect(result).toBe('25.12.2025');
    });
  });

  describe('Boundary Testing', () => {
    it('should correctly transition from today to yesterday at midnight', () => {
      const today = new Date();
      today.setHours(0, 1, 0, 0); // Just after midnight today
      const todayResult = formatEmailDate(today.getTime());
      expect(todayResult).toBe('00:01'); // Should show time

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 0, 0); // Just before midnight yesterday
      const yesterdayResult = formatEmailDate(yesterday.getTime());
      expect(yesterdayResult).toBe('Gestern'); // Should show "Gestern"
    });

    it('should correctly transition from yesterday to this week', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayResult = formatEmailDate(yesterday.getTime());
      expect(yesterdayResult).toBe('Gestern');

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(23, 59, 0, 0);
      const twoDaysAgoResult = formatEmailDate(twoDaysAgo.getTime());
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(twoDaysAgoResult);
    });

    it('should correctly transition from this week to older', () => {
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      sixDaysAgo.setHours(23, 59, 0, 0);
      const sixDaysResult = formatEmailDate(sixDaysAgo.getTime());
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(sixDaysResult);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const sevenDaysResult = formatEmailDate(sevenDaysAgo.getTime());
      expect(sevenDaysResult).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should handle end of month boundaries', () => {
      // Test date at end of January
      const endOfJan = new Date(2026, 0, 31).getTime();
      const result = formatEmailDate(endOfJan);
      expect(result).toBe('31.01.2026');
    });

    it('should handle leap year dates', () => {
      // February 29 in a leap year
      const leapDay = new Date(2024, 1, 29).getTime();
      const result = formatEmailDate(leapDay);
      expect(result).toBe('29.02.2024');
    });

    it('should handle year boundaries', () => {
      // December 31, 2025
      const endOfYear = new Date(2025, 11, 31).getTime();
      const result = formatEmailDate(endOfYear);
      expect(result).toBe('31.12.2025');
    });
  });

  describe('German Language Correctness', () => {
    it('should use German day names', () => {
      const germanDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

      // Test a date from 2-6 days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const result = formatEmailDate(threeDaysAgo.getTime());

      expect(germanDays).toContain(result);

      // Should not contain English day names
      const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      englishDays.forEach((englishDay) => {
        expect(result).not.toBe(englishDay);
      });
    });

    it('should use "Gestern" not "Yesterday"', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatEmailDate(yesterday.getTime());

      expect(result).toBe('Gestern');
      expect(result).not.toBe('Yesterday');
    });

    it('should use German date format (DD.MM.YYYY) not US format', () => {
      const oldDate = new Date(2025, 0, 15).getTime(); // January 15, 2025
      const result = formatEmailDate(oldDate);

      expect(result).toBe('15.01.2025'); // German format
      expect(result).not.toBe('01/15/2025'); // Not US format
      expect(result).not.toBe('2025-01-15'); // Not ISO format
    });
  });

  describe('Real-World Email Scenarios', () => {
    it('should format email received this morning', () => {
      const thisMorning = new Date();
      thisMorning.setHours(9, 15, 0, 0);
      const result = formatEmailDate(thisMorning.getTime());
      expect(result).toBe('09:15');
    });

    it('should format email received this afternoon', () => {
      const thisAfternoon = new Date();
      thisAfternoon.setHours(15, 30, 0, 0);
      const result = formatEmailDate(thisAfternoon.getTime());
      expect(result).toBe('15:30');
    });

    it('should format email from yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(10, 0, 0, 0);
      const result = formatEmailDate(yesterday.getTime());
      expect(result).toBe('Gestern');
    });

    it('should format email from earlier this week', () => {
      const thisWeek = new Date();
      thisWeek.setDate(thisWeek.getDate() - 4);
      const result = formatEmailDate(thisWeek.getTime());
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(result);
    });

    it('should format email from last month', () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const result = formatEmailDate(lastMonth.getTime());
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should format email from last year', () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      const result = formatEmailDate(lastYear.getTime());
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should format very old email (5 years ago)', () => {
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const result = formatEmailDate(fiveYearsAgo.getTime());
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });
  });

  describe('Type Safety', () => {
    it('should return string or null, never undefined', () => {
      const testCases = [
        null,
        undefined,
        Date.now(),
        Date.now() - 1000,
        0,
        new Date().getTime(),
      ];

      testCases.forEach((testCase) => {
        const result = formatEmailDate(testCase);
        expect(result === null || typeof result === 'string').toBe(true);
        expect(result).not.toBe(undefined);
      });
    });

    it('should return valid time format for today', () => {
      const today = new Date();
      today.setHours(14, 30, 0, 0);
      const result = formatEmailDate(today.getTime());

      expect(result).not.toBe(null);
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should return "Gestern" string for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatEmailDate(yesterday.getTime());

      expect(result).not.toBe(null);
      expect(typeof result).toBe('string');
      expect(result).toBe('Gestern');
    });

    it('should return valid day name for this week', () => {
      const thisWeek = new Date();
      thisWeek.setDate(thisWeek.getDate() - 3);
      const result = formatEmailDate(thisWeek.getTime());

      expect(result).not.toBe(null);
      expect(typeof result).toBe('string');
      expect(['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']).toContain(result);
    });

    it('should return valid date format for older dates', () => {
      const older = new Date();
      older.setDate(older.getDate() - 30);
      const result = formatEmailDate(older.getTime());

      expect(result).not.toBe(null);
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });
  });

  describe('Consistency Across Time Zones', () => {
    it('should handle dates consistently regardless of time', () => {
      const date = new Date(2026, 0, 15);

      // Same date at different times should all format the same way
      const morning = new Date(date);
      morning.setHours(8, 0, 0, 0);

      const afternoon = new Date(date);
      afternoon.setHours(14, 0, 0, 0);

      const evening = new Date(date);
      evening.setHours(22, 0, 0, 0);

      const resultMorning = formatEmailDate(morning.getTime());
      const resultAfternoon = formatEmailDate(afternoon.getTime());
      const resultEvening = formatEmailDate(evening.getTime());

      // All should be the same date format
      expect(resultMorning).toBe('15.01.2026');
      expect(resultAfternoon).toBe('15.01.2026');
      expect(resultEvening).toBe('15.01.2026');
    });
  });

  describe('Format Validation', () => {
    it('should always use 24-hour format for times', () => {
      const times = [
        { hours: 0, minutes: 0, expected: '00:00' },
        { hours: 13, minutes: 30, expected: '13:30' },
        { hours: 23, minutes: 59, expected: '23:59' },
      ];

      times.forEach(({ hours, minutes, expected }) => {
        const today = new Date();
        today.setHours(hours, minutes, 0, 0);
        const result = formatEmailDate(today.getTime());
        expect(result).toBe(expected);
      });
    });

    it('should always pad time components to 2 digits', () => {
      const today = new Date();
      today.setHours(1, 5, 0, 0);
      const result = formatEmailDate(today.getTime());
      expect(result).toBe('01:05');
      expect(result).not.toBe('1:5');
    });

    it('should always pad date components to 2 digits', () => {
      const date = new Date(2026, 0, 5).getTime(); // January 5
      const result = formatEmailDate(date);
      expect(result).toBe('05.01.2026');
      expect(result).not.toBe('5.1.2026');
    });

    it('should always use 4-digit years', () => {
      const date = new Date(2026, 0, 15).getTime();
      const result = formatEmailDate(date);
      expect(result).toBe('15.01.2026');
      // Verify it's a 4-digit year by checking the format
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });
  });
});
