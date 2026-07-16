import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { convertMyrAmount, formatIDR, formatMYR } from '../utils/formatters';
import { getChartTheme } from '../utils/chartTheme';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export default function WeekdayChart({ weekdaySpending, currency = 'MYR', myrToIdr = 4500 }) {
  const chartTheme = getChartTheme();
  const formatDisplayed = currency === 'MYR' ? formatMYR : formatIDR;
  const chartData = useMemo(() => ({
    labels: weekdaySpending.days.map((day) => day.name),
    datasets: [{ data: weekdaySpending.days.map((day) => convertMyrAmount(day.average, currency, myrToIdr)), backgroundColor: chartTheme.accent, borderRadius: 8, borderSkipped: false, barThickness: 18 }],
  }), [chartTheme.accent, currency, myrToIdr, weekdaySpending]);
  const options = useMemo(() => ({
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => ` Average: ${formatDisplayed(context.raw)}` } } },
    scales: {
      x: { beginAtZero: true, grid: { color: chartTheme.grid }, ticks: { color: chartTheme.text, callback: (value) => currency === 'MYR' ? `RM${value}` : `Rp${Number(value).toLocaleString('id-ID')}` } },
      y: { grid: { display: false }, ticks: { color: chartTheme.text, font: { family: 'Inter', weight: 600 } } },
    },
  }), [chartTheme.grid, chartTheme.text, currency, formatDisplayed]);
  const insight = weekdaySpending.highestDays.length ? `You tend to spend the most on ${weekdaySpending.highestDays.join(' and ')}.` : 'Add expenses to discover your weekday spending pattern.';
  return <div className="chart-card chart-card--weekday"><div className="chart-card__header"><div><h3 className="chart-card__title">Spending by Weekday</h3><p className="chart-card__subtitle">Average daily spending across your recorded history</p></div></div><div className="chart-container">{weekdaySpending.highestValue === 0 ? <div className="chart-empty">No weekday spending data available.</div> : <Bar data={chartData} options={options} />}</div><p className="chart-card__insight">{insight}</p></div>;
}
