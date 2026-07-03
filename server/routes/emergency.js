import { Router } from 'express';
import {
  buildEmergencySimulation,
  buildEmergencySummary,
  getEmergencyCategoryOptions,
  getEmergencySettings,
  updateEmergencySettings,
} from '../services/emergencyFund.js';

const router = Router();

router.get('/settings', (_req, res) => {
  try {
    const settings = getEmergencySettings();
    res.json({ settings, categories: getEmergencyCategoryOptions(settings) });
  } catch (err) {
    console.error('GET /api/emergency/settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', (req, res) => {
  try {
    const settings = updateEmergencySettings(req.body);
    res.json({ settings, categories: getEmergencyCategoryOptions(settings) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/summary', (_req, res) => {
  try {
    res.json(buildEmergencySummary());
  } catch (err) {
    console.error('GET /api/emergency/summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/simulation', (req, res) => {
  try {
    res.json(buildEmergencySimulation(req.query));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
