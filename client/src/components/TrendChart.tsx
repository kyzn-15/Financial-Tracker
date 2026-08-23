import { useMemo } from 'react';
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
import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { convertMyrAmount, formatDate, formatIDR, formatMYR } from '../utils/formatters';
import { getChartTheme } from '../utils/chartTheme';
import type { Currency, TrendData, TrendPoint } from '../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const EMPTY_POINTS: TrendPoint[] = [];

function shortDate(date: string): string {
  return formatDate(`${date}T00:00:00+08:00`).replace(/\s\d{4}$/, '');
}

interface TrendChartProps {
  trend: TrendData;
  currency?: Currency;
  myrToIdr?: number;
}

export default function TrendChart({ trend, currency = 'MYR', myrToIdr = 4500 }: TrendChartProps) {
  const chartTheme = getChartTheme();
  const isMYR = currency === 'MYR';
  const formatDisplayed = isMYR ? formatMYR : formatIDR;
  const points = trend?.points || EMPTY_POINTS;
  const average = trend?.average || 0;
  const highestDate = trend?.highest?.date;
  const lowestDate = trend?.lowest?.date;

  const chartData = useMemo<ChartData<'line', Array<number | null>, string>>(() => ({
    labels: points.map((point) => shortDate(point.date)),
    datasets: [
      {
        label: `Daily spend (${currency})`,
        data: points.map((point) => convertMyrAmount(point.total, currency, myrToIdr)),
        borderColor: chartTheme.accent,
        backgroundColor: chartTheme.accentFill,
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: chartTheme.accent,
        pointBorderColor: chartTheme.ink,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
      },
      {
        label: 'Average daily spending',
        data: points.map(() => convertMyrAmount(average, currency, myrToIdr)),
        borderColor: '#1d7a44',
        borderDash: [7, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'Highest spending day',
        data: points.map((point) => point.date === highestDate ? convertMyrAmount(point.total, currency, myrToIdr) : null),
        borderColor: 'transparent',
        backgroundColor: chartTheme.danger,
        pointBackgroundColor: chartTheme.danger,
        pointBorderColor: chartTheme.ink,
        pointBorderWidth: 2.5,
        pointRadius: 8,
        pointHoverRadius: 9,
        showLine: false,
      },
      {
        label: 'Lowest spending day',
        data: points.map((point) => point.date === lowestDate ? convertMyrAmount(point.total, currency, myrToIdr) : null),
        borderColor: 'transparent',
        backgroundColor: chartTheme.info,
        pointBackgroundColor: chartTheme.info,
        pointBorderColor: chartTheme.ink,
        pointBorderWidth: 2.5,
        pointRadius: 8,
        pointHoverRadius: 9,
        showLine: false,
      },
    ],
  }), [average, chartTheme, currency, highestDate, lowestDate, myrToIdr, points]);

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: chartTheme.text, font: { family: 'Space Grotesk', size: 10, weight: 600 }, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: '#171717',
        titleFont: { family: 'Space Grotesk', weight: 700 },
        bodyFont: { family: 'Inter', weight: 600 },
        cornerRadius: 4,
        filter: (context) => context.datasetIndex === 0,
        callbacks: {
          title: (contexts) => formatDate(`${points[contexts[0].dataIndex].date}T00:00:00+08:00`),
          label: (context) => [
            ` Total spending: ${formatDisplayed(context.parsed.y ?? 0)}`,
            ` Transactions: ${points[context.dataIndex].transactions}`,
          ],
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: chartTheme.ink, width: 2 }, ticks: { color: chartTheme.text, font: { family: 'Space Grotesk', size: 10, weight: 600 }, maxTicksLimit: 8 } },
      y: {
        grid: { color: chartTheme.grid },
        border: { color: chartTheme.ink, width: 2 },
        ticks: {
          color: chartTheme.text,
          font: { family: 'Space Grotesk', size: 10, weight: 600 },
          callback: (value) => isMYR ? `RM${value}` : `Rp${Number(value).toLocaleString('id-ID')}`,
        },
      },
    },
  }), [chartTheme.grid, chartTheme.ink, chartTheme.text, formatDisplayed, isMYR, points]);

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
