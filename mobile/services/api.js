const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredOrigin = process.env.EXPO_PUBLIC_ALLOWED_ORIGIN?.trim();
const BASE_URL = configuredApiUrl?.replace(/\/+$/, '').replace(/\/api$/, '') + '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function requireConfiguration() {
  if (!configuredApiUrl || !configuredOrigin) {
    throw new Error('Set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_ALLOWED_ORIGIN before signing in.');
  }
}

async function request(path, options = {}) {
  requireConfiguration();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      Origin: configuredOrigin,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.error || payload.message || `Request failed (HTTP ${response.status}).`, response.status);
  }

  return response.status === 204 ? null : response.json();
}

export function login(username, pin) {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin }),
  });
}

export function getSession() {
  return request('/auth/session');
}

export function getCategories() {
  return request('/categories');
}

export function createExpense(data) {
  return request('/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function uploadReceipt(receipt) {
  const body = new FormData();
  body.append('image', {
    uri: receipt.uri,
    name: receipt.name,
    type: receipt.mimeType,
  });
  return request('/receipts', { method: 'POST', body });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}
