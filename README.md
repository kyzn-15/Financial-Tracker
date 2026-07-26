# Neomorphic Personal Financial Tracker

A beautiful, modern full-stack web application designed using the **Neomorphism (Soft UI)** aesthetic. It allows a single user to log their daily expenses, automatically converting and storing values in both **MYR (Malaysian Ringgit)** and **IDR (Indonesian Rupiah)** via the Frankfurter exchange rate API.

## Features

- **Neomorphic UI/UX**: Soft, extruded containers using dual shadows, custom input states (inset on focus), and active toggles that look "pressed" into the surface.
- **Auto Currency Conversion**: Log expenses in either MYR or IDR. The app automatically fetches the exchange rate, calculates the counterpart value, and stores both.
- **Short TTL Caching**: API rates are cached in-memory on the server for 15 minutes to avoid excessive third-party requests.
- **Timezone**: All timestamps are formatted, handled, and displayed in **UTC+8**.
- **Dashboard Analytics**:
  - Month-to-date totals in both MYR and IDR.
  - Interactive Doughnut Chart showing spending breakdown by category.
  - Interactive Line Chart displaying the daily spending trend over the last 30 days.
  - **Chart Currency Toggle**: Dynamically toggle all dashboard charts/numbers between MYR and IDR.
- **Tabbed Navigation**:
  - **Add Expense**: Log new transactions with customizable timestamps (defaults to current time).
  - **Dashboard**: High-level statistical summaries and trend visuals.
  - **History**: Searchable list of transactions with category and date filters, sorting, editing, and deleting capabilities.
- **Graceful Error Handling**: If the currency API is down, values are stored, and conversions can retry/backfill. Toast notifications alert the user about actions and server status.

---

## Tech Stack

- **Frontend**: React 19 + Vite, Chart.js (`react-chartjs-2`), Custom Vanilla CSS variables
- **Backend**: Node.js + Express, Turso via `@libsql/client` (SQLite-compatible), `dotenv`, `cors`
- **Currency Data**: Configured through `EXCHANGE_RATE_API_URL`; no API key is required by the current provider.

---

## Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Installation

Clone this repository and install dependencies for both client and server:

```bash
# Clone the repository and navigate inside
cd "Financial Tracker"

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Configuration

Create or modify `server/.env` for local backend configuration:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DB_PATH=./tracker.db
EXCHANGE_RATE_CACHE_MINUTES=15
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest/MYR
ADMIN_USERNAME=
ADMIN_PIN_HASH=
AUTH_SESSION_SECRET=
```

Create or modify `client/.env.development` for local frontend configuration:

```env
VITE_API_URL=http://localhost:4000/api
```

### Separate frontend and backend deployment

The frontend requires its API URL in the `VITE_API_URL` build variable. Set it in the frontend hosting provider before building or deploying:

```env
VITE_API_URL=https://api.example.com
```

`VITE_API_URL` may be the backend origin or include the `/api` path; the client normalizes either form. Startup fails when it is missing instead of falling back to another server.

Set the backend's production environment variables to allow the deployed frontend:

```env
NODE_ENV=production
CLIENT_ORIGIN=https://app.example.com
TURSO_DATABASE_URL=libsql://your-production-database
TURSO_AUTH_TOKEN=your-production-token
EXCHANGE_RATE_API_URL=https://your-exchange-rate-provider.example/latest/MYR
ADMIN_USERNAME=your-production-admin
ADMIN_PIN_HASH=your-production-bcrypt-hash
AUTH_SESSION_SECRET=your-production-session-secret
TRUST_PROXY=1
```

`NODE_ENV` must be supplied by the process or hosting platform. Development loads `server/.env` and always uses the local `DB_PATH`; production loads `server/.env.production` and requires the remote Turso settings. Environment files are excluded from Git and Docker images, so configure production values in the hosting provider.

Use HTTPS for both sites. For reliable cookie-based login, host the frontend and API on subdomains of the same parent domain (for example, `app.example.com` and `api.example.com`). Browsers can block the session cookie when the frontend and API use unrelated domains.

### 3. Run the Application

Start both the backend server and frontend development server:

#### Start the Backend:
```bash
cd server
npm run start
```
The server will run on the configured port, initialize the isolated local SQLite-compatible database, and populate an empty expenses table with sample seed data.

#### Start the Frontend:
```bash
cd client
npm run dev
```
The development client calls the backend configured by `client/.env.development`.

---

## Database Schema

Table name: `expenses`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, Auto-increment |
| `name` | TEXT | Description of the expense |
| `category` | TEXT | Category name |
| `price_myr` | REAL | Cost in Malaysian Ringgit |
| `price_idr` | REAL | Cost in Indonesian Rupiah |
| `original_currency` | TEXT | Currency selected at entry (`MYR` or `IDR`) |
| `exchange_rate_used` | REAL | Conversion rate applied (1 MYR = X IDR) |
| `timestamp` | TEXT | Timestamp in UTC+8 (`YYYY-MM-DDTHH:MM:SS+08:00`) |
| `created_at` | TEXT | Record insertion datetime |

---

## API Endpoints

- `POST /api/expenses`: Add a new expense (computes conversion).
- `GET /api/expenses`: Retrieve all expenses (supports sorting and filters).
- `GET /api/expenses/:id`: Get a single expense by ID.
- `PUT /api/expenses/:id`: Update an expense (recomputes conversion if price/currency changes).
- `DELETE /api/expenses/:id`: Delete an expense.
- `GET /api/summary`: Retrieve totals, category spending, and trend logs.
- `GET /api/exchange-rate`: View cached exchange rate information.

---

## Security Improvements

The API is hardened with the following controls:

- Helmet security headers, restrictive Content Security Policy, no-store responses, a restrictive Permissions Policy, and production HSTS.
- A credentialed CORS allowlist. Configure `CLIENT_ORIGIN` with one or more comma-separated trusted origins; production requires HTTPS origins.
- Allowlisted origin validation protects every state-changing API request against CSRF. Session cookies remain `HttpOnly` and `Priority=High`; they use `SameSite=None` with `Secure` in production and `SameSite=Lax` without `Secure` in development.
- Signed, time-limited session tokens with constant-time signature verification; login, logout, and credential changes invalidate older sessions. Startup rejects missing, weak, or placeholder session secrets and invalid admin credential configuration.
- Rate limits for all API traffic (300 requests per 15 minutes), login attempts (5 failed attempts per 15 minutes), receipt uploads (20 per hour), and exports (10 per 15 minutes). Set `TRUST_PROXY` only for the number of trusted proxy hops in production so client IP limits remain correct.
- JSON body size limits, safe JSON error handling, and strict server-side validation of expense fields, amounts, timestamps, currencies, and identifiers.
- Prepared SQL statements and an allowlist for sortable columns protect database operations from SQL injection.
- Receipt uploads are size-limited, use server-generated names, and are validated by file signature before storage; only JPEG, PNG, WebP, HEIC, and HEIF images are accepted.
- React’s default escaping protects rendered data from XSS, and exported spreadsheet text is escaped to prevent formula injection when opening XLSX files.
- Sensitive configuration is kept in `server/.env`, which remains ignored by Git. Do not commit real session secrets, PIN hashes, or database files.
