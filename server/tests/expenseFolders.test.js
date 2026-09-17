import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

const databasePath = path.join(tmpdir(), `financial-tracker-folders-${randomUUID()}.db`);
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = pathToFileURL(databasePath).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.EXCHANGE_RATE_API_URL = 'http://localhost.invalid/exchange-rate';
process.env.AUTH_SESSION_SECRET = 'folder-test-secret-with-more-than-32-characters';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PIN_HASH = '$2b$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcde';

const { default: db, initSchema } = await import('../db/database.js');
const { SESSION_COOKIE_NAME, createSessionToken } = await import('../utils/auth.js');
const { requireAuth } = await import('../routes/auth.js');
const express = (await import('express')).default;
const expensesRouter = (await import('../routes/expenses.js')).default;
const foldersRouter = (await import('../routes/folders.js')).default;

await initSchema();

const app = express();
app.use(express.json());
app.use('/api/folders', requireAuth, foldersRouter);
app.use('/api/expenses', requireAuth, expensesRouter);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const sessionToken = await createSessionToken('admin');
const authHeader = { Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`, 'Content-Type': 'application/json' };

after(() => server.close());
after(() => db.close());

async function request(pathname, { method = 'GET', body, auth = true } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: auth ? authHeader : { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  return { response, body: payload };
}

test('unauthenticated folder and expense writes are rejected', async () => {
  const folder = await request('/api/folders', { method: 'POST', body: { name: 'secret trip' }, auth: false });
  assert.equal(folder.response.status, 401);
  assert.equal(typeof (folder.body.error || folder.body.message), 'string');

  const rename = await request('/api/folders/1', { method: 'PUT', body: { name: 'renamed' }, auth: false });
  assert.equal(rename.response.status, 401);
  assert.equal(typeof (rename.body.error || rename.body.message), 'string');

  const remove = await request('/api/folders/1', { method: 'DELETE', auth: false });
  assert.equal(remove.response.status, 401);
  assert.equal(typeof (remove.body.error || remove.body.message), 'string');

  const expense = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Secret', category: 'Food', price: 1, currency: 'MYR', timestamp: '' },
    auth: false,
  });
  assert.equal(expense.response.status, 401);
  assert.equal(typeof (expense.body.error || expense.body.message), 'string');

  const assign = await request('/api/expenses/1/folder', { method: 'PUT', body: { folderId: 1 }, auth: false });
  assert.equal(assign.response.status, 401);
  assert.equal(typeof (assign.body.error || assign.body.message), 'string');
});

test('folder create, expense assignment, and ungrouped rows are listed together', async () => {
  const folder = await request('/api/folders', { method: 'POST', body: { name: 'malaysian traveling trip' } });
  assert.equal(folder.response.status, 201);
  assert.equal(folder.body.name, 'malaysian traveling trip');
  const folderId = Number(folder.body.id);
  assert.ok(folderId > 0);

  const first = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Flight', category: 'Transport', price: 200, currency: 'MYR', timestamp: '', folderId },
  });
  const second = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Hotel', category: 'Rent', price: 150, currency: 'MYR', timestamp: '', folderId },
  });
  const ungrouped = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Coffee at home', category: 'Food', price: 8, currency: 'MYR', timestamp: '' },
  });

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 201);
  assert.equal(ungrouped.response.status, 201);
  assert.equal(Number(first.body.folder_id), folderId);
  assert.equal(first.body.folder_name, 'malaysian traveling trip');
  assert.equal(Number(second.body.folder_id), folderId);
  assert.equal(ungrouped.body.folder_id, null);

  const listed = await request('/api/expenses');
  assert.equal(listed.response.status, 200);
  const names = listed.body.map((row) => row.name);
  assert.equal(names.includes('Flight'), true);
  assert.equal(names.includes('Hotel'), true);
  assert.equal(names.includes('Coffee at home'), true);
  const grouped = listed.body.filter((row) => Number(row.folder_id) === folderId);
  assert.equal(grouped.length, 2);
  assert.equal(listed.body.some((row) => row.name === 'Coffee at home' && row.folder_id == null), true);
});

test('empty or too-long folder names and unknown folder ids are rejected with 400', async () => {
  const empty = await request('/api/folders', { method: 'POST', body: { name: '   ' } });
  assert.equal(empty.response.status, 400);
  assert.equal(typeof (empty.body.error || empty.body.message), 'string');

  const tooLong = await request('/api/folders', { method: 'POST', body: { name: 'x'.repeat(61) } });
  assert.equal(tooLong.response.status, 400);
  assert.equal(typeof (tooLong.body.error || tooLong.body.message), 'string');

  const unknown = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Orphan', category: 'Food', price: 5, currency: 'MYR', timestamp: '', folderId: 999999 },
  });
  assert.equal(unknown.response.status, 400);
  assert.equal(typeof (unknown.body.error || unknown.body.message), 'string');
});

test('creating an expense with custom kurs and folder persists both', async () => {
  const folder = await request('/api/folders', { method: 'POST', body: { name: 'launch trip' } });
  assert.equal(folder.response.status, 201);
  const folderId = Number(folder.body.id);
  const kurs = 3750;
  const price = 40;

  const created = await request('/api/expenses', {
    method: 'POST',
    body: {
      name: 'Launch meal',
      category: 'Food',
      price,
      currency: 'MYR',
      timestamp: '',
      customKurs: kurs,
      folderId,
    },
  });
  assert.equal(created.response.status, 201);
  assert.equal(Number(created.body.exchange_rate_used), kurs);
  assert.equal(Number(created.body.price_myr), price);
  assert.equal(Number(created.body.price_idr), price * kurs);
  assert.equal(Number(created.body.folder_id), folderId);
  assert.equal(created.body.folder_name, 'launch trip');

  const repeated = await request('/api/expenses', {
    method: 'POST',
    body: {
      name: 'Launch meal repeat',
      category: 'Food',
      price,
      currency: 'MYR',
      timestamp: '',
      customKurs: kurs,
      folderId,
    },
  });
  assert.equal(repeated.response.status, 201);
  assert.equal(Number(repeated.body.exchange_rate_used), Number(created.body.exchange_rate_used));
  assert.equal(Number(repeated.body.price_myr), Number(created.body.price_myr));
  assert.equal(Number(repeated.body.price_idr), Number(created.body.price_idr));
  assert.equal(Number(repeated.body.folder_id), Number(created.body.folder_id));
  assert.equal(repeated.body.folder_name, created.body.folder_name);
});

test('rename updates folder_name on member expenses', async () => {
  const folder = await request('/api/folders', { method: 'POST', body: { name: 'old trip name' } });
  assert.equal(folder.response.status, 201);
  const folderId = Number(folder.body.id);

  const created = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Taxi', category: 'Transport', price: 15, currency: 'MYR', timestamp: '', folderId },
  });
  assert.equal(created.response.status, 201);

  const renamed = await request(`/api/folders/${folderId}`, { method: 'PUT', body: { name: 'penang weekend' } });
  assert.equal(renamed.response.status, 200);
  assert.equal(renamed.body.some((row) => Number(row.id) === folderId && row.name === 'penang weekend'), true);

  const listed = await request('/api/expenses');
  const taxi = listed.body.find((row) => row.name === 'Taxi' && Number(row.folder_id) === folderId);
  assert.equal(taxi.folder_name, 'penang weekend');
});

test('deleting a folder removes it and its members from active history', async () => {
  const folder = await request('/api/folders', { method: 'POST', body: { name: 'delete trip' } });
  assert.equal(folder.response.status, 201);
  const folderId = Number(folder.body.id);

  const first = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Delete-me flight', category: 'Transport', price: 90, currency: 'MYR', timestamp: '', folderId },
  });
  const second = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Delete-me hotel', category: 'Rent', price: 80, currency: 'MYR', timestamp: '', folderId },
  });
  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 201);

  const removed = await request(`/api/folders/${folderId}`, { method: 'DELETE' });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.some((row) => Number(row.id) === folderId), false);

  const folders = await request('/api/folders');
  assert.equal(folders.body.some((row) => Number(row.id) === folderId), false);

  const listed = await request('/api/expenses');
  const names = listed.body.map((row) => row.name);
  assert.equal(names.includes('Delete-me flight'), false);
  assert.equal(names.includes('Delete-me hotel'), false);
});

test('assign, create-then-assign, and move update expense folder membership', async () => {
  const folderA = await request('/api/folders', { method: 'POST', body: { name: 'folder a' } });
  const folderB = await request('/api/folders', { method: 'POST', body: { name: 'folder b' } });
  assert.equal(folderA.response.status, 201);
  assert.equal(folderB.response.status, 201);
  const folderAId = Number(folderA.body.id);
  const folderBId = Number(folderB.body.id);

  const ungrouped = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Ungrouped snack', category: 'Food', price: 6, currency: 'MYR', timestamp: '' },
  });
  assert.equal(ungrouped.response.status, 201);
  assert.equal(ungrouped.body.folder_id, null);
  const expenseId = Number(ungrouped.body.id);

  const assigned = await request(`/api/expenses/${expenseId}/folder`, {
    method: 'PUT',
    body: { folderId: folderAId },
  });
  assert.equal(assigned.response.status, 200);
  assert.equal(Number(assigned.body.folder_id), folderAId);
  assert.equal(assigned.body.folder_name, 'folder a');

  const created = await request('/api/folders', { method: 'POST', body: { name: 'brand new folder' } });
  assert.equal(created.response.status, 201);
  const newFolderId = Number(created.body.id);
  const createAssigned = await request(`/api/expenses/${expenseId}/folder`, {
    method: 'PUT',
    body: { folderId: newFolderId },
  });
  assert.equal(createAssigned.response.status, 200);
  assert.equal(Number(createAssigned.body.folder_id), newFolderId);
  assert.equal(createAssigned.body.folder_name, 'brand new folder');

  const moved = await request(`/api/expenses/${expenseId}/folder`, {
    method: 'PUT',
    body: { folderId: folderBId },
  });
  assert.equal(moved.response.status, 200);
  assert.equal(Number(moved.body.folder_id), folderBId);
  assert.equal(moved.body.folder_name, 'folder b');

  const listed = await request('/api/expenses');
  const row = listed.body.find((item) => Number(item.id) === expenseId);
  assert.equal(Number(row.folder_id), folderBId);
  assert.equal(row.folder_name, 'folder b');
});

test('empty or too-long rename and unknown assignment folder ids are rejected with 400', async () => {
  const folder = await request('/api/folders', { method: 'POST', body: { name: 'valid folder' } });
  assert.equal(folder.response.status, 201);
  const folderId = Number(folder.body.id);

  const empty = await request(`/api/folders/${folderId}`, { method: 'PUT', body: { name: '   ' } });
  assert.equal(empty.response.status, 400);
  assert.equal(typeof (empty.body.error || empty.body.message), 'string');

  const tooLong = await request(`/api/folders/${folderId}`, { method: 'PUT', body: { name: 'y'.repeat(61) } });
  assert.equal(tooLong.response.status, 400);
  assert.equal(typeof (tooLong.body.error || tooLong.body.message), 'string');

  const expense = await request('/api/expenses', {
    method: 'POST',
    body: { name: 'Needs folder', category: 'Food', price: 4, currency: 'MYR', timestamp: '' },
  });
  const unknown = await request(`/api/expenses/${Number(expense.body.id)}/folder`, {
    method: 'PUT',
    body: { folderId: 999999 },
  });
  assert.equal(unknown.response.status, 400);
  assert.equal(typeof (unknown.body.error || unknown.body.message), 'string');
});
