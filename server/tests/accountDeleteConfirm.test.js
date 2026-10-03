import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

const databasePath = path.join(tmpdir(), `financial-tracker-delete-confirm-${randomUUID()}.db`);
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = pathToFileURL(databasePath).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.EXCHANGE_RATE_API_URL = 'http://localhost.invalid/exchange-rate';
process.env.AUTH_SESSION_SECRET = 'delete-confirm-test-secret-with-more-than-32-characters';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PIN_HASH = '$2b$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcde';

const { default: db, initSchema } = await import('../db/database.js');
const { SESSION_COOKIE_NAME } = await import('../utils/auth.js');
const { requireAuth } = await import('../routes/auth.js');
const authRouter = (await import('../routes/auth.js')).default;
const { resetLimiter } = await import('../middleware/security.js');
const express = (await import('express')).default;
const expensesRouter = (await import('../routes/expenses.js')).default;
const settingsRouter = (await import('../routes/settings.js')).default;

await initSchema();

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/expenses', requireAuth, expensesRouter);
app.use('/api/settings', requireAuth, settingsRouter);

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

async function request(pathname, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body != null) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  return { response, body: payload };
}

async function clearDeletionCap() {
  await resetLimiter.resetKey('127.0.0.1');
  await resetLimiter.resetKey('::ffff:127.0.0.1');
  await resetLimiter.resetKey('::1');
}

async function deleteAccount(cookie, body) {
  await clearDeletionCap();
  return request('/api/auth/account', { method: 'DELETE', cookie, body });
}

function waitForIssuedDelay(waitSeconds) {
  return new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000 + 1000));
}

async function accountCount(username) {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS count FROM accounts WHERE username = ?',
    args: [username],
  });
  return Number(result.rows[0].count);
}

async function expenseCount(name) {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS count FROM expenses WHERE name = ?',
    args: [name],
  });
  return Number(result.rows[0].count);
}

async function registerAndLogin(username, pin) {
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { username, pin },
  });
  assert.equal(registered.response.status, 201, JSON.stringify(registered.body));
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username, pin },
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.body));
  return cookieFrom(login.response);
}

