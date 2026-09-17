export function invertKursQuote(value: number): number {
  return 1 / value;
}

export function formatKursInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return String(value);
}
