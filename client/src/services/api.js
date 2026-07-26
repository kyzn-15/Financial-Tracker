const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
if (!configuredApiUrl) {
  throw new Error('VITE_API_URL must be configured');
}

const configuredApiBase = configuredApiUrl?.replace(/\/+$/, '');
const BASE_URL = configuredApiBase
  ? configuredApiBase.endsWith('/api') ? configuredApiBase : `${configuredApiBase}/api`
  : null;

async function request(url, options = {}) {
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Something went wrong' }));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function login(username, pin) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, pin }),
  });
}

export async function getSession() {
  return request('/auth/session');
}

export async function getSystemStatus() {
  return request('/health');
}

export async function logout() {
  const response = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export async function getExpenses(filters = {}) {
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.category) params.set('category', filters.category);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);

  const query = params.toString();
  return request(`/expenses${query ? `?${query}` : ''}`);
}

export async function createExpense(data) {
  return request('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExpense(id, data) {
  return request(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(id) {
  return request(`/expenses/${id}`, {
    method: 'DELETE',
  });
}

export async function getCategories() {
  return request('/categories');
}

export async function createCategory(name) {
  return request('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function renameCategory(id, name) {
  return request(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteCategory(id) {
  return request(`/categories/${id}`, { method: 'DELETE' });
}

export async function reorderCategories(ids) {
  return request('/categories/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}

export async function updateCategoryAutomation(id, enabled, frequency) {
  return request(`/categories/${id}/automation`, {
    method: 'PUT',
    body: JSON.stringify({ enabled, frequency }),
  });
}

export async function getRecurringExpenses() {
  return request('/recurring-expenses');
}

export async function updateRecurringExpense(id, data) {
  return request(`/recurring-expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function cancelRecurringExpense(id) {
  return request(`/recurring-expenses/${id}`, { method: 'DELETE' });
}

export async function getSummary() {
  return request('/summary');
}

export async function getExchangeRate() {
  return request('/exchange-rate');
}

export async function getReceipts() {
  return request('/receipts');
}

export async function uploadReceipt(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${BASE_URL}/receipts`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Something went wrong' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function deleteReceipt(id) {
  return request(`/receipts/${id}`, {
    method: 'DELETE',
  });
}

export function getReceiptImageUrl(id) {
  return `${BASE_URL}/receipts/${id}/image`;
}

export async function getEmergencySettings() {
  return request('/emergency/settings');
}

export async function updateEmergencySettings(data) {
  return request('/emergency/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getEmergencySummary() {
  return request('/emergency/summary');
}

export async function getEmergencySimulation(adjustments = {}) {
  const params = new URLSearchParams();
  Object.entries(adjustments).forEach(([key, value]) => {
    if (value === '' || value == null) return;
    const paramValue = typeof value === 'object' ? JSON.stringify(value) : value;
    params.set(key, paramValue);
  });
  const query = params.toString();
  return request(`/emergency/simulation${query ? `?${query}` : ''}`);
}

export async function exportRecords() {
  const response = await fetch(`${BASE_URL}/export/records`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Export failed' }));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);

  return {
    blob,
    filename: filenameMatch?.[1] || 'financial-tracker-database-backup.xlsx',
  };
}

export async function importRecords(file) {
  const formData = new FormData();
  formData.append('backup', file);
  const response = await fetch(`${BASE_URL}/export/records/import`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Database import failed' }));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getBackupPreferences() {
  return request('/backup/preferences');
}

export async function updateBackupPreferences(reminderIntervalDays) {
  return request('/backup/preferences', {
    method: 'PUT',
    body: JSON.stringify({ reminder_interval_days: reminderIntervalDays }),
  });
}

export async function recordBackup() {
  return request('/backup/completed', { method: 'POST' });
}

export async function resetLastBackup() {
  return request('/backup/last-backup', { method: 'DELETE' });
}

export async function createResetIntent() {
  return request('/settings/reset-intent', { method: 'POST' });
}

export async function resetAppData(resetToken, pin) {
  return request('/settings/data', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: 'RESET', resetToken, pin }),
  });
}
