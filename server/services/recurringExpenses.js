import db from '../db/database.js';
import { calculateExpenseAmounts, expenseInsert } from './expenseRecords.js';
import { getNextRecurrenceUTC8, nowUTC8 } from '../utils/datetime.js';

const PROCESS_INTERVAL_MS = 60 * 1000;

function serializeRule(row) {
  return {
    id: Number(row.id),
    name: row.name,
    category: row.category,
    price: Number(row.price),
    currency: row.currency,
    frequency: row.frequency,
    anchor_timestamp: row.anchor_timestamp,
    next_run_at: row.next_run_at,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listRecurringRules() {
  const result = await db.execute({
    sql: `SELECT * FROM recurring_expense_rules
          WHERE status <> 'cancelled'
          ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, next_run_at ASC, id ASC`,
    args: [],
  });
  return result.rows.map(serializeRule);
}

export async function getRecurringRule(id) {
  const result = await db.execute({ sql: 'SELECT * FROM recurring_expense_rules WHERE id = ?', args: [id] });
  return result.rows[0] ? serializeRule(result.rows[0]) : null;
}

export async function updateRecurringRule(id, input) {
  const existing = await getRecurringRule(id);
  if (!existing || existing.status === 'cancelled') return null;
  const updatedAt = nowUTC8();
  const scheduleChanged = input.frequency !== existing.frequency || input.next_run_at !== existing.next_run_at;
  const anchorTimestamp = scheduleChanged ? input.next_run_at : existing.anchor_timestamp;

  await db.execute({
    sql: `UPDATE recurring_expense_rules
          SET name = ?, category = ?, price = ?, currency = ?, frequency = ?, anchor_timestamp = ?, next_run_at = ?, status = ?, updated_at = ?
          WHERE id = ?`,
    args: [input.name, input.category, input.price, input.currency, input.frequency, anchorTimestamp, input.next_run_at, input.status, updatedAt, id],
  });
  return getRecurringRule(id);
}

export async function cancelRecurringRule(id) {
  const existing = await getRecurringRule(id);
  if (!existing) return null;
  await db.execute({
    sql: `UPDATE recurring_expense_rules SET status = 'cancelled', updated_at = ? WHERE id = ?`,
    args: [nowUTC8(), id],
  });
  return { ...existing, status: 'cancelled' };
}

async function occurrenceExists(ruleId, scheduledFor) {
  const result = await db.execute({
    sql: 'SELECT 1 FROM recurring_expense_occurrences WHERE rule_id = ? AND scheduled_for = ?',
    args: [ruleId, scheduledFor],
  });
  return result.rows.length > 0;
}

async function advanceRule(rule, scheduledFor) {
  const nextRunAt = getNextRecurrenceUTC8(rule.anchor_timestamp, scheduledFor, rule.frequency);
  await db.execute({
    sql: 'UPDATE recurring_expense_rules SET next_run_at = ?, updated_at = ? WHERE id = ? AND status = \'active\'',
    args: [nextRunAt, nowUTC8(), rule.id],
  });
  rule.next_run_at = nextRunAt;
}

async function createOccurrence(rule, scheduledFor) {
  if (await occurrenceExists(rule.id, scheduledFor)) {
    await advanceRule(rule, scheduledFor);
    return false;
  }

  const amounts = await calculateExpenseAmounts(rule.price, rule.currency);
  const createdAt = nowUTC8();
  const nextRunAt = getNextRecurrenceUTC8(rule.anchor_timestamp, scheduledFor, rule.frequency);

  try {
    await db.batch([
      expenseInsert(rule.name, rule.category, amounts, rule.currency, scheduledFor),
      {
        sql: `INSERT INTO recurring_expense_occurrences (rule_id, scheduled_for, expense_id, created_at)
              VALUES (?, ?, last_insert_rowid(), ?)`,
        args: [rule.id, scheduledFor, createdAt],
      },
      {
        sql: `UPDATE recurring_expense_rules SET next_run_at = ?, updated_at = ?
              WHERE id = ? AND status = 'active'`,
        args: [nextRunAt, createdAt, rule.id],
      },
    ], 'write');
    rule.next_run_at = nextRunAt;
    return true;
  } catch (err) {
    if (await occurrenceExists(rule.id, scheduledFor)) {
      await advanceRule(rule, scheduledFor);
      return false;
    }
    throw err;
  }
}

export async function processDueRecurringExpenses(cutoff = nowUTC8()) {
  const result = await db.execute({
    sql: `SELECT * FROM recurring_expense_rules WHERE status = 'active' AND next_run_at <= ? ORDER BY next_run_at ASC`,
    args: [cutoff],
  });
  let created = 0;

  for (const row of result.rows) {
    const rule = serializeRule(row);
    while (rule.next_run_at <= cutoff) {
      if (await createOccurrence(rule, rule.next_run_at)) created += 1;
    }
  }
  return created;
}

export function scheduleRecurringExpenses() {
  let isRunning = false;
  const run = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const created = await processDueRecurringExpenses();
      if (created > 0) console.log(`Created ${created} recurring expense occurrence(s)`);
    } catch (err) {
      console.error('Recurring expense processing error:', err.message);
    } finally {
      isRunning = false;
    }
  };

  run();
  const interval = setInterval(run, PROCESS_INTERVAL_MS);
  interval.unref?.();
}
