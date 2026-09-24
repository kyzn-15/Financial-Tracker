import { Router } from 'express';
import bcrypt from 'bcrypt';
import { resetLimiter } from '../middleware/security.js';
import { getAccountById } from '../services/accounts.js';
import { resetAppData } from '../services/appReset.js';
import {
  discardStagedReceiptFiles,
  receiptFilenamesForUser,
  restoreNamedReceiptFiles,
  restoreStagedReceiptFiles,
  stageNamedReceiptFiles,
  stageReceiptFilesForReset,
} from '../services/receiptCleanup.js';
import { consumeResetIntent, createResetIntent } from '../services/resetIntent.js';
import { requestUserId } from '../utils/ownership.js';

const router = Router();

router.post('/reset-intent', (req, res) => {
  return res.status(201).json(createResetIntent(req.auth.sessionId));
});

router.delete('/data', resetLimiter, async (req, res) => {
  const { confirmation, pin, resetToken } = req.body ?? {};
  if (
    confirmation !== 'RESET' ||
    typeof pin !== 'string' ||
    !/^\d{6,12}$/.test(pin) ||
    typeof resetToken !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(resetToken)
  ) {
    return res.status(400).json({ error: 'Reset confirmation is required.' });
  }

  let stagedReceiptDir;
  let databaseReset = false;
  const userId = requestUserId(req);
  try {
    const account = userId == null ? null : await getAccountById(userId);
    const pinHash = account?.password_hash || process.env.ADMIN_PIN_HASH || '';
    let isPinValid = false;
    try {
      isPinValid = await bcrypt.compare(pin, pinHash);
    } catch {
      isPinValid = false;
    }
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

    const ownedFilenames = userId == null ? null : await receiptFilenamesForUser(userId);
    stagedReceiptDir = ownedFilenames == null
      ? stageReceiptFilesForReset()
      : stageNamedReceiptFiles(ownedFilenames);
    await resetAppData(userId);
    databaseReset = true;
    discardStagedReceiptFiles(stagedReceiptDir);
    return res.status(204).send();
  } catch (error) {
    if (stagedReceiptDir && !databaseReset) {
      try {
        if (userId == null) restoreStagedReceiptFiles(stagedReceiptDir);
        else restoreNamedReceiptFiles(stagedReceiptDir);
      } catch (restoreError) {
        console.error('Receipt reset rollback error:', restoreError);
      }
    }
    console.error('DELETE /api/settings/data error:', error);
    return res.status(500).json({ error: 'Could not reset the application data.' });
  }
});

export default router;
