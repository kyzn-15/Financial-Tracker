# Architecture

## Overview

Financial Tracker is a single-user personal-finance web application. A React single-page client talks directly to an Express JSON API. The API owns authentication, validation, business rules, persistence, uploads, export/import, and scheduled maintenance. Data is SQLite-compatible through `@libsql/client`: development uses a configured local database file, while production requires a remote Turso/libSQL database.

```
React client -> /api Express server -> @libsql/client -> local SQLite file or Turso
                         |-> configured MYR-to-IDR exchange-rate API
                         |-> local receipt-image storage
```

The application supports MYR and IDR expenses, storing the entered currency, both converted amounts, and the rate used at creation or edit time. Application timestamps use UTC+8 ISO strings with a `+08:00` offset.

## Technology and runtime

- Client: React 19, Vite 8, JSX, Chart.js with `react-chartjs-2`, Lucide icons, and vanilla Neomorphic CSS.
- Server: Node.js 18+, Express 4, native ES modules.
- Data: `@libsql/client`; schema and idempotent migrations are in `server/db/schema.sql`.
- Security and auth: bcrypt, signed HttpOnly cookie sessions, Helmet, credentialed CORS, origin checks, and rate limiting.
- File and data interchange: Multer for receipt and workbook uploads; ExcelJS for portable XLSX database backups.

`server/config/env.js` loads `server/.env` in development/test and `server/.env.production` in production. The client requires `VITE_API_URL`; `client/src/services/api.js` normalizes an origin or `/api` URL into the API base URL. Server startup fails when required environment, origin, database, exchange-rate, or authentication settings are missing or unsafe.

## Repository layout

```
client/
  src/
    components/       Presentational screens, forms, charts, dialogs, and controls
    hooks/            Feature state and API-refresh orchestration
    services/api.js   The sole client HTTP boundary
    utils/            Formatting, chart theme, category icons, and dashboard calculations
    App.jsx           Authentication gate, tab shell, and feature composition
    App.css,index.css Application theme and layout styles
  vite.config.js      Validates VITE_API_URL at build/start time
server/
  server.js           Startup, middleware, route mounting, and background schedules
  config/env.js       Environment selection and validation
  middleware/         CORS, headers, trusted-origin checks, rate limits, proxy setup
  routes/             HTTP validation and response adapters
  services/           Domain workflows and cross-route business logic
  db/database.js      Shared libSQL client, schema initialization, and optional seed data
  db/schema.sql       Tables, indexes, defaults, and one-time data migrations
  utils/              Session, time, and safe receipt-path utilities
  uploads/receipts/   Runtime receipt-image files (created as needed)
  tests/              Node test coverage for security, reset, environment isolation, and analytics
```

## Frontend

`main.jsx` renders `App`. `App.jsx` first calls `/api/auth/session`, then either renders `LoginPage` or the authenticated tabbed application. It retains only a local storage session hint for loading UI; the server cookie remains authoritative. It also owns the active tab, theme preference, toast/modal UI, and the cross-feature refreshes required after mutations.

Feature hooks encapsulate client state and API calls:

- `useExpenses` loads expenses, dashboard summary, and exchange-rate metadata; it owns history filters and CRUD refreshes.
- `useCategories`, `useRecurringExpenses`, `useReceipts`, and `useEmergencyFund` own the analogous feature state. Receipt and emergency data are loaded on their relevant tabs; recurring rules also refresh on focus and once per minute.

Components implement the UI rather than direct HTTP access. `Dashboard` composes summary and chart components; `ExpenseForm` and `ExpenseList` handle expense entry/history; the remaining feature components cover categories, recurring payments, receipts, emergency-fund planning, settings, backup controls, navigation, and shared modal/toast/icon UI. `services/api.js` sends credentialed requests and centralizes JSON error handling; multipart receipt and XLSX requests are the intentional exceptions to its JSON request helper.

## Backend request flow and boundaries

`server.js` initializes the schema and seed data, validates auth configuration, then installs security middleware before mounting routes. The `/api/health` and `/api/auth/*` endpoints are public; every other mounted route uses `requireAuth`.

For a normal request the flow is:

```
client component -> hook -> services/api.js -> Express security middleware
-> authenticated route -> service/database -> JSON, binary, or 204 response
```

Routes validate and normalize HTTP input, select status codes, and serialize responses. Services contain reusable workflows such as conversion, recurrence creation, export/import, category changes, reset, and emergency-fund calculations. `server/db/database.js` is the shared database boundary; database calls pass SQL parameters through the libSQL client.

