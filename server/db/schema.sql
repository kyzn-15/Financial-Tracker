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