async function createExpense(cookie, name) {
  const created = await request('/api/expenses', {
    method: 'POST',
    cookie,
    body: {
      name,
      category: 'Food',
      price: 12.5,
      currency: 'MYR',
      timestamp: '2026-06-02T12:00:00+08:00',
    },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
}

test('account deletion requires a session-bound delay and deletes only the caller', { timeout: 60_000 }, async () => {
  const unauthenticatedIntent = await request('/api/auth/account/delete-intent', { method: 'POST' });
  assert.equal(unauthenticatedIntent.response.status, 401);

  const alicePin = '135790';
  const bobPin = '246802';
  const caraPin = '369258';
  const aliceCookie = await registerAndLogin('alice', alicePin);
  const bobCookie = await registerAndLogin('bob', bobPin);
  let caraCookie = await registerAndLogin('cara', caraPin);
  await createExpense(aliceCookie, 'Alice lunch');
  await createExpense(bobCookie, 'Bob lunch');

  const bobBefore = await db.execute({
    sql: 'SELECT id, password_hash, active_session_id FROM accounts WHERE username = ?',
    args: ['bob'],
  });
  const bobId = Number(bobBefore.rows[0].id);
  const bobHash = String(bobBefore.rows[0].password_hash);
  const bobSession = String(bobBefore.rows[0].active_session_id);

  const caraIntent = await request('/api/auth/account/delete-intent', { method: 'POST', cookie: caraCookie });
  assert.equal(caraIntent.response.status, 201);
  assert.equal(caraIntent.body.waitSeconds, 10);
  const caraAgain = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'cara', pin: caraPin },
  });
  caraCookie = cookieFrom(caraAgain.response);
  const staleSession = await deleteAccount(caraCookie, { pin: caraPin, deleteToken: caraIntent.body.token });
  assert.equal(staleSession.response.status, 400);
  assert.equal(await accountCount('cara'), 1);

  const pinOnly = await deleteAccount(aliceCookie, { pin: alicePin });
  assert.equal(pinOnly.response.status, 400);
  const missingToken = await deleteAccount(aliceCookie, { pin: alicePin, deleteToken: '' });
  assert.equal(missingToken.response.status, 400);
  assert.equal(await accountCount('alice'), 1);
  assert.equal(await accountCount('bob'), 1);

  const deleteIntent = await request('/api/auth/account/delete-intent', { method: 'POST', cookie: aliceCookie });
  assert.equal(deleteIntent.response.status, 201);
  assert.match(deleteIntent.body.token, /^[A-Za-z0-9_-]{43}$/);
  const resetIntent = await request('/api/settings/reset-intent', { method: 'POST', cookie: aliceCookie });
  assert.equal(resetIntent.response.status, 201);

  const tooEarly = await deleteAccount(aliceCookie, { pin: alicePin, deleteToken: deleteIntent.body.token });
  assert.equal(tooEarly.response.status, 425);
  assert.equal(typeof tooEarly.body.error, 'string');
  assert.equal(await expenseCount('Alice lunch'), 1);
  assert.equal(await expenseCount('Bob lunch'), 1);

  await waitForIssuedDelay(deleteIntent.body.waitSeconds);

  const resetToken = await deleteAccount(aliceCookie, { pin: alicePin, deleteToken: resetIntent.body.token });
  assert.equal(resetToken.response.status, 400);
  const otherSession = await deleteAccount(bobCookie, { pin: bobPin, deleteToken: deleteIntent.body.token });
  assert.equal(otherSession.response.status, 400);
  const wrongPin = await deleteAccount(aliceCookie, { pin: '000000', deleteToken: deleteIntent.body.token });
  assert.equal(wrongPin.response.status, 401);
  const namedUser = await deleteAccount(aliceCookie, {
    pin: alicePin,
    deleteToken: deleteIntent.body.token,
    username: 'bob',
  });
  assert.equal(namedUser.response.status, 404);
  const namedId = await deleteAccount(aliceCookie, {
    pin: alicePin,
    deleteToken: deleteIntent.body.token,
    userId: bobId,
  });
  assert.equal(namedId.response.status, 404);
  assert.equal(await accountCount('alice'), 1);
  assert.equal(await accountCount('bob'), 1);
  assert.equal(await expenseCount('Alice lunch'), 1);
  assert.equal(await expenseCount('Bob lunch'), 1);

  const deleted = await deleteAccount(aliceCookie, { pin: alicePin, deleteToken: deleteIntent.body.token });
  assert.equal(deleted.response.status, 204);
  assert.equal((await request('/api/auth/session', { cookie: aliceCookie })).response.status, 401);
  assert.equal(await accountCount('alice'), 0);
  assert.equal(await expenseCount('Alice lunch'), 0);
  assert.equal(await accountCount('bob'), 1);
  assert.equal(await expenseCount('Bob lunch'), 1);
  assert.deepEqual(
    (await request('/api/expenses', { cookie: bobCookie })).body.map((row) => row.name),
    ['Bob lunch'],
  );

  const bobAfter = await db.execute({
    sql: 'SELECT password_hash, active_session_id FROM accounts WHERE username = ?',
    args: ['bob'],
  });
  assert.equal(String(bobAfter.rows[0].password_hash), bobHash);
  assert.equal(String(bobAfter.rows[0].active_session_id), bobSession);

  const reusedByBob = await deleteAccount(bobCookie, { pin: bobPin, deleteToken: deleteIntent.body.token });
  assert.equal(reusedByBob.response.status, 400);
  const reusedByAlice = await deleteAccount(aliceCookie, { pin: alicePin, deleteToken: deleteIntent.body.token });
  assert.equal(reusedByAlice.response.status, 401);
  assert.equal(await accountCount('bob'), 1);
  assert.equal(await accountCount('cara'), 1);
  assert.equal(await expenseCount('Bob lunch'), 1);
});
