// database.js — Initialize and export the Turso database client
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL must be configured');
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
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
}

export default db;
