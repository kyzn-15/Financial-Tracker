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

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  sort_order  INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

INSERT INTO categories (name, sort_order)
SELECT name, sort_order
FROM (
  SELECT 'Grocery' AS name, 1 AS sort_order UNION ALL
  SELECT 'Food', 2 UNION ALL
  SELECT 'Non-Primary Expenses', 3 UNION ALL
  SELECT 'Other Expenses', 4 UNION ALL
  SELECT 'Entertainment', 5 UNION ALL
  SELECT 'Education', 6 UNION ALL
  SELECT 'Subscription', 7 UNION ALL
  SELECT 'Transport', 8 UNION ALL
  SELECT 'Rent', 9 UNION ALL
  SELECT 'Utilities', 10 UNION ALL
  SELECT 'Health/Medical', 11 UNION ALL
  SELECT 'Phone', 12 UNION ALL
  SELECT 'Insurance', 13 UNION ALL
  SELECT 'Medicine', 14 UNION ALL
  SELECT 'Savings/Investment', 15 UNION ALL
  SELECT 'Others', 16
)
WHERE NOT EXISTS (SELECT 1 FROM categories);

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

CREATE TABLE IF NOT EXISTS app_metadata (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);

-- One-time migration: preserve categories already used by expenses before
-- category management was introduced. The metadata marker prevents a category
-- intentionally removed later from being recreated on every server restart.
INSERT OR IGNORE INTO categories (name, sort_order)
SELECT existing.name,
       (SELECT COALESCE(MAX(sort_order), 0) FROM categories)
         + ROW_NUMBER() OVER (ORDER BY existing.name COLLATE NOCASE)
FROM (
  SELECT DISTINCT TRIM(category) AS name
  FROM expenses
  WHERE category IS NOT NULL AND TRIM(category) <> ''
) AS existing
WHERE NOT EXISTS (
  SELECT 1 FROM app_metadata WHERE key = 'categories_v1_migrated'
);

INSERT OR IGNORE INTO categories (name, sort_order)
SELECT existing.name,
       (SELECT COALESCE(MAX(sort_order), 0) FROM categories)
         + ROW_NUMBER() OVER (ORDER BY existing.name COLLATE NOCASE)
FROM (
  SELECT DISTINCT TRIM(json_each.value) AS name
  FROM emergency_settings,
       json_each(
         CASE
           WHEN json_valid(emergency_settings.essential_categories)
             THEN emergency_settings.essential_categories
           ELSE '[]'
         END
       )
  WHERE json_each.type = 'text' AND TRIM(json_each.value) <> ''
) AS existing
WHERE NOT EXISTS (
  SELECT 1 FROM app_metadata WHERE key = 'categories_v1_migrated'
);

INSERT OR IGNORE INTO app_metadata (key, value)
VALUES ('categories_v1_migrated', 'complete');
