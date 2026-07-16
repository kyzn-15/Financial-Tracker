import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';

const DEFAULT_ESSENTIAL_CATEGORIES = ['Rent', 'Food', 'Transport', 'Phone', 'Insurance', 'Medicine', 'Utilities', 'Grocery', 'Health/Medical'];
const VALID_TARGET_MONTHS = [3, 6, 9, 12];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, number);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function parseCategories(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  } catch {
    return [];
  }
}

function normalizeCategories(categories) {
  if (!Array.isArray(categories)) return [];
  return [...new Set(categories.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean))];
}

function currentMonthKey() {
  const utc8 = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const month = String(utc8.getUTCMonth() + 1).padStart(2, '0');
  return `${utc8.getUTCFullYear()}-${month}`;
}

function monthStartFromKey(monthKey) {
  return `${monthKey}-01T00:00:00+08:00`;
}

function addMonths(monthKey, count) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + count, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function placeholders(items) {
  return items.map(() => '?').join(', ');
}

async function getCompleteMonths(limit = 3) {
  const result = await db.execute({
    sql: `SELECT substr(timestamp, 1, 7) AS month
          FROM expenses
          WHERE substr(timestamp, 1, 7) < ?
          GROUP BY month
          ORDER BY month DESC
          LIMIT ?`,
    args: [currentMonthKey(), limit],
  });
  return result.rows.map((row) => row.month);
}

async function getCategoryTotalsForMonths(months) {
  if (months.length === 0) return [];
  const result = await db.execute({
    sql: `SELECT substr(timestamp, 1, 7) AS month,
                 category,
                 COALESCE(SUM(price_myr), 0) AS total_myr
          FROM expenses
          WHERE substr(timestamp, 1, 7) IN (${placeholders(months)})
          GROUP BY month, category`,
    args: months,
  });
  return result.rows;
}

async function getCurrentMonthCategoryTotals() {
  const monthKey = currentMonthKey();
  const nextMonthKey = addMonths(monthKey, 1);
  const result = await db.execute({
    sql: `SELECT substr(timestamp, 1, 7) AS month,
                 category,
                 COALESCE(SUM(price_myr), 0) AS total_myr
          FROM expenses
          WHERE timestamp >= ? AND timestamp < ?
          GROUP BY month, category`,
    args: [monthStartFromKey(monthKey), monthStartFromKey(nextMonthKey)],
  });
  return result.rows;
}

async function getManagedCategories() {
  const result = await db.execute({
    sql: `SELECT name
          FROM categories
          ORDER BY sort_order ASC, id ASC`,
    args: [],
  });
  return result.rows.map((row) => row.name);
}

function sumRows(rows, predicate) {
  return rows.reduce((sum, row) => (predicate(row) ? sum + toMoney(row.total_myr) : sum), 0);
}

async function buildExpenseProfile(settings) {
  const essentialCategories = new Set(settings.essential_categories);
  const completeMonths = await getCompleteMonths(3);
  const usesPartialData = completeMonths.length === 0;
  const months = usesPartialData ? [currentMonthKey()] : completeMonths;
  const rows = usesPartialData
    ? await getCurrentMonthCategoryTotals()
    : await getCategoryTotalsForMonths(months);
  const divisor = Math.max(months.length, 1);

  const monthlyTotals = months.map((month) => {
    const total = sumRows(rows, (row) => row.month === month && essentialCategories.has(row.category));
    return { month, total_myr: roundMoney(total) };
  });

  const categoryTotals = new Map();
  rows.forEach((row) => {
    categoryTotals.set(row.category, toMoney(categoryTotals.get(row.category)) + toMoney(row.total_myr));
  });

  const categoryAverages = [...categoryTotals.entries()]
    .map(([category, total]) => ({
      category,
      average_myr: roundMoney(total / divisor),
      is_essential: essentialCategories.has(category),
    }))
    .sort((a, b) => b.average_myr - a.average_myr);

  const essentialMonthlyExpense = monthlyTotals.reduce((sum, item) => sum + item.total_myr, 0) / divisor;
  const essentialTotal = categoryAverages
    .filter((item) => item.is_essential)
    .reduce((sum, item) => sum + item.average_myr, 0);
  const nonEssentialTotal = categoryAverages
    .filter((item) => !item.is_essential)
    .reduce((sum, item) => sum + item.average_myr, 0);

  return {
    months,
    rows,
    monthlyTotals,
    categoryAverages,
    topEssentialCategories: categoryAverages.filter((item) => item.is_essential && item.average_myr > 0).slice(0, 5),
    averageMonthlyEssentialExpense: roundMoney(essentialMonthlyExpense),
    essentialVsNonEssential: {
      essential_myr: roundMoney(essentialTotal),
      non_essential_myr: roundMoney(nonEssentialTotal),
    },
    dataBasis: {
      type: usesPartialData ? 'partial_current_month' : 'complete_months',
      monthCount: usesPartialData ? 0 : completeMonths.length,
      months,
      message: usesPartialData
        ? 'Estimate is based on current-month partial expense data because no complete month is available yet.'
        : `Estimate is based on ${completeMonths.length} complete month${completeMonths.length === 1 ? '' : 's'} of expense data.`,
    },
  };
}

