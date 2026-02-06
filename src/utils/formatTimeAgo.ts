/**
 * Format a timestamp as a human-readable German relative time string.
 *
 * This function converts Unix timestamps (in milliseconds) to German relative
 * time strings like "vor 5 Minuten" (5 minutes ago). It handles various time
 * ranges appropriately:
 * - Less than 1 minute: "vor wenigen Sekunden"
 * - 1-59 minutes: "vor X Minuten"
 * - 1-23 hours: "vor X Stunden"
 * - 1-6 days: "vor X Tagen"
 * - 7+ days: "vor mehr als einer Woche"
 *
 * @param timestamp - Unix timestamp in milliseconds (from Date.now() or similar)
 * @returns German relative time string, or null if input is invalid
 *
 * @example
 * ```typescript
 * // Just now
 * formatTimeAgo(Date.now() - 30000); // "vor wenigen Sekunden"
 *
 * // 5 minutes ago
 * formatTimeAgo(Date.now() - 5 * 60 * 1000); // "vor 5 Minuten"
 *
 * // 2 hours ago
 * formatTimeAgo(Date.now() - 2 * 60 * 60 * 1000); // "vor 2 Stunden"
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
    return 'vor wenigen Sekunden';
  }

  // Convert to different time units
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // Format based on time elapsed
  if (minutes < 1) {
    // Less than 1 minute
    return 'vor wenigen Sekunden';
  } else if (minutes === 1) {
    // Exactly 1 minute
    return 'vor 1 Minute';
  } else if (minutes < 60) {
    // 2-59 minutes
    return `vor ${minutes} Minuten`;
  } else if (hours === 1) {
    // Exactly 1 hour
    return 'vor 1 Stunde';
  } else if (hours < 24) {
    // 2-23 hours
    return `vor ${hours} Stunden`;
  } else if (days === 1) {
    // Exactly 1 day
    return 'vor 1 Tag';
  } else if (days < 7) {
    // 2-6 days
    return `vor ${days} Tagen`;
  } else {
    // 7+ days
    return 'vor mehr als einer Woche';
  }
}
