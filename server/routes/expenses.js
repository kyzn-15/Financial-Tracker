// expenses.js — Express Router for all expense endpoints
import { Router } from 'express';
import db from '../db/database.js';
import { getExchangeRate } from '../services/exchangeRate.js';

const router = Router();

const MAX_EXPENSE_TEXT_LENGTH = 160;
const MAX_EXPENSE_AMOUNT = 1_000_000_000;
const UTC8_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\+08:00$/;

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

function parseExpenseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function resolveCategoryName(category) {
  const result = await db.execute({
    sql: 'SELECT name FROM categories WHERE name = ? COLLATE NOCASE',
    args: [category],
  });
  return result.rows[0]?.name || null;
}
// ─── Helper: get current UTC+8 timestamp in ISO 8601 ────────────────────────
function nowUTC8() {
  const now = new Date();
  // UTC+8 offset in ms
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  // Format as ISO string and replace Z with +08:00
  return utc8.toISOString().replace('Z', '').split('.')[0] + '+08:00';
}

// ─── POST /api/expenses — Create a new expense ──────────────────────────────
router.post('/', async (req, res) => {
  try {
    const input = validateExpenseInput(req.body);
    if (!input) {
      return res.status(400).json({ error: 'Invalid expense details.' });
    }
    const { name, price, currency, timestamp } = input;
    const category = await resolveCategoryName(input.category);
    if (!category) {
      return res.status(400).json({ error: 'Choose a category that is currently available.' });
    }
    const cur = currency;
    const ts = timestamp && timestamp.trim() !== '' ? timestamp : nowUTC8();

    // Fetch exchange rate
    const rate = await getExchangeRate();

    let priceMyr = null;
    let priceIdr = null;
    let exchangeRateUsed = rate ? rate.myrToIdr : null;

    if (cur === 'MYR') {
      priceMyr = price;
      priceIdr = rate ? price * rate.myrToIdr : null;
    } else {
      priceIdr = price;
      priceMyr = rate ? price * rate.idrToMyr : null;
    }

    const result = await db.execute({
      sql: `INSERT INTO expenses (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [name, category, priceMyr, priceIdr, cur, exchangeRateUsed, ts],
    });

    // Return the created record
    const createdResult = await db.execute({
      sql: 'SELECT * FROM expenses WHERE id = ?',
      args: [result.lastInsertRowid],
    });
    const created = createdResult.rows[0];
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/expenses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/expenses — List expenses with optional filters ────────────────
router.get('/', async (req, res) => {
  try {
    const { name, category, startDate, endDate, sort, order } = req.query;

    const conditions = [];
    const params = [];

    if (typeof name === 'string' && name.trim()) {
      const escapedName = name.trim().replace(/[\\%_]/g, '\\$&');
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

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Whitelist sort columns to prevent SQL injection
    const allowedSortColumns = ['id', 'name', 'category', 'price_myr', 'price_idr', 'timestamp', 'created_at'];
    const sortColumn = allowedSortColumns.includes(sort) ? sort : 'timestamp';
    const sortOrder = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `SELECT * FROM expenses ${whereClause} ORDER BY ${sortColumn} ${sortOrder}`;
    const result = await db.execute({ sql, args: params });
    const rows = result.rows;

    res.json(rows);
  } catch (err) {
    console.error('GET /api/expenses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/expenses/:id — Get a single expense ──────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseExpenseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid expense id' });
    const result = await db.execute({ sql: 'SELECT * FROM expenses WHERE id = ?', args: [id] });
    const expense = result.rows[0];

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (err) {
    console.error('GET /api/expenses/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/expenses/:id — Update an expense ─────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const id = parseExpenseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid expense id' });

    const existingResult = await db.execute({ sql: 'SELECT * FROM expenses WHERE id = ?', args: [id] });
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const input = validateExpenseInput(req.body);
    if (!input) return res.status(400).json({ error: 'Invalid expense details.' });
    const { name, price, currency, timestamp } = input;
    const category = await resolveCategoryName(input.category);
    if (!category) {
      return res.status(400).json({ error: 'Choose a category that is currently available.' });
    }
    const cur = currency;
    const ts = timestamp && timestamp.trim() !== '' ? timestamp : nowUTC8();

    // Re-fetch exchange rate for recalculation
    const rate = await getExchangeRate();

    let priceMyr = null;
    let priceIdr = null;
    let exchangeRateUsed = rate ? rate.myrToIdr : null;

    if (cur === 'MYR') {
      priceMyr = price;
      priceIdr = rate ? price * rate.myrToIdr : null;
    } else {
      priceIdr = price;
      priceMyr = rate ? price * rate.idrToMyr : null;
    }

    await db.execute({
      sql: `UPDATE expenses
            SET name = ?, category = ?, price_myr = ?, price_idr = ?, original_currency = ?, exchange_rate_used = ?, timestamp = ?
            WHERE id = ?`,
      args: [name, category, priceMyr, priceIdr, cur, exchangeRateUsed, ts, id],
    });

    const updatedResult = await db.execute({ sql: 'SELECT * FROM expenses WHERE id = ?', args: [id] });
    const updated = updatedResult.rows[0];
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/expenses/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/expenses/:id — Delete an expense ───────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const id = parseExpenseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid expense id' });
    const existingResult = await db.execute({ sql: 'SELECT * FROM expenses WHERE id = ?', args: [id] });
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await db.execute({ sql: 'DELETE FROM expenses WHERE id = ?', args: [id] });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/expenses/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