function getStatus(coverageMonths, monthlyExpense) {
  if (monthlyExpense <= 0) return { label: 'Needs Data', tone: 'muted' };
  if (coverageMonths < 1) return { label: 'Critical', tone: 'red' };
  if (coverageMonths < 3) return { label: 'Low', tone: 'orange' };
  if (coverageMonths < 6) return { label: 'Healthy', tone: 'green' };
  if (coverageMonths < 12) return { label: 'Excellent', tone: 'blue' };
  return { label: 'Outstanding', tone: 'gold' };
}

function calculateCore(settings, monthlyExpense) {
  const currentSavings = toMoney(settings.current_savings_myr);
  const reservedFunds = toMoney(settings.reserved_funds_myr);
  const availableSavings = Math.max(0, currentSavings - reservedFunds);
  const coverageMonths = monthlyExpense > 0 ? availableSavings / monthlyExpense : 0;
  const targetSavings = monthlyExpense * settings.target_months;

  return {
    currentSavingsMyr: roundMoney(currentSavings),
    reservedFundsMyr: roundMoney(reservedFunds),
    availableSavingsMyr: roundMoney(availableSavings),
    averageMonthlyEssentialExpenseMyr: roundMoney(monthlyExpense),
    coverageMonths: Math.round(coverageMonths * 10) / 10,
    exactCoverageMonths: coverageMonths,
    coverageDays: Math.floor(coverageMonths * 30),
    targetMonths: settings.target_months,
    targetSavingsMyr: roundMoney(targetSavings),
    remainingSavingsMyr: roundMoney(Math.max(0, targetSavings - availableSavings)),
    progressPercent: targetSavings > 0 ? Math.min(100, Math.round((availableSavings / targetSavings) * 100)) : 0,
    status: getStatus(coverageMonths, monthlyExpense),
  };
}

function calculateExpenseStability(monthlyTotals) {
  if (monthlyTotals.length < 2) return 0.5;
  const values = monthlyTotals.map((item) => item.total_myr);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 0) return 0.5;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const coefficient = Math.sqrt(variance) / mean;
  return Math.max(0, 1 - Math.min(coefficient, 1));
}

function calculateReadinessScore(core, profile) {
  const coverageRatio = core.targetMonths > 0 ? Math.min(core.exactCoverageMonths / core.targetMonths, 1) : 0;
  const savingsRatio = core.targetSavingsMyr > 0 ? Math.min(core.availableSavingsMyr / core.targetSavingsMyr, 1) : 0;
  const stabilityRatio = calculateExpenseStability(profile.monthlyTotals);
  const coveragePoints = coverageRatio * 70;
  const savingsGrowthPoints = savingsRatio * 20;
  const stabilityPoints = stabilityRatio * 10;

  return {
    score: Math.round(coveragePoints + savingsGrowthPoints + stabilityPoints),
    parts: {
      coverage: Math.round(coveragePoints),
      savingsGrowth: Math.round(savingsGrowthPoints),
      expenseStability: Math.round(stabilityPoints),
    },
    explanation: 'Coverage carries 70%, current progress toward the savings target carries 20%, and essential expense stability carries 10%.',
  };
}

