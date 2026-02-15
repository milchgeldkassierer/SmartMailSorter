/**
 * Format a timestamp as a smart date string for email lists (German).
 *
 * This function converts Unix timestamps (in milliseconds) to German date strings
 * similar to Gmail/Outlook formatting:
 * - Today: Shows time in 24-hour format (e.g., "14:30")
 * - Yesterday: Shows "Gestern"
 * - This week (2-6 days ago): Shows day name (e.g., "Montag", "Dienstag")
 * - Older: Shows full date in German format (e.g., "15.01.2026")
 *
 * @param timestamp - Unix timestamp in milliseconds (from Date.now() or similar)
 * @returns German date string formatted for email lists, or null if input is invalid
 *
 * @example
 * ```typescript
 * // Today at 14:30
 * formatEmailDate(new Date('2026-02-15 14:30').getTime()); // "14:30"
 *
 * // Yesterday
 * formatEmailDate(Date.now() - 24 * 60 * 60 * 1000); // "Gestern"
 *
 * // This week (e.g., Monday)
 * formatEmailDate(Date.now() - 3 * 24 * 60 * 60 * 1000); // "Montag"
 *
 * // Older email
 * formatEmailDate(new Date('2026-01-15').getTime()); // "15.01.2026"
 *
 * // Handle invalid input
 * formatEmailDate(null); // null
 * formatEmailDate(undefined); // null
 * ```
 */
export function formatEmailDate(timestamp: number | null | undefined): string | null {
  // Handle null/undefined/invalid input
  if (timestamp == null || typeof timestamp !== 'number' || isNaN(timestamp)) {
    return null;
  }

  // Create date objects for comparison
  const emailDate = new Date(timestamp);
  const now = new Date();

  // Handle invalid dates
  if (isNaN(emailDate.getTime())) {
    return null;
  }

  // Get start of today (00:00:00) for accurate day comparison
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const emailStart = new Date(emailDate.getFullYear(), emailDate.getMonth(), emailDate.getDate());

  // Calculate day difference
  const dayDiff = Math.floor((todayStart.getTime() - emailStart.getTime()) / (24 * 60 * 60 * 1000));

  // Handle future dates (treat as today)
  if (dayDiff < 0) {
    // Format as time HH:MM
    const hours = emailDate.getHours().toString().padStart(2, '0');
    const minutes = emailDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Today: Show time (HH:MM)
  if (dayDiff === 0) {
    const hours = emailDate.getHours().toString().padStart(2, '0');
    const minutes = emailDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Yesterday: Show "Gestern"
  if (dayDiff === 1) {
    return 'Gestern';
  }

  // This week (2-6 days ago): Show day name
  if (dayDiff >= 2 && dayDiff <= 6) {
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return dayNames[emailDate.getDay()];
  }

  // Older (7+ days): Show full date (DD.MM.YYYY)
  const day = emailDate.getDate().toString().padStart(2, '0');
  const month = (emailDate.getMonth() + 1).toString().padStart(2, '0');
  const year = emailDate.getFullYear();
  return `${day}.${month}.${year}`;
}
