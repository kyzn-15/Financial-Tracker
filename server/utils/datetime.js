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
