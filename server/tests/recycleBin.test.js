import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

// The Recycle Bin suite runs against an isolated temporary database and an
// in-process Express app built from the real routers (no auth middleware),
// mirroring how the other suites exercise services directly.
const databasePath = path.join(tmpdir(), `financial-tracker-recycle-${randomUUID()}.db`);
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = pathToFileURL(databasePath).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.EXCHANGE_RATE_API_URL = 'http://localhost.invalid/exchange-rate';

const { default: db, initSchema } = await import('../db/database.js');
const express = (await import('express')).default;
const expensesRouter = (await import('../routes/expenses.js')).default;
const receiptsRouter = (await import('../routes/receipts.js')).default;
const summaryRouter = (await import('../routes/summary.js')).default;
const recycleBinRouter = (await import('../routes/recycleBin.js')).default;
const {
  emptyRecycleBin,
  listRecycleBin,
  purgeExpense,
  purgeExpiredRecycleBinItems,
  restoreReceipt,
  softDeleteExpense,
  softDeleteReceipt,
} = await import('../services/recycleBin.js');
const { purgeExpiredReceipts } = await import('../services/receiptCleanup.js');
const { resolveReceiptFilePath } = await import('../utils/receiptFiles.js');
const { addDaysUTC8, getUTC8Date } = await import('../utils/datetime.js');

