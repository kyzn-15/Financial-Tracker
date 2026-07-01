// server.js — Main entry point for the Financial Tracker API
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the parent directory (d:\Financial Tracker\.env)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import { initSchema, seedIfEmpty } from './db/database.js';
import authRouter, { requireAuth } from './routes/auth.js';
import expensesRouter from './routes/expenses.js';
import summaryRouter from './routes/summary.js';
import receiptsRouter from './routes/receipts.js';
import { scheduleReceiptCleanup } from './services/receiptCleanup.js';

// ─── Initialize database ────────────────────────────────────────────────────
initSchema();
seedIfEmpty();

// ─── Create Express app ─────────────────────────────────────────────────────
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true,
  credentials: true,
}));
app.use(express.json());
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  return next(err);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Mount routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/expenses', requireAuth, expensesRouter);
app.use('/api/receipts', requireAuth, receiptsRouter);
app.use('/api', requireAuth, summaryRouter);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  scheduleReceiptCleanup();
  console.log(`🚀 Financial Tracker API running on http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   - GET    /api/expenses`);
  console.log(`   - POST   /api/expenses`);
  console.log(`   - GET    /api/expenses/:id`);
  console.log(`   - PUT    /api/expenses/:id`);
  console.log(`   - DELETE /api/expenses/:id`);
  console.log(`   - GET    /api/receipts`);
  console.log(`   - POST   /api/receipts`);
  console.log(`   - GET    /api/receipts/:id/image`);
  console.log(`   - DELETE /api/receipts/:id`);
  console.log(`   - GET    /api/summary`);
  console.log(`   - GET    /api/exchange-rate`);
  console.log(`   - GET    /api/health`);
});
