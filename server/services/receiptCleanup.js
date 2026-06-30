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

export function purgeExpiredReceipts() {
  if (!fs.existsSync(RECEIPTS_UPLOAD_DIR)) {
    fs.mkdirSync(RECEIPTS_UPLOAD_DIR, { recursive: true });
  }

  const cutoff = nowUTC8();
  const stale = db.prepare(`
    SELECT id, filename FROM receipts WHERE expires_at <= ?
  `).all(cutoff);

  if (stale.length === 0) return 0;

  const deleteRow = db.prepare('DELETE FROM receipts WHERE id = ?');
  const purge = db.transaction((rows) => {
    for (const row of rows) {
      deleteReceiptFile(row.filename);
      deleteRow.run(row.id);
    }
  });

  purge(stale);
  console.log(`🧹 Purged ${stale.length} expired receipt(s)`);
  return stale.length;
}

export function scheduleReceiptCleanup() {
  purgeExpiredReceipts();
  setInterval(purgeExpiredReceipts, CLEANUP_INTERVAL_MS);
}

export { RETENTION_DAYS };
