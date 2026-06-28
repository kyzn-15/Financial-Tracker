// summary.js — Express Router for summary and exchange-rate endpoints
import { Router } from 'express';
import db from '../db/database.js';
import { getExchangeRateInfo } from '../services/exchangeRate.js';

const router = Router();

// ─── GET /api/summary — Aggregated expense summary ─────────────────────────
router.get('/summary', (req, res) => {
  try {
    // Current month boundaries in UTC+8
    const now = new Date();
    const utc8Now = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = utc8Now.getUTCFullYear();
    const month = String(utc8Now.getUTCMonth() + 1).padStart(2, '0');
    const monthStart = `${year}-${month}-01T00:00:00+08:00`;

    // Next month start
    const nextMonth =
      utc8Now.getUTCMonth() + 2 > 12
        ? `${year + 1}-01-01T00:00:00+08:00`
        : `${year}-${String(utc8Now.getUTCMonth() + 2).padStart(2, '0')}-01T00:00:00+08:00`;

    // Monthly total
    const monthlyTotal = db
      .prepare(
        `SELECT COALESCE(SUM(price_myr), 0) AS myr, COALESCE(SUM(price_idr), 0) AS idr
         FROM expenses
         WHERE timestamp >= ? AND timestamp < ?`
      )
      .get(monthStart, nextMonth);

    // Count
    const countRow = db
      .prepare(
        `SELECT COUNT(*) AS count FROM expenses
         WHERE timestamp >= ? AND timestamp < ?`
      )
      .get(monthStart, nextMonth);

    // By category (current month)
    const byCategory = db
      .prepare(
        `SELECT category,
                COALESCE(SUM(price_myr), 0) AS total_myr,
                COALESCE(SUM(price_idr), 0) AS total_idr
         FROM expenses
         WHERE timestamp >= ? AND timestamp < ?
         GROUP BY category
         ORDER BY total_myr DESC`
      )
      .all(monthStart, nextMonth);

    // Top category
    const topCategory = byCategory.length > 0 ? byCategory[0].category : null;

    // Daily trend — last 30 days
    const thirtyDaysAgo = new Date(utc8Now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr =
      thirtyDaysAgo.toISOString().split('T')[0] + 'T00:00:00+08:00';

    const dailyTrend = db
      .prepare(
        `SELECT
           substr(timestamp, 1, 10) AS date,
           COALESCE(SUM(price_myr), 0) AS total_myr,
           COALESCE(SUM(price_idr), 0) AS total_idr
         FROM expenses
         WHERE timestamp >= ?
         GROUP BY date
         ORDER BY date ASC`
      )
      .all(thirtyDaysAgoStr);

    res.json({
      monthlyTotal,
      byCategory,
      dailyTrend,
      count: countRow.count,
      topCategory,
    });
  } catch (err) {
    console.error('GET /api/summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/exchange-rate — Current cached exchange rate info ──────────────
router.get('/exchange-rate', async (req, res) => {
  try {
    const info = await getExchangeRateInfo();
    res.json(info);
  } catch (err) {
    console.error('GET /api/exchange-rate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
