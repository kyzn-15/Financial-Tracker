import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { convertMyrAmount, convertToMyrAmount } from '../utils/formatters';
import { getChartTheme } from '../utils/chartTheme';
import AppIcon from './AppIcon';
import CategorySelect from './CategorySelect';
import OptionSelect from './OptionSelect';
import ChartCard from './ChartCard';
import type {
  Currency,
  EmergencyCategoryAverage,
  EmergencyFundStore,
  EmergencySettings,
  EmergencySettingsInput,
  EmergencySettingsPayload,
  EmergencySimulation,
  EmergencySummary,
  ExchangeRate,
  NumericValue,
  SimulationAdjustmentInput,
} from '../types';
import { getErrorMessage } from '../utils/errors';
import { usePrivacyMode } from '../hooks/usePrivacyMode';
import angryStatusLogo from '../assets/financial_tracker_icon_angry_red.svg';
import neutralStatusLogo from '../assets/financial_tracker_icon_neutral_yellow.svg';
import defaultStatusLogo from '../assets/logo.svg';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const TARGET_OPTIONS = [3, 6, 9, 12];
const PLAN_OPTIONS = [3, 6, 9, 12];
const DEFAULT_ESSENTIAL_CATEGORIES = ['Rent', 'Food', 'Transport', 'Phone', 'Insurance', 'Medicine', 'Utilities', 'Grocery', 'Health/Medical'];

function numberValue(value: NumericValue | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function moneyInputValue(amount: NumericValue | null | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  if (rounded === 0) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2);
}

function fundAmountForCurrency(
  settings: EmergencySettings,
  field: 'current_savings' | 'reserved_funds',
  currency: Currency,
): number {
  if (field === 'current_savings') {
    return currency === 'IDR' ? settings.current_savings_idr : settings.current_savings_myr;
  }
  return currency === 'IDR' ? settings.reserved_funds_idr : settings.reserved_funds_myr;
}

interface FundDetailsForm {
  current_savings: string;
  reserved_funds: string;
  target_months: number;
}

function formatMonths(value: NumericValue | null | undefined, isPrivacyMode = false): string {
  if (isPrivacyMode) return '*** Months';
  return `${Number(value || 0).toFixed(1)} Months`;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="emergency-empty">{children}</div>;
}

interface EmergencyMetricProps {
  label: string;
  value: string;
  sub?: string;
}

function EmergencyMetric({ label, value, sub }: EmergencyMetricProps) {
  return (
    <div className="emergency-metric neo-card neo-card--sm">
      <span className="emergency-metric__label">{label}</span>
      <strong className="emergency-metric__value">{value}</strong>
      {sub && <span className="emergency-metric__sub">{sub}</span>}
    </div>
  );
}

interface EmergencySettingsPanelProps {
  settingsPayload: EmergencySettingsPayload;
  onSave: (settings: EmergencySettingsInput) => Promise<EmergencySettingsPayload>;
  saving: boolean;
  currency: Currency;
}

