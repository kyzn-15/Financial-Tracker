import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

const databasePath = path.join(tmpdir(), `financial-tracker-custom-kurs-${randomUUID()}.db`);
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = pathToFileURL(databasePath).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.EXCHANGE_RATE_API_URL = 'http://localhost.invalid/exchange-rate';

const { default: db, initSchema } = await import('../db/database.js');
const { FALLBACK_MYR_TO_IDR } = await import('../services/exchangeRate.js');
const { invertKursQuote } = await import('../utils/currency.js');
const express = (await import('express')).default;
const expensesRouter = (await import('../routes/expenses.js')).default;

await initSchema();

const app = express();
app.use(express.json());
app.use('/api/expenses', expensesRouter);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());
after(() => db.close());

function expensePayload(overrides = {}) {
  return {
    name: 'Test expense',
    category: 'Food',
    price: 12.5,
    currency: 'MYR',
    timestamp: '',
    ...overrides,
  };
}

async function postExpense(body) {
  const response = await fetch(`${base}/api/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expensePayload(body)),
  });
  return { response, body: await response.json().catch(() => ({})) };
}

async function putExpense(id, body) {
  const response = await fetch(`${base}/api/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expensePayload(body)),
  });
  return { response, body: await response.json().catch(() => ({})) };
}

test('POST with a custom kurs persists counterpart amounts from that kurs, not the live rate', async () => {
  const kurs = 3210;
  const price = 12.5;
  const custom = await postExpense({ name: 'Custom kurs meal', price, currency: 'MYR', customKurs: kurs });
  assert.equal(custom.response.status, 201);
  assert.equal(Number(custom.body.exchange_rate_used), kurs);
  assert.equal(Number(custom.body.price_myr), price);
  assert.equal(Number(custom.body.price_idr), price * kurs);

  const live = await postExpense({ name: 'Live rate meal', price, currency: 'MYR' });
  assert.equal(live.response.status, 201);
  assert.equal(Number(live.body.exchange_rate_used), FALLBACK_MYR_TO_IDR);
  assert.equal(Number(live.body.price_myr), price);
  assert.equal(Number(live.body.price_idr), price * FALLBACK_MYR_TO_IDR);
  assert.notEqual(Number(custom.body.exchange_rate_used), Number(live.body.exchange_rate_used));
});

test('POST with an IDR original amount uses the supplied custom kurs', async () => {
  const kurs = 3210;
  const price = 40125;
  const created = await postExpense({ name: 'IDR custom kurs', price, currency: 'IDR', customKurs: kurs });
  assert.equal(created.response.status, 201);
  assert.equal(Number(created.body.exchange_rate_used), kurs);
  assert.equal(Number(created.body.price_idr), price);
  assert.equal(Number(created.body.price_myr), price / kurs);
});

test('PUT with a custom kurs updates stored amounts from that kurs', async () => {
  const created = await postExpense({ name: 'Editable', price: 10, currency: 'MYR' });
  assert.equal(created.response.status, 201);
  const id = Number(created.body.id);
  const kurs = 2800;
  const price = 20;
  const updated = await putExpense(id, { name: 'Edited with kurs', price, currency: 'MYR', customKurs: kurs });
  assert.equal(updated.response.status, 200);
  assert.equal(Number(updated.body.exchange_rate_used), kurs);
  assert.equal(Number(updated.body.price_myr), price);
  assert.equal(Number(updated.body.price_idr), price * kurs);
});

test('invalid custom kurs values are rejected with HTTP 400 JSON errors', async () => {
  const cases = [
    { customKurs: 0 },
    { customKurs: -12 },
    { customKurs: 'abc' },
    { customKurs: true },
    { customKurs: 'Infinity' },
    { customKurs: 12, customKursQuote: 'USD_EUR' },
  ];

  for (const extra of cases) {
    const { response, body } = await postExpense(extra);
    assert.equal(response.status, 400, JSON.stringify(extra));
    assert.equal(typeof (body.error || body.message), 'string');
  }

  const created = await postExpense({ name: 'For invalid put', price: 8, currency: 'MYR' });
  const invalidPut = await putExpense(Number(created.body.id), { customKurs: 0 });
  assert.equal(invalidPut.response.status, 400);
  assert.equal(typeof (invalidPut.body.error || invalidPut.body.message), 'string');
});

test('POST with IDR→MYR custom kurs persists the same MYR→IDR kurs as 1/Y', async () => {
  const y = 0.00023;
  const price = 12.5;
  const myrToIdr = invertKursQuote(y);

  const fromIdrQuote = await postExpense({
    name: 'IDR quote meal',
    price,
    currency: 'MYR',
    customKurs: y,
    customKursQuote: 'IDR_MYR',
  });
  assert.equal(fromIdrQuote.response.status, 201);
  assert.equal(Number(fromIdrQuote.body.exchange_rate_used), myrToIdr);
  assert.equal(Number(fromIdrQuote.body.price_myr), price);
  assert.equal(Number(fromIdrQuote.body.price_idr), price * myrToIdr);
  assert.notEqual(Number(fromIdrQuote.body.exchange_rate_used), FALLBACK_MYR_TO_IDR);

  const fromMyrQuote = await postExpense({
    name: 'MYR quote meal',
    price,
    currency: 'MYR',
    customKurs: myrToIdr,
    customKursQuote: 'MYR_IDR',
  });
  assert.equal(fromMyrQuote.response.status, 201);
  assert.equal(Number(fromMyrQuote.body.exchange_rate_used), Number(fromIdrQuote.body.exchange_rate_used));
  assert.equal(Number(fromMyrQuote.body.price_myr), Number(fromIdrQuote.body.price_myr));
  assert.equal(Number(fromMyrQuote.body.price_idr), Number(fromIdrQuote.body.price_idr));
});

test('PUT without customKurs keeps the saved custom kurs', async () => {
  const kurs = 3210;
  const created = await postExpense({ name: 'Keep kurs', price: 12.5, currency: 'MYR', customKurs: kurs });
  assert.equal(created.response.status, 201);
  assert.equal(Number(created.body.exchange_rate_used), kurs);
  assert.notEqual(Number(created.body.exchange_rate_used), FALLBACK_MYR_TO_IDR);

  const newPrice = 20;
  const updated = await putExpense(Number(created.body.id), {
    name: 'Keep kurs edited',
    price: newPrice,
    currency: 'MYR',
  });
  assert.equal(updated.response.status, 200);
  assert.equal(Number(updated.body.exchange_rate_used), kurs);
  assert.equal(Number(updated.body.price_myr), newPrice);
  assert.equal(Number(updated.body.price_idr), newPrice * kurs);
  assert.notEqual(Number(updated.body.exchange_rate_used), FALLBACK_MYR_TO_IDR);
});

test('omitting custom kurs uses the live or fallback conversion', async () => {
  const price = 9;
  const created = await postExpense({ name: 'No custom kurs', price, currency: 'MYR' });
  assert.equal(created.response.status, 201);
  assert.equal(Number(created.body.exchange_rate_used), FALLBACK_MYR_TO_IDR);
  assert.equal(Number(created.body.price_myr), price);
  assert.equal(Number(created.body.price_idr), price * FALLBACK_MYR_TO_IDR);
});
