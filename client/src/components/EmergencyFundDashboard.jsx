import React, { useEffect, useMemo, useState } from 'react';
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
import { Doughnut, Line } from 'react-chartjs-2';
import { formatMYR } from '../utils/formatters';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const TARGET_OPTIONS = [3, 6, 9, 12];
const PLAN_OPTIONS = [3, 6, 9, 12];

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMonths(value) {
  return `${Number(value || 0).toFixed(1)} Months`;
}

function EmptyState({ children }) {
  return <div className="emergency-empty">{children}</div>;
}

function EmergencyMetric({ label, value, sub }) {
  return (
    <div className="emergency-metric neo-card neo-card--sm">
      <span className="emergency-metric__label">{label}</span>
      <strong className="emergency-metric__value">{value}</strong>
      {sub && <span className="emergency-metric__sub">{sub}</span>}
    </div>
  );
}

function SettingsPanel({ settingsPayload, onSave, saving }) {
  const settings = settingsPayload?.settings;
  const categories = settingsPayload?.categories || [];
  const [form, setForm] = useState({
    current_savings_myr: 0,
    reserved_funds_myr: 0,
    target_months: 6,
    essential_categories: [],
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!settings) return;
    setForm({
      current_savings_myr: settings.current_savings_myr ?? 0,
      reserved_funds_myr: settings.reserved_funds_myr ?? 0,
      target_months: settings.target_months ?? 6,
      essential_categories: settings.essential_categories || [],
    });
  }, [settings]);

  const updateField = (field, value) => {
    setMessage('');
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCategory = (category) => {
    setMessage('');
    setForm((prev) => {
      const selected = new Set(prev.essential_categories);
      if (selected.has(category)) selected.delete(category);
      else selected.add(category);
      return { ...prev, essential_categories: [...selected] };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const currentSavings = numberValue(form.current_savings_myr);
    const reservedFunds = numberValue(form.reserved_funds_myr);

    if (currentSavings < 0 || reservedFunds < 0) {
      setMessage('Savings and reserved funds must be zero or higher.');
      return;
    }

    await onSave({
      current_savings_myr: currentSavings,
      reserved_funds_myr: reservedFunds,
      target_months: Number(form.target_months),
      essential_categories: form.essential_categories,
    });
    setMessage('Emergency settings saved.');
  };

  return (
    <form className="emergency-settings neo-card" onSubmit={handleSubmit}>
      <div className="emergency-section-heading">
        <h3>Settings</h3>
        <p>Only unrestricted savings and selected essentials count toward coverage.</p>
      </div>

      <div className="emergency-form-grid">
        <div className="neo-input-group">
          <label className="neo-label" htmlFor="emergency-current-savings">Current Savings</label>
          <div className="money-input">
            <span>RM</span>
            <input
              id="emergency-current-savings"
              className="neo-input"
              type="number"
              min="0"
              step="0.01"
              value={form.current_savings_myr}
              onChange={(event) => updateField('current_savings_myr', event.target.value)}
            />
          </div>
        </div>

        <div className="neo-input-group">
          <label className="neo-label" htmlFor="emergency-reserved-funds">Reserved Funds</label>
          <div className="money-input">
            <span>RM</span>
            <input
              id="emergency-reserved-funds"
              className="neo-input"
              type="number"
              min="0"
              step="0.01"
              value={form.reserved_funds_myr}
              onChange={(event) => updateField('reserved_funds_myr', event.target.value)}
            />
          </div>
        </div>

        <div className="neo-input-group">
          <label className="neo-label" htmlFor="emergency-target-months">Target Months</label>
          <select
            id="emergency-target-months"
            className="neo-select"
            value={form.target_months}
            onChange={(event) => updateField('target_months', event.target.value)}
          >
            {TARGET_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="emergency-category-picker">
        <span className="neo-label">Essential Categories</span>
        {categories.length === 0 ? (
          <EmptyState>Add expenses to build category options.</EmptyState>
        ) : (
          <div className="emergency-category-grid">
            {categories.map((category) => (
              <label key={category} className="emergency-checkbox">
                <input
                  type="checkbox"
                  checked={form.essential_categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="emergency-actions">
        {message && <p className="emergency-settings__message">{message}</p>}
        <button className="neo-btn neo-btn--primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}

function CoverageOverview({ summary }) {
  const statusClass = `emergency-status emergency-status--${summary.status.tone}`;

  return (
    <section className="emergency-overview neo-card">
      <div className="emergency-overview__top">
        <div>
          <span className="emergency-kicker">Emergency Fund</span>
          <h2>{formatMonths(summary.coverageMonths)}</h2>
          <p>{summary.coverageDays} Days of essential coverage</p>
        </div>
        <div className={statusClass}>{summary.status.label}</div>
      </div>

      <div className="emergency-progress">
        <div className="emergency-progress__meta">
          <span>Target {summary.targetMonths} Months</span>
          <strong>{summary.progressPercent}%</strong>
        </div>
        <div className="emergency-progress__track">
          <div className="emergency-progress__bar" style={{ width: `${summary.progressPercent}%` }}></div>
        </div>
        <div className="emergency-progress__meta emergency-progress__meta--muted">
          <span>Current {formatMonths(summary.coverageMonths)}</span>
          <span>Visual progress capped at 100%</span>
        </div>
      </div>

      <p className="emergency-data-basis">{summary.dataBasis.message}</p>
    </section>
  );
}

function GoalCard({ summary, planMonths, setPlanMonths }) {
  const monthlyNeeded = planMonths > 0 ? summary.remainingSavingsMyr / planMonths : 0;

  return (
    <section className="emergency-goal neo-card">
      <div className="emergency-section-heading">
        <h3>Goal</h3>
        <p>Target savings are based on essential monthly expenses.</p>
      </div>
      <div className="emergency-goal__grid">
        <EmergencyMetric label="Target" value={`${summary.targetMonths} Months`} sub={formatMYR(summary.targetSavingsMyr)} />
        <EmergencyMetric label="Current" value={formatMYR(summary.availableSavingsMyr)} sub="Available emergency savings" />
        <EmergencyMetric label="Remaining" value={formatMYR(summary.remainingSavingsMyr)} sub="Needed to reach target" />
      </div>
      <div className="emergency-plan">
        <label className="neo-label" htmlFor="emergency-plan-months">Reach Goal In</label>
        <select
          id="emergency-plan-months"
          className="neo-select"
          value={planMonths}
          onChange={(event) => setPlanMonths(Number(event.target.value))}
        >
          {PLAN_OPTIONS.map((option) => (
            <option key={option} value={option}>{option} months</option>
          ))}
        </select>
        <div className="emergency-plan__result">
          <span>Monthly Saving Needed</span>
          <strong>{formatMYR(monthlyNeeded)}</strong>
        </div>
      </div>
    </section>
  );
}

function Insights({ insights }) {
  return (
    <section className="emergency-insights neo-card">
      <div className="emergency-section-heading">
        <h3>Insights</h3>
      </div>
      <div className="emergency-insight-list">
        {insights.map((insight) => (
          <article className="emergency-insight" key={`${insight.title}-${insight.body}`}>
            <strong>{insight.title}</strong>
            <p>{insight.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Timeline({ summary }) {
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
        <strong>{formatMYR(summary.availableSavingsMyr)}</strong>
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
            <strong>{formatMYR(remaining)}</strong>
          </div>
        );
      })}
    </section>
  );
}

function Simulator({ simulation, runSimulation }) {
  const [adjustments, setAdjustments] = useState({
    rentDeltaMyr: 200,
    foodPercent: 10,
    transportDeltaMyr: 100,
    medicalDeltaMyr: 300,
  });



  const updateAdjustment = (field, value) => {
    setAdjustments((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runSimulation({
      rentDeltaMyr: numberValue(adjustments.rentDeltaMyr),
      foodPercent: numberValue(adjustments.foodPercent),
      transportDeltaMyr: numberValue(adjustments.transportDeltaMyr),
      medicalDeltaMyr: numberValue(adjustments.medicalDeltaMyr),
    }).catch(() => {});
  };

  return (
    <section className="emergency-simulator neo-card">
      <div className="emergency-section-heading">
        <h3>What If?</h3>
        <p>Temporary changes do not alter saved expenses.</p>
      </div>
      <form className="simulator-grid" onSubmit={handleSubmit}>
        <label>
          <span>Rent +RM</span>
          <input className="neo-input" type="number" value={adjustments.rentDeltaMyr} onChange={(event) => updateAdjustment('rentDeltaMyr', event.target.value)} />
        </label>
        <label>
          <span>Food +%</span>
          <input className="neo-input" type="number" value={adjustments.foodPercent} onChange={(event) => updateAdjustment('foodPercent', event.target.value)} />
        </label>
        <label>
          <span>Transport +RM</span>
          <input className="neo-input" type="number" value={adjustments.transportDeltaMyr} onChange={(event) => updateAdjustment('transportDeltaMyr', event.target.value)} />
        </label>
        <label>
          <span>Medical +RM</span>
          <input className="neo-input" type="number" value={adjustments.medicalDeltaMyr} onChange={(event) => updateAdjustment('medicalDeltaMyr', event.target.value)} />
        </label>
        <button className="neo-btn neo-btn--secondary" type="submit">Recalculate</button>
      </form>

      {simulation && (
        <div className="simulation-result">
          <EmergencyMetric label="Monthly Expenses" value={formatMYR(simulation.simulated.monthlyExpenseMyr)} sub={`Base ${formatMYR(simulation.base.monthlyExpenseMyr)}`} />
          <EmergencyMetric label="Coverage" value={formatMonths(simulation.simulated.coverageMonths)} sub={`${simulation.simulated.coverageDays} days`} />
          <EmergencyMetric label="Status" value={simulation.simulated.status.label} sub="Temporary scenario" />
        </div>
      )}
    </section>
  );
}

function Analytics({ summary, planMonths }) {
  const essentialVsNon = summary.analytics.essentialVsNonEssential;
  const hasPieData = essentialVsNon.essential_myr > 0 || essentialVsNon.non_essential_myr > 0;
  const monthlyNeeded = planMonths > 0 ? summary.remainingSavingsMyr / planMonths : 0;
  const trendLabels = Array.from({ length: planMonths + 1 }, (_, index) => (index === 0 ? 'Now' : `M${index}`));
  const trendValues = trendLabels.map((_, index) => {
    if (summary.averageMonthlyEssentialExpenseMyr <= 0) return 0;
    return Number(((summary.availableSavingsMyr + monthlyNeeded * index) / summary.averageMonthlyEssentialExpenseMyr).toFixed(1));
  });

  const pieData = {
    labels: ['Essential', 'Non-Essential'],
    datasets: [{
      data: [essentialVsNon.essential_myr, essentialVsNon.non_essential_myr],
      backgroundColor: ['#00b894', '#ff7675'],
      borderColor: '#ecf0f3',
      borderWidth: 2,
    }],
  };

  const lineData = {
    labels: trendLabels,
    datasets: [{
      label: 'Coverage Months',
      data: trendValues,
      borderColor: '#6C63FF',
      backgroundColor: 'rgba(108, 99, 255, 0.12)',
      borderWidth: 3,
      fill: true,
      tension: 0.3,
      pointBackgroundColor: '#6C63FF',
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };

  return (
    <section className="emergency-analytics">
      <div className="emergency-section-heading">
        <h3>Analytics</h3>
      </div>
      <div className="emergency-analytics-grid">
        <div className="chart-card">
          <div className="chart-card__header">
            <h3 className="chart-card__title">Essential vs Non-Essential</h3>
          </div>
          <div className="chart-container">
            {hasPieData ? <Doughnut data={pieData} options={chartOptions} /> : <EmptyState>No spending data available.</EmptyState>}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h3 className="chart-card__title">Coverage Trend</h3>
          </div>
          <div className="chart-container">
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>

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
                <em>{formatMYR(item.average_myr)}</em>
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

export default function EmergencyFundDashboard({ emergency, onSaveSettings }) {
  const { summary, settingsPayload, simulation, loading, saving, error, runSimulation } = emergency;
  const [planMonths, setPlanMonths] = useState(6);

  const metrics = useMemo(() => {
    if (!summary) return [];
    return [
      ['Current Savings', formatMYR(summary.currentSavingsMyr)],
      ['Reserved Funds', formatMYR(summary.reservedFundsMyr)],
      ['Available Emergency Savings', formatMYR(summary.availableSavingsMyr)],
      ['Average Monthly Essential Expenses', formatMYR(summary.averageMonthlyEssentialExpenseMyr)],
      ['Coverage', formatMonths(summary.coverageMonths), `${summary.coverageDays} Days`],
      ['Status', summary.status.label],
    ];
  }, [summary]);

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
        <GoalCard summary={summary} planMonths={planMonths} setPlanMonths={setPlanMonths} />
      </div>

      <div className="emergency-metrics-grid">
        {metrics.map(([label, value, sub]) => (
          <EmergencyMetric key={label} label={label} value={value} sub={sub} />
        ))}
      </div>

      <div className="emergency-main-grid">
        <SettingsPanel settingsPayload={settingsPayload} onSave={onSaveSettings} saving={saving} />
        <Insights insights={summary.insights} />
      </div>

      <div className="emergency-main-grid emergency-main-grid--balanced">
        <Timeline summary={summary} />
        <Simulator simulation={simulation} runSimulation={runSimulation} />
      </div>

      <Analytics summary={summary} planMonths={planMonths} />
    </div>
  );
}


