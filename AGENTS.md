# Project AI Rules & Constraints

## 1. Core Stack
- **Client:** React 19, Vite 8, JSX (no TS), Chart.js + `react-chartjs-2`, vanilla CSS (Neomorphic Soft UI)
- **Server:** Node.js 18+, Express 4, ES modules (`import`/`export`)
- **Data:** SQLite via `better-sqlite3`; schema in `server/db/schema.sql`
- **Auth:** bcrypt + cookie sessions; `credentials: 'include'` on client
- **Env:** root `.env` (loaded by `server/server.js`); never commit secrets

## 2. Architectural Rules
- **Layout:** `client/src/components/` (UI), `hooks/` (state), `services/api.js` (HTTP only), `utils/` (formatters)
- **Server:** `server/routes/` (HTTP), `server/db/database.js` (DB singleton), `server/services/` (exchange rate, cleanup)
- **API:** prefix `/api`; protected routes use `requireAuth`; JSON errors `{ error | message }`
- **DB:** use prepared statements via exported `db`; no raw string SQL in routes beyond params
- **Currency:** MYR/IDR only; conversions via `server/services/exchangeRate.js`; store both amounts + rate used
- **Time:** UTC+8 ISO timestamps (`+08:00`); use `server/utils/datetime.js` helpers
- **Scope:** minimal diffs; match existing patterns; no new abstractions for one-off use

## 3. Code Style & Quality
- ES modules everywhere; async/await; small single-purpose functions
- Client HTTP only through `services/api.js`; server logic in routes/services, not `server.js`
- Validate inputs at route boundary; return 400/404/500 with clear JSON
- Neomorphic styling: reuse CSS variables in `App.css` / `index.css`; avoid inline styles
- Run `npm run lint` (oxlint) in `client/` after client edits
- No tests unless requested; no drive-by refactors

## 4. Definition of Done
- No placeholders, TODOs, or untyped parameters.
- Code must be complete, syntactically valid, and ready to deploy.
- Auth, CORS, and env vars respected; no hardcoded credentials
- Both `client` and `server` run without errors after change
