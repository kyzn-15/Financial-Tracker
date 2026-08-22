import { useCallback, useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Legend, Tooltip } from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { CHART_COLORS, convertMyrAmount, formatCurrencyAmount } from '../utils/formatters';
import { getCategoryBreakdown } from '../utils/dashboardAnalytics';
import { getChartTheme } from '../utils/chartTheme';
import type { CategoryTotal, Currency } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryChartProps {
  data?: CategoryTotal[];
  currency?: Currency;
  myrToIdr?: number;
}

export default function CategoryChart({ data = [], currency = 'MYR', myrToIdr = 4500 }: CategoryChartProps) {
  const chartTheme = getChartTheme();
  const categories = useMemo(() => getCategoryBreakdown(data), [data]);
  const displayCategories = useMemo(() => categories.map((item) => ({
    ...item,
    displayTotal: convertMyrAmount(item.total, currency, myrToIdr),
  })), [categories, currency, myrToIdr]);
  const formatCurrency = useCallback(
    (amount: number) => formatCurrencyAmount(amount, currency, myrToIdr),
    [currency, myrToIdr]
  );

  const chartData = useMemo<ChartData<'doughnut', number[], string>>(() => ({
    labels: displayCategories.map((item) => item.category),
    datasets: [{
      data: displayCategories.map((item) => item.displayTotal),
      backgroundColor: CHART_COLORS.slice(0, Math.max(displayCategories.length, 1)),
      borderWidth: 2,
      borderColor: chartTheme.surface,
      hoverOffset: 4,
    }],
  }), [chartTheme.surface, displayCategories]);

  const options = useMemo<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: chartTheme.text,
          font: { family: 'Inter', size: 11, weight: 500 },
          padding: 12,
          generateLabels: () => displayCategories.map((item, index) => {
            return {
              text: `${item.category} · ${formatCurrency(item.total)} · ${item.percentage.toFixed(1)}%`,
              fillStyle: CHART_COLORS[index % CHART_COLORS.length],
              strokeStyle: chartTheme.surface,
              fontColor: chartTheme.text,
              lineWidth: 2,
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
  }), [chartTheme.surface, chartTheme.text, displayCategories, formatCurrency]);

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
