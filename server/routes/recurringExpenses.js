import { Router } from 'express';
import db from '../db/database.js';
import { RECURRENCE_FREQUENCIES } from '../services/expenseRecords.js';
import { cancelRecurringRule, getRecurringRule, listRecurringRules, updateRecurringRule } from '../services/recurringExpenses.js';
import { normalizeUTC8Timestamp, nowUTC8 } from '../utils/datetime.js';
import { requestUserId } from '../utils/ownership.js';

const router = Router();
const MAX_TEXT_LENGTH = 160;
const MAX_AMOUNT = 1_000_000_000;

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function validateRuleInput(input, userId = null) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const categoryInput = typeof input?.category === 'string' ? input.category.trim() : '';
  const price = Number(input?.price);
  const currency = typeof input?.currency === 'string' ? input.currency.toUpperCase() : '';
  const frequency = input?.frequency;
  const status = input?.status;

  if (!name || name.length > MAX_TEXT_LENGTH || !categoryInput || categoryInput.length > MAX_TEXT_LENGTH) return null;
  if (!Number.isFinite(price) || price <= 0 || price > MAX_AMOUNT) return null;
  if (!['MYR', 'IDR'].includes(currency) || !RECURRENCE_FREQUENCIES.includes(frequency) || !['active', 'paused'].includes(status)) return null;

  let nextRunAt;
  try {
    nextRunAt = normalizeUTC8Timestamp(input.next_run_at);
  } catch {
    return null;
  }
  if (status === 'active' && Date.parse(nextRunAt) <= Date.parse(nowUTC8())) return null;

  const categoryResult = await db.execute({
    sql: `SELECT name FROM categories WHERE name = ? COLLATE NOCASE${userId == null ? '' : ' AND user_id = ?'}`,
    args: userId == null ? [categoryInput] : [categoryInput, userId],
  });
  const category = categoryResult.rows[0]?.name;
  return category ? { name, category, price, currency, frequency, next_run_at: nextRunAt, status } : null;
}

router.get('/', async (req, res) => {
  try {
    return res.json(await listRecurringRules(requestUserId(req)));
  } catch (err) {
    console.error('GET /api/recurring-expenses error:', err);
    return res.status(500).json({ error: 'Failed to load recurring payments.' });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid recurring payment id.' });

  try {
    const userId = requestUserId(req);
    if (!await getRecurringRule(id, userId)) return res.status(404).json({ error: 'Recurring payment not found.' });
    const input = await validateRuleInput(req.body, userId);
    if (!input) return res.status(400).json({ error: 'Invalid recurring payment details. Active payments need a future next date.' });
    return res.json(await updateRecurringRule(id, input, userId));
  } catch (err) {
    console.error('PUT /api/recurring-expenses/:id error:', err);
    return res.status(500).json({ error: 'Failed to update recurring payment.' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid recurring payment id.' });

  try {
    const cancelled = await cancelRecurringRule(id, requestUserId(req));
    if (!cancelled) return res.status(404).json({ error: 'Recurring payment not found.' });
    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/recurring-expenses/:id error:', err);
    return res.status(500).json({ error: 'Failed to cancel recurring payment.' });
  }
});

export default router;
