// expenses.js — Express Router for all expense endpoints
import { Router } from 'express';
import db from '../db/database.js';
import { calculateExpenseAmounts, createExpenseRecord, getExpenseRecord, RECURRENCE_FREQUENCIES } from '../services/expenseRecords.js';
import { folderExists } from '../services/folders.js';
import { softDeleteExpense } from '../services/recycleBin.js';
import { toMyrToIdrKurs } from '../utils/currency.js';
import { nowUTC8 } from '../utils/datetime.js';

const router = Router();

const MAX_EXPENSE_TEXT_LENGTH = 160;
const MAX_EXPENSE_AMOUNT = 1_000_000_000;
const MAX_CUSTOM_KURS = 1_000_000;
const UTC8_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\+08:00$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SORT_COLUMNS = new Set(['id', 'name', 'category', 'price_myr', 'price_idr', 'timestamp', 'created_at']);

function validateExpenseInput(input) {
  const { name, category, price, currency, timestamp } = input ?? {};
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedCategory = typeof category === 'string' ? category.trim() : '';
  const normalizedCurrency = typeof currency === 'string' ? currency.toUpperCase() : '';
  const normalizedPrice = Number(price);

  if (!normalizedName || normalizedName.length > MAX_EXPENSE_TEXT_LENGTH || !normalizedCategory || normalizedCategory.length > MAX_EXPENSE_TEXT_LENGTH) {
    return null;
  }
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0 || normalizedPrice > MAX_EXPENSE_AMOUNT) {
    return null;
  }
  if (!['MYR', 'IDR'].includes(normalizedCurrency)) return null;
  if (timestamp != null && timestamp !== '' && (typeof timestamp !== 'string' || !UTC8_TIMESTAMP_PATTERN.test(timestamp) || Number.isNaN(Date.parse(timestamp)))) {
    return null;
  }

  return {
    name: normalizedName,
    category: normalizedCategory,
    price: normalizedPrice,
    currency: normalizedCurrency,
    timestamp: timestamp || '',
  };
}

function parseCustomKurs(value) {
  if (value == null || value === '') return { omitted: true };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return { omitted: true };
    const kurs = Number(trimmed);
    if (!Number.isFinite(kurs) || kurs <= 0) return { invalid: true };
    return { kurs };
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return { invalid: true };
  }
  return { kurs: value };
}

function parseCustomKursQuote(value) {
  if (value == null || value === '' || value === 'MYR_IDR') return 'MYR_IDR';
  if (value === 'IDR_MYR') return 'IDR_MYR';
  return null;
}

function resolveSubmittedCustomKurs(body) {
  const parsed = parseCustomKurs(body?.customKurs);
  if (parsed.invalid) return { invalid: true };
  if (parsed.omitted) return { omitted: true };
  const quote = parseCustomKursQuote(body?.customKursQuote);
  if (!quote) return { invalid: true };
  const kurs = toMyrToIdrKurs(parsed.kurs, quote);
  if (!Number.isFinite(kurs) || kurs <= 0 || kurs > MAX_CUSTOM_KURS) return { invalid: true };
  return { kurs };
}

function storedExchangeRate(existing) {
  const kurs = Number(existing?.exchange_rate_used);
  return Number.isFinite(kurs) && kurs > 0 ? kurs : undefined;
}

function parseFolderId(value) {
  if (value == null || value === '') return { folderId: null };
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return { invalid: true };
  return { folderId: id };
}

function parseFolderFilter(value) {
  if (value == null || value === '') return { folderId: '' };
  if (value === 'ungrouped') return { folderId: 'ungrouped' };
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { folderId: id };
}

async function resolveFolderId(folderId) {
  if (folderId == null) return null;
  return (await folderExists(folderId)) ? folderId : undefined;
}

function parseExpenseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validateRecurrence(input) {
  if (input == null || input.enabled === false) return { enabled: false };
  if (input.enabled !== true || !RECURRENCE_FREQUENCIES.includes(input.frequency)) return null;
  return { enabled: true, frequency: input.frequency };
}

function normalizeFilterTimestamp(value, endOfDay) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (DATE_PATTERN.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) return null;
    return `${trimmed}T${endOfDay ? '23:59:59' : '00:00:00'}+08:00`;
  }
  return UTC8_TIMESTAMP_PATTERN.test(trimmed) && !Number.isNaN(Date.parse(trimmed)) ? trimmed : null;
}

function validateExpenseFilters(query) {
  const name = typeof query.name === 'string' ? query.name.trim() : query.name == null ? '' : null;
  const category = typeof query.category === 'string' ? query.category.trim() : query.category == null ? '' : null;
  const startDate = normalizeFilterTimestamp(query.startDate, false);
  const endDate = normalizeFilterTimestamp(query.endDate, true);
  const sort = query.sort == null || query.sort === '' ? 'timestamp' : query.sort;
  const order = query.order == null || query.order === ''
    ? 'DESC'
    : typeof query.order === 'string' ? query.order.toUpperCase() : null;

  const folderFilter = parseFolderFilter(query.folderId);
  if (
    name == null || name.length > MAX_EXPENSE_TEXT_LENGTH ||
    category == null || category.length > MAX_EXPENSE_TEXT_LENGTH ||
    startDate == null || endDate == null ||
    folderFilter == null ||
    !SORT_COLUMNS.has(sort) || !['ASC', 'DESC'].includes(order) ||
    (startDate && endDate && Date.parse(startDate) > Date.parse(endDate))
  ) return null;

  return { name, category, startDate, endDate, sort, order, folderId: folderFilter.folderId };
}

