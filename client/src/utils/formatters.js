/**
 * Format a number as Malaysian Ringgit
 */
export function formatMYR(amount) {
  if (amount == null) return '—';
  return `RM ${Number(amount).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a number as Indonesian Rupiah
 */
export function formatIDR(amount) {
  if (amount == null) return '—';
  return `Rp ${Number(amount).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function convertMyrAmount(amount, currency = 'MYR', myrToIdr = 4500) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return currency === 'IDR' ? value * Number(myrToIdr || 4500) : value;
}

export function convertToMyrAmount(amount, currency = 'MYR', myrToIdr = 4500) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return currency === 'IDR' ? value / Number(myrToIdr || 4500) : value;
}

export function formatCurrencyAmount(amount, currency = 'MYR', myrToIdr = 4500) {
  const converted = convertMyrAmount(amount, currency, myrToIdr);
  return currency === 'IDR' ? formatIDR(converted) : formatMYR(converted);
}

/**
 * Format ISO timestamp for display in UTC+8
 */
export function formatDateTime(isoString) {
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
export function formatDate(isoString) {
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
 * Chart color palette
 */
export const CHART_COLORS = [
  '#4a8bc2', '#4fe2a1', '#d3182d', '#74b9ff',
  '#fdcb6e', '#587aa3', '#8abbb2', '#d8a8a1',
  '#8dbec4', '#d9c88f', '#b9c5d1', '#687786',
  '#b96f75',
];
