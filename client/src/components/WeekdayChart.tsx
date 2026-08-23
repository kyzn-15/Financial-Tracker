import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';
import { convertMyrAmount, formatIDR, formatMYR } from '../utils/formatters';
import { getChartTheme } from '../utils/chartTheme';
import type { Currency, WeekdaySpending } from '../types';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface WeekdayChartProps {
  weekdaySpending: WeekdaySpending;
  currency?: Currency;
  myrToIdr?: number;
}

export default function WeekdayChart({ weekdaySpending, currency = 'MYR', myrToIdr = 4500 }: WeekdayChartProps) {
  const chartTheme = getChartTheme();
  const formatDisplayed = currency === 'MYR' ? formatMYR : formatIDR;
  const chartData = useMemo<ChartData<'bar', number[], string>>(() => ({
    labels: weekdaySpending.days.map((day) => day.name),
    datasets: [{ data: weekdaySpending.days.map((day) => convertMyrAmount(day.average, currency, myrToIdr)), backgroundColor: chartTheme.accent, borderColor: chartTheme.ink, borderWidth: 2, borderRadius: 4, borderSkipped: false, maxBarThickness: 26 }],
  }), [chartTheme.accent, chartTheme.ink, currency, myrToIdr, weekdaySpending]);
  const options = useMemo<ChartOptions<'bar'>>(() => ({
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#171717', titleFont: { family: 'Space Grotesk', weight: 700 }, bodyFont: { family: 'Inter', weight: 600 }, cornerRadius: 4, callbacks: { label: (context) => ` Average: ${formatDisplayed(context.parsed.x)}` } } },
    scales: {
      x: { beginAtZero: true, grid: { color: chartTheme.grid }, border: { color: chartTheme.ink, width: 2 }, ticks: { color: chartTheme.text, font: { weight: 600 }, callback: (value) => currency === 'MYR' ? `RM${value}` : `Rp${Number(value).toLocaleString('id-ID')}` } },
      y: { grid: { display: false }, border: { color: chartTheme.ink, width: 2 }, ticks: { color: chartTheme.text, font: { family: 'Space Grotesk', size: 11, weight: 700 } } },
    },
  }), [chartTheme.grid, chartTheme.text, chartTheme.ink, currency, formatDisplayed]);
  const insight = weekdaySpending.highestDays.length ? `You tend to spend the most on ${weekdaySpending.highestDays.join(' and ')}.` : 'Add expenses to discover your weekday spending pattern.';
  return <div className="chart-card chart-card--weekday"><div className="chart-card__header"><div><h3 className="chart-card__title">Spending by Weekday</h3><p className="chart-card__subtitle">Average daily spending across your recorded history</p></div></div><div className="chart-container">{weekdaySpending.highestValue === 0 ? <div className="chart-empty">No weekday spending data available.</div> : <Bar data={chartData} options={options} />}</div><p className="chart-card__insight">{insight}</p></div>;
}
