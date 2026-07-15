import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const RECEIPTS_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'receipts');

const RETENTION_DAYS = 7;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function deleteReceiptFile(filename) {
  const filePath = path.join(RECEIPTS_UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export async function purgeExpiredReceipts() {
  if (!fs.existsSync(RECEIPTS_UPLOAD_DIR)) {
    fs.mkdirSync(RECEIPTS_UPLOAD_DIR, { recursive: true });
  }

  const cutoff = nowUTC8();
  const result = await db.execute({
    sql: 'SELECT id, filename FROM receipts WHERE expires_at <= ?',
    args: [cutoff],
  });
  const stale = result.rows;

  if (stale.length === 0) return 0;

  await db.batch(
    stale.map((row) => ({ sql: 'DELETE FROM receipts WHERE id = ?', args: [row.id] })),
    'write'
  );
  stale.forEach((row) => deleteReceiptFile(row.filename));
  console.log(`🧹 Purged ${stale.length} expired receipt(s)`);
  return stale.length;
}

export function scheduleReceiptCleanup() {
  const runCleanup = () => {
    purgeExpiredReceipts().catch((err) => {
      console.error('Receipt cleanup error:', err);
    });
  };

  runCleanup();
  setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}

export { RETENTION_DAYS };
