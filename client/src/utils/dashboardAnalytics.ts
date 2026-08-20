const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DISPLAY_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function number(value: NumericValue | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

export function getMonthlyComparison(
  comparison: { current?: Partial<MoneyPair>; previous?: Partial<MoneyPair> } = {},
): MonthlyComparison {
  const current = number(comparison.current?.myr);
  const previous = number(comparison.previous?.myr);
  const difference = current - previous;
  const percentage = previous > 0 ? (difference / previous) * 100 : null;

  return {
    current,
    previous,
    difference,
    percentage,
    direction: difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'neutral',
    isNewMonth: previous === 0 && current > 0,
  };
}

export function getCategoryBreakdown(categories: CategoryTotal[] = [], currency: Currency = 'MYR'): CategoryBreakdownItem[] {
  const key = currency === 'MYR' ? 'total_myr' : 'total_idr';
  const items = categories
    .map((item) => ({ ...item, total: number(item[key]) }))
    .sort((a, b) => b.total - a.total);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return items.map((item) => ({
    ...item,
    percentage: total > 0 ? (item.total / total) * 100 : 0,
  }));
}

export function getCategoryGrowth(categories: CategoryComparison[] = []): CategoryGrowth | null {
  const growth = categories
    .map((item) => {
      const current = number(item.current_myr);
      const previous = number(item.previous_myr);
      const difference = current - previous;
      return {
        category: item.category,
        current,
        previous,
        difference,
        percentage: previous > 0 ? (difference / previous) * 100 : null,
        isNew: previous === 0 && current > 0,
      };
    })
    .filter((item) => item.difference > 0)
    .sort((a, b) => b.difference - a.difference);

  return growth[0] || null;
}

export function getLargestPurchase(
  purchase: LargestPurchaseRecord | null | undefined,
  currentMonthTotal: NumericValue,
  referenceDate?: string,
): LargestPurchase | null {
  if (!purchase) return null;

  const amount = number(purchase.price_myr);
  const date = purchase.timestamp?.slice(0, 10) || '';
  const current = number(currentMonthTotal);
  const currentMonthKey = referenceDate?.slice(0, 7);

  return {
    ...purchase,
    amount,
    date,
    shareOfCurrentMonth: current > 0 ? (amount / current) * 100 : null,
    isCurrentMonth: Boolean(currentMonthKey && date.startsWith(currentMonthKey)),
  };
}

export function getWeekdaySpending(rows: WeekdaySpendingRow[] = []): WeekdaySpending {
  const rowByWeekday = new Map(rows.map((row) => [Number(row.weekday), row]));
  const days = DISPLAY_WEEKDAYS.map((name) => {
    const index = WEEKDAYS.indexOf(name);
    const row = rowByWeekday.get(index);
    return {
      name,
      average: number(row?.average_myr),
      transactionsDays: number(row?.active_days),
    };
  });
  const highestValue = Math.max(...days.map((day) => day.average), 0);
  const highestDays = highestValue > 0
    ? days.filter((day) => day.average === highestValue).map((day) => day.name)
    : [];

  return { days, highestValue, highestDays };
}

export function getTrendData(rows: DailySpendingRow[] = [], referenceDate?: string): TrendData {
  const totalsByDate = new Map(rows.map((row) => [row.date, row]));
  const endDate = referenceDate ? parseDate(referenceDate) : new Date();
  const points = [];

  for (let index = 29; index >= 0; index -= 1) {
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - index);
    const dateKey = toDateKey(date);
    const row = totalsByDate.get(dateKey);
    points.push({
      date: dateKey,
      total: number(row?.total_myr),
      totalIdr: number(row?.total_idr),
      transactions: number(row?.transaction_count),
    });
  }

  const activePoints = points.filter((point) => point.transactions > 0);
  const average = points.reduce((sum, point) => sum + point.total, 0) / points.length;
  const averageIdr = points.reduce((sum, point) => sum + point.totalIdr, 0) / points.length;
  const highest = activePoints.length
    ? activePoints.reduce((largest, point) => point.total > largest.total ? point : largest)
    : null;
  const lowest = activePoints.length
    ? activePoints.reduce((smallest, point) => point.total < smallest.total ? point : smallest)
    : null;

  return { points, average, averageIdr, highest, lowest };
}

