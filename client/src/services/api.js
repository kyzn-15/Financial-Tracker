const BASE_URL = '/api';

async function request(url, options = {}) {
  const response = await fetch(`${BASE_URL}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Something went wrong' }));
    throw new Error(error.message || `HTTP ${response.status}`);
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
  if (filters.category) params.set('category', filters.category);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);

  const query = params.toString();
  return request(`/expenses${query ? `?${query}` : ''}`);
}

export async function getExpense(id) {
  return request(`/expenses/${id}`);
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
    if (value !== '' && value != null) params.set(key, value);
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
    filename: filenameMatch?.[1] || 'financial-tracker-export.xlsx',
  };
}