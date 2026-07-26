import { useState } from 'react';
import { formatCurrencyAmount, formatDate } from '../utils/formatters';
import AppIcon from './AppIcon';

function HeatmapTooltip({ day, formatCurrency, onViewExpenses }) {
  if (!day) return <p className="heatmap-tooltip">Hover over a day to see its spending.</p>;

  return (
    <p className="heatmap-tooltip">
      <strong>{formatDate(`${day.date}T00:00:00+08:00`)}</strong>
      <span>{formatCurrency(day.total)}</span>
      <span>{day.transactions} {day.transactions === 1 ? 'transaction' : 'transactions'}</span>
      {day.transactions > 0 && (
        <button className="heatmap-tooltip__action" type="button" onClick={() => onViewExpenses(day.date)}>
          View expenses
        </button>
      )}
    </p>
  );
}

export default function SpendingHeatmap({ days = [], currency = 'MYR', myrToIdr = 4500, streak = 0, onViewExpenses }) {
  const [hoveredDay, setHoveredDay] = useState(null);
  const hasSpending = days.some((day) => day.total > 0);
  const formatCurrency = (amount) => formatCurrencyAmount(amount, currency, myrToIdr);

  return (
    <div className="chart-card heatmap-card">
      <div className="chart-card__header">
        <div>
          <h3 className="chart-card__title">Spending Heatmap</h3>
          <p className="chart-card__subtitle">Daily spending over the last 12 months</p>
        </div>
        <div className={`heatmap-streak ${streak > 0 ? 'heatmap-streak--active' : 'heatmap-streak--inactive'}`} title="Consecutive days with at least one expense recorded">
          <span className="heatmap-streak__fire"><AppIcon name="flame" size={17} /></span>
          <strong>{streak}</strong>
          <span className="heatmap-streak__label">day streak</span>
        </div>
      </div>
      {hasSpending ? (
        <>
          <HeatmapTooltip day={hoveredDay} formatCurrency={formatCurrency} onViewExpenses={onViewExpenses} />
          <div className="heatmap-scroll" aria-label="Daily spending heatmap">
            <div className="heatmap-grid">
              {days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  className={`heatmap-day heatmap-day--${day.level}`}
                  aria-label={`${formatDate(`${day.date}T00:00:00+08:00`)}, ${formatCurrency(day.total)}, ${day.transactions} transactions`}
                  onMouseEnter={() => setHoveredDay(day)}
                  onFocus={() => setHoveredDay(day)}
                  onClick={() => day.transactions > 0 && onViewExpenses(day.date)}
                />
              ))}
            </div>
          </div>
          <div className="heatmap-legend" aria-label="Heatmap intensity legend">
            <span>Low spending</span>
            {[0, 1, 2, 3, 4].map((level) => <i key={level} className={`heatmap-day heatmap-day--${level}`} />)}
            <span>High spending</span>
          </div>
        </>
      ) : (
        <div className="chart-empty">No spending recorded in the last 12 months.</div>
      )}
    </div>
  );
}
