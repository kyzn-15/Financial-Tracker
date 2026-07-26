import { Router } from 'express';
import bcrypt from 'bcrypt';
import { resetLimiter } from '../middleware/security.js';
import { resetAppData } from '../services/appReset.js';
import {
  discardStagedReceiptFiles,
  restoreStagedReceiptFiles,
  stageReceiptFilesForReset,
} from '../services/receiptCleanup.js';
import { consumeResetIntent, createResetIntent } from '../services/resetIntent.js';

const router = Router();

router.post('/reset-intent', (req, res) => {
  return res.status(201).json(createResetIntent(req.auth.sessionId));
});

router.delete('/data', resetLimiter, async (req, res) => {
  const { confirmation, pin, resetToken } = req.body ?? {};
  if (
    confirmation !== 'RESET' ||
    typeof pin !== 'string' ||
    !/^\d{4,12}$/.test(pin) ||
    typeof resetToken !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(resetToken)
  ) {
    return res.status(400).json({ error: 'Reset confirmation is required.' });
  }

  let stagedReceiptDir;
  let databaseReset = false;
  try {
    const isPinValid = await bcrypt.compare(pin, process.env.ADMIN_PIN_HASH);
    if (!isPinValid) {
      return res.status(401).json({ error: 'Current PIN is incorrect.' });
    }

    const intentStatus = consumeResetIntent(req.auth.sessionId, resetToken);
    if (intentStatus === 'too_early') {
      return res.status(425).json({ error: 'The reset safety delay has not finished.' });
    }
    if (intentStatus !== 'ready') {
      return res.status(400).json({ error: 'Reset confirmation expired. Open the reset dialog again.' });
    }

    stagedReceiptDir = stageReceiptFilesForReset();
    await resetAppData();
    databaseReset = true;
    discardStagedReceiptFiles(stagedReceiptDir);
    return res.status(204).send();
  } catch (error) {
    if (stagedReceiptDir && !databaseReset) {
      try {
        restoreStagedReceiptFiles(stagedReceiptDir);
      } catch (restoreError) {
        console.error('Receipt reset rollback error:', restoreError);
      }
    }
    console.error('DELETE /api/settings/data error:', error);
    return res.status(500).json({ error: 'Could not reset the application data.' });
  }
});

export default router;
