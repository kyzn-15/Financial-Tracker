import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

const databasePath = path.join(tmpdir(), `financial-tracker-multiuser-${randomUUID()}.db`);
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = pathToFileURL(databasePath).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.EXCHANGE_RATE_API_URL = 'http://localhost.invalid/exchange-rate';
process.env.AUTH_SESSION_SECRET = 'multiuser-test-secret-with-more-than-32-characters';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PIN_HASH = '$2b$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcde';

const { default: db, initSchema } = await import('../db/database.js');
const { SESSION_COOKIE_NAME, createSessionToken } = await import('../utils/auth.js');
const { requireAuth } = await import('../routes/auth.js');
const authRouter = (await import('../routes/auth.js')).default;
const express = (await import('express')).default;
const expensesRouter = (await import('../routes/expenses.js')).default;
const receiptsRouter = (await import('../routes/receipts.js')).default;
const backupRouter = (await import('../routes/backup.js')).default;
const { resolveReceiptFilePath } = await import('../utils/receiptFiles.js');

const PNG_ONE_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const LEGACY_RECEIPT = `${randomUUID()}.png`;

await db.executeMultiple(`
  CREATE TABLE expense_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
  );
  CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price_myr REAL,
    price_idr REAL,
    original_currency TEXT NOT NULL,
    exchange_rate_used REAL,
    timestamp TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
    deleted_at TEXT,
    folder_id INTEGER
  );
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
  );
  CREATE TABLE receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE emergency_settings (
    id INTEGER PRIMARY KEY,
    current_savings_myr REAL,
    reserved_funds_myr REAL DEFAULT 0,
    target_months INTEGER DEFAULT 6,
    essential_categories TEXT,
    updated_at TEXT
  );
  CREATE TABLE app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
  );
`);
await db.batch([
  { sql: "INSERT INTO categories (name, sort_order) VALUES ('Food', 1)", args: [] },
  { sql: "INSERT INTO expense_folders (name) VALUES ('Admin trip')", args: [] },
  {
    sql: `INSERT INTO expenses
          (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp, folder_id)
          VALUES ('Admin legacy', 'Food', 10, 40000, 'MYR', 4000, '2026-01-01T00:00:00+08:00', 1)`,
    args: [],
  },
  {
    sql: `INSERT INTO receipts (filename, mime_type, uploaded_at, expires_at)
          VALUES (?, 'image/png', '2026-01-01T00:00:00+08:00', '2026-01-08T00:00:00+08:00')`,
    args: [LEGACY_RECEIPT],
  },
  {
    sql: `INSERT INTO emergency_settings (id, current_savings_myr, target_months, essential_categories, updated_at)
          VALUES (1, 500, 6, '["Food"]', '2026-01-01T00:00:00+08:00')`,
    args: [],
  },
  {
    sql: `INSERT INTO app_metadata (key, value) VALUES ('last_exchange_rate_myr_idr', '4123.5')`,
    args: [],
  },
], 'write');

await initSchema();

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/expenses', requireAuth, expensesRouter);
app.use('/api/receipts', requireAuth, receiptsRouter);
app.use('/api/backup', requireAuth, backupRouter);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

after(() => server.close());
after(() => db.close());

function cookieFrom(response) {
  const header = response.headers.get('set-cookie') || '';
  const match = header.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  assert.ok(match, 'session cookie was set');
  return `${SESSION_COOKIE_NAME}=${match[1]}`;
}

async function request(pathname, { method = 'GET', body, cookie, form } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body != null) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: form ?? (body == null ? undefined : JSON.stringify(body)),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  return { response, body: payload };
}

async function uploadReceipt(cookie) {
  const form = new FormData();
  form.append('image', new File([PNG_ONE_PIXEL], 'receipt.png', { type: 'image/png' }));
  return request('/api/receipts', { method: 'POST', cookie, form });
}

