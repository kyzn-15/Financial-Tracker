// Pick the stored counterpart amount for history display. Do not reconvert with a live rate.
export function selectStoredExpenseAmount(expense, currency) {
  const amount = currency === 'IDR' ? expense.price_idr : expense.price_myr;
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
}
