import React, { useCallback, useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { CHART_COLORS, convertMyrAmount, formatCurrencyAmount } from '../utils/formatters';
import { getCategoryBreakdown } from '../utils/dashboardAnalytics';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function CategoryChart({ data = [], currency = 'MYR', myrToIdr = 4500 }) {
  const categories = useMemo(() => getCategoryBreakdown(data), [data]);
  const displayCategories = useMemo(() => categories.map((item) => ({
    ...item,
    displayTotal: convertMyrAmount(item.total, currency, myrToIdr),
  })), [categories, currency, myrToIdr]);
  const formatCurrency = useCallback(
    (amount) => formatCurrencyAmount(amount, currency, myrToIdr),
    [currency, myrToIdr]
  );

  const chartData = useMemo(() => ({
    labels: displayCategories.map((item) => item.category),
    datasets: [{
      data: displayCategories.map((item) => item.displayTotal),
      backgroundColor: CHART_COLORS.slice(0, Math.max(displayCategories.length, 1)),
      borderWidth: 2,
      borderColor: '#e0e5ec',
      hoverOffset: 4,
    }],
  }), [displayCategories]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#2d3436',
          font: { family: 'Inter', size: 11, weight: 500 },
          padding: 12,
          generateLabels: (chart) => chart.data.labels.map((label, index) => {
            const item = displayCategories[index];
            return {
              text: `${label} · ${formatCurrency(item.total)} · ${item.percentage.toFixed(1)}%`,
              fillStyle: chart.data.datasets[0].backgroundColor[index],
              strokeStyle: chart.data.datasets[0].borderColor,
              lineWidth: chart.data.datasets[0].borderWidth,
              index,
            };
          }),
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const item = displayCategories[context.dataIndex];
            return `${formatCurrency(item.total)} · ${item.percentage.toFixed(1)}% of total`;
          },
        },
      },
    },
  }), [displayCategories, formatCurrency]);

  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <div>
          <h3 className="chart-card__title">Spending by Category ({currency})</h3>
          <p className="chart-card__subtitle">Amounts and share of total spending</p>
        </div>
      </div>
      <div className="chart-container">
        {displayCategories.length === 0 ? (
          <div className="chart-empty">No category spending recorded this month.</div>
        ) : (
          <Doughnut data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
