export type Currency = 'MYR' | 'IDR';
export type Theme = 'light' | 'dark';
export type PrivacyOnLoginPreference = 'always-on' | 'always-off' | 'remember';
export type AppTab = 'add' | 'dashboard' | 'receipts' | 'emergency' | 'history' | 'settings';
export type SortOrder = 'asc' | 'desc';
export type ExpenseSortColumn = 'id' | 'name' | 'category' | 'price_myr' | 'price_idr' | 'timestamp' | 'created_at';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';
export type RecurringStatus = 'active' | 'paused' | 'cancelled';
export type ToastType = 'info' | 'success' | 'error';
export type NumericValue = number | string;

export interface LoginCredentials {
  username: string;
  pin: string;
}

export interface SessionResponse {
  authenticated: boolean;
  expiresAt?: number;
}

export interface SystemStatusResponse {
  status: string;
}

export type RecurrenceInput =
  | { enabled: false }
  | { enabled: true; frequency: RecurrenceFrequency };

export type KursQuote = 'MYR_IDR' | 'IDR_MYR';

export interface ExpenseInput {
  name: string;
  category: string;
  price: number;
  currency: Currency;
  timestamp: string;
  recurrence?: RecurrenceInput;
  customKurs?: number | null;
  customKursQuote?: KursQuote;
  folderId?: number | null;
}

export interface Expense {
  id: number;
  name: string;
  category: string;
  price_myr: number;
  price_idr: number;
  original_currency: Currency;
  exchange_rate_used: number | null;
  timestamp: string;
  created_at: string;
  folder_id: number | null;
  folder_name: string | null;
  recurring_rule_id: number | null;
  recurrence_scheduled_for: string | null;
}

export interface ExpenseFolder {
  id: number;
  name: string;
  created_at: string;
  expense_count: number;
}

export interface ExpenseFilters {
  name: string;
  category: string;
  folderId: string;
  startDate: string;
  endDate: string;
  sort: ExpenseSortColumn;
  order: SortOrder;
}

export interface Category {
  id: number;
  name: string;
  sort_order: number;
  usage_count: number;
  automation_enabled: boolean;
  automation_frequency: RecurrenceFrequency;
}

export interface RecurringExpense {
  id: number;
  name: string;
  category: string;
  price: number;
  currency: Currency;
  frequency: RecurrenceFrequency;
  anchor_timestamp: string;
  next_run_at: string;
  status: RecurringStatus;
  created_at: string;
  updated_at: string;
}

export interface RecurringExpenseInput {
  name: string;
  category: string;
  price: number;
  currency: Currency;
  frequency: RecurrenceFrequency;
  next_run_at: string;
  status: Exclude<RecurringStatus, 'cancelled'>;
}

export interface Receipt {
  id: number;
  uploaded_at: string;
  expires_at: string;
  mime_type: string;
  image_url: string;
}

export interface RecycleBinExpenseItem {
  id: number;
  name: string;
  category: string;
  price_myr: number;
  price_idr: number;
  original_currency: Currency;
  timestamp: string;
  deleted_at: string;
  expires_at: string;
}

export interface RecycleBinReceiptItem {
  id: number;
  mime_type: string;
  uploaded_at: string;
  image_url: string;
  image_available: boolean;
  deleted_at: string;
  expires_at: string;
}

export interface RecycleBinContents {
  retention_days: number;
  expenses: RecycleBinExpenseItem[];
  receipts: RecycleBinReceiptItem[];
}

export interface EmptyRecycleBinResult {
  expenses: number;
  receipts: number;
}

export interface MoneyPair {
  myr: number;
  idr: number;
}

export interface CategoryTotal {
  category: string;
  total_myr: number;
  total_idr: number;
}

export interface CategoryComparison {
  category: string;
  current_myr: number;
  current_idr: number;
  previous_myr: number;
  previous_idr: number;
}

export interface LargestPurchaseRecord {
  id: number;
  name: string;
  category: string;
  price_myr: number;
  price_idr: number;
  timestamp: string;
}

export interface WeekdaySpendingRow {
  weekday: number | string;
  average_myr: number;
  average_idr: number;
  active_days: number;
}

export interface DailySpendingRow {
  date: string;
  total_myr: number;
  total_idr: number;
  transaction_count: number;
}

export interface Summary {
  monthlyTotal: MoneyPair;
  allTimeTotal: MoneyPair;
  byCategory: CategoryTotal[];
  dailyTrend: DailySpendingRow[];
  count: number;
  topCategory: string | null;
  referenceDate: string;
  monthlyComparison: { current: MoneyPair; previous: MoneyPair };
  categoryComparison: CategoryComparison[];
  largestPurchase: LargestPurchaseRecord | null;
  weekdaySpending: WeekdaySpendingRow[];
  heatmap: DailySpendingRow[];
}

export interface ExchangeRate {
  myrToIdr: number;
  idrToMyr: number;
  usingFallback: boolean;
  cached: boolean;
  message?: string;
  fetchedAt?: string;
  expiresAt?: string;
  isValid?: boolean;
}

export interface MonthlyComparison {
  current: number;
  previous: number;
  difference: number;
  percentage: number | null;
  direction: 'increase' | 'decrease' | 'neutral';
  isNewMonth: boolean;
}

export interface CategoryBreakdownItem extends CategoryTotal {
  total: number;
  percentage: number;
}

export interface CategoryGrowth {
  category: string;
  current: number;
  previous: number;
  difference: number;
  percentage: number | null;
  isNew: boolean;
}

export interface LargestPurchase extends LargestPurchaseRecord {
  amount: number;
  date: string;
  shareOfCurrentMonth: number | null;
  isCurrentMonth: boolean;
}

