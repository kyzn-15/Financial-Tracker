import { useCallback, useMemo } from 'react';
import SummaryCards from './SummaryCards';
import CategoryChart from './CategoryChart';
import TrendChart from './TrendChart';
import WeekdayChart from './WeekdayChart';
import SpendingHeatmap from './SpendingHeatmap';
import FinancialInsights from './FinancialInsights';
import AppIcon from './AppIcon';
import { AllTimeSpendingCard, CategoryGrowthCard, LargestPurchaseCard, MonthlyComparisonCard } from './AnalyticsCards';
import { formatCurrencyAmount, formatDate } from '../utils/formatters';
import {
  getCategoryGrowth,
  getFinancialInsights,
  getExpenseStreak,
  getHeatmapData,
  getHeatmapInsight,
  getLargestPurchase,
  getMonthlyComparison,
  getTrendData,
  getWeekdaySpending,
} from '../utils/dashboardAnalytics';
import type { AppTab, Currency, ExchangeRate, Summary } from '../types';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
}

function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
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

interface DashboardProps {
  summary: Summary | null;
  currency?: Currency;
  exchangeRate: ExchangeRate | null;
  onViewHeatmapExpenses: (date: string) => void;
  onNavigate: (tab: AppTab) => void;
}

export default function Dashboard({ summary, currency = 'MYR', exchangeRate, onViewHeatmapExpenses, onNavigate }: DashboardProps) {
  const myrToIdr = exchangeRate?.myrToIdr || 4500;
  const formatCurrency = useCallback(
    (amount: number) => formatCurrencyAmount(amount, currency, myrToIdr),
    [currency, myrToIdr]
  );
  const comparison = useMemo(() => getMonthlyComparison(summary?.monthlyComparison), [summary]);
  const categoryGrowth = useMemo(() => getCategoryGrowth(summary?.categoryComparison), [summary]);
  const largestPurchase = useMemo(
    () => getLargestPurchase(summary?.largestPurchase, comparison.current, summary?.referenceDate),
    [comparison, summary]
  );
  const weekdaySpending = useMemo(() => getWeekdaySpending(summary?.weekdaySpending), [summary]);
  const trend = useMemo(() => getTrendData(summary?.dailyTrend, summary?.referenceDate), [summary]);
  const heatmapDays = useMemo(() => getHeatmapData(summary?.heatmap, summary?.referenceDate), [summary]);
  const expenseStreak = useMemo(() => getExpenseStreak(heatmapDays, summary?.referenceDate), [heatmapDays, summary?.referenceDate]);
  const heatmapInsight = useMemo(() => getHeatmapInsight(heatmapDays), [heatmapDays]);
  const insights = useMemo(() => getFinancialInsights({
    comparison,
    categoryGrowth,
    weekdaySpending,
    largestPurchase,
    heatmapInsight,
    formatCurrency,
    formatDate,
  }), [comparison, categoryGrowth, weekdaySpending, largestPurchase, heatmapInsight, formatCurrency]);

  return (
    <div className="dashboard">
      <section className="dashboard-section">
        <SectionHeading eyebrow="Overview" title="Monthly Total" description="A snapshot of your current month." />
        <SummaryCards summary={summary} currency={currency} myrToIdr={myrToIdr} />
      </section>

      <section className="dashboard-section dashboard-quick-access" aria-labelledby="quick-access-title">
        <div className="dashboard-section__heading">
          <div>
            <p className="dashboard-section__eyebrow">Menu</p>
            <h2 id="quick-access-title">Quick Access</h2>
            <p className="dashboard-section__description">Open your savings safety net or saved receipts.</p>
          </div>
        </div>
        <div className="quick-access-grid">
          <button className="quick-access-card" type="button" onClick={() => onNavigate('emergency')}>
            <span className="quick-access-card__icon quick-access-card__icon--emergency">
              <AppIcon name="shield" size={22} />
            </span>
            <span className="quick-access-card__content">
              <strong>Emergency Fund</strong>
              <span>Track your savings goal and coverage.</span>
            </span>
            <AppIcon name="arrow-right" className="quick-access-card__arrow" />
          </button>
          <button className="quick-access-card" type="button" onClick={() => onNavigate('receipts')}>
            <span className="quick-access-card__icon quick-access-card__icon--receipts">
              <AppIcon name="receipt" size={22} />
            </span>
            <span className="quick-access-card__content">
              <strong>Receipts</strong>
              <span>Save and review your recent receipts.</span>
            </span>
            <AppIcon name="arrow-right" className="quick-access-card__arrow" />
          </button>
        </div>
      </section>

      <section className="dashboard-section">
        <SectionHeading eyebrow="Overview" title="Spending Overview" description="See your lifetime total and how this month's spending changed." />
        <div className="analytics-card-grid analytics-card-grid--overview">
          <MonthlyComparisonCard comparison={comparison} currency={currency} formatCurrency={formatCurrency} />
          <AllTimeSpendingCard total={Number(summary?.allTimeTotal?.myr ?? 0)} currency={currency} formatCurrency={formatCurrency} />
        </div>
      </section>

      <section className="dashboard-section">
        <SectionHeading eyebrow="Spending Analysis" title="Categories and purchases" description="Understand what is driving your spending." />
        <div className="dashboard-analysis-grid">
          <CategoryChart data={summary?.byCategory || []} currency={currency} myrToIdr={myrToIdr} />
          <CategoryGrowthCard growth={categoryGrowth} formatCurrency={formatCurrency} />
          <LargestPurchaseCard purchase={largestPurchase} formatCurrency={formatCurrency} />
        </div>
      </section>

      <section className="dashboard-section">
        <SectionHeading eyebrow="Spending Behaviour" title="Patterns over time" description="Explore when and how your spending happens." />
        <div className="charts-grid charts-grid--behaviour">
          <WeekdayChart weekdaySpending={weekdaySpending} currency={currency} myrToIdr={myrToIdr} />
          <SpendingHeatmap days={heatmapDays} currency={currency} myrToIdr={myrToIdr} streak={expenseStreak} onViewExpenses={onViewHeatmapExpenses} />
          <TrendChart trend={trend} currency={currency} myrToIdr={myrToIdr} />
        </div>
      </section>

      <FinancialInsights insights={insights} />
    </div>
  );
}
