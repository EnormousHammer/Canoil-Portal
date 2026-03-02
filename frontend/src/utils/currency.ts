/**
 * Multi-currency formatting utilities.
 * Supports CAD (default), USD, EUR, GBP with proper locale formatting.
 */

export type CurrencyCode = 'CAD' | 'USD' | 'EUR' | 'GBP';

const CURRENCY_CONFIG: Record<CurrencyCode, { locale: string; symbol: string }> = {
  CAD: { locale: 'en-CA', symbol: 'CA$' },
  USD: { locale: 'en-US', symbol: '$' },
  EUR: { locale: 'de-DE', symbol: '\u20AC' },
  GBP: { locale: 'en-GB', symbol: '\u00A3' },
};

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: CurrencyCode = 'CAD',
  decimals: number = 2
): string {
  const num = Number(amount);
  if (isNaN(num)) return '$0.00';
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.CAD;

  try {
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    return `${cfg.symbol}${num.toFixed(decimals)}`;
  }
}

export function formatCompact(
  amount: number | string | null | undefined,
  currency: CurrencyCode = 'CAD'
): string {
  const num = Number(amount);
  if (isNaN(num)) return '$0';
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.CAD;

  try {
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumSignificantDigits: 3,
    }).format(num);
  } catch {
    if (Math.abs(num) >= 1_000_000) return `${cfg.symbol}${(num / 1_000_000).toFixed(1)}M`;
    if (Math.abs(num) >= 1_000) return `${cfg.symbol}${(num / 1_000).toFixed(1)}K`;
    return `${cfg.symbol}${num.toFixed(0)}`;
  }
}

export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
