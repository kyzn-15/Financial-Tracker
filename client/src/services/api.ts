import type {
  BackupPreferences,
  Category,
  EmptyRecycleBinResult,
  EmergencySettingsInput,
  EmergencySettingsPayload,
  EmergencySimulation,
  EmergencySummary,
  ExchangeRate,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  ImportResult,
  Receipt,
  RecycleBinContents,
  RecurrenceFrequency,
  RecurringExpense,
  RecurringExpenseInput,
  ResetIntent,
  SessionResponse,
  SimulationAdjustmentInput,
  Summary,
  SystemStatusResponse,
} from '../types';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
if (!configuredApiUrl) {
  throw new Error('VITE_API_URL must be configured');
}

const configuredApiBase = configuredApiUrl.replace(/\/+$/, '');
const BASE_URL = configuredApiBase.endsWith('/api') ? configuredApiBase : `${configuredApiBase}/api`;

async function readApiError(response: Response): Promise<string | undefined> {
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') return undefined;
  if ('message' in payload && typeof payload.message === 'string') return payload.message;
  if ('error' in payload && typeof payload.error === 'string') return payload.error;
  return undefined;
}

async function request<T>(url: string, options?: RequestInit): Promise<T>;
async function request(url: string, options: RequestInit, noContent: true): Promise<void>;
async function request<T>(url: string, options: RequestInit = {}, noContent = false): Promise<T | void> {
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await readApiError(response);
    const fallback = response.status === 404
      ? 'Backend endpoint not found. Redeploy Render from the latest main commit.'
      : `Request failed (HTTP ${response.status}).`;
    throw new Error(message || fallback);
  }

  if (noContent || response.status === 204) return;
  return response.json();
}

export async function login(username: string, pin: string): Promise<{ authenticated: boolean }> {
  return request<{ authenticated: boolean }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, pin }),
  });
}

export async function getSession(): Promise<SessionResponse> {
  return request<SessionResponse>('/auth/session');
}

export async function getSystemStatus(): Promise<SystemStatusResponse> {
  return request<SystemStatusResponse>('/health');
}

export async function logout(): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export async function getExpenses(filters: Partial<ExpenseFilters> = {}): Promise<Expense[]> {
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.category) params.set('category', filters.category);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);

  const query = params.toString();
  return request<Expense[]>(`/expenses${query ? `?${query}` : ''}`);
}

