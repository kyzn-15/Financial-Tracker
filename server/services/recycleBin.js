// recycleBin.js — Soft-delete retention, restore, and permanent-purge workflows
import fs from 'fs';
import db from '../db/database.js';
import { addDaysUTC8, nowUTC8 } from '../utils/datetime.js';
import { createReceiptToken } from '../utils/auth.js';
import { resolveReceiptFilePath } from '../utils/receiptFiles.js';
import { ownerClause } from '../utils/ownership.js';

export const RETENTION_DAYS = 7;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function deleteReceiptFileQuietly(filename) {
  let filePath;
  try {
    filePath = resolveReceiptFilePath(filename);
  } catch {
    console.warn('Skipped unsafe receipt filename during recycle-bin purge.');
    return;
  }
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    // Metadata removal already succeeded; an orphaned file is harmless and logged.
    console.warn(`Could not remove receipt file ${filename}:`, error.message);
  }
}

function receiptHasFile(filename) {
  try {
    return fs.existsSync(resolveReceiptFilePath(filename));
  } catch {
    return false;
  }
}

function withExpiry(item) {
  return { ...item, expires_at: addDaysUTC8(item.deleted_at, RETENTION_DAYS) };
}

function parseRowId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Soft-delete an active expense so it can be restored for RETENTION_DAYS.
 */
export async function softDeleteExpense(id, userId = null) {
  const owner = ownerClause(userId);
  const result = await db.execute({
    sql: `UPDATE expenses SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL${owner.sql}`,
    args: [nowUTC8(), id, ...owner.args],
  });
  return result.rowsAffected > 0;
}

/**
 * Soft-delete an active receipt. The image data is kept while the
 * record stays recoverable, so normal expiry purges must ignore it.
 */
export async function softDeleteReceipt(id, userId = null) {
  const owner = ownerClause(userId);
  const result = await db.execute({
    sql: `UPDATE receipts SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL${owner.sql}`,
    args: [nowUTC8(), id, ...owner.args],
  });
  return result.rowsAffected > 0;
}

export async function listRecycleBin(sessionId, userId = null) {
  const [expensesResult, receiptsResult] = await Promise.all([
    db.execute({
      sql: `SELECT id, name, category, price_myr, price_idr, original_currency, timestamp, deleted_at
            FROM expenses
            WHERE deleted_at IS NOT NULL${ownerClause(userId).sql}
            ORDER BY deleted_at DESC`,
      args: ownerClause(userId).args,
    }),
    db.execute({
      sql: `SELECT id, filename, mime_type, uploaded_at, deleted_at, (image_data IS NOT NULL) AS has_blob
            FROM receipts
            WHERE deleted_at IS NOT NULL${ownerClause(userId).sql}
            ORDER BY deleted_at DESC`,
      args: ownerClause(userId).args,
    }),
  ]);

  return {
    expenses: expensesResult.rows.map((row) => withExpiry({
      id: Number(row.id),
      name: row.name,
      category: row.category,
      price_myr: row.price_myr,
      price_idr: row.price_idr,
      original_currency: row.original_currency,
      timestamp: row.timestamp,
      deleted_at: row.deleted_at,
    })),
    receipts: receiptsResult.rows.map((row) => {
      const id = Number(row.id);
      const token = sessionId ? createReceiptToken(id, sessionId) : '';
      return withExpiry({
        id,
        mime_type: row.mime_type,
        uploaded_at: row.uploaded_at,
        image_url: token ? `/api/receipts/${id}/image?token=${token}` : `/api/receipts/${id}/image`,
        image_available: Boolean(row.has_blob || receiptHasFile(row.filename)),
        deleted_at: row.deleted_at,
      });
    }),
  };
}

export async function restoreExpense(id, userId = null) {
  const owner = ownerClause(userId);
  const result = await db.execute({
    sql: `UPDATE expenses SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL${owner.sql}`,
    args: [id, ...owner.args],
  });
  return result.rowsAffected > 0;
}

export async function restoreReceipt(id, userId = null) {
  // A receipt whose normal expires_at elapsed inside the bin gets a fresh
  // viewing window on restore instead of being re-purged immediately.
  const restoredAt = nowUTC8();
  const result = await db.execute({
    sql: `UPDATE receipts
          SET deleted_at = NULL,
              expires_at = CASE WHEN expires_at <= ? THEN ? ELSE expires_at END
          WHERE id = ? AND deleted_at IS NOT NULL${ownerClause(userId).sql}`,
    args: [restoredAt, addDaysUTC8(new Date(), RETENTION_DAYS), id, ...ownerClause(userId).args],
  });
  return result.rowsAffected > 0;
}

export function getRecycledExpenseState(id, userId = null) {
  return getItemState('expenses', id, userId);
}

export function getRecycledReceiptState(id, userId = null) {
  return getItemState('receipts', id, userId);
}

async function getItemState(table, id, userId = null) {
  const owner = ownerClause(userId);
  const result = await db.execute({
    sql: `SELECT deleted_at FROM ${table} WHERE id = ?${owner.sql}`,
    args: [id, ...owner.args],
  });
  const row = result.rows[0];
  if (!row) return 'missing';
  return row.deleted_at == null ? 'active' : 'deleted';
}

