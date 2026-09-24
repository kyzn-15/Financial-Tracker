import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import ExcelJS from 'exceljs';

const databasePath = path.join(tmpdir(), `financial-tracker-security-${randomUUID()}.db`);
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = pathToFileURL(databasePath).href;
process.env.AUTH_SESSION_SECRET = 'security-test-secret-with-more-than-32-characters';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PIN_HASH = 'test-credential-version-1';
delete process.env.TURSO_AUTH_TOKEN;

const { default: db, initSchema } = await import('../db/database.js');
const {
  createReceiptToken,
  createSessionToken,
  revokeSessionToken,
  verifyReceiptToken,
  verifySessionToken,
} = await import('../utils/auth.js');
const { resolveReceiptFilePath } = await import('../utils/receiptFiles.js');
const {
  BackupValidationError,
  buildDatabaseExportWorkbook,
  importDatabaseWorkbook,
} = await import('../services/exportWorkbook.js');

test('security boundaries reject unsafe files and invalidate sessions', async () => {
  await initSchema();
  assert.throws(() => resolveReceiptFilePath('../../outside.jpg'), /Invalid receipt filename/);

  const firstToken = await createSessionToken('admin');
  const firstSession = await verifySessionToken(firstToken);
  assert.equal(firstSession?.username, 'admin');

  // Receipt tokens are bound to receiptId and active sessionId
  const receiptToken = createReceiptToken(42, firstSession.sessionId);
  assert.equal(await verifyReceiptToken(42, receiptToken), true);
  assert.equal(await verifyReceiptToken(99, receiptToken), false, 'receipt token cannot access other receipts');
  assert.equal(await verifyReceiptToken(42, `${receiptToken}tampered`), false, 'tampered receipt token is rejected');
  assert.equal(await verifyReceiptToken(42, 'invalid.token'), false);

  const secondToken = await createSessionToken('admin');
  assert.equal(await verifySessionToken(firstToken), null);
  // When active session rotates, previous receipt tokens are immediately invalidated
  assert.equal(await verifyReceiptToken(42, receiptToken), false, 'receipt token invalidates on session rotation');

  assert.equal(await revokeSessionToken(secondToken), true);
  assert.equal(await verifySessionToken(secondToken), null);

  const formula = '=WEBSERVICE("https://example.invalid")';
  await db.batch([
    {
      sql: `INSERT INTO expenses
            (name, category, price_myr, price_idr, original_currency, exchange_rate_used, timestamp)
            VALUES (?, 'Other Expenses', 1, 4000, 'MYR', 4000, '2026-01-01T00:00:00+08:00')`,
      args: [formula],
    },
    {
      sql: `INSERT INTO receipts (filename, mime_type, uploaded_at, expires_at)
            VALUES ('../../outside.jpg', 'image/jpeg', '2026-01-01T00:00:00+08:00', '2026-01-08T00:00:00+08:00')`,
      args: [],
    },
  ], 'write');

  const buffer = await buildDatabaseExportWorkbook();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const values = workbook.worksheets.flatMap((sheet) => sheet.getSheetValues().flat());
  assert.equal(values.includes(`__FINTRACKER_TEXT__:${formula}`), true);
  assert.equal(values.includes(process.env.ADMIN_PIN_HASH), false);
  assert.equal(values.includes(firstSession.sessionId), false);
  await assert.rejects(importDatabaseWorkbook(buffer), BackupValidationError);
});

after(() => {
  db.close();
});
