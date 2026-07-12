import React from 'react';
import { formatDate } from '../utils/formatters';

export function MonthlyComparisonCard({ comparison, currency, formatCurrency }) {
  if (comparison.current === 0 && comparison.previous === 0) {
    return (
      <div className="analytics-card">
        <div className="analytics-card__header"><h3>Monthly Comparison</h3><span className="analytics-card__eyebrow">{currency}</span></div>
        <div className="analytics-empty">No spending recorded for this or last month.</div>
      </div>
    );
  }

  const changePrefix = comparison.difference > 0 ? '+' : '';
  const percentage = comparison.percentage == null
    ? 'New'
    : `${comparison.percentage > 0 ? '+' : ''}${comparison.percentage.toFixed(1)}%`;
  const insight = comparison.direction === 'increase'
    ? `Your spending increased by ${comparison.percentage?.toFixed(1) ?? 0}% compared to last month.`
    : comparison.direction === 'decrease'
      ? `Great job! You spent ${Math.abs(comparison.percentage ?? 0).toFixed(1)}% less than last month.`
      : comparison.isNewMonth
        ? 'This is your first month with recorded spending.'
        : 'Your spending is unchanged from last month.';

  return (
    <div className="analytics-card analytics-card--comparison">
      <div className="analytics-card__header">
        <h3>Monthly Comparison</h3>
        <span className="analytics-card__eyebrow">{currency}</span>
      </div>
      <div className="comparison-grid">
        <div><span>This Month</span><strong>{formatCurrency(comparison.current)}</strong></div>
        <div><span>Last Month</span><strong>{formatCurrency(comparison.previous)}</strong></div>
      </div>
      <div className={`dashboard-change dashboard-change--${comparison.direction}`}>
        <span>Difference</span>
        <strong>{changePrefix}{formatCurrency(comparison.difference)}</strong>
        <em>{percentage}</em>
      </div>
      <p className="analytics-card__insight">{insight}</p>
    </div>
  );
}

export function CategoryGrowthCard({ growth, formatCurrency }) {
  if (!growth) {
    return (
      <div className="analytics-card">
        <div className="analytics-card__header"><h3>Category Growth</h3></div>
        <div className="analytics-empty">No category has increased compared to last month.</div>
      </div>
    );
  }

  return (
    <div className="analytics-card">
      <div className="analytics-card__header">
        <h3>Category Growth</h3>
        <span className="analytics-card__eyebrow">{growth.isNew ? 'New' : 'Highest increase'}</span>
      </div>
      <strong className="analytics-card__feature">{growth.category}</strong>
      <div className="metric-pair-grid">
        <div><span>Last Month</span><strong>{formatCurrency(growth.previous)}</strong></div>
        <div><span>This Month</span><strong>{formatCurrency(growth.current)}</strong></div>
      </div>
      <div className="dashboard-change dashboard-change--increase">
        <span>Increase</span>
        <strong>+{formatCurrency(growth.difference)}</strong>
        <em>{growth.isNew ? 'New' : `+${growth.percentage.toFixed(1)}%`}</em>
      </div>
      <p className="analytics-card__insight">
        {growth.isNew
          ? `${growth.category} is a new category this month, adding ${formatCurrency(growth.current)} to your spending.`
          : `${growth.category} spending increased the most this month, contributing ${formatCurrency(growth.difference)} to your overall increase.`}
      </p>
    </div>
  );
}

export function LargestPurchaseCard({ purchase, formatCurrency }) {
  if (!purchase) {
    return (
      <div className="analytics-card">
        <div className="analytics-card__header"><h3>Largest Purchase</h3><span className="analytics-card__eyebrow">All time</span></div>
        <div className="analytics-empty">No purchases recorded yet.</div>
      </div>
    );
  }

  return (
    <div className="analytics-card">
      <div className="analytics-card__header">
        <h3>Largest Purchase</h3>
        <span className="analytics-card__eyebrow">All time</span>
      </div>
      <strong className="analytics-card__feature">{purchase.name}</strong>
      <strong className="analytics-card__amount">{formatCurrency(purchase.amount)}</strong>
      <dl className="purchase-details">
        <div><dt>Category</dt><dd>{purchase.category}</dd></div>
        <div><dt>Date</dt><dd>{formatDate(purchase.timestamp)}</dd></div>
      </dl>
      <p className="analytics-card__insight">
        {purchase.shareOfCurrentMonth == null
          ? 'There is no current-month spending to compare this purchase against.'
          : `This purchase accounted for ${purchase.shareOfCurrentMonth.toFixed(1)}% of this month's spending${purchase.isCurrentMonth ? '.' : ', even though it was made outside the current month.'}`}
      </p>
    </div>
  );
}

export default function AnalyticsCards({ comparison, categoryGrowth, largestPurchase, currency, formatCurrency }) {
  return (
    <div className="analytics-card-grid">
      <MonthlyComparisonCard comparison={comparison} currency={currency} formatCurrency={formatCurrency} />
      <CategoryGrowthCard growth={categoryGrowth} formatCurrency={formatCurrency} />
      <LargestPurchaseCard purchase={largestPurchase} formatCurrency={formatCurrency} />
    </div>
  );
}
