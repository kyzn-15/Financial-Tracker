import db from '../db/database.js';

export async function listFolders() {
  const result = await db.execute({
    sql: `SELECT expense_folders.id,
                 expense_folders.name,
                 expense_folders.created_at,
                 COUNT(expenses.id) AS expense_count
          FROM expense_folders
          LEFT JOIN expenses ON expenses.folder_id = expense_folders.id AND expenses.deleted_at IS NULL
          GROUP BY expense_folders.id, expense_folders.name, expense_folders.created_at
          ORDER BY expense_folders.name COLLATE NOCASE ASC`,
    args: [],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    created_at: row.created_at,
    expense_count: Number(row.expense_count),
  }));
}

export async function createFolder(name) {
  const duplicate = await db.execute({
    sql: 'SELECT id FROM expense_folders WHERE name = ? COLLATE NOCASE',
    args: [name],
  });
  if (duplicate.rows.length > 0) {
    const error = new Error('A folder with that name already exists.');
    error.statusCode = 409;
    throw error;
  }

  const result = await db.execute({
    sql: 'INSERT INTO expense_folders (name) VALUES (?) RETURNING id, name, created_at',
    args: [name],
  });
  const row = result.rows[0];
  return {
    id: Number(row.id),
    name: row.name,
    created_at: row.created_at,
    expense_count: 0,
  };
}

export async function folderExists(id) {
  const result = await db.execute({
    sql: 'SELECT id FROM expense_folders WHERE id = ?',
    args: [id],
  });
  return result.rows.length > 0;
}
