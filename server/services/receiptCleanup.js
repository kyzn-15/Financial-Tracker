import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';
import { RECEIPTS_UPLOAD_DIR, resolveReceiptFilePath } from '../utils/receiptFiles.js';

const RETENTION_DAYS = 7;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function deleteReceiptFile(filename) {
  let filePath;
  try {
    filePath = resolveReceiptFilePath(filename);
  } catch {
    console.warn('Skipped unsafe receipt filename during cleanup.');
    return;
  }
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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

export function stageReceiptFilesForReset() {
  const parentDir = path.dirname(RECEIPTS_UPLOAD_DIR);
  fs.mkdirSync(parentDir, { recursive: true });

  let stagedDir = null;
  if (fs.existsSync(RECEIPTS_UPLOAD_DIR)) {
    stagedDir = path.join(parentDir, `.receipts-reset-${randomUUID()}`);
    fs.renameSync(RECEIPTS_UPLOAD_DIR, stagedDir);
  }
  try {
    fs.mkdirSync(RECEIPTS_UPLOAD_DIR, { recursive: true });
  } catch (error) {
    if (stagedDir) fs.renameSync(stagedDir, RECEIPTS_UPLOAD_DIR);
    throw error;
  }
  return stagedDir;
}

export function restoreStagedReceiptFiles(stagedDir) {
  fs.rmSync(RECEIPTS_UPLOAD_DIR, { recursive: true, force: true });
  if (stagedDir) {
    fs.renameSync(stagedDir, RECEIPTS_UPLOAD_DIR);
  } else {
    fs.mkdirSync(RECEIPTS_UPLOAD_DIR, { recursive: true });
  }
}

export function discardStagedReceiptFiles(stagedDir) {
  if (stagedDir) {
    fs.rmSync(stagedDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
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
