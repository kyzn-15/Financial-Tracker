import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import ExcelJS from 'exceljs';

const adminPin = '908172';
const noraPin = '135790';
const databasePath = path.join(tmpdir(), `financial-tracker-multiuser-safety-${randomUUID()}.db`);
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = pathToFileURL(databasePath).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.EXCHANGE_RATE_API_URL = 'http://localhost.invalid/exchange-rate';
process.env.AUTH_SESSION_SECRET = 'multiuser-safety-test-secret-with-more-than-32-characters';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PIN_HASH = bcrypt.hashSync(adminPin, 10);

const { default: db, initSchema } = await import('../db/database.js');
const { SESSION_COOKIE_NAME } = await import('../utils/auth.js');
const { requireAuth } = await import('../routes/auth.js');
const authRouter = (await import('../routes/auth.js')).default;
const express = (await import('express')).default;
const expensesRouter = (await import('../routes/expenses.js')).default;
const settingsRouter = (await import('../routes/settings.js')).default;
const exportRouter = (await import('../routes/export.js')).default;

await initSchema();
await db.execute({
  sql: `INSERT INTO expenses
        (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp)
        VALUES ('Admin legacy', 'Food', 10, 40000, 'MYR', 4000, '2026-01-01T00:00:00+08:00')`,
  args: [],
});
await initSchema();

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/expenses', requireAuth, expensesRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/export', requireAuth, exportRouter);

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

function waitForIssuedDelay(waitSeconds) {
  return new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000 + 1000));
}

async function accountRow(username) {
  const result = await db.execute({
    sql: 'SELECT id, password_hash, active_session_id FROM accounts WHERE username = ?',
    args: [username],
  });
  return result.rows[0] || null;
}

async function metadataValue(key) {
  const result = await db.execute({
    sql: 'SELECT value FROM app_metadata WHERE key = ?',
    args: [key],
  });
  return result.rows[0]?.value == null ? null : String(result.rows[0].value);
}

async function expenseNames(cookie) {
  const listed = await request('/api/expenses', { cookie });
  assert.equal(listed.response.status, 200, JSON.stringify(listed.body));
  return listed.body.map((row) => row.name);
}

async function activeExpense(name) {
  const result = await db.execute({
    sql: 'SELECT id, user_id, deleted_at FROM expenses WHERE name = ? AND deleted_at IS NULL',
    args: [name],
  });
  return result.rows;
}

async function exportBackup(cookie) {
  const response = await fetch(`${base}/api/export/records`, { headers: { Cookie: cookie } });
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, bytes.toString('utf8').slice(0, 300));
  return bytes;
}

async function importBackup(cookie, bytes) {
  const form = new FormData();
  form.append('backup', new File([bytes], 'financial-tracker-database-backup.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  return request('/api/export/records/import', { method: 'POST', cookie, form });
}

async function workbookValues(bytes) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const values = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value == null || cell.value === '') return;
        values.push(typeof cell.value === 'string' ? cell.value : JSON.stringify(cell.value));
      });
    });
  });
  return values;
}

async function issuedToken(pathname, cookie) {
  const intent = await request(pathname, { method: 'POST', cookie });
  assert.equal(intent.response.status, 201, JSON.stringify(intent.body));
  assert.equal(intent.body.waitSeconds, 10);
  assert.match(intent.body.token, /^[A-Za-z0-9_-]{43}$/);
  await waitForIssuedDelay(intent.body.waitSeconds);
  return intent.body.token;
}

