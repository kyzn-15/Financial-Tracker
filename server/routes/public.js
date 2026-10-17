import { Router } from 'express';
import { getExchangeRateInfo } from '../services/exchangeRate.js';

const router = Router();

router.get('/exchange-rate', async (_req, res) => {
  try {
    res.json(await getExchangeRateInfo());
  } catch (err) {
    console.error('GET /api/public/exchange-rate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
