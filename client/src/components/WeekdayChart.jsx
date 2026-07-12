import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { formatMYR } from '../utils/formatters';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export default function WeekdayChart({ weekdaySpending }) {
  const chartData = useMemo(() => ({
    labels: weekdaySpending.days.map((day) => day.name),
    datasets: [{
      data: weekdaySpending.days.map((day) => day.average),
      backgroundColor: '#6C63FF',
      borderRadius: 8,
      borderSkipped: false,
      barThickness: 18,
    }],
  }), [weekdaySpending]);

  const options = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` Average: ${formatMYR(context.raw)}`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(163, 177, 198, 0.2)' },
        ticks: { color: '#636e72', callback: (value) => `RM${value}` },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#636e72', font: { family: 'Inter', weight: 600 } },
      },
    },
  }), []);

  const insight = weekdaySpending.highestDays.length
    ? `You tend to spend the most on ${weekdaySpending.highestDays.join(' and ')}.`
    : 'Add expenses to discover your weekday spending pattern.';

  return (
    <div className="chart-card chart-card--weekday">
      <div className="chart-card__header">
        <div>
          <h3 className="chart-card__title">Spending by Weekday</h3>
          <p className="chart-card__subtitle">Average daily spending across your recorded history</p>
        </div>
      </div>
      <div className="chart-container">
        {weekdaySpending.highestValue === 0 ? (
          <div className="chart-empty">No weekday spending data available.</div>
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </div>
      <p className="chart-card__insight">{insight}</p>
    </div>
  );
}