async function foodIncreaseInsight() {
  const months = await getCompleteMonths(2);
  if (months.length < 2) return null;
  const rows = await getCategoryTotalsForMonths(months);
  const [latestMonth, previousMonth] = months;
  const foodTotal = (month) => sumRows(rows, (row) => row.month === month && row.category.toLowerCase().includes('food'));
  const latest = foodTotal(latestMonth);
  const previous = foodTotal(previousMonth);

  if (previous > 0 && latest > previous * 1.2) {
    return {
      title: 'Food expenses have increased significantly.',
      body: 'Reducing restaurant spending could improve your emergency fund.',
    };
  }
  return null;
}

async function buildInsights(core) {
  const insights = [];

  if (core.averageMonthlyEssentialExpenseMyr <= 0) {
    insights.push({
      title: 'Select essential categories and add expenses.',
      body: 'Emergency coverage needs at least one essential spending baseline before it can be estimated.',
    });
  } else if (core.exactCoverageMonths < 1) {
    insights.push({
      title: 'Your emergency fund is critically low.',
      body: 'Focus on building at least one month of essential expenses.',
    });
  } else if (core.exactCoverageMonths >= 3 && core.exactCoverageMonths < 6) {
    insights.push({
      title: 'Good progress.',
      body: `You are financially protected for approximately ${core.coverageDays} days.`,
    });
  } else if (core.exactCoverageMonths >= core.targetMonths) {
    insights.push({
      title: 'Your emergency target is funded.',
      body: 'Keep reserved money separate so emergency savings remain available if income stops.',
    });
  }

  if (core.currentSavingsMyr > 0 && core.reservedFundsMyr > core.currentSavingsMyr * 0.4) {
    insights.push({
      title: 'A large portion of your savings is already reserved.',
      body: 'Consider increasing unrestricted emergency savings.',
    });
  }

  const foodInsight = await foodIncreaseInsight();
  if (foodInsight) insights.push(foodInsight);

  if (insights.length === 0) {
    insights.push({
      title: 'Your emergency fund is improving.',
      body: 'Continue tracking essential expenses so the estimate stays accurate.',
    });
  }

  return insights;
}

