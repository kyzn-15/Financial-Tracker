// server.js — Main entry point for the Financial Tracker API
import './config/env.js';

import express from 'express';
import cors from 'cors';
import { initSchema, seedIfEmpty } from './db/database.js';
import authRouter, { requireAuth } from './routes/auth.js';
import expensesRouter from './routes/expenses.js';
import summaryRouter from './routes/summary.js';
import receiptsRouter from './routes/receipts.js';
import emergencyRouter from './routes/emergency.js';
import exportRouter from './routes/export.js';
import backupRouter from './routes/backup.js';
import categoriesRouter from './routes/categories.js';
import recurringExpensesRouter from './routes/recurringExpenses.js';
import settingsRouter from './routes/settings.js';
import { scheduleReceiptCleanup } from './services/receiptCleanup.js';
import { scheduleRecurringExpenses } from './services/recurringExpenses.js';
import { assertAuthConfiguration } from './utils/auth.js';
import {
  apiLimiter,
  configureTrustProxy,
  corsOptions,
  requireTrustedOrigin,
  securityHeaders,
  setApiResponseHeaders,
} from './middleware/security.js';
import { notFoundHandler } from './middleware/notFound.js';

// ─── Initialize database ────────────────────────────────────────────────────
await initSchema();
await seedIfEmpty();
assertAuthConfiguration();

// ─── Create Express app ─────────────────────────────────────────────────────
const app = express();

configureTrustProxy(app);
app.use(securityHeaders);
app.use(setApiResponseHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb', strict: true }));
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  return next(err);
});
app.use('/api', apiLimiter);
app.use('/api', requireTrustedOrigin);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Mount routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/expenses', requireAuth, expensesRouter);
app.use('/api/receipts', requireAuth, receiptsRouter);
app.use('/api/emergency', requireAuth, emergencyRouter);
app.use('/api/export', requireAuth, exportRouter);
app.use('/api/backup', requireAuth, backupRouter);
app.use('/api/categories', requireAuth, categoriesRouter);
app.use('/api/recurring-expenses', requireAuth, recurringExpensesRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api', requireAuth, summaryRouter);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 fallback ────────────────────────────────────────────────────────────
app.use(notFoundHandler);

app.use((err, _req, res, _next) => {
  if (res.headersSent) return;

  const status = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  if (status >= 500) {
    console.error('Unhandled API error:', err.message);
  }
  res.status(status).json({ error: status === 403 ? 'Request not allowed.' : 'Internal server error.' });
});
// ─── Start server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  scheduleReceiptCleanup();
  scheduleRecurringExpenses();
  console.log(`🚀 Financial Tracker API running on port ${PORT} (${process.env.NODE_ENV})`);
  console.log(`   Endpoints:`);
  console.log(`   - GET    /api/expenses`);
  console.log(`   - POST   /api/expenses`);
  console.log(`   - PUT    /api/expenses/:id`);
  console.log(`   - DELETE /api/expenses/:id`);
  console.log(`   - GET    /api/receipts`);
  console.log(`   - POST   /api/receipts`);
  console.log(`   - GET    /api/receipts/:id/image`);
  console.log(`   - DELETE /api/receipts/:id`);
  console.log(`   - GET    /api/summary`);
  console.log(`   - GET    /api/exchange-rate`);
  console.log(`   - GET    /api/export/records`);
  console.log(`   - POST   /api/export/records/import`);
  console.log(`   - GET    /api/health`);
});

