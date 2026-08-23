/**
 * Format a number as Malaysian Ringgit
 */
export function formatMYR(amount: NumericValue | null | undefined): string {
  if (amount == null) return '—';
  return `RM ${Number(amount).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a number as Indonesian Rupiah
 */
export function formatIDR(amount: NumericValue | null | undefined): string {
  if (amount == null) return '—';
  return `Rp ${Number(amount).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function convertMyrAmount(amount: NumericValue, currency: Currency = 'MYR', myrToIdr = 4500): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return currency === 'IDR' ? value * Number(myrToIdr || 4500) : value;
}

export function convertToMyrAmount(amount: NumericValue, currency: Currency = 'MYR', myrToIdr = 4500): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return currency === 'IDR' ? value / Number(myrToIdr || 4500) : value;
}

export function formatCurrencyAmount(amount: NumericValue, currency: Currency = 'MYR', myrToIdr = 4500): string {
  const converted = convertMyrAmount(amount, currency, myrToIdr);
  return currency === 'IDR' ? formatIDR(converted) : formatMYR(converted);
}

/**
 * Format ISO timestamp for display in UTC+8
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  // If the string already has timezone info, Date will parse it.
  // If it's bare (from SQLite), assume it's already UTC+8.
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Singapore', // UTC+8
  });
}

/**
 * Format just the date portion
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  });
}

/**
 * Chart color palette — flat Neo-Brutalist accents
 */
export const CHART_COLORS = [
  '#72B7FF', '#7BE495', '#FF7A7A', '#B69CFF',
  '#FFD95A', '#FFAA5C', '#57C4B4', '#F49BC8',
  '#8FA6E8', '#C2D36B', '#E89B6E', '#9ADBC5',
  '#D8A25A',
];
import type { Currency, NumericValue } from '../types';
