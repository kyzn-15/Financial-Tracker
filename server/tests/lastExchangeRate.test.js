import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

const databasePath = path.join(tmpdir(), `financial-tracker-last-rate-${randomUUID()}.db`);
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = pathToFileURL(databasePath).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const mock = { status: 503, idr: 4123.5 };
const rateServer = http.createServer((req, res) => {
  if (mock.status !== 200) {
    res.writeHead(mock.status);
    res.end('unavailable');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ rates: { IDR: mock.idr } }));
});

await new Promise((resolve) => rateServer.listen(0, '127.0.0.1', resolve));
process.env.EXCHANGE_RATE_API_URL = `http://127.0.0.1:${rateServer.address().port}`;

const { default: db, initSchema } = await import('../db/database.js');
const {
  LAST_EXCHANGE_RATE_KEY,
  FALLBACK_MYR_TO_IDR,
  clearExchangeRateCache,
  getExchangeRate,
  getExchangeRateInfo,
} = await import('../services/exchangeRate.js');

await initSchema();

after(() => rateServer.close());
after(() => db.close());

test('API failure with no saved rate uses the bootstrap rate', async () => {
  mock.status = 503;
  clearExchangeRateCache();
  const rate = await getExchangeRate();
  assert.equal(rate.myrToIdr, FALLBACK_MYR_TO_IDR);
  assert.equal(rate.usingFallback, true);
});

test('a successful API fetch is saved and reused when the API later fails', async () => {
  mock.status = 200;
  mock.idr = 4123.5;
  clearExchangeRateCache();
  const live = await getExchangeRate();
  assert.equal(live.myrToIdr, 4123.5);
  assert.equal(live.usingFallback, false);

  const stored = await db.execute({
    sql: 'SELECT value FROM app_metadata WHERE key = ?',
    args: [LAST_EXCHANGE_RATE_KEY],
  });
  assert.equal(Number(stored.rows[0].value), 4123.5);

  mock.status = 503;
  clearExchangeRateCache();
  const saved = await getExchangeRate();
  assert.equal(saved.myrToIdr, 4123.5);
  assert.equal(saved.usingFallback, true);
  assert.notEqual(saved.myrToIdr, FALLBACK_MYR_TO_IDR);

  const info = await getExchangeRateInfo();
  assert.equal(info.myrToIdr, 4123.5);
  assert.equal(info.usingFallback, true);
  assert.equal(info.message, 'Using last saved rate (API unavailable)');
});
