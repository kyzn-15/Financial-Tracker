import React, { useState } from 'react';
import SummaryCards from './SummaryCards';
import CategoryChart from './CategoryChart';
import TrendChart from './TrendChart';

export default function Dashboard({ summary }) {
  const [chartCurrency, setChartCurrency] = useState('MYR');

  return (
    <div className="dashboard">
      <div className="dashboard__currency-toggle-wrapper">
        <div className="currency-toggle" style={{ width: '180px' }}>
          <button
            type="button"
            className={`currency-toggle__btn ${chartCurrency === 'MYR' ? 'currency-toggle__btn--active' : ''}`}
            onClick={() => setChartCurrency('MYR')}
          >
            Show MYR
          </button>
          <button
            type="button"
            className={`currency-toggle__btn ${chartCurrency === 'IDR' ? 'currency-toggle__btn--active' : ''}`}
            onClick={() => setChartCurrency('IDR')}
          >
            Show IDR
          </button>
        </div>
      </div>

      <SummaryCards summary={summary} />

      <div className="charts-grid">
        <CategoryChart data={summary?.byCategory || []} currency={chartCurrency} />
        <TrendChart data={summary?.dailyTrend || []} currency={chartCurrency} />
      </div>
    </div>
  );
}