const TEST_EXCHANGE_RATE = 4000;
const PNG_ONE_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function currentMonthTimestamp(dayOffset = 0) {
  const date = new Date(`${getUTC8Date()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return `${date.toISOString().slice(0, 10)}T10:00:00+08:00`;
}

async function insertExpense({ name = 'Coffee', category = 'Food', priceMyr = 12.5, timestamp } = {}) {
  const result = await db.execute({
    sql: `INSERT INTO expenses
          (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp)
          VALUES (?, ?, ?, ?, 'MYR', ?, ?)`,
    args: [name, category, priceMyr, priceMyr * TEST_EXCHANGE_RATE, TEST_EXCHANGE_RATE, timestamp ?? currentMonthTimestamp()],
  });
  return Number(result.lastInsertRowid);
}

async function getReceiptFilename(receiptId) {
  const result = await db.execute({ sql: 'SELECT filename FROM receipts WHERE id = ?', args: [receiptId] });
  return result.rows[0]?.filename ?? null;
}

async function insertReceiptRow({ daysUntilExpiry = 5, deletedAt = null } = {}) {
  const filename = `${randomUUID()}.png`;
  const uploadedAt = addDaysUTC8(new Date(), -2);
  const expiresAt = addDaysUTC8(new Date(), daysUntilExpiry);
  const result = deletedAt == null
    ? await db.execute({
        sql: `INSERT INTO receipts (filename, mime_type, uploaded_at, expires_at)
              VALUES (?, 'image/png', ?, ?)`,
        args: [filename, uploadedAt, expiresAt],
      })
    : await db.execute({
        sql: `INSERT INTO receipts (filename, mime_type, uploaded_at, expires_at, deleted_at)
              VALUES (?, 'image/png', ?, ?, ?)`,
        args: [filename, uploadedAt, expiresAt, deletedAt],
      });
  return { id: Number(result.lastInsertRowid), filename };
}

function writeReceiptFile(filename) {
  const filePath = resolveReceiptFilePath(filename);
  writeFileSync(filePath, PNG_ONE_PIXEL);
  return filePath;
}

// ─── HTTP harness ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/expenses', expensesRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api', summaryRouter);
app.use('/api/recycle-bin', recycleBinRouter);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

async function getJson(pathname) {
  const response = await fetch(`${base}${pathname}`);
  assert.equal(response.status, 200, pathname);
  return response.json();
}

async function clearLifecycleData() {
  await db.batch([
    { sql: 'DELETE FROM recurring_expense_occurrences', args: [] },
    { sql: 'DELETE FROM recurring_expense_rules', args: [] },
    { sql: 'DELETE FROM expenses', args: [] },
    { sql: 'DELETE FROM receipts', args: [] },
  ], 'write');
}

// ─── Migration: pre-Recycle-Bin databases gain deleted_at safely ────────────

test('schema migration adds deleted_at to an existing database without data loss', async () => {
  // Build tables using the pre-migration schema shape.
  await db.executeMultiple(`
    CREATE TABLE expenses (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      name                TEXT NOT NULL,
      category            TEXT NOT NULL,
      price_myr           REAL,
      price_idr           REAL,
      original_currency   TEXT NOT NULL CHECK(original_currency IN ('MYR','IDR')),
      exchange_rate_used  REAL,
      timestamp           TEXT NOT NULL,
      created_at          TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
    );
    CREATE TABLE receipts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      filename     TEXT NOT NULL,
      mime_type    TEXT NOT NULL,
      uploaded_at  TEXT NOT NULL,
      expires_at   TEXT NOT NULL
    );
  `);

  const legacyExpenseId = await insertExpense({ name: 'Legacy expense' });
  const legacyReceipt = await insertReceiptRow();

  await initSchema();

  const expenseColumns = await db.execute('PRAGMA table_info(expenses)');
  const receiptColumns = await db.execute('PRAGMA table_info(receipts)');
  assert.equal(expenseColumns.rows.some((column) => column.name === 'deleted_at'), true);
  assert.equal(receiptColumns.rows.some((column) => column.name === 'deleted_at'), true);

  const preservedExpense = await db.execute({ sql: 'SELECT name FROM expenses WHERE id = ?', args: [legacyExpenseId] });
  assert.equal(preservedExpense.rows[0].name, 'Legacy expense');
  const preservedReceipt = await db.execute({ sql: 'SELECT filename FROM receipts WHERE id = ?', args: [legacyReceipt.id] });
  assert.equal(preservedReceipt.rows[0].filename, legacyReceipt.filename);

  // Re-running initialization stays idempotent.
  await initSchema();
});

// ─── Expense lifecycle ───────────────────────────────────────────────────────

test('deleting an expense moves it to the Recycle Bin and hides it from active views', async () => {
  await clearLifecycleData();
  const id = await insertExpense({ name: 'Recyclable coffee', priceMyr: 12.5 });

  let history = await getJson('/api/expenses');
  assert.equal(history.some((expense) => expense.id === id), true);
  let summary = await getJson('/api/summary');
  assert.equal(summary.count, 1);
  assert.equal(Number(summary.monthlyTotal.myr), 12.5);

  const deleteResponse = await fetch(`${base}/api/expenses/${id}`, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 204);

  history = await getJson('/api/expenses');
  assert.equal(history.some((expense) => expense.id === id), false);

  summary = await getJson('/api/summary');
  assert.equal(summary.count, 0);
  assert.equal(Number(summary.monthlyTotal.myr), 0);
  assert.equal(summary.largestPurchase, null);

  const bin = await getJson('/api/recycle-bin');
  assert.equal(bin.retention_days, 7);
  const binned = bin.expenses.find((expense) => expense.id === id);
  assert.equal(binned?.name, 'Recyclable coffee');
  assert.equal(binned?.category, 'Food');
  assert.ok(binned?.deleted_at);
  assert.ok(Date.parse(binned.expires_at) > Date.parse(binned.deleted_at));

  const databaseRow = await db.execute({ sql: 'SELECT deleted_at FROM expenses WHERE id = ?', args: [id] });
  assert.ok(databaseRow.rows[0].deleted_at, 'soft-deleted row stays in the database');

  // Duplicate delete requests report the item as gone from active data.
  const duplicateResponse = await fetch(`${base}/api/expenses/${id}`, { method: 'DELETE' });
  assert.equal(duplicateResponse.status, 404);
});

test('updating a soft-deleted expense is rejected', async () => {
  const id = await insertExpense();
  assert.equal(await softDeleteExpense(id), true);

  const response = await fetch(`${base}/api/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Renamed', category: 'Food', price: 1, currency: 'MYR', timestamp: '' }),
  });
  assert.equal(response.status, 404);
  await purgeExpense(id);
});

