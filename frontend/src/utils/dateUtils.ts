/**
 * Centralized date utilities for the Canoil Portal.
 * Handles MISys .NET format (/Date(ms)/, /Date(ms+offset)/), ISO strings, and numeric timestamps.
 * ALL date display and parsing in the app should use these functions.
 */

/**
 * Parse any date value to Date | null.
 * Handles: MISys /Date(ms)/, /Date(ms+offset)/, ISO strings, numeric timestamps.
 */
export function parseMISysDate(dateValue: unknown): Date | null {
  if (dateValue == null || dateValue === '') return null;
  try {
    if (typeof dateValue === 'string' && dateValue.includes('/Date(')) {
      const match = dateValue.match(/\/Date\((\d+)/);
      if (match) {
        const ms = parseInt(match[1], 10);
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
      }
    }
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
      const d = new Date(dateValue);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof dateValue === 'string') {
      const d = new Date(dateValue);
      return isNaN(d.getTime()) ? null : d;
    }
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'number') {
      const ms = dateValue < 4102444800 ? dateValue * 1000 : dateValue;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Format date for display (e.g. "Jan 15, 2025").
 * Returns "—" if value cannot be parsed.
 */
export function formatDisplayDate(dateValue: unknown): string {
  const date = parseMISysDate(dateValue);
  if (!date) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Parse date to ISO string for consistent sorting and storage.
 * Handles MISys format, ISO, and other formats.
 */
export function parseDateToISO(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  const match = s.match(/\/Date\((\d+)/);
  if (match) {
    const ms = parseInt(match[1], 10);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? s : d.toISOString();
  }
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

/**
 * Get date value from object with fallbacks for common MISys field names.
 * Use for: Order Date, Transaction Date, Close Date, etc.
 */
export function getDate(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== '') return v;
  }
  return null;
}

// Common field aliases for MISys data
export const DATE_FIELDS = {
  orderDate: ['Order Date', 'ordDt', 'orderDt', 'order_date'] as const,
  closeDate: ['Close Date', 'closeDt', 'close_date'] as const,
  transactionDate: ['Transaction Date', 'tranDate', 'transDate', 'tranDt', 'transDt'] as const,
  releaseDate: ['Release Date', 'relDt', 'release_date'] as const,
  completionDate: ['Completion Date', 'compDt', 'completion_date'] as const,
};

export function getOrderDate(obj: Record<string, unknown>): unknown {
  return getDate(obj, ...DATE_FIELDS.orderDate);
}

export function getCloseDate(obj: Record<string, unknown>): unknown {
  return getDate(obj, ...DATE_FIELDS.closeDate);
}

export function getTransactionDate(obj: Record<string, unknown>): unknown {
  return getDate(obj, ...DATE_FIELDS.transactionDate);
}