export function getHeatmapData(rows: DailySpendingRow[] = [], referenceDate?: string): HeatmapDay[] {
  const totalsByDate = new Map(rows.map((row) => [row.date, row]));
  const endDate = referenceDate ? parseDate(referenceDate) : new Date();
  const days = [];

  for (let index = 364; index >= 0; index -= 1) {
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - index);
    const dateKey = toDateKey(date);
    const row = totalsByDate.get(dateKey);
    days.push({
      date: dateKey,
      total: number(row?.total_myr),
      transactions: number(row?.transaction_count),
    });
  }

  const highestTotal = Math.max(...days.map((day) => day.total), 0);
  return days.map((day) => ({
    ...day,
    level: day.total === 0 || highestTotal === 0 ? 0 : Math.min(4, Math.ceil((day.total / highestTotal) * 4)),
  }));
}

export function getHeatmapInsight(heatmapDays: HeatmapDay[] = []): HeatmapInsight | null {
  const recentDays = heatmapDays.slice(-28);
  if (!recentDays.some((day) => day.total > 0)) return null;

  const weeks = [];
  for (let index = 0; index < recentDays.length; index += 7) {
    const days = recentDays.slice(index, index + 7);
    weeks.push({
      startDate: days[0]?.date,
      total: days.reduce((sum, day) => sum + day.total, 0),
    });
  }
  const highestWeek = weeks.reduce((largest, week) => week.total > largest.total ? week : largest, weeks[0]);
  return highestWeek?.total > 0 ? highestWeek : null;
}

export function getExpenseStreak(heatmapDays: HeatmapDay[] = [], referenceDate?: string): number {
  if (!referenceDate || heatmapDays.length === 0) return 0;

  const transactionsByDate = new Map(heatmapDays.map((day) => [day.date, number(day.transactions)]));
  let streak = 0;
  let date = parseDate(referenceDate);

  while ((transactionsByDate.get(toDateKey(date)) ?? 0) > 0) {
    streak += 1;
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return streak;
}

interface FinancialInsightInput {
  comparison: MonthlyComparison;
  categoryGrowth: CategoryGrowth | null;
  weekdaySpending: WeekdaySpending;
  largestPurchase: LargestPurchase | null;
  heatmapInsight: HeatmapInsight | null;
  formatCurrency: (amount: number) => string;
  formatDate: (value: string) => string;
}

export function getFinancialInsights({ comparison, categoryGrowth, weekdaySpending, largestPurchase, heatmapInsight, formatCurrency, formatDate }: FinancialInsightInput): FinancialInsight[] {
  const insights: FinancialInsight[] = [];

  if (comparison.current > 0 && comparison.direction === 'increase' && comparison.percentage != null) {
    insights.push({ tone: 'danger', text: `Your spending increased by ${comparison.percentage.toFixed(1)}% compared to last month.` });
  } else if (comparison.current > 0 && comparison.direction === 'decrease' && comparison.percentage != null) {
    insights.push({ tone: 'success', text: `Great job! You spent ${Math.abs(comparison.percentage).toFixed(1)}% less than last month.` });
  } else if (comparison.isNewMonth) {
    insights.push({ tone: 'info', text: `You logged ${formatCurrency(comparison.current)} in spending this month after no spending last month.` });
  }

  if (categoryGrowth) {
    const change = categoryGrowth.isNew
      ? `is new this month, adding ${formatCurrency(categoryGrowth.current)}`
      : `increased the most, contributing ${formatCurrency(categoryGrowth.difference)}`;
    insights.push({ tone: 'warning', text: `${categoryGrowth.category} spending ${change} to your overall increase.` });
  }

  if (weekdaySpending.highestDays.length > 0) {
    const days = weekdaySpending.highestDays.join(' and ');
    insights.push({ tone: 'accent', text: `You tend to spend the most on ${days}.` });
  }

  if (largestPurchase?.shareOfCurrentMonth != null) {
    insights.push({
      tone: 'info',
      text: `Your ${largestPurchase.name} purchase represents ${largestPurchase.shareOfCurrentMonth.toFixed(1)}% of this month's spending.`,
    });
  }

  if (heatmapInsight) {
    insights.push({
      tone: 'success',
      text: `Your highest-spending recent week began ${formatDate(`${heatmapInsight.startDate}T00:00:00+08:00`)}.`,
    });
  }

  return insights.slice(0, 5);
}
import type {
  CategoryBreakdownItem,
  CategoryComparison,
  CategoryGrowth,
  CategoryTotal,
  Currency,
  DailySpendingRow,
  FinancialInsight,
  HeatmapDay,
  HeatmapInsight,
  LargestPurchase,
  LargestPurchaseRecord,
  MoneyPair,
  MonthlyComparison,
  NumericValue,
  TrendData,
  WeekdaySpending,
  WeekdaySpendingRow,
} from '../types';
