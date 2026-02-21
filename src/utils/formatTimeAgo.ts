import i18n from '../i18n';

/**
 * Format a timestamp as a human-readable relative time string in the current language.
 *
 * @param timestamp - Unix timestamp in milliseconds (from Date.now() or similar)
 * @returns Localized relative time string, or null if input is invalid
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
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  // Format based on time elapsed
  if (minutes < 1) {
    return i18n.t('timeAgo.justNow');
  } else if (minutes === 1) {
    return i18n.t('timeAgo.minuteAgo');
  } else if (minutes < 60) {
    return i18n.t('timeAgo.minutesAgo', { count: minutes });
  } else if (hours === 1) {
    return i18n.t('timeAgo.hourAgo');
  } else if (hours < 24) {
    return i18n.t('timeAgo.hoursAgo', { count: hours });
  } else if (days === 1) {
    return i18n.t('timeAgo.dayAgo');
  } else if (days < 7) {
    return i18n.t('timeAgo.daysAgo', { count: days });
  } else if (weeks === 1 && days < 14) {
    return i18n.t('timeAgo.weekAgo');
  } else if (days < 30) {
    return i18n.t('timeAgo.weeksAgo', { count: weeks });
  } else if (months === 1) {
    return i18n.t('timeAgo.monthAgo');
  } else if (days < 365) {
    return i18n.t('timeAgo.monthsAgo', { count: months });
  } else if (years === 1) {
    return i18n.t('timeAgo.yearAgo');
  } else {
    return i18n.t('timeAgo.yearsAgo', { count: years });
  }
}
