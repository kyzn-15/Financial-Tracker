// expenses.js — Express Router for all expense endpoints
import { Router } from 'express';
import db from '../db/database.js';
import { getExchangeRate } from '../services/exchangeRate.js';

const router = Router();

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
    const { name, category, price, currency, timestamp } = req.body;

    // Validate required fields
    if (!name || !category || price == null || !currency) {
      return res.status(400).json({
        error: 'Missing required fields: name, category, price, currency',
      });
    }

    if (!['MYR', 'IDR'].includes(currency.toUpperCase())) {
      return res.status(400).json({
        error: 'currency must be MYR or IDR',
      });
    }

    const cur = currency.toUpperCase();
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

    const stmt = db.prepare(`
      INSERT INTO expenses (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(name, category, priceMyr, priceIdr, cur, exchangeRateUsed, ts);

    // Return the created record
    const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/expenses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/expenses — List expenses with optional filters ────────────────
router.get('/', (req, res) => {
  try {
    const { category, startDate, endDate, sort, order } = req.query;

    const conditions = [];
    const params = [];

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
    const rows = db.prepare(sql).all(...params);

    res.json(rows);
  } catch (err) {
    console.error('GET /api/expenses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/expenses/:id — Get a single expense ──────────────────────────
router.get('/:id', (req, res) => {
  try {
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);

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
    const { name, category, price, currency, timestamp } = req.body;

    // Check the record exists
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Validate required fields
    if (!name || !category || price == null || !currency) {
      return res.status(400).json({
        error: 'Missing required fields: name, category, price, currency',
      });
    }

    if (!['MYR', 'IDR'].includes(currency.toUpperCase())) {
      return res.status(400).json({ error: 'currency must be MYR or IDR' });
    }

    const cur = currency.toUpperCase();
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

    const stmt = db.prepare(`
      UPDATE expenses
      SET name = ?, category = ?, price_myr = ?, price_idr = ?, original_currency = ?, exchange_rate_used = ?, timestamp = ?
      WHERE id = ?
    `);

    stmt.run(name, category, priceMyr, priceIdr, cur, exchangeRateUsed, ts, req.params.id);

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/expenses/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/expenses/:id — Delete an expense ───────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/expenses/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
