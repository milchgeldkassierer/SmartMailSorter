import i18n from '../i18n';

/**
 * Format a timestamp as a human-readable relative time string in the current language.
 *
 * This function converts Unix timestamps (in milliseconds) to localized relative
 * time strings like "vor 5 Minuten" (German) or "5 minutes ago" (English).
 * It handles various time ranges appropriately:
 * - Less than 1 minute: "Just now" / "Gerade eben"
 * - 1-59 minutes: "5 minutes ago" / "Vor 5 Minuten"
 * - 1-23 hours: "2 hours ago" / "Vor 2 Stunden"
 * - 1-6 days: "3 days ago" / "Vor 3 Tagen"
 * - 7+ days: "A week ago" / "Vor einer Woche"
 *
 * @param timestamp - Unix timestamp in milliseconds (from Date.now() or similar)
 * @returns Localized relative time string, or null if input is invalid
 *
 * @example
 * ```typescript
 * // Just now
 * formatTimeAgo(Date.now() - 30000); // "Gerade eben" (DE) or "Just now" (EN)
 *
 * // 5 minutes ago
 * formatTimeAgo(Date.now() - 5 * 60 * 1000); // "Vor 5 Minuten" (DE) or "5 minutes ago" (EN)
 *
 * // 2 hours ago
 * formatTimeAgo(Date.now() - 2 * 60 * 60 * 1000); // "Vor 2 Stunden" (DE) or "2 hours ago" (EN)
 *
 * // Handle invalid input
 * formatTimeAgo(null); // null
 * formatTimeAgo(undefined); // null
 * ```
 */
export function formatTimeAgo(timestamp: number | null | undefined): string | null {
  // Handle null/undefined/invalid input
  if (timestamp == null || typeof timestamp !== 'number' || isNaN(timestamp)) {
    return null;
  }

  // Calculate time difference in milliseconds
  const now = Date.now();
  const diffMs = now - timestamp;

  // Handle future timestamps (treat as "just now")
  if (diffMs < 0) {
    return i18n.t('timeAgo.justNow');
  }

  // Convert to different time units
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  // Format based on time elapsed
  if (minutes < 1) {
    // Less than 1 minute
    return i18n.t('timeAgo.justNow');
  } else if (minutes === 1) {
    // Exactly 1 minute
    return i18n.t('timeAgo.minuteAgo');
  } else if (minutes < 60) {
    // 2-59 minutes
    return i18n.t('timeAgo.minutesAgo', { count: minutes });
  } else if (hours === 1) {
    // Exactly 1 hour
    return i18n.t('timeAgo.hourAgo');
  } else if (hours < 24) {
    // 2-23 hours
    return i18n.t('timeAgo.hoursAgo', { count: hours });
  } else if (days === 1) {
    // Exactly 1 day
    return i18n.t('timeAgo.dayAgo');
  } else if (days < 7) {
    // 2-6 days
    return i18n.t('timeAgo.daysAgo', { count: days });
  } else if (weeks === 1) {
    // Exactly 1 week
    return i18n.t('timeAgo.weekAgo');
  } else {
    // 7+ days
    return i18n.t('timeAgo.weeksAgo', { count: weeks });
  }
}

/**
 * Format a timestamp as a localized date string.
 *
 * This function formats dates according to the current language's conventions:
 * - German (de): DD.MM.YYYY format (e.g., "15.02.2026")
 * - English (en): MM/DD/YYYY format (e.g., "02/15/2026")
 *
 * @param timestamp - Unix timestamp in milliseconds (from Date.now() or similar)
 * @param options - Optional Intl.DateTimeFormat options to customize the output
 * @returns Localized date string, or null if input is invalid
 *
 * @example
 * ```typescript
 * // Format date in current locale
 * formatDate(Date.now()); // "15.02.2026" (DE) or "02/15/2026" (EN)
 *
 * // Custom format with time
 * formatDate(Date.now(), {
 *   year: 'numeric',
 *   month: '2-digit',
 *   day: '2-digit',
 *   hour: '2-digit',
 *   minute: '2-digit'
 * }); // "15.02.2026, 14:30" (DE) or "02/15/2026, 2:30 PM" (EN)
 * ```
 */
export function formatDate(timestamp: number | null | undefined, options?: Intl.DateTimeFormatOptions): string | null {
  // Handle null/undefined/invalid input
  if (timestamp == null || typeof timestamp !== 'number' || isNaN(timestamp)) {
    return null;
  }

  // Get current language from i18n
  const locale = i18n.language || 'de';

  // Default format options
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  // Merge with custom options if provided
  const formatOptions = options || defaultOptions;

  try {
    // Format the date using Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat(locale, formatOptions);
    return formatter.format(new Date(timestamp));
  } catch {
    // Fallback to ISO format if formatting fails
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * Format a timestamp as a localized date and time string.
 *
 * This function combines date and time formatting according to the current language's conventions.
 *
 * @param timestamp - Unix timestamp in milliseconds (from Date.now() or similar)
 * @returns Localized date and time string, or null if input is invalid
 *
 * @example
 * ```typescript
 * formatDateTime(Date.now()); // "15.02.2026, 14:30" (DE) or "02/15/2026, 2:30 PM" (EN)
 * ```
 */
export function formatDateTime(timestamp: number | null | undefined): string | null {
  return formatDate(timestamp, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a number with locale-aware separators.
 *
 * This function formats numbers according to the current language's conventions:
 * - German (de): 1.234,56 (dot as thousands separator, comma as decimal)
 * - English (en): 1,234.56 (comma as thousands separator, dot as decimal)
 *
 * @param value - The number to format
 * @param options - Optional Intl.NumberFormat options to customize the output
 * @returns Localized number string, or null if input is invalid
 *
 * @example
 * ```typescript
 * // Format storage size
 * formatNumber(1234.56); // "1.234,56" (DE) or "1,234.56" (EN)
 *
 * // Format with specific decimal places
 * formatNumber(1234.567, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 * // "1.234,57" (DE) or "1,234.57" (EN)
 *
 * // Format as integer (no decimals)
 * formatNumber(1234.567, { maximumFractionDigits: 0 });
 * // "1.235" (DE) or "1,235" (EN)
 * ```
 */
export function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string | null {
  // Handle null/undefined/invalid input
  if (value == null || typeof value !== 'number' || isNaN(value)) {
    return null;
  }

  // Get current language from i18n
  const locale = i18n.language || 'de';

  try {
    // Format the number using Intl.NumberFormat
    const formatter = new Intl.NumberFormat(locale, options);
    return formatter.format(value);
  } catch {
    // Fallback to string conversion if formatting fails
    return value.toString();
  }
}
