import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';
import { LAST_EXCHANGE_RATE_FETCHED_AT_KEY, LAST_EXCHANGE_RATE_KEY } from './exchangeRate.js';

export const DEFAULT_CATEGORIES = [
  'Grocery',
  'Food',
  'Non-Primary Expenses',
  'Other Expenses',
  'Entertainment',
  'Education',
  'Subscription',
  'Transport',
  'Rent',
  'Utilities',
  'Health/Medical',
  'Phone',
  'Insurance',
  'Medicine',
  'Savings/Investment',
  'Others',
];

export function defaultCategoryStatements(userId, timestamp) {
  const categories = DEFAULT_CATEGORIES.map((name, index) => (
    userId == null
      ? {
          sql: 'INSERT INTO categories (name, sort_order) VALUES (?, ?)',
          args: [name, index + 1],
        }
      : {
          sql: 'INSERT INTO categories (user_id, name, sort_order) VALUES (?, ?, ?)',
          args: [userId, name, index + 1],
        }
  ));
  return [
    ...categories,
    {
      sql: `INSERT INTO category_automation_settings (category_id, enabled, frequency, updated_at)
            SELECT id,
                   CASE WHEN name COLLATE NOCASE IN ('Rent', 'Subscription', 'Insurance') THEN 1 ELSE 0 END,
                   'monthly', ?
            FROM categories
            ${userId == null ? '' : 'WHERE user_id = ?'}`,
      args: userId == null ? [timestamp] : [timestamp, userId],
    },
  ];
}

async function resetAccountData(userId) {
  const transaction = await db.transaction('write');
  try {
    await transaction.batch([
      {
        sql: `DELETE FROM recurring_expense_occurrences
              WHERE expense_id IN (SELECT id FROM expenses WHERE user_id = ?)
                 OR rule_id IN (SELECT id FROM recurring_expense_rules WHERE user_id = ?)`,
        args: [userId, userId],
      },
      { sql: 'DELETE FROM recurring_expense_rules WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM expenses WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM expense_folders WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM receipts WHERE user_id = ?', args: [userId] },
      {
        sql: `DELETE FROM category_automation_settings
              WHERE category_id IN (SELECT id FROM categories WHERE user_id = ?)`,
        args: [userId],
      },
      { sql: 'DELETE FROM categories WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM emergency_settings WHERE user_id = ?', args: [userId] },
      {
        sql: `DELETE FROM backup_preferences
              WHERE username = (SELECT username FROM accounts WHERE id = ?)`,
        args: [userId],
      },
      ...defaultCategoryStatements(userId, nowUTC8()),
    ]);
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) await transaction.rollback().catch(() => {});
    throw error;
  } finally {
    if (!transaction.closed) transaction.close();
  }
}

export async function resetAppData(userId = null) {
  if (userId != null) {
    await resetAccountData(userId);
    return;
  }

  const transaction = await db.transaction('write');

  try {
    await transaction.batch([
      { sql: 'DELETE FROM recurring_expense_occurrences', args: [] },
      { sql: 'DELETE FROM recurring_expense_rules', args: [] },
      { sql: 'DELETE FROM expenses', args: [] },
      { sql: 'DELETE FROM expense_folders', args: [] },
      { sql: 'DELETE FROM receipts', args: [] },
      { sql: 'DELETE FROM category_automation_settings', args: [] },
      { sql: 'DELETE FROM categories', args: [] },
      { sql: 'DELETE FROM emergency_settings', args: [] },
      { sql: 'DELETE FROM backup_preferences', args: [] },
      {
        sql: 'DELETE FROM app_metadata WHERE key NOT IN (?, ?)',
        args: [LAST_EXCHANGE_RATE_KEY, LAST_EXCHANGE_RATE_FETCHED_AT_KEY],
      },
      {
        sql: `DELETE FROM sqlite_sequence
              WHERE name IN ('expenses', 'categories', 'recurring_expense_rules', 'receipts', 'expense_folders')`,
        args: [],
      },
      ...defaultCategoryStatements(null, nowUTC8()),
      {
        sql: `INSERT INTO app_metadata (key, value)
              VALUES ('categories_v1_migrated', 'complete'), ('sample_data_seeded_v1', 'complete')`,
        args: [],
      },
    ]);
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) await transaction.rollback().catch(() => {});
    throw error;
  } finally {
    if (!transaction.closed) transaction.close();
  }
}
