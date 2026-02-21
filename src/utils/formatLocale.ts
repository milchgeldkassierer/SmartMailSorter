import i18n from '../i18n';

/**
 * Format a timestamp as a localized date string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param options - Optional Intl.DateTimeFormat options
 * @returns Localized date string, or null if input is invalid
 */
export function formatDate(timestamp: number | null | undefined, options?: Intl.DateTimeFormatOptions): string | null {
  if (timestamp == null || typeof timestamp !== 'number' || isNaN(timestamp)) {
    return null;
  }

  const locale = i18n.resolvedLanguage || i18n.language || 'de';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  const formatOptions = options || defaultOptions;

  try {
    const formatter = new Intl.DateTimeFormat(locale, formatOptions);
    return formatter.format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * Format a timestamp as a localized date and time string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Localized date and time string, or null if input is invalid
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
 * @param value - The number to format
 * @param options - Optional Intl.NumberFormat options
 * @returns Localized number string, or null if input is invalid
 */
export function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string | null {
  if (value == null || typeof value !== 'number' || isNaN(value)) {
    return null;
  }

  const locale = i18n.resolvedLanguage || i18n.language || 'de';

  try {
    const formatter = new Intl.NumberFormat(locale, options);
    return formatter.format(value);
  } catch {
    return value.toString();
  }
}
