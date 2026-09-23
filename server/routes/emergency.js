import { Router } from 'express';
import {
  buildEmergencySimulation,
  buildEmergencySummary,
  getEmergencyCategoryOptions,
  getEmergencySettings,
  updateEmergencySettings,
} from '../services/emergencyFund.js';
import { requestUserId } from '../utils/ownership.js';

const router = Router();

const VALID_TARGET_MONTHS = [3, 6, 9, 12];
const VALID_CURRENCIES = new Set(['MYR', 'IDR']);
const MAX_FUND_AMOUNT = 1_000_000_000_000;

function invalidSettings(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function parseFundAmount(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > MAX_FUND_AMOUNT) {
    throw invalidSettings(`${field} must be a non-negative number`);
  }
  return number;
}

function parseEmergencySettingsBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidSettings('Invalid emergency settings');
  }

  const input = {};
  if (body.current_savings !== undefined) input.current_savings = parseFundAmount(body.current_savings, 'current_savings');
  if (body.reserved_funds !== undefined) input.reserved_funds = parseFundAmount(body.reserved_funds, 'reserved_funds');
  if (body.currency !== undefined) {
    const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : '';
    if (!VALID_CURRENCIES.has(currency)) throw invalidSettings('currency must be MYR or IDR');
    input.currency = currency;
  }
  if (body.target_months !== undefined) {
    const targetMonths = Number(body.target_months);
    if (!VALID_TARGET_MONTHS.includes(targetMonths)) {
      throw invalidSettings('target_months must be one of 3, 6, 9, or 12');
    }
    input.target_months = targetMonths;
  }
  if (body.essential_categories !== undefined) input.essential_categories = body.essential_categories;
  return input;
}

router.get('/settings', async (req, res) => {
  try {
    const userId = requestUserId(req);
    const settings = await getEmergencySettings(userId);
    const categories = await getEmergencyCategoryOptions(settings, userId);
    res.json({ settings, categories });
  } catch (err) {
    console.error('GET /api/emergency/settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const userId = requestUserId(req);
    const settings = await updateEmergencySettings(parseEmergencySettingsBody(req.body), userId);
    const categories = await getEmergencyCategoryOptions(settings, userId);
    res.json({ settings, categories });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('PUT /api/emergency/settings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    res.json(await buildEmergencySummary(requestUserId(req)));
  } catch (err) {
    console.error('GET /api/emergency/summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/simulation', async (req, res) => {
  try {
    res.json(await buildEmergencySimulation(req.query, requestUserId(req)));
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('GET /api/emergency/simulation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
