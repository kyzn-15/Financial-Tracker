import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = pathToFileURL(
  path.join(tmpdir(), `financial-tracker-reset-${randomUUID()}.db`)
).href;
delete process.env.TURSO_AUTH_TOKEN;

const { default: db, initSchema, seedIfEmpty } = await import('../db/database.js');
const { resetAppData } = await import('../services/appReset.js');
const { consumeResetIntent, createResetIntent } = await import('../services/resetIntent.js');
const {
  discardStagedReceiptFiles,
  stageReceiptFilesForReset,
} = await import('../services/receiptCleanup.js');
const { RECEIPTS_UPLOAD_DIR, resolveReceiptFilePath } = await import('../utils/receiptFiles.js');

test('reset intent is delayed, session-bound, and single-use', () => {
  const now = 1_000_000;
  const intent = createResetIntent('session-one', now);

  assert.equal(consumeResetIntent('session-two', intent.token, now + 10_000), 'invalid');
  assert.equal(consumeResetIntent('session-one', intent.token, now + 9_999), 'too_early');
  assert.equal(consumeResetIntent('session-one', intent.token, now + 10_000), 'ready');
  assert.equal(consumeResetIntent('session-one', intent.token, now + 10_000), 'invalid');
});

test('reset removes user data and restores only clean defaults', async () => {
  await initSchema();

  // A receipt file on disk (active receipt) must not survive the reset either.
  const activeReceiptFilename = `${randomUUID()}.jpg`;
  writeFileSync(resolveReceiptFilePath(activeReceiptFilename), 'reset-test-image');

  await db.batch([
    { sql: "INSERT INTO categories (name, sort_order) VALUES ('Custom', 99)", args: [] },
    { sql: "INSERT INTO expense_folders (name) VALUES ('malaysian traveling trip')", args: [] },
    {
      sql: `INSERT INTO expenses
            (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp, folder_id)
            VALUES ('Private expense', 'Custom', 10, 40000, 'MYR', 4000, '2026-01-01T00:00:00+08:00', 1)`,
      args: [],
    },
    {
      // Recycle Bin data must be permanently destroyed by reset, never kept recoverable.
      sql: `INSERT INTO expenses
            (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp, deleted_at)
            VALUES ('Recycled expense', 'Custom', 5, 20000, 'MYR', 4000, '2026-01-01T00:00:00+08:00',
                    '2026-01-02T00:00:00+08:00')`,
      args: [],
    },
    {
      sql: `INSERT INTO recurring_expense_rules
            (anchor_expense_id, name, category, price, currency, frequency, anchor_timestamp, next_run_at, status, created_at, updated_at)
            VALUES (1, 'Private expense', 'Custom', 10, 'MYR', 'monthly', '2026-01-01T00:00:00+08:00',
                    '2026-02-01T00:00:00+08:00', 'active', '2026-01-01T00:00:00+08:00', '2026-01-01T00:00:00+08:00')`,
      args: [],
    },
    {
      sql: `INSERT INTO recurring_expense_occurrences (rule_id, scheduled_for, expense_id, created_at)
            VALUES (1, '2026-01-01T00:00:00+08:00', 1, '2026-01-01T00:00:00+08:00')`,
      args: [],
    },
    {
      sql: `INSERT INTO receipts (filename, mime_type, uploaded_at, expires_at)
            VALUES ('${activeReceiptFilename}', 'image/jpeg',
                    '2026-01-01T00:00:00+08:00', '2026-01-08T00:00:00+08:00')`,
      args: [],
    },
    {
      sql: `INSERT INTO receipts (filename, mime_type, uploaded_at, expires_at, deleted_at)
            VALUES ('123e4567-e89b-42d3-a456-426614174000.jpg', 'image/jpeg',
                    '2026-01-01T00:00:00+08:00', '2026-01-08T00:00:00+08:00', '2026-01-02T00:00:00+08:00')`,
      args: [],
    },
    {
      sql: `INSERT INTO emergency_settings
            (id, current_savings_myr, reserved_funds_myr, target_months, essential_categories, updated_at)
            VALUES (1, 500, 100, 6, '["Custom"]', '2026-01-01T00:00:00+08:00')`,
      args: [],
    },
    {
      sql: `INSERT INTO backup_preferences
            (username, reminder_interval_days, last_backup_at, updated_at)
            VALUES ('admin', 14, '2026-01-01T00:00:00+08:00', '2026-01-01T00:00:00+08:00')`,
      args: [],
    },
    {
      sql: `INSERT OR REPLACE INTO app_metadata (key, value)
            VALUES ('active_session_id', 'private-session')`,
      args: [],
    },
  ], 'write');

  // Follow the exact reset route sequence: stage receipt files, wipe the
  // database, then permanently discard the staged files.
  const stagedDir = stageReceiptFilesForReset();
  await resetAppData();
  discardStagedReceiptFiles(stagedDir);

  for (const table of [
    'expenses',
    'expense_folders',
    'receipts',
    'recurring_expense_rules',
    'recurring_expense_occurrences',
    'emergency_settings',
    'backup_preferences',
  ]) {
    const result = await db.execute(`SELECT COUNT(*) AS count FROM ${table}`);
    assert.equal(Number(result.rows[0].count), 0, table);
  }

  // Recycle Bin is empty after reset: nothing soft-deleted remains recoverable.
  const recycledExpenses = await db.execute('SELECT COUNT(*) AS count FROM expenses WHERE deleted_at IS NOT NULL');
  assert.equal(Number(recycledExpenses.rows[0].count), 0);
  const recycledReceipts = await db.execute('SELECT COUNT(*) AS count FROM receipts WHERE deleted_at IS NOT NULL');
  assert.equal(Number(recycledReceipts.rows[0].count), 0);

  assert.equal(existsSync(resolveReceiptFilePath(activeReceiptFilename)), false, 'receipt file removed');
  assert.equal(existsSync(RECEIPTS_UPLOAD_DIR), true, 'uploads directory recreated');

  const categories = await db.execute('SELECT id, name FROM categories ORDER BY id');
  assert.equal(categories.rows.length, 16);
  assert.equal(categories.rows[0].id, 1);
  assert.equal(categories.rows.some((category) => category.name === 'Custom'), false);

  const metadata = await db.execute('SELECT key FROM app_metadata ORDER BY key');
  assert.deepEqual(metadata.rows.map((row) => row.key), ['categories_v1_migrated', 'sample_data_seeded_v1']);

  await seedIfEmpty();
  const expenses = await db.execute('SELECT COUNT(*) AS count FROM expenses');
  assert.equal(Number(expenses.rows[0].count), 0);
});

after(() => db.close());
