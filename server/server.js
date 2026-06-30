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
app.use(cors());
app.use(express.json());

// ─── Mount routes ────────────────────────────────────────────────────────────
app.use('/api/expenses', expensesRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api', summaryRouter);

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
