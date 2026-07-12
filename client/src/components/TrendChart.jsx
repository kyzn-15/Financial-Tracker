import React, { useMemo } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { convertMyrAmount, formatDate, formatIDR, formatMYR } from '../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const EMPTY_POINTS = [];

function shortDate(date) {
  return formatDate(`${date}T00:00:00+08:00`).replace(/\s\d{4}$/, '');
}

export default function TrendChart({ trend, currency = 'MYR', myrToIdr = 4500 }) {
  const isMYR = currency === 'MYR';
  const formatDisplayed = isMYR ? formatMYR : formatIDR;
  const points = trend?.points || EMPTY_POINTS;
  const average = trend?.average || 0;
  const highestDate = trend?.highest?.date;
  const lowestDate = trend?.lowest?.date;

  const chartData = useMemo(() => ({
    labels: points.map((point) => shortDate(point.date)),
    datasets: [
      {
        label: `Daily spend (${currency})`,
        data: points.map((point) => convertMyrAmount(point.total, currency, myrToIdr)),
        borderColor: '#6C63FF',
        backgroundColor: 'rgba(108, 99, 255, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#6C63FF',
        pointBorderColor: '#e0e5ec',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'Average daily spending',
        data: points.map(() => convertMyrAmount(average, currency, myrToIdr)),
        borderColor: '#00b894',
        borderDash: [6, 6],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'Highest spending day',
        data: points.map((point) => point.date === highestDate ? convertMyrAmount(point.total, currency, myrToIdr) : null),
        borderColor: 'transparent',
        backgroundColor: '#ff7675',
        pointBackgroundColor: '#ff7675',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 7,
        pointHoverRadius: 8,
        showLine: false,
      },
      {
        label: 'Lowest spending day',
        data: points.map((point) => point.date === lowestDate ? convertMyrAmount(point.total, currency, myrToIdr) : null),
        borderColor: 'transparent',
        backgroundColor: '#74b9ff',
        pointBackgroundColor: '#74b9ff',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 7,
        pointHoverRadius: 8,
        showLine: false,
      },
    ],
  }), [average, currency, highestDate, lowestDate, myrToIdr, points]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: '#636e72', font: { family: 'Inter', size: 10 }, usePointStyle: true },
      },
      tooltip: {
        filter: (context) => context.datasetIndex === 0,
        callbacks: {
          title: (contexts) => formatDate(`${points[contexts[0].dataIndex].date}T00:00:00+08:00`),
          label: (context) => [
            ` Total spending: ${formatDisplayed(context.raw)}`,
            ` Transactions: ${points[context.dataIndex].transactions}`,
          ],
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#636e72', font: { family: 'Inter', size: 10 }, maxTicksLimit: 8 } },
      y: {
        grid: { color: 'rgba(163, 177, 198, 0.2)' },
        ticks: {
          color: '#636e72',
          font: { family: 'Inter', size: 10 },
          callback: (value) => isMYR ? `RM${value}` : `Rp${Number(value).toLocaleString('id-ID')}`,
        },
      },
    },
  }), [formatDisplayed, isMYR, points]);

  const hasTransactions = points.some((point) => point.transactions > 0);

  return (
    <div className="chart-card chart-card--trend">
      <div className="chart-card__header">
        <div>
          <h3 className="chart-card__title">Daily Trend (Last 30 Days)</h3>
          <p className="chart-card__subtitle">Average line and highest/lowest spending-day markers included</p>
        </div>
      </div>
      <div className="chart-container">
        {hasTransactions ? <Line data={chartData} options={options} /> : <div className="chart-empty">No trend data available.</div>}
      </div>
    </div>
  );
}
