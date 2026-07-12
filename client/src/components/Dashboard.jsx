import React, { useMemo, useState } from 'react';
import SummaryCards from './SummaryCards';
import CategoryChart from './CategoryChart';
import TrendChart from './TrendChart';
import WeekdayChart from './WeekdayChart';
import SpendingHeatmap from './SpendingHeatmap';
import FinancialInsights from './FinancialInsights';
import { CategoryGrowthCard, LargestPurchaseCard, MonthlyComparisonCard } from './AnalyticsCards';
import { formatDate, formatMYR } from '../utils/formatters';
import {
  getCategoryGrowth,
  getFinancialInsights,
  getHeatmapData,
  getHeatmapInsight,
  getLargestPurchase,
  getMonthlyComparison,
  getTrendData,
  getWeekdaySpending,
} from '../utils/dashboardAnalytics';

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="dashboard-section__heading">
      <div>
        <p className="dashboard-section__eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p className="dashboard-section__description">{description}</p>}
      </div>
    </div>
  );
}

export default function Dashboard({ summary }) {
  const [chartCurrency, setChartCurrency] = useState('MYR');
  const comparison = useMemo(() => getMonthlyComparison(summary?.monthlyComparison), [summary]);
  const categoryGrowth = useMemo(() => getCategoryGrowth(summary?.categoryComparison), [summary]);
  const largestPurchase = useMemo(
    () => getLargestPurchase(summary?.largestPurchase, comparison.current, summary?.referenceDate),
    [comparison, summary]
  );
  const weekdaySpending = useMemo(() => getWeekdaySpending(summary?.weekdaySpending), [summary]);
  const trend = useMemo(() => getTrendData(summary?.dailyTrend, summary?.referenceDate), [summary]);
  const heatmapDays = useMemo(() => getHeatmapData(summary?.heatmap, summary?.referenceDate), [summary]);
  const heatmapInsight = useMemo(() => getHeatmapInsight(heatmapDays), [heatmapDays]);
  const insights = useMemo(() => getFinancialInsights({
    comparison,
    categoryGrowth,
    weekdaySpending,
    largestPurchase,
    heatmapInsight,
    formatCurrency: formatMYR,
    formatDate,
  }), [comparison, categoryGrowth, weekdaySpending, largestPurchase, heatmapInsight]);

  return (
    <div className="dashboard">
      <div className="dashboard__currency-toggle-wrapper">
        <div className="currency-toggle dashboard__currency-toggle">
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

      <section className="dashboard-section">
        <SectionHeading eyebrow="Overview" title="Monthly Total" description="A snapshot of your current month." />
        <SummaryCards summary={summary} />
      </section>

      <section className="dashboard-section">
        <SectionHeading eyebrow="Overview" title="Monthly Comparison" description="See how this month's spending changed." />
        <div className="analytics-card-grid analytics-card-grid--single">
          <MonthlyComparisonCard comparison={comparison} />
        </div>
      </section>

      <section className="dashboard-section">
        <SectionHeading eyebrow="Spending Analysis" title="Categories and purchases" description="Understand what is driving your spending." />
        <div className="dashboard-analysis-grid">
          <CategoryChart data={summary?.byCategory || []} currency={chartCurrency} />
          <CategoryGrowthCard growth={categoryGrowth} />
          <LargestPurchaseCard purchase={largestPurchase} />
        </div>
      </section>

      <section className="dashboard-section">
        <SectionHeading eyebrow="Spending Behaviour" title="Patterns over time" description="Explore when and how your spending happens." />
        <div className="charts-grid charts-grid--behaviour">
          <WeekdayChart weekdaySpending={weekdaySpending} />
          <SpendingHeatmap days={heatmapDays} />
          <TrendChart trend={trend} currency={chartCurrency} />
        </div>
      </section>

      <FinancialInsights insights={insights} />
    </div>
  );
}
