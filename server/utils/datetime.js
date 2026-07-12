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
