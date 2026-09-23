import bcrypt from 'bcrypt';
import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';
import { defaultCategoryStatements } from './appReset.js';
import {
  discardStagedReceiptFiles,
  receiptFilenamesForUser,
  restoreNamedReceiptFiles,
  stageNamedReceiptFiles,
} from './receiptCleanup.js';

const PASSWORD_COST = 10;

export function validateNewAccount(username, pin) {
  if (typeof username !== 'string' || typeof pin !== 'string') return null;
  const normalized = username.trim();
  if (normalized.length < 1 || normalized.length > 80) return null;
  if (/[\u0000-\u001F\u007F]/.test(normalized)) return null;
  if (!/^\d{4,12}$/.test(pin)) return null;
  return { username: normalized, pin };
}

function isUniqueViolation(error) {
  return /unique/i.test(error?.message || '');
}

export async function getAccountById(id) {
  const result = await db.execute({
    sql: 'SELECT id, username, password_hash FROM accounts WHERE id = ?',
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  return { id: Number(row.id), username: String(row.username), password_hash: String(row.password_hash) };
}

export async function registerAccount(username, pin) {
  const account = validateNewAccount(username, pin);
  if (!account) {
    const error = new Error('Username must be 1 to 80 characters and PIN must be 4 to 12 digits.');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(account.pin, PASSWORD_COST);
  const transaction = await db.transaction('write');
  try {
    const inserted = await transaction.execute({
      sql: 'INSERT INTO accounts (username, password_hash) VALUES (?, ?) RETURNING id',
      args: [account.username, passwordHash],
    });
    const id = Number(inserted.rows[0].id);
    await transaction.batch(defaultCategoryStatements(id, nowUTC8()));
    await transaction.commit();
    return { id, username: account.username };
  } catch (error) {
    if (!transaction.closed) await transaction.rollback().catch(() => {});
    if (isUniqueViolation(error) && /accounts\.username/i.test(error.message || '')) {
      const duplicate = new Error('That username is already taken.');
      duplicate.statusCode = 409;
      throw duplicate;
    }
    throw error;
  } finally {
    if (!transaction.closed) transaction.close();
  }
}

async function metadataValue(key) {
  const result = await db.execute({
    sql: 'SELECT value FROM app_metadata WHERE key = ?',
    args: [key],
  });
  return result.rows[0]?.value == null ? null : String(result.rows[0].value);
}

export async function deleteAccount(accountId) {
  const account = await getAccountById(accountId);
  if (!account) return false;

  const removesBootstrap = (await metadataValue('bootstrap_admin_id')) === String(account.id);
  const filenames = await receiptFilenamesForUser(account.id);
  const stagedDir = stageNamedReceiptFiles(filenames);
  const transaction = await db.transaction('write');
  try {
    await transaction.batch([
      {
        sql: `DELETE FROM recurring_expense_occurrences
              WHERE expense_id IN (SELECT id FROM expenses WHERE user_id = ?)
                 OR rule_id IN (SELECT id FROM recurring_expense_rules WHERE user_id = ?)`,
        args: [account.id, account.id],
      },
      { sql: 'DELETE FROM recurring_expense_rules WHERE user_id = ?', args: [account.id] },
      { sql: 'DELETE FROM expenses WHERE user_id = ?', args: [account.id] },
      { sql: 'DELETE FROM expense_folders WHERE user_id = ?', args: [account.id] },
      { sql: 'DELETE FROM receipts WHERE user_id = ?', args: [account.id] },
      {
        sql: `DELETE FROM category_automation_settings
              WHERE category_id IN (SELECT id FROM categories WHERE user_id = ?)`,
        args: [account.id],
      },
      { sql: 'DELETE FROM categories WHERE user_id = ?', args: [account.id] },
      { sql: 'DELETE FROM emergency_settings WHERE user_id = ?', args: [account.id] },
      { sql: 'DELETE FROM backup_preferences WHERE username = ?', args: [account.username] },
      { sql: 'DELETE FROM accounts WHERE id = ?', args: [account.id] },
      ...(removesBootstrap
        ? [
            {
              sql: `INSERT INTO app_metadata (key, value, updated_at)
                    VALUES ('admin_account_removed', '1', datetime('now','+8 hours'))
                    ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = excluded.updated_at`,
              args: [],
            },
            {
              sql: "DELETE FROM app_metadata WHERE key IN ('bootstrap_admin_id', 'bootstrap_admin_username')",
              args: [],
            },
          ]
        : []),
    ]);
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) await transaction.rollback().catch(() => {});
    restoreNamedReceiptFiles(stagedDir);
    throw error;
  } finally {
    if (!transaction.closed) transaction.close();
  }

  discardStagedReceiptFiles(stagedDir);
  return true;
}
