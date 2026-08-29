import { formatDate } from '../utils/formatters';
import type { CategoryGrowth, Currency, LargestPurchase, MonthlyComparison } from '../types';
import { usePrivacyMode } from '../hooks/usePrivacyMode';

type FormatCurrency = (amount: number) => string;

interface MonthlyComparisonCardProps {
  comparison: MonthlyComparison;
  currency: Currency;
  formatCurrency: FormatCurrency;
}

interface AllTimeSpendingCardProps {
  total: number;
  currency: Currency;
  formatCurrency: FormatCurrency;
}

export function AllTimeSpendingCard({ total, currency, formatCurrency }: AllTimeSpendingCardProps) {
  return (
    <div className="analytics-card analytics-card--all-time">
      <div className="analytics-card__header">
        <h3>All Time Spending</h3>
        <span className="analytics-card__eyebrow">{currency}</span>
      </div>
      <span className="analytics-card__label">Total recorded spending</span>
      <strong className="analytics-card__amount">{formatCurrency(total)}</strong>
      <p className="analytics-card__insight">
        {total > 0 ? 'Includes every active expense you have recorded.' : 'No spending has been recorded yet.'}
      </p>
    </div>
  );
}

export function MonthlyComparisonCard({ comparison, currency, formatCurrency }: MonthlyComparisonCardProps) {
  const { formatPercentage, isPrivacyMode } = usePrivacyMode();
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
    : formatPercentage(comparison.percentage, { includeSign: true });
  const insight = comparison.direction === 'increase'
    ? (isPrivacyMode ? 'Your spending increased compared to last month.' : `Your spending increased by ${comparison.percentage?.toFixed(1) ?? 0}% compared to last month.`)
    : comparison.direction === 'decrease'
      ? (isPrivacyMode ? 'Great job! You spent less than last month.' : `Great job! You spent ${Math.abs(comparison.percentage ?? 0).toFixed(1)}% less than last month.`)
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
export function CategoryGrowthCard({ growth, formatCurrency }: { growth: CategoryGrowth | null; formatCurrency: FormatCurrency }) {
  const { formatPercentage } = usePrivacyMode();
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
        <em>{growth.isNew || growth.percentage == null ? 'New' : formatPercentage(growth.percentage, { includeSign: true })}</em>
      </div>
      <p className="analytics-card__insight">
        {growth.isNew
          ? `${growth.category} is a new category this month, adding ${formatCurrency(growth.current)} to your spending.`
          : `${growth.category} spending increased the most this month, contributing ${formatCurrency(growth.difference)} to your overall increase.`}
      </p>
    </div>
  );
}
export function LargestPurchaseCard({ purchase, formatCurrency }: { purchase: LargestPurchase | null; formatCurrency: FormatCurrency }) {
  const { isPrivacyMode } = usePrivacyMode();
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
          : isPrivacyMode
            ? `This purchase's share of this month's spending is hidden.${purchase.isCurrentMonth ? '' : ' It was made outside the current month.'}`
            : `This purchase accounted for ${purchase.shareOfCurrentMonth.toFixed(1)}% of this month's spending${purchase.isCurrentMonth ? '.' : ', even though it was made outside the current month.'}`}
      </p>
    </div>
  );
}