Mounted resource areas are:

- `auth`: login, session check, and logout.
- `expenses`: expense CRUD with filters/sorting and optional recurrence creation.
- `summary` and `exchange-rate`: dashboard aggregates and current rate metadata.
- `categories`: category CRUD, ordering, and recurrence automation settings.
- `recurring-expenses`: list, update/pause, and cancel rules.
- `receipts`: restricted image upload, metadata, image retrieval, and deletion.
- `emergency`: emergency-fund settings, calculations, and simulations.
- `export`: complete database workbook export/import.
- `backup`: per-user backup reminder preferences.
- `settings`: reset-intent issuance and confirmed app-data reset.

## Authentication and security

There is one configured administrator. Login compares the submitted PIN with `ADMIN_PIN_HASH` using bcrypt. On success, `server/utils/auth.js` creates an HMAC-signed, six-hour session token containing the username, credential version, expiry, and an active session ID persisted in `app_metadata`. It is returned as an HttpOnly cookie. Only the current active session ID is valid, so a new login or logout invalidates previous sessions.

`requireAuth` verifies the cookie and puts the verified session on `req.auth`; routes use its username for backup preferences and its session ID for reset intents. Production cookies are `Secure` and `SameSite=None`; development cookies are `SameSite=Lax`. The client always uses `credentials: 'include'`.

The API allowlists `CLIENT_ORIGIN`, accepts credentialed CORS only for it, and rejects state-changing requests whose Origin/Referer is not trusted. Helmet headers, no-store responses, body limits, server-side input validation, parameterized database calls, and per-feature rate limits are applied at the API boundary.

## Data model and data flow

`schema.sql` is safe to execute on every startup. It creates these tables:

- `expenses`: canonical transaction records, including MYR and IDR values, original currency, rate used, and UTC+8 timestamp.
- `categories` and `category_automation_settings`: ordered categories and recurrence defaults.
- `recurring_expense_rules` and `recurring_expense_occurrences`: recurring-payment definitions and their idempotent generated expenses.
- `receipts`: image metadata and seven-day expiry; image bytes stay under `server/uploads/receipts/` rather than in the database.
- `emergency_settings`: savings, reserved funds, target months, and essential categories.
- `backup_preferences`: reminder interval and most recent export time, keyed by administrator username.
- `app_metadata`: internal seed/migration markers and the active session ID.

The schema also preserves categories already referenced by expenses or emergency settings on the one-time category migration. `seedIfEmpty` loads `server/db/seed.sql` only once for a new, empty expenses dataset; app reset instead restores default categories and marks sample data as already seeded.

Expense creation and updates call `expenseRecords.calculateExpenseAmounts`, which uses `exchangeRate.getExchangeRate`. The conversion service caches a configured external MYR-to-IDR response in memory for the configured TTL and uses a fixed 4,500 fallback when it cannot fetch a valid rate. Converted values and the exact rate are persisted, so historical records do not change when the live rate changes.

Dashboard summary data is calculated server-side from `expenses` for current/previous month totals, categories, daily trend, heatmap, weekday averages, and largest purchase. The client formats and charts that response. Emergency-fund services separately derive coverage, stability, readiness, insights, and simulations from stored settings and expense/category data.

## Background work, files, and recovery

At server start, `scheduleReceiptCleanup` purges expired receipt metadata and files, then repeats daily. `scheduleRecurringExpenses` processes due active rules immediately and every minute; occurrence rows prevent duplicate generated expenses.

Receipt uploads accept only signature-verified JPEG, PNG, WebP, HEIC, or HEIF images up to 10 MB. Files are assigned UUID names and resolved only through the safe receipt-path utility.

Database export writes all database tables plus a schema manifest to XLSX. Import validates the workbook, manifest, schemas, and values before replacing data within the export service's restore workflow. An app-data reset requires a time-delayed, single-use reset intent plus the current PIN; it stages receipt files before database reset so failed resets can restore them.

## Architectural constraints

- Keep client HTTP in `client/src/services/api.js`; keep UI in components and feature state in hooks.
- Keep HTTP concerns in routes and shared business workflows in services; do not grow `server.js` beyond composition/startup.
- Preserve the `/api` boundary and protect new data routes with `requireAuth` unless they are intentionally public.
- Currency is limited to MYR/IDR and time values must remain UTC+8 ISO strings. Use the existing helpers rather than ad hoc conversion or date formatting.
- Treat schema changes, exports/imports, recurrence behavior, and reset/receipt file coordination as coupled persistence workflows.