export function EmergencySavingsSettingsPanel({ settingsPayload, onSave, saving, currency }: EmergencySettingsPanelProps) {
  const { isPrivacyMode } = usePrivacyMode();
  const settings = settingsPayload?.settings;
  const [form, setForm] = useState<FundDetailsForm>({
    current_savings: '0',
    reserved_funds: '0',
    target_months: 6,
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!settings) return;
    setForm({
      current_savings: moneyInputValue(fundAmountForCurrency(settings, 'current_savings', currency)),
      reserved_funds: moneyInputValue(fundAmountForCurrency(settings, 'reserved_funds', currency)),
      target_months: settings.target_months ?? 6,
    });
  }, [currency, settings]);

  const updateField = <K extends keyof FundDetailsForm>(field: K, value: FundDetailsForm[K]) => {
    setMessage('');
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentSavings = form.current_savings.trim() === '' ? 0 : Number(form.current_savings);
    const reservedFunds = form.reserved_funds.trim() === '' ? 0 : Number(form.reserved_funds);

    if (!Number.isFinite(currentSavings) || !Number.isFinite(reservedFunds) || currentSavings < 0 || reservedFunds < 0) {
      setMessage('Savings and reserved funds must be zero or higher.');
      return;
    }

    await onSave({
      current_savings: currentSavings,
      reserved_funds: reservedFunds,
      currency,
      target_months: Number(form.target_months),
    });
    setMessage('Fund details saved.');
  };

  return (
    <form className="emergency-settings neo-card" onSubmit={handleSubmit}>
      <div className="emergency-section-heading">
        <h3>Fund Details</h3>
        <p>Set the savings available for emergencies and your coverage goal.</p>
      </div>

      <div className="emergency-form-grid">
        <div className="neo-input-group">
          <label className="neo-label" htmlFor="emergency-current-savings">Current Savings ({currency})</label>
          <div className="money-input">
            <span>{currency === 'MYR' ? 'RM' : 'Rp'}</span>
            <input
              id="emergency-current-savings"
              className="neo-input"
              type={isPrivacyMode ? 'password' : 'number'}
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.current_savings}
              onChange={(event) => updateField('current_savings', event.target.value)}
            />
          </div>
        </div>

        <div className="neo-input-group">
          <label className="neo-label" htmlFor="emergency-reserved-funds">Reserved Funds ({currency})</label>
          <div className="money-input">
            <span>{currency === 'MYR' ? 'RM' : 'Rp'}</span>
            <input
              id="emergency-reserved-funds"
              className="neo-input"
              type={isPrivacyMode ? 'password' : 'number'}
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.reserved_funds}
              onChange={(event) => updateField('reserved_funds', event.target.value)}
            />
          </div>
        </div>

        <div className="neo-input-group">
          <label className="neo-label" htmlFor="emergency-target-months">Target Months</label>
          <OptionSelect
            id="emergency-target-months"
            dialogTitle="Target months"
            ariaLabel="Target months"
            value={String(form.target_months)}
            onChange={(value) => updateField('target_months', Number(value))}
            options={TARGET_OPTIONS.map((option) => ({ value: String(option), label: `${option} months` }))}
          />
        </div>
      </div>

      <div className="emergency-actions">
        {message && <p className="emergency-settings__message">{message}</p>}
        <button className="neo-btn neo-btn--primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Fund Details'}
        </button>
      </div>
    </form>
  );
}

