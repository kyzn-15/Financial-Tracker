import { formatCurrencyAmount } from '../utils/formatters';
import type { Currency, Summary } from '../types';

interface SummaryCardsProps {
  summary: Summary | null;
  currency?: Currency;
  myrToIdr?: number;
}

export default function SummaryCards({ summary, currency = 'MYR', myrToIdr = 4500 }: SummaryCardsProps) {
  const isMYR = currency === 'MYR';
  const total = summary?.monthlyTotal?.myr ?? 0;
  const formatCurrency = (amount: number) => formatCurrencyAmount(amount, currency, myrToIdr);
  const count = summary?.count ?? 0;
  const topCategory = summary?.topCategory ?? 'None';

  return (
    <div className="summary-grid">
      <div className="summary-card summary-card--total">
        <div className="summary-card__inner">
          <span className="summary-card__code">{isMYR ? 'MY' : 'ID'}</span>
          <div className="summary-card__value">{formatCurrency(total)}</div>
          <div className="summary-card__sub">{isMYR ? 'Malaysian Ringgit' : 'Indonesian Rupiah'}</div>
        </div>
      </div>
      <div className="summary-card">
        <div className="summary-card__label">Total Transactions</div>
        <div className="summary-card__value">{count}</div>
        <div className="summary-card__sub">Expenses logged this month</div>
      </div>
      <div className="summary-card">
        <div className="summary-card__label">Top Category</div>
        <div className={`summary-card__value ${topCategory.length > 15 ? 'summary-card__value--compact' : ''}`}>{topCategory}</div>
        <div className="summary-card__sub">Highest spend this month</div>
      </div>
    </div>
  );
}
