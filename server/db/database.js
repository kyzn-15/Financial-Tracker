// database.js — Initialize and export the Turso database client
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { isProduction, isTest } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tursoDatabaseUrl = process.env.TURSO_DATABASE_URL?.trim();
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();
const developmentDatabasePath = process.env.DB_PATH?.trim();

if (isProduction && (!tursoDatabaseUrl || !tursoAuthToken)) {
  throw new Error('Production requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
}

if (isProduction && !['libsql:', 'https:'].includes(new URL(tursoDatabaseUrl).protocol)) {
  throw new Error('Production TURSO_DATABASE_URL must use libsql: or https:');
}

if (!isProduction && !isTest && !developmentDatabasePath) {
  throw new Error('Development requires DB_PATH for an isolated local database');
}

const databaseUrl = isProduction
  ? tursoDatabaseUrl
  : isTest && tursoDatabaseUrl
    ? tursoDatabaseUrl
    : pathToFileURL(path.resolve(__dirname, '..', developmentDatabasePath)).href;

if (!isProduction && new URL(databaseUrl).protocol !== 'file:') {
  throw new Error('Development and test databases must use a local file: URL');
}

const db = createClient({
  url: databaseUrl,
  authToken: isProduction ? tursoAuthToken : undefined,
});

/**
 * Ensure required columns exist on databases created before schema migrations.
 * Safe to run repeatedly; skips fresh databases where schema.sql has already
 * created the columns.
 */
async function ensureDatabaseColumns() {
  const targets = [
    { table: 'expenses', column: 'deleted_at', type: 'TEXT' },
    { table: 'expenses', column: 'folder_id', type: 'INTEGER' },
    { table: 'receipts', column: 'deleted_at', type: 'TEXT' },
    { table: 'receipts', column: 'image_data', type: 'BLOB' },
    { table: 'emergency_settings', column: 'current_savings_idr', type: 'REAL' },
    { table: 'emergency_settings', column: 'reserved_funds_idr', type: 'REAL' },
    { table: 'emergency_settings', column: 'original_currency', type: "TEXT DEFAULT 'MYR'" },
    { table: 'emergency_settings', column: 'exchange_rate_used', type: 'REAL' },
    { table: 'expense_folders', column: 'user_id', type: 'INTEGER' },
    { table: 'expenses', column: 'user_id', type: 'INTEGER' },
    { table: 'categories', column: 'user_id', type: 'INTEGER' },
    { table: 'recurring_expense_rules', column: 'user_id', type: 'INTEGER' },
    { table: 'receipts', column: 'user_id', type: 'INTEGER' },
    { table: 'emergency_settings', column: 'user_id', type: 'INTEGER' },
  ];

  for (const { table, column, type } of targets) {
    const info = await db.execute(`PRAGMA table_info(${table})`);
    const tableExists = info.rows.length > 0;
    const columnExists = info.rows.some((row) => row.name === column);
    if (tableExists && !columnExists) {
      await db.execute({ sql: `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, args: [] });
      console.log(`Added ${table}.${column} (${type}) for storage/migration support`);
    }
  }
}

/**
 * Run the schema.sql file to create tables and indexes.
 */
async function uniqueIndexColumns(table) {
  const listed = await db.execute(`PRAGMA index_list('${table}')`);
  const groups = [];
  for (const index of listed.rows) {
    if (Number(index.unique) !== 1) continue;
    const info = await db.execute(`PRAGMA index_info('${String(index.name).replaceAll("'", "''")}')`);
    groups.push(info.rows.map((row) => String(row.name)));
  }
  return groups;
}

/**
 * Databases created before accounts keep a global UNIQUE(name). Rebuild those
 * tables in place so each account can use the same category and folder names.
 */
async function rebuildOwnerTable(table, createSql, copySql, indexSql) {
  const groups = await uniqueIndexColumns(table);
  const hasOwnerUnique = groups.some((columns) => columns.includes('user_id') && columns.includes('name'));
  if (hasOwnerUnique) return;

  await db.execute(`DROP TABLE IF EXISTS ${table}__next`);
  await db.execute(createSql);
  await db.execute(copySql);
  await db.execute(`DROP TABLE ${table}`);
  await db.execute(`ALTER TABLE ${table}__next RENAME TO ${table}`);
  for (const statement of indexSql) {
    await db.execute(statement);
  }
}

async function migrateAccountOwnership() {
  await db.execute('PRAGMA foreign_keys = OFF');
  try {
    await rebuildOwnerTable(
      'categories',
      `CREATE TABLE categories__next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL COLLATE NOCASE,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
        UNIQUE (user_id, name)
      )`,
      `INSERT INTO categories__next (id, user_id, name, sort_order, created_at)
       SELECT id, user_id, name, sort_order, created_at FROM categories`,
      [
        'CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order)',
        'CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)',
      ],
    );
    await rebuildOwnerTable(
      'expense_folders',
      `CREATE TABLE expense_folders__next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL COLLATE NOCASE,
        created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
        UNIQUE (user_id, name)
      )`,
      `INSERT INTO expense_folders__next (id, user_id, name, created_at)
       SELECT id, user_id, name, created_at FROM expense_folders`,
      [
        'CREATE INDEX IF NOT EXISTS idx_expense_folders_name ON expense_folders(name)',
        'CREATE INDEX IF NOT EXISTS idx_expense_folders_user_id ON expense_folders(user_id)',
      ],
    );
  } finally {
    await db.execute('PRAGMA foreign_keys = ON');
  }
}

async function metadataValue(key) {
  const result = await db.execute({
    sql: 'SELECT value FROM app_metadata WHERE key = ?',
    args: [key],
  });
  return result.rows[0]?.value == null ? null : String(result.rows[0].value);
}

async function setMetadata(key, value) {
  await db.execute({
    sql: `INSERT INTO app_metadata (key, value, updated_at)
          VALUES (?, ?, datetime('now','+8 hours'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [key, value],
  });
}

/**
 * Attach pre-account rows to the configured administrator and keep that
 * account's password aligned with ADMIN_PIN_HASH. A deleted administrator
 * is not recreated on the next startup.
 */
async function ensureBootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim() || '';
  const pinHash = process.env.ADMIN_PIN_HASH || '';
  if (!username || username.length > 80 || !pinHash) return null;

  const existing = await db.execute({
    sql: 'SELECT id, password_hash FROM accounts WHERE username = ? COLLATE NOCASE',
    args: [username],
  });
  const bootstrapId = await metadataValue('bootstrap_admin_id');

  if (existing.rows[0]) {
    const id = Number(existing.rows[0].id);
    const removed = await metadataValue('admin_account_removed');
    const isBootstrap = bootstrapId === String(id) || (bootstrapId == null && !removed);
    if (!isBootstrap) return null;
    if (bootstrapId !== String(id)) await setMetadata('bootstrap_admin_id', String(id));
    if (existing.rows[0].password_hash !== pinHash) {
      await db.execute({
        sql: 'UPDATE accounts SET password_hash = ? WHERE id = ?',
        args: [pinHash, id],
      });
    }
    await setMetadata('bootstrap_admin_username', username);
    return id;
  }

  if (await metadataValue('admin_account_removed')) return null;

  const inserted = await db.execute({
    sql: 'INSERT INTO accounts (username, password_hash) VALUES (?, ?) RETURNING id',
    args: [username, pinHash],
  });
  const id = Number(inserted.rows[0].id);
  await setMetadata('bootstrap_admin_id', String(id));
  await setMetadata('bootstrap_admin_username', username);
  return id;
}

async function collapseUnownedNameDuplicates(table) {
  await db.execute(
    `DELETE FROM ${table}
     WHERE user_id IS NULL
       AND id NOT IN (
         SELECT id FROM (
           SELECT MIN(id) AS id
           FROM ${table}
           WHERE user_id IS NULL
           GROUP BY name COLLATE NOCASE
         )
       )`,
  );
}

async function claimUnownedRows(adminId) {
  if (adminId == null) return;
  await collapseUnownedNameDuplicates('categories');
  await collapseUnownedNameDuplicates('expense_folders');
  const tables = [
    'expense_folders',
    'expenses',
    'categories',
    'recurring_expense_rules',
    'receipts',
    'emergency_settings',
  ];
  for (const table of tables) {
    await db.execute({
      sql: `UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`,
      args: [adminId],
    });
  }
}

export async function initSchema() {
  await ensureDatabaseColumns();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await db.executeMultiple(schema);
  await migrateAccountOwnership();
  const adminId = await ensureBootstrapAdmin();
  await claimUnownedRows(adminId);
  console.log('Database schema initialized');
}

/**
 * If the expenses table is empty, populate it with seed data.
 */
export async function seedIfEmpty() {
  const seededResult = await db.execute({
    sql: "SELECT 1 FROM app_metadata WHERE key = 'sample_data_seeded_v1'",
    args: [],
  });
  if (seededResult.rows.length > 0) return;

  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS count FROM expenses',
    args: [],
  });
  const count = Number(result.rows[0].count);

  if (count === 0) {
    const seedPath = path.join(__dirname, 'seed.sql');
    const seed = fs.readFileSync(seedPath, 'utf-8');
    await db.executeMultiple(seed);
    console.log('Database seeded with sample data');
  } else {
    console.log(`Database already has ${count} expense(s), skipping seed`);
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO app_metadata (key, value)
          VALUES ('sample_data_seeded_v1', 'complete')`,
    args: [],
  });
}

export default db;
