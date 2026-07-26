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
 * Run the schema.sql file to create tables and indexes.
 */
export async function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await db.executeMultiple(schema);
  console.log('✅ Database schema initialized');
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
    console.log('🌱 Database seeded with sample data');
  } else {
    console.log(`ℹ️  Database already has ${count} expense(s), skipping seed`);
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO app_metadata (key, value)
          VALUES ('sample_data_seeded_v1', 'complete')`,
    args: [],
  });
}

export default db;
