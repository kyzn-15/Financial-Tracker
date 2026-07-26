import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';

const DEFAULT_CATEGORIES = [
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

export async function resetAppData() {
  const transaction = await db.transaction('write');

  try {
    await transaction.batch([
      { sql: 'DELETE FROM recurring_expense_occurrences', args: [] },
      { sql: 'DELETE FROM recurring_expense_rules', args: [] },
      { sql: 'DELETE FROM expenses', args: [] },
      { sql: 'DELETE FROM receipts', args: [] },
      { sql: 'DELETE FROM category_automation_settings', args: [] },
      { sql: 'DELETE FROM categories', args: [] },
      { sql: 'DELETE FROM emergency_settings', args: [] },
      { sql: 'DELETE FROM backup_preferences', args: [] },
      { sql: 'DELETE FROM app_metadata', args: [] },
      {
        sql: `DELETE FROM sqlite_sequence
              WHERE name IN ('expenses', 'categories', 'recurring_expense_rules', 'receipts')`,
        args: [],
      },
      ...DEFAULT_CATEGORIES.map((name, index) => ({
        sql: 'INSERT INTO categories (name, sort_order) VALUES (?, ?)',
        args: [name, index + 1],
      })),
      {
        sql: `INSERT INTO category_automation_settings (category_id, enabled, frequency, updated_at)
              SELECT id,
                     CASE WHEN name COLLATE NOCASE IN ('Rent', 'Subscription', 'Insurance') THEN 1 ELSE 0 END,
                     'monthly', ?
              FROM categories`,
        args: [nowUTC8()],
      },
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