test('restoring an expense makes it immediately active again', async () => {
  const id = await insertExpense({ name: 'Restore me' });
  assert.equal(await softDeleteExpense(id), true);

  const restoreResponse = await fetch(`${base}/api/recycle-bin/expenses/${id}/restore`, { method: 'POST' });
  assert.equal(restoreResponse.status, 200);

  const history = await getJson('/api/expenses');
  assert.equal(history.some((expense) => expense.id === id), true);
  const summary = await getJson('/api/summary');
  assert.equal(summary.count, 1);

  const bin = await getJson('/api/recycle-bin');
  assert.equal(bin.expenses.some((expense) => expense.id === id), false);

  // Duplicate restore requests report the item as no longer recycled.
  const duplicateRestore = await fetch(`${base}/api/recycle-bin/expenses/${id}/restore`, { method: 'POST' });
  assert.equal(duplicateRestore.status, 404);

  assert.equal(await softDeleteExpense(id), true);
  await purgeExpense(id);
});

test('permanent deletion of a recycled expense removes every trace and releases its recurrence link', async () => {
  const id = await insertExpense({ name: 'Automated payment' });
  const anchorTimestamp = currentMonthTimestamp(-30);
  const ruleResult = await db.execute({
    sql: `INSERT INTO recurring_expense_rules
          (anchor_expense_id, name, category, price, currency, frequency, anchor_timestamp, next_run_at, status, created_at, updated_at)
          VALUES (?, 'Automated payment', 'Food', 12.5, 'MYR', 'monthly', ?, ?, 'active', ?, ?)`,
    args: [id, anchorTimestamp, currentMonthTimestamp(1), anchorTimestamp, anchorTimestamp],
  });
  const ruleId = Number(ruleResult.lastInsertRowid);
  await db.execute({
    sql: `INSERT INTO recurring_expense_occurrences (rule_id, scheduled_for, expense_id, created_at)
          VALUES (?, ?, ?, ?)`,
    args: [ruleId, anchorTimestamp, id, anchorTimestamp],
  });

  assert.equal(await softDeleteExpense(id), true);

  // While recoverable, deleting a generated expense never cancels its rule.
  const rulesWhileDeleted = await db.execute({ sql: 'SELECT status FROM recurring_expense_rules WHERE id = ?', args: [ruleId] });
  assert.equal(rulesWhileDeleted.rows[0].status, 'active');

  const purgeResponse = await fetch(`${base}/api/recycle-bin/expenses/${id}`, { method: 'DELETE' });
  assert.equal(purgeResponse.status, 204);

  const expenseCount = await db.execute({ sql: 'SELECT COUNT(*) AS count FROM expenses WHERE id = ?', args: [id] });
  assert.equal(Number(expenseCount.rows[0].count), 0);
  const occurrences = await db.execute({ sql: 'SELECT COUNT(*) AS count FROM recurring_expense_occurrences WHERE expense_id = ?', args: [id] });
  assert.equal(Number(occurrences.rows[0].count), 0);
  const rule = await db.execute({ sql: 'SELECT anchor_expense_id, status FROM recurring_expense_rules WHERE id = ?', args: [ruleId] });
  assert.equal(rule.rows[0].status, 'active', 'the recurring rule survives');
  assert.equal(rule.rows[0].anchor_expense_id, null, 'the rule anchor is released');

  const duplicatePurge = await fetch(`${base}/api/recycle-bin/expenses/${id}`, { method: 'DELETE' });
  assert.equal(duplicatePurge.status, 404);

  await db.execute({ sql: 'DELETE FROM recurring_expense_rules WHERE id = ?', args: [ruleId] });
});

