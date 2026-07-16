import React from 'react';
import { formatCurrencyAmount } from '../utils/formatters';
import { getCategoryIconName } from '../utils/categoryIcons';
import AppIcon from './AppIcon';

export default function SummaryCards({ summary, currency = 'MYR', myrToIdr = 4500 }) {
  const isMYR = currency === 'MYR';
  const total = summary?.monthlyTotal?.myr ?? 0;
  const formatCurrency = (amount) => formatCurrencyAmount(amount, currency, myrToIdr);
  const count = summary?.count ?? 0;
  const topCategory = summary?.topCategory ?? 'None';

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <div className="summary-card__icon summary-card__icon--purple">{isMYR ? '🇲🇾' : '🇮🇩'}</div>
        <div className="summary-card__label">Total This Month ({currency})</div>
        <div className="summary-card__value">{formatCurrency(total)}</div>
        <div className="summary-card__sub">{isMYR ? 'Malaysian Ringgit' : 'Indonesian Rupiah'}</div>
      </div>
      <div className="summary-card">
        <div className="summary-card__icon summary-card__icon--blue"><AppIcon name="bar-chart" size={22} /></div>
        <div className="summary-card__label">Total Transactions</div>
        <div className="summary-card__value">{count}</div>
        <div className="summary-card__sub">Expenses logged this month</div>
      </div>
      <div className="summary-card">
        <div className="summary-card__icon summary-card__icon--orange"><AppIcon name={getCategoryIconName(topCategory)} size={22} /></div>
        <div className="summary-card__label">Top Category</div>
        <div className={`summary-card__value ${topCategory.length > 15 ? 'summary-card__value--compact' : ''}`}>{topCategory}</div>
        <div className="summary-card__sub">Highest spend this month</div>
      </div>
    </div>
  );
}
