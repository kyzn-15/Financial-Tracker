import { Router } from 'express';
import {
  getBackupPreferences,
  recordBackup,
  resetLastBackup,
  updateBackupReminderInterval,
} from '../services/backupReminder.js';

const router = Router();

router.get('/preferences', async (req, res) => {
  try {
    res.json(await getBackupPreferences(req.auth.username));
  } catch (err) {
    console.error('GET /api/backup/preferences error:', err);
    res.status(500).json({ error: 'Failed to load backup preferences.' });
  }
});

router.put('/preferences', async (req, res) => {
  try {
    res.json(await updateBackupReminderInterval(req.auth.username, req.body?.reminder_interval_days));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/completed', async (req, res) => {
  try {
    res.json(await recordBackup(req.auth.username));
  } catch (err) {
    console.error('POST /api/backup/completed error:', err);
    res.status(500).json({ error: 'Failed to save backup date.' });
  }
});

router.delete('/last-backup', async (req, res) => {
  try {
    res.json(await resetLastBackup(req.auth.username));
  } catch (err) {
    console.error('DELETE /api/backup/last-backup error:', err);
    res.status(500).json({ error: 'Failed to reset backup date.' });
  }
});

export default router;