test('bootstrap admin and scoped backups survive other accounts', { timeout: 120_000 }, async () => {
  const admin = await accountRow('admin');
  assert.ok(admin, 'premade admin exists');
  const adminId = Number(admin.id);
  const adminHash = String(admin.password_hash);
  assert.equal(adminHash, process.env.ADMIN_PIN_HASH);
  assert.equal(await metadataValue('admin_account_removed'), null);

  const claimed = await db.execute({
    sql: `SELECT accounts.username FROM expenses
          JOIN accounts ON accounts.id = expenses.user_id
          WHERE expenses.name = 'Admin legacy'`,
    args: [],
  });
  assert.equal(claimed.rows[0].username, 'admin');

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', pin: adminPin },
  });
  assert.equal(adminLogin.response.status, 200, JSON.stringify(adminLogin.body));
  const adminCookie = cookieFrom(adminLogin.response);
  assert.deepEqual(await expenseNames(adminCookie), ['Admin legacy']);

  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { username: 'nora', pin: noraPin },
  });
  assert.equal(registered.response.status, 201, JSON.stringify(registered.body));
  const noraLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'nora', pin: noraPin },
  });
  assert.equal(noraLogin.response.status, 200, JSON.stringify(noraLogin.body));
  const noraCookie = cookieFrom(noraLogin.response);
  assert.deepEqual(await expenseNames(noraCookie), []);

  const created = await request('/api/expenses', {
    method: 'POST',
    cookie: noraCookie,
    body: {
      name: 'Nora night market',
      category: 'Food',
      price: 18,
      currency: 'MYR',
      timestamp: '2026-06-02T12:00:00+08:00',
    },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  assert.deepEqual(await expenseNames(adminCookie), ['Admin legacy']);
  assert.deepEqual(await expenseNames(noraCookie), ['Nora night market']);

  const legacy = await activeExpense('Admin legacy');
  assert.equal(legacy.length, 1);
  assert.equal(Number(legacy[0].user_id), adminId);
  const crossDelete = await request(`/api/expenses/${Number(legacy[0].id)}`, {
    method: 'DELETE',
    cookie: noraCookie,
  });
  assert.equal(crossDelete.response.status, 404);
  assert.equal((await activeExpense('Admin legacy')).length, 1);

  const noraHash = String((await accountRow('nora')).password_hash);
  const resetToken = await issuedToken('/api/settings/reset-intent', noraCookie);
  const reset = await request('/api/settings/data', {
    method: 'DELETE',
    cookie: noraCookie,
    body: { confirmation: 'RESET', resetToken, pin: noraPin },
  });
  assert.equal(reset.response.status, 204, JSON.stringify(reset.body));
  assert.deepEqual(await expenseNames(noraCookie), []);
  assert.deepEqual(await expenseNames(adminCookie), ['Admin legacy']);
  assert.equal(String((await accountRow('admin')).password_hash), adminHash);
  assert.equal(String((await accountRow('nora')).password_hash), noraHash);
  assert.equal(await metadataValue('admin_account_removed'), null);

  const recreated = await request('/api/expenses', {
    method: 'POST',
    cookie: noraCookie,
    body: {
      name: 'Nora night market',
      category: 'Food',
      price: 18,
      currency: 'MYR',
      timestamp: '2026-06-02T12:00:00+08:00',
    },
  });
  assert.equal(recreated.response.status, 201, JSON.stringify(recreated.body));

  const noraSession = String((await accountRow('nora')).active_session_id);
  const adminSession = String((await accountRow('admin')).active_session_id);
  const noraBackup = await exportBackup(noraCookie);
  const noraValues = await workbookValues(noraBackup);
  assert.equal(noraValues.includes('Nora night market'), true);
  for (const leaked of ['Admin legacy', adminHash, noraHash, adminSession, noraSession]) {
    assert.equal(noraValues.includes(leaked), false, `nora workbook leaked ${leaked}`);
  }
  assert.equal(noraValues.includes('password_hash'), true);
  assert.equal(noraValues.includes('active_session_id'), true);

  const noraExpense = await activeExpense('Nora night market');
  assert.equal((await request(`/api/expenses/${Number(noraExpense[0].id)}`, {
    method: 'DELETE',
    cookie: noraCookie,
  })).response.status, 204);
  assert.deepEqual(await expenseNames(noraCookie), []);
  const noraImport = await importBackup(noraCookie, noraBackup);
  assert.equal(noraImport.response.status, 200, JSON.stringify(noraImport.body));
  assert.deepEqual(await expenseNames(noraCookie), ['Nora night market']);
  assert.deepEqual(await expenseNames(adminCookie), ['Admin legacy']);
  assert.equal(Number((await activeExpense('Admin legacy'))[0].user_id), adminId);
  assert.equal(String((await accountRow('admin')).password_hash), adminHash);
  assert.equal(String((await accountRow('nora')).password_hash), noraHash);
  assert.equal(String((await accountRow('admin')).active_session_id), adminSession);

  const adminBackup = await exportBackup(adminCookie);
  const adminValues = await workbookValues(adminBackup);
  assert.equal(adminValues.includes('Admin legacy'), true);
  for (const leaked of ['Nora night market', adminHash, noraHash, adminSession, noraSession]) {
    assert.equal(adminValues.includes(leaked), false, `admin workbook leaked ${leaked}`);
  }

  const legacyAgain = await activeExpense('Admin legacy');
  assert.equal((await request(`/api/expenses/${Number(legacyAgain[0].id)}`, {
    method: 'DELETE',
    cookie: adminCookie,
  })).response.status, 204);
  assert.deepEqual(await expenseNames(adminCookie), []);
  const adminImport = await importBackup(adminCookie, adminBackup);
  assert.equal(adminImport.response.status, 200, JSON.stringify(adminImport.body));
  assert.deepEqual(await expenseNames(adminCookie), ['Admin legacy']);
  assert.deepEqual(await expenseNames(noraCookie), ['Nora night market']);
  assert.equal(Number((await activeExpense('Admin legacy'))[0].user_id), adminId);
  assert.equal(Number((await activeExpense('Nora night market'))[0].user_id), Number((await accountRow('nora')).id));
  assert.equal(String((await accountRow('admin')).password_hash), adminHash);
  assert.equal(String((await accountRow('admin')).active_session_id), adminSession);
  assert.equal(String((await accountRow('nora')).password_hash), noraHash);

  const deleteToken = await issuedToken('/api/auth/account/delete-intent', noraCookie);
  const noraDeleted = await request('/api/auth/account', {
    method: 'DELETE',
    cookie: noraCookie,
    body: { pin: noraPin, deleteToken },
  });
  assert.equal(noraDeleted.response.status, 204, JSON.stringify(noraDeleted.body));
  assert.equal(await accountRow('nora'), null);
  assert.equal((await activeExpense('Nora night market')).length, 0);
  assert.deepEqual(await expenseNames(adminCookie), ['Admin legacy']);
  assert.equal(String((await accountRow('admin')).password_hash), adminHash);
  assert.equal(await metadataValue('admin_account_removed'), null);

  const adminStillWorks = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', pin: adminPin },
  });
  assert.equal(adminStillWorks.response.status, 200, JSON.stringify(adminStillWorks.body));
  const adminCookieAfter = cookieFrom(adminStillWorks.response);
  assert.deepEqual(await expenseNames(adminCookieAfter), ['Admin legacy']);
  assert.equal(String((await accountRow('admin')).password_hash), adminHash);

  const adminDeleteToken = await issuedToken('/api/auth/account/delete-intent', adminCookieAfter);
  const adminDeleted = await request('/api/auth/account', {
    method: 'DELETE',
    cookie: adminCookieAfter,
    body: { pin: adminPin, deleteToken: adminDeleteToken },
  });
  assert.equal(adminDeleted.response.status, 204, JSON.stringify(adminDeleted.body));
  assert.equal(await accountRow('admin'), null);
  assert.equal(await metadataValue('admin_account_removed'), '1');

  await initSchema();
  assert.equal(await accountRow('admin'), null);
  assert.equal(await metadataValue('admin_account_removed'), '1');

  const cara = await request('/api/auth/register', {
    method: 'POST',
    body: { username: 'cara', pin: '369258' },
  });
  assert.equal(cara.response.status, 201, JSON.stringify(cara.body));
  assert.equal(await accountRow('admin'), null);
});
