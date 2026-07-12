import React, { useState } from 'react';
import { formatDate, formatMYR } from '../utils/formatters';

function HeatmapTooltip({ day }) {
  if (!day) return <p className="heatmap-tooltip">Hover over a day to see its spending.</p>;

  return (
    <p className="heatmap-tooltip">
      <strong>{formatDate(`${day.date}T00:00:00+08:00`)}</strong>
      <span>{formatMYR(day.total)}</span>
      <span>{day.transactions} {day.transactions === 1 ? 'transaction' : 'transactions'}</span>
    </p>
  );
}

export default function SpendingHeatmap({ days = [] }) {
  const [hoveredDay, setHoveredDay] = useState(null);
  const hasSpending = days.some((day) => day.total > 0);

  return (
    <div className="chart-card heatmap-card">
      <div className="chart-card__header">
        <div>
          <h3 className="chart-card__title">Spending Heatmap</h3>
          <p className="chart-card__subtitle">Daily spending over the last 12 months</p>
        </div>
      </div>
      {hasSpending ? (
        <>
          <HeatmapTooltip day={hoveredDay} />
          <div className="heatmap-scroll" aria-label="Daily spending heatmap">
            <div className="heatmap-grid">
              {days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  className={`heatmap-day heatmap-day--${day.level}`}
                  aria-label={`${formatDate(`${day.date}T00:00:00+08:00`)}, ${formatMYR(day.total)}, ${day.transactions} transactions`}
                  onMouseEnter={() => setHoveredDay(day)}
                  onFocus={() => setHoveredDay(day)}
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
