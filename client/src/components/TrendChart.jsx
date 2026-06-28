import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatDate } from '../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function TrendChart({ data = [], currency = 'MYR' }) {
  const isMYR = currency === 'MYR';

  // Format dates for labels
  const labels = data.map(item => {
    // split date (YYYY-MM-DD) and display as DD MMM
    const parts = item.date.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${day} ${months[monthIdx] || ''}`;
    }
    return item.date;
  });

  const values = data.map(item => isMYR ? item.total_myr : item.total_idr);

  const chartData = {
    labels,
    datasets: [
      {
        label: `Daily Spend (${currency})`,
        data: values,
        borderColor: '#6C63FF',
        backgroundColor: 'rgba(108, 99, 255, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#6C63FF',
        pointBorderColor: '#e0e5ec',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend since there is only one line
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.raw;
            if (isMYR) {
              return ` RM ${Number(val).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;
            } else {
              return ` Rp ${Number(val).toLocaleString('id-ID', { minimumFractionDigits: 0 })}`;
            }
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#636e72',
          font: {
            family: 'Inter',
            size: 10,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(163, 177, 198, 0.2)', // Subtle grid lines
        },
        ticks: {
          color: '#636e72',
          font: {
            family: 'Inter',
            size: 10,
          },
          callback: (value) => {
            if (isMYR) {
              return `RM${value}`;
            } else {
              // Format large IDR values in thousands/millions (K/M) for space
              if (value >= 1000000) {
                return `Rp${(value / 1000000).toFixed(1)}M`;
              }
              if (value >= 1000) {
                return `Rp${(value / 1000).toFixed(0)}K`;
              }
              return `Rp${value}`;
            }
          },
        },
      },
    },
  };

  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <h3 className="chart-card__title">Daily Trend (Last 30 Days)</h3>
      </div>
      <div className="chart-container">
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No trend data available
          </div>
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
