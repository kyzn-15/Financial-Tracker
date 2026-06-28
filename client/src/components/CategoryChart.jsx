import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { CHART_COLORS } from '../utils/formatters';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function CategoryChart({ data = [], currency = 'MYR' }) {
  const isMYR = currency === 'MYR';

  // Sort data so the doughnut looks orderly
  const sortedData = [...data].sort((a, b) => {
    const valA = isMYR ? a.total_myr : a.total_idr;
    const valB = isMYR ? b.total_myr : b.total_idr;
    return valB - valA;
  });

  const labels = sortedData.map(item => item.category);
  const values = sortedData.map(item => isMYR ? item.total_myr : item.total_idr);

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: CHART_COLORS.slice(0, Math.max(values.length, 1)),
        borderWidth: 2,
        borderColor: '#e0e5ec', // Match background color for neomorphic look
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#2d3436',
          font: {
            family: 'Inter',
            size: 11,
            weight: 500,
          },
          padding: 12,
        },
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
  };

  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <h3 className="chart-card__title">Spending by Category ({currency})</h3>
      </div>
      <div className="chart-container">
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No data available for this month
          </div>
        ) : (
          <Doughnut data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
