# Project AI Rules & Constraints

## Architecture Reference

Before changes that depend on project structure, module boundaries, data flow, or architectural decisions, read `ARCHITECTURE.md`.

`ARCHITECTURE.md` is the authoritative architecture reference. Do not guess relationships it documents.

## Implementation Rules

- Keep diffs minimal, match existing patterns, and do not add abstractions for one-off use.
- ES modules everywhere; async/await; small single-purpose functions
- Client HTTP only through `services/api.js`; server logic in routes/services, not `server.js`
- Keep API routes under `/api`; apply `requireAuth` to new protected routes and return JSON errors shaped as `{ error | message }`.
- Use the exported database client with parameter arguments; do not interpolate untrusted values into SQL.
- Support only MYR and IDR. Use the exchange-rate and UTC+8 helpers for new monetary records and timestamps.
- Validate inputs at route boundary; return 400/404/500 with clear JSON
- Neomorphic styling: reuse CSS variables in `App.css` / `index.css`; avoid inline styles
- Keep secrets in ignored environment files; never hardcode or commit credentials.
- Run `npm run lint` (oxlint) in `client/` after client edits
- No tests unless requested; no drive-by refactors

## Definition of Done

- No placeholders, TODOs, or untyped parameters.
- Code must be complete, syntactically valid, and ready to deploy.
- Auth, CORS, and env vars respected; no hardcoded credentials
- Both `client` and `server` run without errors after change