/**
 * Permanently remove a single recycled expense plus its occurrence links.
 * The recurring rule itself is never cancelled here; only the generated
 * expense disappears (its rule anchor is released, mirroring the schema's
 * ON DELETE SET NULL). The deleted_at re-check makes concurrent restores safe.
 */
export async function purgeExpense(id, userId = null) {
  const owner = ownerClause(userId);
  const deleted = await db.execute({
    sql: `DELETE FROM expenses WHERE id = ? AND deleted_at IS NOT NULL${owner.sql}`,
    args: [id, ...owner.args],
  });
  if (deleted.rowsAffected > 0) {
    await db.batch([
      { sql: 'UPDATE recurring_expense_rules SET anchor_expense_id = NULL WHERE anchor_expense_id = ?', args: [id] },
      // Safety net alongside FK cascade: drop occurrence links of purged expenses.
      { sql: 'DELETE FROM recurring_expense_occurrences WHERE expense_id = ?', args: [id] },
    ], 'write');
  }
  return deleted.rowsAffected > 0;
}

/**
 * Permanently remove a single recycled receipt. Database metadata goes first
 * so the item cannot be restored once its file is being removed; a failed
 * file deletion only leaves an orphaned file, never a broken record.
 */
export async function purgeReceipt(id, userId = null) {
  const owner = ownerClause(userId);
  const result = await db.execute({
    sql: `SELECT filename FROM receipts WHERE id = ? AND deleted_at IS NOT NULL${owner.sql}`,
    args: [id, ...owner.args],
  });
  const receipt = result.rows[0];
  if (!receipt) return false;

  const deleted = await db.execute({
    sql: `DELETE FROM receipts WHERE id = ? AND deleted_at IS NOT NULL${owner.sql}`,
    args: [id, ...owner.args],
  });
  if (deleted.rowsAffected === 0) return false;

  deleteReceiptFileQuietly(receipt.filename);
  return true;
}

/**
 * Permanently remove every soft-deleted expense and receipt. Only records
 * whose deleted_at is set are touched — active data is never affected.
 */
export async function emptyRecycleBin(userId = null) {
  const owner = ownerClause(userId);
  const receiptsResult = await db.execute({
    sql: `SELECT id, filename FROM receipts WHERE deleted_at IS NOT NULL${owner.sql}`,
    args: owner.args,
  });

  const expensesCount = (await db.execute({
    sql: `DELETE FROM expenses WHERE deleted_at IS NOT NULL${owner.sql}`,
    args: owner.args,
  })).rowsAffected;

  // Re-check per row so items restored mid-operation keep their files.
  const removedReceiptFiles = [];
  let receiptCount = 0;
  for (const row of receiptsResult.rows) {
    const deleted = await db.execute({
      sql: `DELETE FROM receipts WHERE id = ? AND deleted_at IS NOT NULL${owner.sql}`,
      args: [Number(row.id), ...owner.args],
    });
    if (deleted.rowsAffected > 0) {
      receiptCount += 1;
      removedReceiptFiles.push(row.filename);
    }
  }

  // Safety nets alongside FK actions: release rule anchors and drop occurrence
  // links that pointed at purged expenses.
  await db.batch([
    {
      sql: 'UPDATE recurring_expense_rules SET anchor_expense_id = NULL WHERE anchor_expense_id IS NOT NULL AND anchor_expense_id NOT IN (SELECT id FROM expenses)',
      args: [],
    },
    {
      sql: 'DELETE FROM recurring_expense_occurrences WHERE expense_id NOT IN (SELECT id FROM expenses)',
      args: [],
    },
  ], 'write');

  removedReceiptFiles.forEach((filename) => deleteReceiptFileQuietly(filename));

  return { expenses: expensesCount, receipts: receiptCount };
}

/**
 * Permanently purge recycled items whose retention window has elapsed.
 * Idempotent: repeated runs only see items still past their cutoff.
 */
export async function purgeExpiredRecycleBinItems(cutoff = addDaysUTC8(new Date(), -RETENTION_DAYS)) {
  const expensesResult = await db.execute({
    sql: 'SELECT id FROM expenses WHERE deleted_at IS NOT NULL AND deleted_at <= ?',
    args: [cutoff],
  });
  const expenseIds = expensesResult.rows.map((row) => parseRowId(row.id)).filter(Boolean);

  const receiptsResult = await db.execute({
    sql: `SELECT id, filename FROM receipts WHERE deleted_at IS NOT NULL AND deleted_at <= ?`,
    args: [cutoff],
  });

  let expenseCount = 0;
  for (const id of expenseIds) {
    if (await purgeExpense(id)) expenseCount += 1;
  }

  let receiptCount = 0;
  for (const row of receiptsResult.rows) {
    if (await purgeReceipt(Number(row.id))) receiptCount += 1;
  }

  if (expenseCount > 0 || receiptCount > 0) {
    console.log(`🧹 Purged ${expenseCount} expired expense(s) and ${receiptCount} expired receipt(s)`);
  }
  return { expenses: expenseCount, receipts: receiptCount };
}

export function scheduleRecycleBinCleanup() {
  let isRunning = false;
  const run = () => {
    if (isRunning) return;
    isRunning = true;
    purgeExpiredRecycleBinItems()
      .catch((err) => console.error('Recycle bin cleanup error:', err))
      .finally(() => {
        isRunning = false;
      });
  };

  run();
  setInterval(run, CLEANUP_INTERVAL_MS);
}
