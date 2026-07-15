import { Router } from 'express';
import {
  buildEmergencySimulation,
  buildEmergencySummary,
  getEmergencyCategoryOptions,
  getEmergencySettings,
  updateEmergencySettings,
} from '../services/emergencyFund.js';

const router = Router();

router.get('/settings', async (_req, res) => {
  try {
    const settings = await getEmergencySettings();
    const categories = await getEmergencyCategoryOptions(settings);
    res.json({ settings, categories });
  } catch (err) {
    console.error('GET /api/emergency/settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const settings = await updateEmergencySettings(req.body);
    const categories = await getEmergencyCategoryOptions(settings);
    res.json({ settings, categories });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/summary', async (_req, res) => {
  try {
    res.json(await buildEmergencySummary());
  } catch (err) {
    console.error('GET /api/emergency/summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/simulation', async (req, res) => {
  try {
    res.json(await buildEmergencySimulation(req.query));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
