import React from 'react';
import { formatMYR, formatIDR, CATEGORY_ICONS } from '../utils/formatters';

export default function SummaryCards({ summary }) {
  const myrTotal = summary?.monthlyTotal?.myr ?? 0;
  const idrTotal = summary?.monthlyTotal?.idr ?? 0;
  const count = summary?.count ?? 0;
  const topCategory = summary?.topCategory ?? 'None';
  const topCategoryIcon = CATEGORY_ICONS[topCategory] || '📁';

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <div className="summary-card__icon summary-card__icon--purple">🇲🇾</div>
        <div className="summary-card__label">Total This Month (MYR)</div>
        <div className="summary-card__value">{formatMYR(myrTotal)}</div>
        <div className="summary-card__sub">Malaysian Ringgit</div>
      </div>

      <div className="summary-card">
        <div className="summary-card__icon summary-card__icon--green">🇮🇩</div>
        <div className="summary-card__label">Total This Month (IDR)</div>
        <div className="summary-card__value">{formatIDR(idrTotal)}</div>
        <div className="summary-card__sub">Indonesian Rupiah</div>
      </div>

      <div className="summary-card">
        <div className="summary-card__icon summary-card__icon--blue">📊</div>
        <div className="summary-card__label">Total Transactions</div>
        <div className="summary-card__value">{count}</div>
        <div className="summary-card__sub">Expenses logged this month</div>
      </div>

      <div className="summary-card">
        <div className="summary-card__icon summary-card__icon--orange">{topCategoryIcon}</div>
        <div className="summary-card__label">Top Category</div>
        <div className="summary-card__value" style={{ fontSize: topCategory.length > 15 ? 'var(--font-size-md)' : 'var(--font-size-xl)' }}>
          {topCategory}
        </div>
        <div className="summary-card__sub">Highest spend this month</div>
      </div>
    </div>
  );
}