export interface WeekdaySpending {
  days: Array<{ name: string; average: number; transactionsDays: number }>;
  highestValue: number;
  highestDays: string[];
}

export interface TrendPoint {
  date: string;
  total: number;
  totalIdr: number;
  transactions: number;
}

export interface TrendData {
  points: TrendPoint[];
  average: number;
  averageIdr: number;
  highest: TrendPoint | null;
  lowest: TrendPoint | null;
}

export interface HeatmapDay {
  date: string;
  total: number;
  transactions: number;
  level: number;
}

export interface HeatmapInsight {
  startDate?: string;
  total: number;
}

export interface FinancialInsight {
  tone: 'danger' | 'success' | 'info' | 'warning' | 'accent';
  text: string;
}

export interface BackupPreferences {
  reminder_interval_days: number;
  last_backup_at: string | null;
  reminder_due: boolean;
}

export interface ImportResult {
  message: string;
  row_count: number;
  table_count: number;
}

export interface ResetIntent {
  token: string;
  waitSeconds: number;
  expiresAt: number;
}

export interface DeleteIntent {
  token: string;
  waitSeconds: number;
  expiresAt: number;
}

export interface EmergencySettings {
  id: number;
  current_savings_myr: number;
  current_savings_idr: number;
  reserved_funds_myr: number;
  reserved_funds_idr: number;
  original_currency: Currency;
  exchange_rate_used: number | null;
  target_months: number;
  essential_categories: string[];
  updated_at: string;
}

export interface EmergencySettingsInput {
  current_savings?: number;
  reserved_funds?: number;
  currency?: Currency;
  target_months?: number;
  essential_categories?: string[];
}

export interface EmergencySettingsPayload {
  settings: EmergencySettings;
  categories: string[];
}

export interface EmergencyStatus {
  label: string;
  tone: 'muted' | 'red' | 'orange' | 'green' | 'blue' | 'gold';
}

export interface EmergencyCategoryAverage {
  category: string;
  average_myr: number;
  is_essential: boolean;
}

export interface EmergencySummary {
  settings: EmergencySettings;
  categoryOptions: string[];
  currentSavingsMyr: number;
  reservedFundsMyr: number;
  availableSavingsMyr: number;
  averageMonthlyEssentialExpenseMyr: number;
  coverageMonths: number;
  exactCoverageMonths: number;
  coverageDays: number;
  targetMonths: number;
  targetSavingsMyr: number;
  remainingSavingsMyr: number;
  progressPercent: number;
  status: EmergencyStatus;
  dataBasis: {
    type: 'partial_current_month' | 'complete_months';
    monthCount: number;
    months: string[];
    message: string;
  };
  monthlyTotals: Array<{ month: string; total_myr: number }>;
  topEssentialCategories: EmergencyCategoryAverage[];
  analytics: {
    essentialVsNonEssential: { essential_myr: number; non_essential_myr: number };
    categoryAverages: EmergencyCategoryAverage[];
    readinessScore: {
      score: number;
      parts: { coverage: number; savingsGrowth: number; expenseStability: number };
      explanation: string;
    };
  };
  insights: Array<{ title: string; body: string }>;
}

export type SimulationAdjustmentInput =
  | { label: string; type: 'amount'; amountMyr: number }
  | { label: string; type: 'percent'; percent: number; baseCategory: string };

export interface EmergencySimulation {
  adjustments: Array<SimulationAdjustmentInput & { deltaMyr: number }>;
  totalDeltaMyr: number;
  base: {
    monthlyExpenseMyr: number;
    coverageMonths: number;
    coverageDays: number;
    status: EmergencyStatus;
  };
  simulated: {
    monthlyExpenseMyr: number;
    coverageMonths: number;
    coverageDays: number;
    status: EmergencyStatus;
  };
}

export interface CategoryStore {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Category[]>;
  addCategory: (name: string) => Promise<Category[]>;
  renameCategory: (id: number, name: string) => Promise<Category[]>;
  removeCategory: (id: number) => Promise<Category[]>;
  reorderCategories: (ids: number[]) => Promise<Category[]>;
  updateAutomation: (id: number, enabled: boolean, frequency: RecurrenceFrequency) => Promise<Category[]>;
}

export interface FolderStore {
  folders: ExpenseFolder[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<ExpenseFolder[]>;
  createFolder: (name: string) => Promise<ExpenseFolder>;
  renameFolder: (id: number, name: string) => Promise<ExpenseFolder[]>;
  removeFolder: (id: number) => Promise<ExpenseFolder[]>;
}

export interface RecurringExpenseStore {
  rules: RecurringExpense[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<RecurringExpense[]>;
  update: (id: number, data: RecurringExpenseInput) => Promise<RecurringExpense>;
  cancel: (id: number) => Promise<void>;
}

export interface RecycleBinStore {
  contents: RecycleBinContents | null;
  loading: boolean;
  error: string | null;
  busyId: string | null;
  load: () => Promise<RecycleBinContents>;
  refresh: () => Promise<RecycleBinContents>;
  restoreExpense: (id: number) => Promise<void>;
  purgeExpense: (id: number) => Promise<void>;
  restoreReceipt: (id: number) => Promise<void>;
  purgeReceipt: (id: number) => Promise<void>;
  emptyBin: () => Promise<EmptyRecycleBinResult>;
}

export interface EmergencyFundStore {
  summary: EmergencySummary | null;
  settingsPayload: EmergencySettingsPayload | null;
  simulation: EmergencySimulation | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveSettings: (data: EmergencySettingsInput) => Promise<EmergencySettingsPayload>;
  runSimulation: (adjustments: { adjustments: SimulationAdjustmentInput[] }) => Promise<EmergencySimulation>;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  isExiting: boolean;
}