export async function createExpense(data: ExpenseInput): Promise<Expense> {
  return request<Expense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExpense(id: number, data: ExpenseInput): Promise<Expense> {
  return request<Expense>(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(id: number): Promise<void> {
  return request(`/expenses/${id}`, {
    method: 'DELETE',
  }, true);
}

export async function getCategories(): Promise<Category[]> {
  return request<Category[]>('/categories');
}

export async function createCategory(name: string): Promise<Category[]> {
  return request<Category[]>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function renameCategory(id: number, name: string): Promise<Category[]> {
  return request<Category[]>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteCategory(id: number): Promise<Category[]> {
  return request<Category[]>(`/categories/${id}`, { method: 'DELETE' });
}

export async function reorderCategories(ids: number[]): Promise<Category[]> {
  return request<Category[]>('/categories/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}

export async function updateCategoryAutomation(id: number, enabled: boolean, frequency: RecurrenceFrequency): Promise<Category[]> {
  return request<Category[]>(`/categories/${id}/automation`, {
    method: 'PUT',
    body: JSON.stringify({ enabled, frequency }),
  });
}

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  return request<RecurringExpense[]>('/recurring-expenses');
}

export async function updateRecurringExpense(id: number, data: RecurringExpenseInput): Promise<RecurringExpense> {
  return request<RecurringExpense>(`/recurring-expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function cancelRecurringExpense(id: number): Promise<void> {
  return request(`/recurring-expenses/${id}`, { method: 'DELETE' }, true);
}

export async function getSummary(): Promise<Summary> {
  return request<Summary>('/summary');
}

export async function getExchangeRate(): Promise<ExchangeRate> {
  return request<ExchangeRate>('/exchange-rate');
}

export async function getReceipts(): Promise<Receipt[]> {
  return request<Receipt[]>('/receipts');
}

export async function uploadReceipt(file: File): Promise<Receipt> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${BASE_URL}/receipts`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response) || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function deleteReceipt(id: number): Promise<void> {
  return request(`/receipts/${id}`, {
    method: 'DELETE',
  }, true);
}

export function getReceiptImageUrl(id: number): string {
  return `${BASE_URL}/receipts/${id}/image`;
}

export async function getEmergencySettings(): Promise<EmergencySettingsPayload> {
  return request<EmergencySettingsPayload>('/emergency/settings');
}

export async function updateEmergencySettings(data: EmergencySettingsInput): Promise<EmergencySettingsPayload> {
  return request<EmergencySettingsPayload>('/emergency/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getEmergencySummary(): Promise<EmergencySummary> {
  return request<EmergencySummary>('/emergency/summary');
}

export async function getEmergencySimulation(
  adjustments: { adjustments?: SimulationAdjustmentInput[] } = {},
): Promise<EmergencySimulation> {
  const params = new URLSearchParams();
  if (adjustments.adjustments) params.set('adjustments', JSON.stringify(adjustments.adjustments));
  const query = params.toString();
  return request<EmergencySimulation>(`/emergency/simulation${query ? `?${query}` : ''}`);
}

export async function exportRecords(): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${BASE_URL}/export/records`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response) || `HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);

  return {
    blob,
    filename: filenameMatch?.[1] || 'financial-tracker-database-backup.xlsx',
  };
}

export async function importRecords(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('backup', file);
  const response = await fetch(`${BASE_URL}/export/records/import`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response) || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getBackupPreferences(): Promise<BackupPreferences> {
  return request<BackupPreferences>('/backup/preferences');
}

export async function updateBackupPreferences(reminderIntervalDays: number): Promise<BackupPreferences> {
  return request<BackupPreferences>('/backup/preferences', {
    method: 'PUT',
    body: JSON.stringify({ reminder_interval_days: reminderIntervalDays }),
  });
}

export async function recordBackup(): Promise<BackupPreferences> {
  return request<BackupPreferences>('/backup/completed', { method: 'POST' });
}

export async function resetLastBackup(): Promise<BackupPreferences> {
  return request<BackupPreferences>('/backup/last-backup', { method: 'DELETE' });
}

export async function createResetIntent(): Promise<ResetIntent> {
  return request<ResetIntent>('/settings/reset-intent', { method: 'POST' });
}

export async function resetAppData(resetToken: string, pin: string): Promise<void> {
  return request('/settings/data', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: 'RESET', resetToken, pin }),
  }, true);
}

export async function getRecycleBin(): Promise<RecycleBinContents> {
  return request<RecycleBinContents>('/recycle-bin');
}

export async function restoreRecycledExpense(id: number): Promise<void> {
  await request<{ message: string }>(`/recycle-bin/expenses/${id}/restore`, { method: 'POST' });
}

export async function purgeRecycledExpense(id: number): Promise<void> {
  return request(`/recycle-bin/expenses/${id}`, { method: 'DELETE' }, true);
}

export async function restoreRecycledReceipt(id: number): Promise<void> {
  await request<{ message: string }>(`/recycle-bin/receipts/${id}/restore`, { method: 'POST' });
}

export async function purgeRecycledReceipt(id: number): Promise<void> {
  return request(`/recycle-bin/receipts/${id}`, { method: 'DELETE' }, true);
}

export async function emptyRecycleBin(): Promise<EmptyRecycleBinResult> {
  return request<EmptyRecycleBinResult>('/recycle-bin', { method: 'DELETE' });
}