export function EmergencyEssentialCategoriesPanel({ settingsPayload, onSave, saving }: Pick<EmergencySettingsPanelProps, 'settingsPayload' | 'onSave' | 'saving'>) {
  const settings = settingsPayload?.settings;
  const categories = settingsPayload?.categories || [];
  const [essentialCategories, setEssentialCategories] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (settings) setEssentialCategories(settings.essential_categories || []);
  }, [settings]);

  const toggleCategory = (category: string) => {
    setMessage('');
    setEssentialCategories((previous) => {
      const selected = new Set(previous);
      if (selected.has(category)) selected.delete(category);
      else selected.add(category);
      return [...selected];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    await onSave({
      essential_categories: essentialCategories,
    });
    setMessage('Essential categories saved.');
  };

  const useRecommendedCategories = () => {
    setMessage('');
    setEssentialCategories(categories.filter((category) => DEFAULT_ESSENTIAL_CATEGORIES.includes(category)));
  };

  return (
    <form className="emergency-settings neo-card" onSubmit={handleSubmit}>
      <div className="emergency-section-heading">
        <h3>Essential Categories</h3>
        <p>Choose which spending categories count toward emergency coverage.</p>
      </div>

      <div className="emergency-category-picker">
        <div className="emergency-category-picker__header">
          <div>
            <span className="neo-label">Included categories</span>
            <p>Only the selected categories are included in the coverage estimate.</p>
          </div>
          <strong>{essentialCategories.length} selected</strong>
        </div>

        {categories.length === 0 ? (
          <EmptyState>Add expenses to build category options.</EmptyState>
        ) : (
          <>
            <div className="emergency-category-actions">
              <button type="button" className="neo-btn neo-btn--secondary neo-btn--sm" onClick={useRecommendedCategories}>
                Recommended
              </button>
              <button type="button" className="neo-btn neo-btn--secondary neo-btn--sm" onClick={() => setEssentialCategories(categories)}>
                Select All
              </button>
              <button type="button" className="neo-btn neo-btn--secondary neo-btn--sm" onClick={() => setEssentialCategories([])}>
                Clear
              </button>
            </div>

            <div className="emergency-category-grid">
              {categories.map((category) => (
                <label key={category} className="emergency-checkbox">
                  <input
                    type="checkbox"
                    checked={essentialCategories.includes(category)}
                    onChange={() => toggleCategory(category)}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="emergency-actions">
        {message && <p className="emergency-settings__message">{message}</p>}
        <button className="neo-btn neo-btn--primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Essential Categories'}
        </button>
      </div>
    </form>
  );
}

function getStatusLogo(status: EmergencySummary['status']) {
  if (status.tone === 'red') return angryStatusLogo;
  if (status.tone === 'orange') return neutralStatusLogo;
  return defaultStatusLogo;
}

function CoverageOverview({ summary }: { summary: EmergencySummary }) {
  const { isPrivacyMode } = usePrivacyMode();
  const statusClass = `emergency-status emergency-status--${summary.status.tone}`;
  const progressClass = `emergency-progress__bar emergency-progress__bar--${summary.status.tone}`;

  return (
    <section className="emergency-overview neo-card">
      <div className="emergency-overview__top">
        <div className="emergency-overview__coverage">
          <span className="emergency-kicker">Emergency Fund</span>
          <h2>{formatMonths(summary.coverageMonths, isPrivacyMode)}</h2>
          <p>{isPrivacyMode ? '*** Days of essential coverage' : `${summary.coverageDays} Days of essential coverage`}</p>
        </div>
        <div className="emergency-status-wrap">
          <img className="emergency-status-logo" src={getStatusLogo(summary.status)} alt="" />
          <div className={statusClass}>{summary.status.label}</div>
        </div>
      </div>

      <div className="emergency-progress">
        <div className="emergency-progress__meta">
          <span>Target {summary.targetMonths} Months</span>
          <strong>{isPrivacyMode ? '***' : `${summary.progressPercent}%`}</strong>
        </div>
        <div className="emergency-progress__track">
          <div className={progressClass} style={{ width: `${summary.progressPercent}%` }}></div>
        </div>
        <div className="emergency-progress__meta emergency-progress__meta--muted">
          <span>Current {formatMonths(summary.coverageMonths, isPrivacyMode)}</span>
          <span>Visual progress capped at 100%</span>
        </div>
      </div>

      <p className="emergency-data-basis">{summary.dataBasis.message}</p>
    </section>
  );
}

interface GoalCardProps {
  summary: EmergencySummary;
  planMonths: number;
  setPlanMonths: (months: number) => void;
  formatAmount: (amount: number) => string;
}

function GoalCard({ summary, planMonths, setPlanMonths, formatAmount }: GoalCardProps) {
  const monthlyNeeded = planMonths > 0 ? summary.remainingSavingsMyr / planMonths : 0;

  return (
    <section className="emergency-goal neo-card">
      <div className="emergency-section-heading">
        <h3>Goal</h3>
        <p>Target savings are based on essential monthly expenses.</p>
      </div>
      <div className="emergency-goal__grid">
        <EmergencyMetric label="Target" value={`${summary.targetMonths} Months`} sub={formatAmount(summary.targetSavingsMyr)} />
        <EmergencyMetric label="Current" value={formatAmount(summary.availableSavingsMyr)} sub="Available emergency savings" />
        <EmergencyMetric label="Remaining" value={formatAmount(summary.remainingSavingsMyr)} sub="Needed to reach target" />
      </div>
      <div className="emergency-plan">
        <label className="neo-label" htmlFor="emergency-plan-months">Reach Goal In</label>
        <OptionSelect
          id="emergency-plan-months"
          dialogTitle="Reach goal in"
          ariaLabel="Reach goal in"
          value={String(planMonths)}
          onChange={(value) => setPlanMonths(Number(value))}
          options={PLAN_OPTIONS.map((option) => ({ value: String(option), label: `${option} months` }))}
        />
        <div className="emergency-plan__result">
          <span>Monthly Saving Needed</span>
          <strong>{formatAmount(monthlyNeeded)}</strong>
        </div>
      </div>
    </section>
  );
}

function Insights({ insights }: { insights: EmergencySummary['insights'] }) {
  const { isPrivacyMode } = usePrivacyMode();
  return (
    <section className="emergency-insights neo-card">
      <div className="emergency-section-heading">
        <h3>Insights</h3>
      </div>
      <div className="emergency-insight-list">
        {insights.map((insight) => (
          <article className="emergency-insight" key={`${insight.title}-${insight.body}`}>
            <strong>{insight.title}</strong>
            <p>{isPrivacyMode ? 'Financial details are hidden while Privacy Mode is on.' : insight.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Timeline({ summary, formatAmount }: { summary: EmergencySummary; formatAmount: (amount: number) => string }) {
  const monthCount = Math.max(summary.targetMonths, Math.ceil(summary.coverageMonths || 1));
  const months = Array.from({ length: Math.min(monthCount, 12) }, (_, index) => index + 1);
  const monthlyExpense = summary.averageMonthlyEssentialExpenseMyr;

  return (
    <section className="emergency-timeline neo-card">
      <div className="emergency-section-heading">
        <h3>Emergency Timeline</h3>
      </div>
      <div className="timeline-row timeline-row--today">
        <span>Today</span>
        <div className="timeline-bar timeline-bar--full"></div>
        <strong>{formatAmount(summary.availableSavingsMyr)}</strong>
      </div>
      {months.map((month) => {
        const remaining = Math.max(0, summary.availableSavingsMyr - monthlyExpense * month);
        const percent = summary.availableSavingsMyr > 0 ? Math.max(0, (remaining / summary.availableSavingsMyr) * 100) : 0;
        return (
          <div className="timeline-row" key={month}>
            <span>Month {month}</span>
            <div className="timeline-bar">
              <div style={{ width: `${percent}%` }}></div>
            </div>
            <strong>{formatAmount(remaining)}</strong>
          </div>
        );
      })}
    </section>
  );
}

interface SimulationAdjustmentDraft {
  id: string;
  label: string;
  type: 'amount' | 'percent';
  amountMyr: number;
  percent: NumericValue;
  baseCategory: string;
}

function createAdjustment(categoryAverages: EmergencyCategoryAverage[] = []): SimulationAdjustmentDraft {
  return {
    id: `${Date.now()}-${Math.random()}`,
    label: '',
    type: 'amount',
    amountMyr: 0,
    percent: 0,
    baseCategory: categoryAverages[0]?.category || '',
  };
}

interface SimulatorProps {
  simulation: EmergencySimulation | null;
  runSimulation: EmergencyFundStore['runSimulation'];
  categoryAverages: EmergencyCategoryAverage[];
  currency: Currency;
  myrToIdr: number;
  formatAmount: (amount: number) => string;
}

function Simulator({ simulation, runSimulation, categoryAverages, currency, myrToIdr, formatAmount }: SimulatorProps) {
  const { isPrivacyMode } = usePrivacyMode();
  const [adjustments, setAdjustments] = useState(() => [createAdjustment(categoryAverages)]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setAdjustments((prev) => prev.map((item) => (
      item.baseCategory || categoryAverages.length === 0
        ? item
        : { ...item, baseCategory: categoryAverages[0].category }
    )));
  }, [categoryAverages]);

  const updateAdjustment = <K extends keyof SimulationAdjustmentDraft>(id: string, field: K, value: SimulationAdjustmentDraft[K]) => {
    setMessage('');
    setAdjustments((prev) => prev.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  };

  const updateAmountAdjustment = (id: string, value: NumericValue) => updateAdjustment(id, 'amountMyr', convertToMyrAmount(value, currency, myrToIdr));

  const addAdjustment = () => {
    setMessage('');
    setAdjustments((prev) => [...prev, createAdjustment(categoryAverages)]);
  };

  const removeAdjustment = (id: string) => {
    setMessage('');
    setAdjustments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: SimulationAdjustmentInput[] = adjustments.map((item, index) => {
      const label = item.label.trim() || `Adjustment ${index + 1}`;
      return item.type === 'percent'
        ? { label, type: 'percent', percent: numberValue(item.percent), baseCategory: item.baseCategory }
        : { label, type: 'amount', amountMyr: numberValue(item.amountMyr) };
    });

    const hasMissingCategory = payload.some((item) => item.type === 'percent' && !item.baseCategory);
    if (hasMissingCategory) {
      setMessage('Choose a category for every percentage calculation.');
      return;
    }

    runSimulation({ adjustments: payload }).catch((err) => setMessage(getErrorMessage(err, 'Could not run simulation.')));
  };

  return (
    <section className="emergency-simulator neo-card">
      <div className="emergency-section-heading">
        <h3>What If?</h3>
        <p>Build custom monthly changes without editing saved expenses.</p>
      </div>
      <form className="simulation-builder" onSubmit={handleSubmit}>
        {adjustments.length === 0 ? (
          <EmptyState>No custom calculations added.</EmptyState>
        ) : (
          adjustments.map((item, index) => (
            <div className="simulation-row" key={item.id}>
              <label className="simulation-field simulation-field--name">
                <span>Name</span>
                <input
                  className="neo-input"
                  type="text"
                  value={item.label}
                  placeholder={`Adjustment ${index + 1}`}
                  onChange={(event) => updateAdjustment(item.id, 'label', event.target.value)}
                />
              </label>

              <label className="simulation-field simulation-field--type">
                <span>Type</span>
                <OptionSelect
                  dialogTitle="Adjustment type"
                  ariaLabel={`Type for adjustment ${index + 1}`}
                  value={item.type}
                  onChange={(value) => updateAdjustment(item.id, 'type', value === 'percent' ? 'percent' : 'amount')}
                  options={[
                    { value: 'amount', label: `${currency} Change`, icon: 'circle-dollar' },
                    { value: 'percent', label: 'Category %', icon: 'chart' },
                  ]}
                />
              </label>

              {item.type === 'percent' ? (
                <>
                  <label className="simulation-field simulation-field--category">
                    <span>Category</span>
                    <CategorySelect
                      choices={categoryAverages.map((category) => ({ name: category.category }))}
                      value={item.baseCategory}
                      onChange={(name) => updateAdjustment(item.id, 'baseCategory', name)}
                      placeholder="No categories"
                      disabled={categoryAverages.length === 0}
                      ariaLabel={`Category for adjustment ${index + 1}`}
                    />
                  </label>
                  <label className="simulation-field simulation-field--value">
                    <span>Change %</span>
                    <input
                      className="neo-input"
                      type="number"
                      step="0.1"
                      value={item.percent}
                      onChange={(event) => updateAdjustment(item.id, 'percent', event.target.value)}
                    />
                  </label>
                </>
              ) : (
                <label className="simulation-field simulation-field--value">
                  <span>Monthly {currency}</span>
                  <input
                    className="neo-input"
                    type={isPrivacyMode ? 'password' : 'number'}
                    inputMode="decimal"
                    step="0.01"
                    value={convertMyrAmount(item.amountMyr, currency, myrToIdr)}
                    onChange={(event) => updateAmountAdjustment(item.id, event.target.value)}
                  />
                </label>
              )}

              <button
                className="simulation-row__remove"
                type="button"
                onClick={() => removeAdjustment(item.id)}
                title="Remove calculation"
              >
                <AppIcon name="x" size={16} />
              </button>
            </div>
          ))
        )}

        {message && <p className="simulation-message">{message}</p>}

        <div className="simulation-actions">
          <button className="neo-btn neo-btn--secondary" type="button" onClick={addAdjustment}>Add Calculation</button>
          <button className="neo-btn neo-btn--primary" type="submit" disabled={adjustments.length === 0}>Recalculate</button>
        </div>
      </form>

      {simulation && (
        <div className="simulation-result">
          <EmergencyMetric label="Monthly Change" value={formatAmount(simulation.totalDeltaMyr || 0)} sub="Net custom adjustment" />
          <EmergencyMetric label="Monthly Expenses" value={formatAmount(simulation.simulated.monthlyExpenseMyr)} sub={`Base ${formatAmount(simulation.base.monthlyExpenseMyr)}`} />
          <EmergencyMetric label="Coverage" value={formatMonths(simulation.simulated.coverageMonths, isPrivacyMode)} sub={isPrivacyMode ? '*** days' : `${simulation.simulated.coverageDays} days`} />
          <EmergencyMetric label="Status" value={simulation.simulated.status.label} sub="Temporary scenario" />
        </div>
      )}
    </section>
  );
}
interface AnalyticsProps {
  summary: EmergencySummary;
  planMonths: number;
  currency: Currency;
  myrToIdr: number;
  formatAmount: (amount: number) => string;
}

function Analytics({ summary, planMonths, currency, myrToIdr, formatAmount }: AnalyticsProps) {
  const { isPrivacyMode } = usePrivacyMode();
  const chartTheme = getChartTheme();
  const essentialVsNon = summary.analytics.essentialVsNonEssential;
  const hasPieData = essentialVsNon.essential_myr > 0 || essentialVsNon.non_essential_myr > 0;
  const monthlyNeeded = planMonths > 0 ? summary.remainingSavingsMyr / planMonths : 0;
  const trendLabels = Array.from({ length: planMonths + 1 }, (_, index) => (index === 0 ? 'Now' : `M${index}`));
  const trendValues = trendLabels.map((_, index) => {
    if (summary.averageMonthlyEssentialExpenseMyr <= 0) return 0;
    return Number(((summary.availableSavingsMyr + monthlyNeeded * index) / summary.averageMonthlyEssentialExpenseMyr).toFixed(1));
  });

  const pieData: ChartData<'doughnut', number[], string> = {
    labels: ['Essential', 'Non-Essential'],
    datasets: [{
      data: [convertMyrAmount(essentialVsNon.essential_myr, currency, myrToIdr), convertMyrAmount(essentialVsNon.non_essential_myr, currency, myrToIdr)],
      backgroundColor: [chartTheme.success, chartTheme.danger],
      borderColor: chartTheme.surface,
      borderWidth: 2,
    }],
  };

  const lineData: ChartData<'line', number[], string> = {
    labels: trendLabels,
    datasets: [{
      label: 'Coverage Months',
      data: trendValues,
      borderColor: chartTheme.accent,
      backgroundColor: chartTheme.accentFill,
      borderWidth: 3,
      fill: true,
      tension: 0.3,
      pointBackgroundColor: chartTheme.accent,
    }],
  };

  const pieOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: chartTheme.text } },
      tooltip: { callbacks: { label: (context) => `${context.label}: ${formatAmount(context.parsed)}` } },
    },
  };
  const lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: chartTheme.text } },
      tooltip: { callbacks: { label: (context) => `Coverage Months: ${isPrivacyMode ? '***' : context.parsed.y}` } },
    },
    scales: {
      x: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.text } },
      y: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.text, callback: () => isPrivacyMode ? '***' : undefined } },
    },
  };

  return (
    <section className="emergency-analytics">
      <div className="emergency-section-heading">
        <h3>Analytics</h3>
      </div>
      <div className="emergency-analytics-grid">
        <ChartCard title="Essential vs Non-Essential">
          {() => (
            <div className="chart-container">
              {hasPieData ? <Doughnut data={pieData} options={pieOptions} /> : <EmptyState>No spending data available.</EmptyState>}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Coverage Trend">
          {() => (
            <div className="chart-container">
              <Line data={lineData} options={lineOptions} />
            </div>
          )}
        </ChartCard>

        <div className="neo-card emergency-ranking">
          <div className="emergency-section-heading">
            <h3>Top Essential Categories</h3>
          </div>
          {summary.topEssentialCategories.length === 0 ? (
            <EmptyState>No essential spending found.</EmptyState>
          ) : (
            summary.topEssentialCategories.map((item, index) => (
              <div className="ranking-row" key={item.category}>
                <span>{index + 1}</span>
                <strong>{item.category}</strong>
                <em>{formatAmount(item.average_myr)}</em>
              </div>
            ))
          )}
        </div>

        <div className="neo-card readiness-card">
          <div className="readiness-card__score">{summary.analytics.readinessScore.score} / 100</div>
          <p>{summary.analytics.readinessScore.explanation}</p>
          <div className="readiness-parts">
            <span>Coverage {summary.analytics.readinessScore.parts.coverage}/70</span>
            <span>Savings Growth {summary.analytics.readinessScore.parts.savingsGrowth}/20</span>
            <span>Expense Stability {summary.analytics.readinessScore.parts.expenseStability}/10</span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface EmergencyFundDashboardProps {
  emergency: EmergencyFundStore;
  currency?: Currency;
  exchangeRate: ExchangeRate | null;
}

export default function EmergencyFundDashboard({ emergency, currency = 'MYR', exchangeRate }: EmergencyFundDashboardProps) {
  const { formatCurrency, isPrivacyMode } = usePrivacyMode();
  const { summary, settingsPayload, simulation, loading, saving, error, runSimulation, saveSettings } = emergency;
  const [planMonths, setPlanMonths] = useState(6);
  const myrToIdr = exchangeRate?.myrToIdr || 4500;
  const formatAmount = useCallback(
    (amount: number) => formatCurrency(amount, currency, myrToIdr),
    [currency, formatCurrency, myrToIdr]
  );

  const metrics = useMemo(() => {
    if (!summary) return [];
    const items: Array<[string, string, string?]> = [
      ['Current Savings', formatAmount(summary.currentSavingsMyr)],
      ['Reserved Funds', formatAmount(summary.reservedFundsMyr)],
      ['Available Emergency Savings', formatAmount(summary.availableSavingsMyr)],
      ['Average Monthly Essential Expenses', formatAmount(summary.averageMonthlyEssentialExpenseMyr)],
      ['Coverage', formatMonths(summary.coverageMonths, isPrivacyMode), isPrivacyMode ? '*** Days' : `${summary.coverageDays} Days`],
      ['Status', summary.status.label],
    ];
    return items;
  }, [formatAmount, isPrivacyMode, summary]);

  if (loading && !summary) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner__circle"></div>
      </div>
    );
  }

  if (error && !summary) {
    return <div className="neo-card emergency-error">Error fetching emergency fund data: {error}</div>;
  }

  if (!summary) {
    return <EmptyState>Emergency fund data is not available.</EmptyState>;
  }

  return (
    <div className="emergency-dashboard">
      {error && <div className="neo-card emergency-error">{error}</div>}
      <div className="emergency-hero-grid">
        <CoverageOverview summary={summary} />
        <GoalCard summary={summary} planMonths={planMonths} setPlanMonths={setPlanMonths} formatAmount={formatAmount} />
      </div>

      <div className="emergency-metrics-grid">
        {metrics.map(([label, value, sub]) => (
          <EmergencyMetric key={label} label={label} value={value} sub={sub} />
        ))}
      </div>

      {settingsPayload && (
        <EmergencySavingsSettingsPanel
          settingsPayload={settingsPayload}
          onSave={saveSettings}
          saving={saving}
          currency={currency}
        />
      )}

      <Insights insights={summary.insights} />

      <div className="emergency-main-grid emergency-main-grid--balanced">
        <Timeline summary={summary} formatAmount={formatAmount} />
        <Simulator simulation={simulation} runSimulation={runSimulation} categoryAverages={summary.analytics.categoryAverages} currency={currency} myrToIdr={myrToIdr} formatAmount={formatAmount} />
      </div>

      <Analytics summary={summary} planMonths={planMonths} currency={currency} myrToIdr={myrToIdr} formatAmount={formatAmount} />
    </div>
  );
}


