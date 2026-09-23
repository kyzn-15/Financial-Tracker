import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';
import { ownerClause } from '../utils/ownership.js';

export async function listFolders(userId = null) {
  const owner = ownerClause(userId, 'expense_folders.user_id');
  const expenseOwner = userId == null ? '' : ' AND expenses.user_id = expense_folders.user_id';
  const result = await db.execute({
    sql: `SELECT expense_folders.id,
                 expense_folders.name,
                 expense_folders.created_at,
                 COUNT(expenses.id) AS expense_count
          FROM expense_folders
          LEFT JOIN expenses
            ON expenses.folder_id = expense_folders.id
           AND expenses.deleted_at IS NULL${expenseOwner}
          ${userId == null ? '' : 'WHERE expense_folders.user_id = ?'}
          GROUP BY expense_folders.id, expense_folders.name, expense_folders.created_at
          ORDER BY expense_folders.name COLLATE NOCASE ASC`,
    args: owner.args,
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    created_at: row.created_at,
    expense_count: Number(row.expense_count),
  }));
}

export async function createFolder(name, userId = null) {
  const owner = ownerClause(userId);
  const duplicate = await db.execute({
    sql: `SELECT id FROM expense_folders WHERE name = ? COLLATE NOCASE${owner.sql}`,
    args: [name, ...owner.args],
  });
  if (duplicate.rows.length > 0) {
    const error = new Error('A folder with that name already exists.');
    error.statusCode = 409;
    throw error;
  }

  const result = userId == null
    ? await db.execute({
        sql: 'INSERT INTO expense_folders (name) VALUES (?) RETURNING id, name, created_at',
        args: [name],
      })
    : await db.execute({
        sql: 'INSERT INTO expense_folders (name, user_id) VALUES (?, ?) RETURNING id, name, created_at',
        args: [name, userId],
      });
  const row = result.rows[0];
  return {
    id: Number(row.id),
    name: row.name,
    created_at: row.created_at,
    expense_count: 0,
  };
}

export async function folderExists(id, userId = null) {
  const owner = ownerClause(userId);
  const result = await db.execute({
    sql: `SELECT id FROM expense_folders WHERE id = ?${owner.sql}`,
    args: [id, ...owner.args],
  });
  return result.rows.length > 0;
}

export async function renameFolder(id, name, userId = null) {
  const owner = ownerClause(userId);
  const existing = await db.execute({
    sql: `SELECT id FROM expense_folders WHERE id = ?${owner.sql}`,
    args: [id, ...owner.args],
  });
  if (existing.rows.length === 0) return false;

  const duplicate = await db.execute({
    sql: `SELECT id FROM expense_folders WHERE name = ? COLLATE NOCASE AND id <> ?${owner.sql}`,
    args: [name, id, ...owner.args],
  });
  if (duplicate.rows.length > 0) {
    const error = new Error('A folder with that name already exists.');
    error.statusCode = 409;
    throw error;
  }

  await db.execute({
    sql: `UPDATE expense_folders SET name = ? WHERE id = ?${owner.sql}`,
    args: [name, id, ...owner.args],
  });
  return true;
}

export async function deleteFolder(id, userId = null) {
  const exists = await folderExists(id, userId);
  if (!exists) return false;
  const owner = ownerClause(userId);

  await db.batch([
    {
      sql: `UPDATE expenses SET deleted_at = ? WHERE folder_id = ? AND deleted_at IS NULL${owner.sql}`,
      args: [nowUTC8(), id, ...owner.args],
    },
    {
      sql: `DELETE FROM expense_folders WHERE id = ?${owner.sql}`,
      args: [id, ...owner.args],
    },
  ], 'write');
  return true;
}
