export function nowUTC8() {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return utc8.toISOString().replace('Z', '').split('.')[0] + '+08:00';
}

export function addDaysUTC8(fromDate, days) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const future = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const utc8 = new Date(future.getTime() + 8 * 60 * 60 * 1000);
  return utc8.toISOString().replace('Z', '').split('.')[0] + '+08:00';
}

export function getUTC8Date() {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return utc8.toISOString().slice(0, 10);
}

export function getMonthRangeUTC8(dateString = getUTC8Date(), offset = 0) {
  const [year, month] = dateString.split('-').map(Number);
  const monthDate = new Date(Date.UTC(year, month - 1 + offset, 1));
  const rangeYear = monthDate.getUTCFullYear();
  const rangeMonth = String(monthDate.getUTCMonth() + 1).padStart(2, '0');
  const start = `${rangeYear}-${rangeMonth}-01T00:00:00+08:00`;
  const nextMonthDate = new Date(Date.UTC(rangeYear, monthDate.getUTCMonth() + 1, 1));
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth = String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0');

  return {
    start,
    end: `${nextYear}-${nextMonth}-01T00:00:00+08:00`,
  };
}

export function subtractDaysUTC8(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const UTC8_ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+08:00$/;

function parseUTC8Parts(timestamp) {
  const match = typeof timestamp === 'string' ? timestamp.match(UTC8_ISO_PATTERN) : null;
  if (!match) throw new Error('Invalid UTC+8 recurrence timestamp.');
  return match.slice(1).map(Number);
}

function formatUTC8Parts(year, month, day, hour, minute, second) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`;
}

export function normalizeUTC8Timestamp(timestamp) {
  if (typeof timestamp !== 'string') throw new Error('Invalid UTC+8 timestamp.');
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\+08:00$/.test(timestamp)
    ? timestamp.replace('+08:00', ':00+08:00')
    : timestamp;
  parseUTC8Parts(withSeconds);
  if (Number.isNaN(Date.parse(withSeconds))) throw new Error('Invalid UTC+8 timestamp.');
  return withSeconds;
}

export function getNextRecurrenceUTC8(anchorTimestamp, scheduledTimestamp, frequency) {
  const [, , anchorDay, anchorHour, anchorMinute, anchorSecond] = parseUTC8Parts(normalizeUTC8Timestamp(anchorTimestamp));
  const [year, month, day] = parseUTC8Parts(normalizeUTC8Timestamp(scheduledTimestamp));

  if (frequency === 'daily' || frequency === 'weekly') {
    const days = frequency === 'daily' ? 1 : 7;
    const next = new Date(Date.UTC(year, month - 1, day + days));
    return formatUTC8Parts(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), anchorHour, anchorMinute, anchorSecond);
  }

  if (frequency === 'monthly') {
    const nextMonth = new Date(Date.UTC(year, month, 1));
    const nextYear = nextMonth.getUTCFullYear();
    const nextMonthNumber = nextMonth.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(nextYear, nextMonthNumber, 0)).getUTCDate();
    return formatUTC8Parts(nextYear, nextMonthNumber, Math.min(anchorDay, lastDay), anchorHour, anchorMinute, anchorSecond);
  }

  throw new Error('Unsupported recurrence frequency.');
}