test('register, isolate, and delete an account without touching anyone else', async () => {
  const categorySql = await db.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'categories'",
    args: [],
  });
  assert.match(String(categorySql.rows[0].sql), /user_id/);

  const legacy = await db.execute({
    sql: `SELECT expenses.user_id, accounts.username
          FROM expenses
          JOIN accounts ON accounts.id = expenses.user_id
          WHERE expenses.name = 'Admin legacy'`,
    args: [],
  });
  assert.equal(legacy.rows[0].username, 'admin');

  const badRegister = await request('/api/auth/register', { method: 'POST', body: {} });
  assert.equal(badRegister.response.status, 400);
  assert.equal(typeof (badRegister.body.error || badRegister.body.message), 'string');

  const unauthenticated = await request('/api/expenses');
  assert.equal(unauthenticated.response.status, 401);

  const aliceRegister = await request('/api/auth/register', {
    method: 'POST',
    body: { username: 'alice', pin: '135790' },
  });
  assert.equal(aliceRegister.response.status, 201);

  const duplicate = await request('/api/auth/register', {
    method: 'POST',
    body: { username: 'Alice', pin: '135790' },
  });
  assert.equal(duplicate.response.status, 409);

  const bobRegister = await request('/api/auth/register', {
    method: 'POST',
    body: { username: 'bob', pin: '246802' },
  });
  assert.equal(bobRegister.response.status, 201);

  const aliceLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'alice', pin: '135790' },
  });
  const aliceCookie = cookieFrom(aliceLogin.response);
  const bobLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'bob', pin: '246802' },
  });
  const bobCookie = cookieFrom(bobLogin.response);

  const expenseBody = {
    name: 'Lunch',
    category: 'Food',
    price: 12.5,
    currency: 'MYR',
    timestamp: '2026-06-02T12:00:00+08:00',
  };
  const aliceExpense = await request('/api/expenses', {
    method: 'POST',
    cookie: aliceCookie,
    body: { ...expenseBody, name: 'Alice lunch' },
  });
  assert.equal(aliceExpense.response.status, 201);
  assert.equal(aliceExpense.body.original_currency, 'MYR');
  assert.match(String(aliceExpense.body.timestamp), /\+08:00$/);

  const bobExpense = await request('/api/expenses', {
    method: 'POST',
    cookie: bobCookie,
    body: { ...expenseBody, name: 'Bob lunch' },
  });
  assert.equal(bobExpense.response.status, 201);
  const bobRecycled = await request('/api/expenses', {
    method: 'POST',
    cookie: bobCookie,
    body: { ...expenseBody, name: 'Bob recycled' },
  });
  assert.equal(await request(`/api/expenses/${bobRecycled.body.id}`, { method: 'DELETE', cookie: bobCookie }).then((result) => result.response.status), 204);

  const bobReceipt = await uploadReceipt(bobCookie);
  assert.equal(bobReceipt.response.status, 201);
  const bobReceiptRow = await db.execute({ sql: 'SELECT filename FROM receipts WHERE id = ?', args: [bobReceipt.body.id] });
  const bobReceiptFilename = String(bobReceiptRow.rows[0].filename);
  assert.equal(existsSync(resolveReceiptFilePath(bobReceiptFilename)), true);
  writeFileSync(resolveReceiptFilePath(LEGACY_RECEIPT), PNG_ONE_PIXEL);
  assert.equal((await request('/api/backup/preferences', { cookie: bobCookie })).response.status, 200);
  assert.equal((await request('/api/backup/preferences', { cookie: aliceCookie })).response.status, 200);

  const aliceList = await request('/api/expenses', { cookie: aliceCookie });
  assert.deepEqual(aliceList.body.map((row) => row.name), ['Alice lunch']);
  const bobList = await request('/api/expenses', { cookie: bobCookie });
  assert.deepEqual(bobList.body.map((row) => row.name), ['Bob lunch']);

  const adminToken = await createSessionToken('admin');
  const adminList = await request('/api/expenses', { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` });
  assert.deepEqual(adminList.body.map((row) => row.name), ['Admin legacy']);

  const crossDelete = await request('/api/auth/account', {
    method: 'DELETE',
    cookie: aliceCookie,
    body: { pin: '135790', username: 'bob' },
  });
  assert.equal(crossDelete.response.status, 404);
  assert.equal((await request('/api/expenses', { cookie: bobCookie })).body[0].name, 'Bob lunch');

  const deleted = await request('/api/auth/account', {
    method: 'DELETE',
    cookie: bobCookie,
    body: { pin: '246802' },
  });
  assert.equal(deleted.response.status, 204);
  assert.equal((await request('/api/auth/session', { cookie: bobCookie })).response.status, 401);
  assert.equal((await request('/api/expenses', { cookie: bobCookie })).response.status, 401);
  assert.deepEqual((await request('/api/expenses', { cookie: aliceCookie })).body.map((row) => row.name), ['Alice lunch']);
  assert.deepEqual((await request('/api/expenses', { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` })).body.map((row) => row.name), ['Admin legacy']);

  const bobRows = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM expenses WHERE name LIKE 'Bob %') AS expenses,
            (SELECT COUNT(*) FROM receipts WHERE filename = ?) AS receipts,
            (SELECT COUNT(*) FROM backup_preferences WHERE username = 'bob') AS preferences,
            (SELECT COUNT(*) FROM accounts WHERE username = 'bob') AS accounts`,
    args: [bobReceiptFilename],
  });
  assert.equal(Number(bobRows.rows[0].expenses), 0);
  assert.equal(Number(bobRows.rows[0].receipts), 0);
  assert.equal(Number(bobRows.rows[0].preferences), 0);
  assert.equal(Number(bobRows.rows[0].accounts), 0);
  assert.equal(existsSync(resolveReceiptFilePath(bobReceiptFilename)), false);
  assert.equal(existsSync(resolveReceiptFilePath(LEGACY_RECEIPT)), true);
  const shared = await db.execute({
    sql: "SELECT value FROM app_metadata WHERE key = 'last_exchange_rate_myr_idr'",
    args: [],
  });
  assert.equal(shared.rows[0].value, '4123.5');
});
