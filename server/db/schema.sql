CREATE TABLE IF NOT EXISTS expenses (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  category            TEXT NOT NULL,
  price_myr           REAL,
  price_idr           REAL,
  original_currency   TEXT NOT NULL CHECK(original_currency IN ('MYR','IDR')),
  exchange_rate_used  REAL,
  timestamp           TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_timestamp ON expenses(timestamp);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

CREATE TABLE IF NOT EXISTS receipts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  filename     TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  uploaded_at  TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipts_expires_at ON receipts(expires_at);

CREATE TABLE IF NOT EXISTS emergency_settings (
  id                    INTEGER PRIMARY KEY,
  current_savings_myr   REAL,
  reserved_funds_myr    REAL DEFAULT 0,
  target_months         INTEGER DEFAULT 6,
  essential_categories  TEXT,
  updated_at            TEXT
);

CREATE TABLE IF NOT EXISTS backup_preferences (
  username                TEXT PRIMARY KEY,
  reminder_interval_days  INTEGER NOT NULL DEFAULT 30 CHECK(reminder_interval_days IN (1, 14, 30)),
  last_backup_at          TEXT,
  updated_at              TEXT NOT NULL
);
