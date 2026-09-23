// summary.js — Express Router for summary and exchange-rate endpoints
import { Router } from 'express';
import db from '../db/database.js';
import { getExchangeRateInfo } from '../services/exchangeRate.js';
import { getMonthRangeUTC8, getUTC8Date, subtractDaysUTC8 } from '../utils/datetime.js';
import { requestUserId } from '../utils/ownership.js';

const router = Router();

// ——— GET /api/summary — Dashboard aggregates ———————————————————————————
router.get('/summary', async (req, res) => {
  try {
    const userId = requestUserId(req);
    const ownerSql = userId == null ? '' : ' AND user_id = ?';
    const withOwner = (args) => (userId == null ? args : [...args, userId]);
    const referenceDate = getUTC8Date();
    const currentMonth = getMonthRangeUTC8(referenceDate);
    const previousMonth = getMonthRangeUTC8(referenceDate, -1);
    const trendStart = `${subtractDaysUTC8(referenceDate, 29)}T00:00:00+08:00`;
    const heatmapStart = `${subtractDaysUTC8(referenceDate, 364)}T00:00:00+08:00`;

    const [
      monthlyTotalResult,
      allTimeTotalResult,
      countResult,
      byCategoryResult,
      previousMonthTotalResult,
      categoryComparisonResult,
      largestPurchaseResult,
      weekdaySpendingResult,
      dailyTrendResult,
      heatmapResult,
    ] = await Promise.all([
      db.execute({
        sql: `SELECT COALESCE(SUM(price_myr), 0) AS myr, COALESCE(SUM(price_idr), 0) AS idr
              FROM expenses
              WHERE deleted_at IS NULL AND timestamp >= ? AND timestamp < ?${ownerSql}`,
        args: withOwner([currentMonth.start, currentMonth.end]),
      }),
      db.execute({
        sql: `SELECT COALESCE(SUM(price_myr), 0) AS myr, COALESCE(SUM(price_idr), 0) AS idr
              FROM expenses
              WHERE deleted_at IS NULL${ownerSql}`,
        args: withOwner([]),
      }),
      db.execute({
        sql: `SELECT COUNT(*) AS count
              FROM expenses
              WHERE deleted_at IS NULL AND timestamp >= ? AND timestamp < ?${ownerSql}`,
        args: withOwner([currentMonth.start, currentMonth.end]),
      }),
      db.execute({
        sql: `SELECT category,
                     COALESCE(SUM(price_myr), 0) AS total_myr,
                     COALESCE(SUM(price_idr), 0) AS total_idr
              FROM expenses
              WHERE deleted_at IS NULL AND timestamp >= ? AND timestamp < ?${ownerSql}
              GROUP BY category
              ORDER BY total_myr DESC`,
        args: withOwner([currentMonth.start, currentMonth.end]),
      }),
      db.execute({
        sql: `SELECT COALESCE(SUM(price_myr), 0) AS myr, COALESCE(SUM(price_idr), 0) AS idr
              FROM expenses
              WHERE deleted_at IS NULL AND timestamp >= ? AND timestamp < ?${ownerSql}`,
        args: withOwner([previousMonth.start, previousMonth.end]),
      }),
      db.execute({
        sql: `SELECT category,
                     COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN price_myr ELSE 0 END), 0) AS current_myr,
                     COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN price_idr ELSE 0 END), 0) AS current_idr,
                     COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN price_myr ELSE 0 END), 0) AS previous_myr,
                     COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN price_idr ELSE 0 END), 0) AS previous_idr
              FROM expenses
              WHERE deleted_at IS NULL AND ((timestamp >= ? AND timestamp < ?) OR (timestamp >= ? AND timestamp < ?))${ownerSql}
              GROUP BY category`,
        args: withOwner([
          currentMonth.start,
          currentMonth.end,
          currentMonth.start,
          currentMonth.end,
          previousMonth.start,
          previousMonth.end,
          previousMonth.start,
          previousMonth.end,
          currentMonth.start,
          currentMonth.end,
          previousMonth.start,
          previousMonth.end,
        ]),
      }),
      db.execute({
        sql: `SELECT id, name, category, price_myr, price_idr, timestamp
              FROM expenses
              WHERE deleted_at IS NULL${ownerSql}
              ORDER BY COALESCE(price_myr, 0) DESC, id DESC
              LIMIT 1`,
        args: withOwner([]),
      }),
      db.execute({
        sql: `WITH daily_totals AS (
                SELECT strftime('%w', substr(timestamp, 1, 10)) AS weekday,
                       substr(timestamp, 1, 10) AS date,
                       COALESCE(SUM(price_myr), 0) AS total_myr,
                       COALESCE(SUM(price_idr), 0) AS total_idr
                FROM expenses
                WHERE deleted_at IS NULL${ownerSql}
                GROUP BY weekday, date
              )
              SELECT weekday,
                     AVG(total_myr) AS average_myr,
                     AVG(total_idr) AS average_idr,
                     COUNT(*) AS active_days
              FROM daily_totals
              GROUP BY weekday`,
        args: withOwner([]),
      }),
      db.execute({
        sql: `SELECT substr(timestamp, 1, 10) AS date,
                     COALESCE(SUM(price_myr), 0) AS total_myr,
                     COALESCE(SUM(price_idr), 0) AS total_idr,
                     COUNT(*) AS transaction_count
              FROM expenses
              WHERE deleted_at IS NULL AND timestamp >= ?${ownerSql}
              GROUP BY date
              ORDER BY date ASC`,
        args: withOwner([trendStart]),
      }),
      db.execute({
        sql: `SELECT substr(timestamp, 1, 10) AS date,
                     COALESCE(SUM(price_myr), 0) AS total_myr,
                     COALESCE(SUM(price_idr), 0) AS total_idr,
                     COUNT(*) AS transaction_count
              FROM expenses
              WHERE deleted_at IS NULL AND timestamp >= ?${ownerSql}
              GROUP BY date
              ORDER BY date ASC`,
        args: withOwner([heatmapStart]),
      }),
    ]);

    const monthlyTotal = monthlyTotalResult.rows[0];
    const allTimeTotal = allTimeTotalResult.rows[0];
    const countRow = countResult.rows[0];
    const byCategory = byCategoryResult.rows;
    const previousMonthTotal = previousMonthTotalResult.rows[0];
    const categoryComparison = categoryComparisonResult.rows;
    const largestPurchase = largestPurchaseResult.rows[0];
    const weekdaySpending = weekdaySpendingResult.rows;
    const dailyTrend = dailyTrendResult.rows;
    const heatmap = heatmapResult.rows;

    res.json({
      monthlyTotal,
      allTimeTotal,
      byCategory,
      dailyTrend,
      count: Number(countRow.count),
      topCategory: byCategory.length > 0 ? byCategory[0].category : null,
      referenceDate,
      monthlyComparison: {
        current: monthlyTotal,
        previous: previousMonthTotal,
      },
      categoryComparison,
      largestPurchase: largestPurchase || null,
      weekdaySpending,
      heatmap,
    });
  } catch (err) {
    console.error('GET /api/summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ——— GET /api/exchange-rate — Current cached exchange rate info ——————————
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