export async function getEmergencySettings() {
  let result = await db.execute({ sql: 'SELECT * FROM emergency_settings WHERE id = 1', args: [] });
  let row = result.rows[0];
  if (!row) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO emergency_settings (id, current_savings_myr, reserved_funds_myr, target_months, essential_categories, updated_at)
            VALUES (1, 0, 0, 6, ?, ?)`,
      args: [JSON.stringify(DEFAULT_ESSENTIAL_CATEGORIES), nowUTC8()],
    });
    result = await db.execute({ sql: 'SELECT * FROM emergency_settings WHERE id = 1', args: [] });
    row = result.rows[0];
  }

  return {
    id: row.id,
    current_savings_myr: toMoney(row.current_savings_myr),
    reserved_funds_myr: toMoney(row.reserved_funds_myr),
    target_months: VALID_TARGET_MONTHS.includes(Number(row.target_months)) ? Number(row.target_months) : 6,
    essential_categories: parseCategories(row.essential_categories),
    updated_at: row.updated_at,
  };
}

export async function getEmergencyCategoryOptions(settings = null) {
  if (!settings) await getEmergencySettings();
  return getManagedCategories();
}

export async function updateEmergencySettings(input) {
  const targetMonths = Number(input.target_months);
  if (!VALID_TARGET_MONTHS.includes(targetMonths)) {
    throw new Error('target_months must be one of 3, 6, 9, or 12');
  }

  const currentSavings = Number(input.current_savings_myr);
  const reservedFunds = Number(input.reserved_funds_myr);
  if (!Number.isFinite(currentSavings) || currentSavings < 0) {
    throw new Error('current_savings_myr must be a non-negative number');
  }
  if (!Number.isFinite(reservedFunds) || reservedFunds < 0) {
    throw new Error('reserved_funds_myr must be a non-negative number');
  }

  const essentialCategories = normalizeCategories(input.essential_categories);

  await db.execute({
    sql: `INSERT INTO emergency_settings (id, current_savings_myr, reserved_funds_myr, target_months, essential_categories, updated_at)
          VALUES (1, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            current_savings_myr = excluded.current_savings_myr,
            reserved_funds_myr = excluded.reserved_funds_myr,
            target_months = excluded.target_months,
            essential_categories = excluded.essential_categories,
            updated_at = excluded.updated_at`,
    args: [roundMoney(currentSavings), roundMoney(reservedFunds), targetMonths, JSON.stringify(essentialCategories), nowUTC8()],
  });

  return await getEmergencySettings();
}

export async function buildEmergencySummary() {
  const settings = await getEmergencySettings();
  const [profile, categoryOptions] = await Promise.all([
    buildExpenseProfile(settings),
    getEmergencyCategoryOptions(settings),
  ]);
  const core = calculateCore(settings, profile.averageMonthlyEssentialExpense);

  return {
    settings,
    categoryOptions,
    ...core,
    dataBasis: profile.dataBasis,
    monthlyTotals: profile.monthlyTotals,
    topEssentialCategories: profile.topEssentialCategories,
    analytics: {
      essentialVsNonEssential: profile.essentialVsNonEssential,
      categoryAverages: profile.categoryAverages,
      readinessScore: calculateReadinessScore(core, profile),
    },
    insights: await buildInsights(core),
  };
}

function parseSimulationAdjustments(query, categoryAverages) {
  if (!query.adjustments) {
    const foodAverage = categoryAverages
      .filter((item) => item.category.toLowerCase().includes('food'))
      .reduce((sum, item) => sum + item.average_myr, 0);
    const legacyAdjustments = [
      { label: 'Rent', type: 'amount', amountMyr: Number(query.rentDeltaMyr || 0) },
      { label: 'Food', type: 'percent', percent: Number(query.foodPercent || 0), baseCategory: 'Food', baseAmountMyr: foodAverage },
      { label: 'Transport', type: 'amount', amountMyr: Number(query.transportDeltaMyr || 0) },
      { label: 'Medical', type: 'amount', amountMyr: Number(query.medicalDeltaMyr || 0) },
    ];
    return legacyAdjustments.filter((item) => item.amountMyr || item.percent);
  }

  let parsed;
  try {
    parsed = JSON.parse(query.adjustments);
  } catch {
    throw new Error('Simulation adjustments must be valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Simulation adjustments must be an array');
  }
  if (parsed.length > 25) {
    throw new Error('Simulation supports up to 25 adjustments');
  }

  const categoryAverageByName = new Map(categoryAverages.map((item) => [item.category, toMoney(item.average_myr)]));

  return parsed
    .map((item, index) => {
      const label = typeof item.label === 'string' && item.label.trim()
        ? item.label.trim().slice(0, 60)
        : `Adjustment ${index + 1}`;
      const type = item.type === 'percent' ? 'percent' : 'amount';

      if (type === 'percent') {
        const percent = Number(item.percent || 0);
        if (!Number.isFinite(percent)) throw new Error('Percentage adjustments must be valid numbers');
        const baseCategory = typeof item.baseCategory === 'string' ? item.baseCategory : '';
        const baseAmountMyr = categoryAverageByName.get(baseCategory) ?? 0;
        return {
          label,
          type,
          percent,
          baseCategory,
          baseAmountMyr: roundMoney(baseAmountMyr),
          deltaMyr: roundMoney(baseAmountMyr * (percent / 100)),
        };
      }

      const amountMyr = Number(item.amountMyr || 0);
      if (!Number.isFinite(amountMyr)) throw new Error('Amount adjustments must be valid numbers');
      return {
        label,
        type,
        amountMyr: roundMoney(amountMyr),
        deltaMyr: roundMoney(amountMyr),
      };
    })
    .filter((item) => item.deltaMyr !== 0);
}

export async function buildEmergencySimulation(query) {
  const summary = await buildEmergencySummary();
  const categoryAverages = summary.analytics.categoryAverages;
  const adjustments = parseSimulationAdjustments(query, categoryAverages);
  const totalDeltaMyr = roundMoney(adjustments.reduce((sum, item) => sum + item.deltaMyr, 0));
  const simulatedMonthlyExpense = Math.max(0, summary.averageMonthlyEssentialExpenseMyr + totalDeltaMyr);
  const simulated = calculateCore(summary.settings, simulatedMonthlyExpense);

  return {
    adjustments,
    totalDeltaMyr,
    base: {
      monthlyExpenseMyr: summary.averageMonthlyEssentialExpenseMyr,
      coverageMonths: summary.coverageMonths,
      coverageDays: summary.coverageDays,
      status: summary.status,
    },
    simulated: {
      monthlyExpenseMyr: simulated.averageMonthlyEssentialExpenseMyr,
      coverageMonths: simulated.coverageMonths,
      coverageDays: simulated.coverageDays,
      status: simulated.status,
    },
  };
}
