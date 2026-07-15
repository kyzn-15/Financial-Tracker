import assert from 'node:assert/strict';
import { after, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = new URL('../db/dashboard-analytics.test.db', import.meta.url).href;
delete process.env.TURSO_AUTH_TOKEN;

const { default: db, initSchema } = await import('../db/database.js');
const { getMonthRangeUTC8, getUTC8Date, subtractDaysUTC8 } = await import('../utils/datetime.js');

const TEST_EXCHANGE_RATE = 4000;

function timestampForDate(date) {
  return `${date}T12:00:00+08:00`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function createExpense(name, category, amount, date) {
  return {
    name,
    category,
    priceMyr: amount,
    priceIdr: amount * TEST_EXCHANGE_RATE,
    timestamp: timestampForDate(date),
  };
}

async function seedDashboardAnalytics(database) {
  const referenceDate = getUTC8Date();
  const currentMonth = getMonthRangeUTC8(referenceDate);
  const previousMonth = getMonthRangeUTC8(referenceDate, -1);
  const currentMonthDate = currentMonth.start.slice(0, 10);
  const previousMonthDate = previousMonth.start.slice(0, 10);
  const expenses = [
    createExpense('Weekly groceries', 'Grocery', 180, addDays(currentMonthDate, 1)),
    createExpense('Friday dinner', 'Food', 240, addDays(currentMonthDate, 4)),
    createExpense('Food delivery', 'Food', 320, addDays(currentMonthDate, 11)),
    createExpense('Fuel', 'Transport', 180, addDays(currentMonthDate, 8)),
    createExpense('Concert tickets', 'Entertainment', 300, addDays(currentMonthDate, 14)),
    createExpense('Health check-up', 'Health/Medical', 240, addDays(currentMonthDate, 18)),
    createExpense('Streaming subscription', 'Subscription', 80, addDays(currentMonthDate, 21)),
    createExpense('Previous month groceries', 'Grocery', 140, addDays(previousMonthDate, 2)),
    createExpense('Previous month dining', 'Food', 320, addDays(previousMonthDate, 9)),
    createExpense('Previous month fuel', 'Transport', 90, addDays(previousMonthDate, 16)),
    createExpense('Laptop', 'Education', 4200, subtractDaysUTC8(referenceDate, 145)),
  ];

  for (let offset = 30; offset <= 350; offset += 16) {
    expenses.push(createExpense(
      `Historical expense ${offset}`,
      'Other Expenses',
      35 + (offset % 90),
      subtractDaysUTC8(referenceDate, offset)
    ));
  }

  await database.batch([
    { sql: 'DELETE FROM expenses', args: [] },
    ...expenses.map((expense) => ({
      sql: `INSERT INTO expenses (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp)
            VALUES (?, ?, ?, ?, 'MYR', ?, ?)`,
      args: [
        expense.name,
        expense.category,
        expense.priceMyr,
        expense.priceIdr,
        TEST_EXCHANGE_RATE,
        expense.timestamp,
      ],
    })),
  ], 'write');

  return expenses;
}

await initSchema();

test('seeds isolated dummy data for every dashboard analytics section', async () => {
  const expenses = await seedDashboardAnalytics(db);
  const referenceDate = getUTC8Date();
  const currentMonth = getMonthRangeUTC8(referenceDate);
  const previousMonth = getMonthRangeUTC8(referenceDate, -1);
  const [currentCountResult, previousFoodResult, largestPurchaseResult, heatmapDaysResult] = await Promise.all([
    db.execute({
      sql: 'SELECT COUNT(*) AS count FROM expenses WHERE timestamp >= ? AND timestamp < ?',
      args: [currentMonth.start, currentMonth.end],
    }),
    db.execute({
      sql: `SELECT COALESCE(SUM(price_myr), 0) AS total FROM expenses
            WHERE category = 'Food' AND timestamp >= ? AND timestamp < ?`,
      args: [previousMonth.start, previousMonth.end],
    }),
    db.execute({
      sql: 'SELECT name, price_myr FROM expenses ORDER BY price_myr DESC LIMIT 1',
      args: [],
    }),
    db.execute({
      sql: `SELECT COUNT(DISTINCT substr(timestamp, 1, 10)) AS count FROM expenses
            WHERE timestamp >= ?`,
      args: [`${subtractDaysUTC8(referenceDate, 364)}T00:00:00+08:00`],
    }),
  ]);
  const currentCount = Number(currentCountResult.rows[0].count);
  const previousFood = Number(previousFoodResult.rows[0].total);
  const largestPurchase = largestPurchaseResult.rows[0];
  const heatmapDays = Number(heatmapDaysResult.rows[0].count);

  assert.equal(expenses.length > 25, true);
  assert.equal(currentCount > 0, true);
  assert.equal(previousFood, 320);
  assert.equal(largestPurchase.name, 'Laptop');
  assert.equal(largestPurchase.price_myr, 4200);
  assert.equal(heatmapDays > 12, true);
});

after(() => {
  db.close();
});
