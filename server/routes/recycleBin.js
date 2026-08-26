// recycleBin.js — Express Router for Recycle Bin restore and permanent deletion
import { Router } from 'express';
import {
  emptyRecycleBin,
  getRecycledExpenseState,
  getRecycledReceiptState,
  listRecycleBin,
  purgeExpense,
  purgeReceipt,
  restoreExpense,
  restoreReceipt,
} from '../services/recycleBin.js';
import { RETENTION_DAYS } from '../services/receiptCleanup.js';

const router = Router();

function parseItemId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function itemNotFound(res, label, state) {
  if (state === 'missing') {
    return res.status(404).json({ error: `${label} not found` });
  }
  // 'active' covers duplicate restores/purges: the item already left the bin.
  return res.status(404).json({ error: `${label} is not in the Recycle Bin.` });
}

// ─── GET /api/recycle-bin — List soft-deleted expenses and receipts ────────
router.get('/', async (req, res) => {
  try {
    res.json({
      retention_days: RETENTION_DAYS,
      ...await listRecycleBin(req.auth?.sessionId),
    });
  } catch (err) {
    console.error('GET /api/recycle-bin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/recycle-bin/expenses/:id/restore — Make an expense active again
router.post('/expenses/:id/restore', async (req, res) => {
  try {
    const id = parseItemId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid expense id.' });

    if (!await restoreExpense(id)) {
      return itemNotFound(res, 'Expense', await getRecycledExpenseState(id));
    }

    res.json({ message: 'Expense restored.' });
  } catch (err) {
    console.error('POST /api/recycle-bin/expenses/:id/restore error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/recycle-bin/expenses/:id — Permanently remove one expense ──
router.delete('/expenses/:id', async (req, res) => {
  try {
    const id = parseItemId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid expense id.' });

    if (!await purgeExpense(id)) {
      return itemNotFound(res, 'Expense', await getRecycledExpenseState(id));
    }

    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/recycle-bin/expenses/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/recycle-bin/receipts/:id/restore — Make a receipt active again
router.post('/receipts/:id/restore', async (req, res) => {
  try {
    const id = parseItemId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid receipt id.' });

    if (!await restoreReceipt(id)) {
      return itemNotFound(res, 'Receipt', await getRecycledReceiptState(id));
    }

    res.json({ message: 'Receipt restored.' });
  } catch (err) {
    console.error('POST /api/receipts/:id/restore error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/recycle-bin/receipts/:id — Permanently remove one receipt ──
router.delete('/receipts/:id', async (req, res) => {
  try {
    const id = parseItemId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid receipt id.' });

    if (!await purgeReceipt(id)) {
      return itemNotFound(res, 'Receipt', await getRecycledReceiptState(id));
    }

    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/recycle-bin/receipts/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/recycle-bin — Permanently empty the Recycle Bin ────────────
router.delete('/', async (_req, res) => {
  try {
    res.json(await emptyRecycleBin());
  } catch (err) {
    console.error('DELETE /api/recycle-bin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