async function resolveCategoryName(category) {
  const result = await db.execute({
    sql: 'SELECT name FROM categories WHERE name = ? COLLATE NOCASE',
    args: [category],
  });
  return result.rows[0]?.name || null;
}
// ─── POST /api/expenses — Create a new expense ──────────────────────────────
router.post('/', async (req, res) => {
  try {
    const input = validateExpenseInput(req.body);
    if (!input) {
      return res.status(400).json({ error: 'Invalid expense details.' });
    }
    const recurrence = validateRecurrence(req.body?.recurrence);
    if (!recurrence) {
      return res.status(400).json({ error: 'Choose a valid recurring frequency.' });
    }
    const customKurs = resolveSubmittedCustomKurs(req.body);
    if (customKurs.invalid) {
      return res.status(400).json({ error: 'Custom kurs must be a positive number.' });
    }
    const folderInput = parseFolderId(req.body?.folderId);
    if (folderInput.invalid) {
      return res.status(400).json({ error: 'Invalid folder.' });
    }
    const category = await resolveCategoryName(input.category);
    if (!category) {
      return res.status(400).json({ error: 'Choose a category that is currently available.' });
    }
    const folderId = await resolveFolderId(folderInput.folderId);
    if (folderId === undefined) {
      return res.status(400).json({ error: 'Choose a folder that exists.' });
    }
    const created = await createExpenseRecord({
      ...input,
      category,
      customKurs: customKurs.kurs,
      folderId,
    }, recurrence);
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/expenses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/expenses — List expenses with optional filters ────────────────
router.get('/', async (req, res) => {
  try {
    const filters = validateExpenseFilters(req.query);
    if (!filters) return res.status(400).json({ error: 'Invalid expense filters.' });
    const { name, category, startDate, endDate, sort, order, folderId } = filters;

    const conditions = ['deleted_at IS NULL'];
    const params = [];

    if (name) {
      const escapedName = name.replace(/[\\%_]/g, '\\$&');
      conditions.push("name LIKE ? ESCAPE '\\' COLLATE NOCASE");
      params.push(`%${escapedName}%`);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (startDate) {
      conditions.push('timestamp >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('timestamp <= ?');
      params.push(endDate);
    }
    if (folderId === 'ungrouped') {
      conditions.push('folder_id IS NULL');
    } else if (folderId) {
      conditions.push('folder_id = ?');
      params.push(folderId);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `SELECT * FROM (
                   SELECT expenses.*,
                          expense_folders.name AS folder_name,
                          recurring_expense_occurrences.rule_id AS recurring_rule_id,
                          recurring_expense_occurrences.scheduled_for AS recurrence_scheduled_for
                   FROM expenses
                   LEFT JOIN expense_folders ON expense_folders.id = expenses.folder_id
                   LEFT JOIN recurring_expense_occurrences ON recurring_expense_occurrences.expense_id = expenses.id
                 ) AS expense_records ${whereClause} ORDER BY ${sort} ${order}`;
    const result = await db.execute({ sql, args: params });
    const rows = result.rows;

    res.json(rows);
  } catch (err) {
    console.error('GET /api/expenses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/expenses/:id — Update an expense ─────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const id = parseExpenseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid expense id' });

    const existingResult = await db.execute({ sql: 'SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL', args: [id] });
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const input = validateExpenseInput(req.body);
    if (!input) return res.status(400).json({ error: 'Invalid expense details.' });
    const customKurs = resolveSubmittedCustomKurs(req.body);
    if (customKurs.invalid) {
      return res.status(400).json({ error: 'Custom kurs must be a positive number.' });
    }
    const folderInput = parseFolderId(req.body?.folderId);
    if (folderInput.invalid) {
      return res.status(400).json({ error: 'Invalid folder.' });
    }
    const { name, price, currency, timestamp } = input;
    const category = await resolveCategoryName(input.category);
    if (!category) {
      return res.status(400).json({ error: 'Choose a category that is currently available.' });
    }
    const folderId = await resolveFolderId(folderInput.folderId);
    if (folderId === undefined) {
      return res.status(400).json({ error: 'Choose a folder that exists.' });
    }
    const cur = currency;
    const ts = timestamp && timestamp.trim() !== '' ? timestamp : nowUTC8();
    const kurs = customKurs.omitted ? storedExchangeRate(existing) : customKurs.kurs;

    const { priceMyr, priceIdr, exchangeRateUsed } = await calculateExpenseAmounts(price, cur, kurs);

    await db.execute({
      sql: `UPDATE expenses
            SET name = ?, category = ?, price_myr = ?, price_idr = ?, original_currency = ?, exchange_rate_used = ?, timestamp = ?, folder_id = ?
            WHERE id = ?`,
      args: [name, category, priceMyr, priceIdr, cur, exchangeRateUsed, ts, folderId, id],
    });

    const updated = await getExpenseRecord(id);
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/expenses/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/expenses/:id — Move an expense to the Recycle Bin ─────────
router.delete('/:id', async (req, res) => {
  try {
    const id = parseExpenseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid expense id' });

    // Normal deletion is a soft delete: the expense stays recoverable in the
    // Recycle Bin for RETENTION_DAYS before automatic permanent cleanup.
    const deleted = await softDeleteExpense(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/expenses/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
