// database.js — Initialize and export the SQLite database instance
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve DB path from env or default
const dbPath = path.resolve(__dirname, process.env.DB_PATH || './tracker.db');

// Ensure the directory for the DB file exists
const dbDir = path.dirname(dbPath);
if (!dbDir || !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create the database connection
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

/**
 * Run the schema.sql file to create tables and indexes.
 */
export function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('✅ Database schema initialized');
}

/**
 * If the expenses table is empty, populate it with seed data.
 */
export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM expenses').get();
  if (row.count === 0) {
    const seedPath = path.join(__dirname, 'seed.sql');
    const seed = fs.readFileSync(seedPath, 'utf-8');
    db.exec(seed);
    console.log('🌱 Database seeded with sample data');
  } else {
    console.log(`ℹ️  Database already has ${row.count} expense(s), skipping seed`);
  }
}

export default db;
