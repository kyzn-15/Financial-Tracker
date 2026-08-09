export const DEFAULT_CATEGORIES = [
  'Grocery', 'Food', 'Non-Primary Expenses', 'Other Expenses', 'Entertainment',
  'Education', 'Subscription', 'Transport', 'Rent', 'Utilities', 'Health/Medical',
  'Phone', 'Insurance', 'Medicine', 'Savings/Investment', 'Others',
];

const RECEIPT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export function nowUTC8() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19) + '+08:00';
}

export function isSupportedReceipt(mimeType) {
  return RECEIPT_MIME_TYPES.has(mimeType);
}