test('seven-day cleanup permanently removes expired recycled expenses only', async () => {
  const activeId = await insertExpense({ name: 'Still active' });
  const freshDeletedId = await insertExpense({ name: 'Recently deleted' });
  assert.equal(await softDeleteExpense(freshDeletedId), true);
  const expiredId = await insertExpense({ name: 'Long deleted' });
  assert.equal(await softDeleteExpense(expiredId), true);
  await db.execute({
    sql: 'UPDATE expenses SET deleted_at = ? WHERE id = ?',
    args: [addDaysUTC8(new Date(), -8), expiredId],
  });

  const result = await purgeExpiredRecycleBinItems();
  assert.equal(result.expenses, 1);

  const survivors = await db.execute({
    sql: `SELECT id FROM expenses WHERE id IN (${activeId}, ${freshDeletedId}, ${expiredId})`,
    args: [],
  });
  assert.deepEqual(
    survivors.rows.map((row) => Number(row.id)).sort((a, b) => a - b),
    [activeId, freshDeletedId],
  );

  const bin = await listRecycleBin();
  assert.equal(bin.expenses.some((expense) => expense.id === freshDeletedId), true);
});

// ─── Receipt lifecycle ───────────────────────────────────────────────────────

async function uploadReceipt() {
  const form = new FormData();
  form.append('image', new Blob([PNG_ONE_PIXEL], { type: 'image/png' }), 'receipt.png');
  const response = await fetch(`${base}/api/receipts`, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  return response.json();
}

test('uploading then deleting a receipt keeps the image recoverable in the Recycle Bin', async () => {
  const receipt = await uploadReceipt();
  const filename = await getReceiptFilename(receipt.id);
  const filePath = resolveReceiptFilePath(filename);

  // Active receipt appears in the receipts tab and serves its image.
  let receipts = await getJson('/api/receipts');
  assert.equal(receipts.some((item) => item.id === receipt.id), true);
  assert.equal(existsSync(filePath), true, 'uploaded file exists');

  const deleteResponse = await fetch(`${base}/api/receipts/${receipt.id}`, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 204);

  receipts = await getJson('/api/receipts');
  assert.equal(receipts.some((item) => item.id === receipt.id), false);

  // Soft-deleted receipts keep their physical file while recoverable.
  assert.equal(existsSync(filePath), true);
  const imageResponse = await fetch(`${base}/api/receipts/${receipt.id}/image`);
  assert.equal(imageResponse.status, 200);

  const bin = await getJson('/api/recycle-bin');
  const binned = bin.receipts.find((item) => item.id === receipt.id);
  assert.ok(binned, 'deleted receipt appears in the Recycle Bin');
  assert.equal(binned.image_available, true);
  assert.ok(Date.parse(binned.expires_at) > Date.parse(binned.deleted_at));

  // Restore puts the receipt straight back into rotation.
  const restoreResponse = await fetch(`${base}/api/recycle-bin/receipts/${receipt.id}/restore`, { method: 'POST' });
  assert.equal(restoreResponse.status, 200);
  receipts = await getJson('/api/receipts');
  assert.equal(receipts.some((item) => item.id === receipt.id), true);

  // Permanent deletion removes metadata and the physical file.
  assert.equal(await softDeleteReceipt(receipt.id), true);
  const purgeResponse = await fetch(`${base}/api/recycle-bin/receipts/${receipt.id}`, { method: 'DELETE' });
  assert.equal(purgeResponse.status, 204);
  assert.equal(existsSync(filePath), false);
  const goneImage = await fetch(`${base}/api/receipts/${receipt.id}/image`);
  assert.equal(goneImage.status, 404);
});

test('expired normal receipt cleanup skips recycled receipts but still purges active ones', async () => {
  const recycled = await insertReceiptRow({ daysUntilExpiry: -1, deletedAt: addDaysUTC8(new Date(), -1) });
  const recycledFile = writeReceiptFile(recycled.filename);
  const active = await insertReceiptRow({ daysUntilExpiry: -1 });
  const activeFile = writeReceiptFile(active.filename);

  await purgeExpiredReceipts();

  const recycledRow = await db.execute({ sql: 'SELECT id FROM receipts WHERE id = ?', args: [recycled.id] });
  assert.equal(recycledRow.rows.length, 1, 'recycled receipt survives expiry cleanup');
  assert.equal(existsSync(recycledFile), true);

  const activeRow = await db.execute({ sql: 'SELECT id FROM receipts WHERE id = ?', args: [active.id] });
  assert.equal(activeRow.rows.length, 0, 'active expired receipt is purged');
  assert.equal(existsSync(activeFile), false);
});

test('restoring a recycled receipt past its original expiry grants a fresh window', async () => {
  const receipt = await insertReceiptRow({ daysUntilExpiry: -2, deletedAt: addDaysUTC8(new Date(), -1) });

  assert.equal(await softDeleteReceipt(receipt.id), false, 'already recycled receipts cannot be re-deleted');
  assert.equal(await restoreReceipt(receipt.id), true);

  const row = (await db.execute({ sql: 'SELECT expires_at, deleted_at FROM receipts WHERE id = ?', args: [receipt.id] })).rows[0];
  assert.equal(row.deleted_at, null);
  assert.ok(Date.parse(row.expires_at) > Date.now(), 'expiry was pushed into the future again');
});

test('seven-day cleanup purges expired recycled receipts even when their file is missing', async () => {
  const missingFile = await insertReceiptRow({ daysUntilExpiry: 5 });
  await db.execute({
    sql: 'UPDATE receipts SET deleted_at = ? WHERE id = ?',
    args: [addDaysUTC8(new Date(), -9), missingFile.id],
  });

  const result = await purgeExpiredRecycleBinItems();
  assert.equal(result.receipts >= 1, true);

  const row = await db.execute({ sql: 'SELECT id FROM receipts WHERE id = ?', args: [missingFile.id] });
  assert.equal(row.rows.length, 0);
});

// ─── Empty Recycle Bin ───────────────────────────────────────────────────────

test('emptying the Recycle Bin permanently removes only deleted records', async () => {
  await clearLifecycleData();
  const activeExpenseId = await insertExpense({ name: 'Keep me' });
  const activeReceipt = await insertReceiptRow({ daysUntilExpiry: 6 });
  const activeReceiptFile = writeReceiptFile(activeReceipt.filename);

  const deletedExpenseOne = await insertExpense({ name: 'Bin one' });
  assert.equal(await softDeleteExpense(deletedExpenseOne), true);
  const deletedExpenseTwo = await insertExpense({ name: 'Bin two' });
  assert.equal(await softDeleteExpense(deletedExpenseTwo), true);
  const deletedReceipt = await insertReceiptRow({ daysUntilExpiry: 6 });
  const deletedReceiptFile = writeReceiptFile(deletedReceipt.filename);
  assert.equal(await softDeleteReceipt(deletedReceipt.id), true);

  const result = await emptyRecycleBin();
  assert.equal(result.expenses, 2);
  assert.equal(result.receipts, 1);

  const remainingExpenses = await db.execute('SELECT id FROM expenses');
  assert.deepEqual(remainingExpenses.rows.map((row) => Number(row.id)), [activeExpenseId]);
  assert.equal(existsSync(activeReceiptFile), true, 'active receipt file is untouched');
  const remainingReceipts = await db.execute('SELECT id FROM receipts');
  assert.deepEqual(remainingReceipts.rows.map((row) => Number(row.id)), [activeReceipt.id]);

  assert.equal(existsSync(deletedReceiptFile), false, 'deleted receipt file is removed');

  const bin = await listRecycleBin();
  assert.equal(bin.expenses.length, 0);
  assert.equal(bin.receipts.length, 0);
});

after(async () => {
  // Remove any files created by these tests, then close resources.
  const rows = await db.execute('SELECT filename FROM receipts');
  rows.rows.forEach((row) => {
    try {
      const filePath = resolveReceiptFilePath(row.filename);
      if (existsSync(filePath)) rmSync(filePath);
    } catch {
      // Unsafe names were never written to disk by this suite.
    }
  });
  await db.close();
  try {
    rmSync(databasePath, { force: true });
  } catch {
    // Windows may briefly keep the libsql file handle open; the temp file
    // lives in the OS temp directory so leaving it is acceptable.
  }
});
