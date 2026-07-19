import db from '../db/database.js';
import { getExchangeRate } from './exchangeRate.js';
import { getNextRecurrenceUTC8, normalizeUTC8Timestamp, nowUTC8 } from '../utils/datetime.js';

export const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly'];

export async function calculateExpenseAmounts(price, currency) {
  const rate = await getExchangeRate();
  const exchangeRateUsed = rate.myrToIdr;

  return currency === 'MYR'
    ? { priceMyr: price, priceIdr: price * exchangeRateUsed, exchangeRateUsed }
    : { priceMyr: price * rate.idrToMyr, priceIdr: price, exchangeRateUsed };
}

export function expenseInsert(name, category, amounts, currency, timestamp) {
  return {
    sql: `INSERT INTO expenses (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [name, category, amounts.priceMyr, amounts.priceIdr, currency, amounts.exchangeRateUsed, timestamp],
  };
}

export async function getExpenseRecord(id) {
  const result = await db.execute({
    sql: `SELECT expenses.*,
                 recurring_expense_occurrences.rule_id AS recurring_rule_id,
                 recurring_expense_occurrences.scheduled_for AS recurrence_scheduled_for
          FROM expenses
          LEFT JOIN recurring_expense_occurrences ON recurring_expense_occurrences.expense_id = expenses.id
          WHERE expenses.id = ?`,
    args: [id],
  });
  return result.rows[0] || null;
}

export async function createExpenseRecord(input, recurrence = { enabled: false }) {
  const timestamp = normalizeUTC8Timestamp(input.timestamp || nowUTC8());
  const amounts = await calculateExpenseAmounts(input.price, input.currency);

  if (!recurrence.enabled) {
    const result = await db.execute(expenseInsert(input.name, input.category, amounts, input.currency, timestamp));
    return getExpenseRecord(result.lastInsertRowid);
  }

  const createdAt = nowUTC8();
  const nextRunAt = getNextRecurrenceUTC8(timestamp, timestamp, recurrence.frequency);
  const results = await db.batch([
    expenseInsert(input.name, input.category, amounts, input.currency, timestamp),
    {
      sql: `INSERT INTO recurring_expense_rules
              (anchor_expense_id, name, category, price, currency, frequency, anchor_timestamp, next_run_at, status, created_at, updated_at)
            VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      args: [input.name, input.category, input.price, input.currency, recurrence.frequency, timestamp, nextRunAt, createdAt, createdAt],
    },
    {
      sql: `INSERT INTO recurring_expense_occurrences (rule_id, scheduled_for, expense_id, created_at)
            SELECT id, ?, anchor_expense_id, ? FROM recurring_expense_rules WHERE id = last_insert_rowid()`,
      args: [timestamp, createdAt],
    },
  ], 'write');

  return getExpenseRecord(results[0].lastInsertRowid);
}
