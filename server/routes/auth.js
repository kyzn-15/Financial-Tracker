import { Router } from 'express';
import bcrypt from 'bcrypt';
import {
  createClearSessionCookie,
  createSessionCookie,
  createSessionToken,
  getCookie,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from '../utils/auth.js';
import { loginLimiter } from '../middleware/security.js';

const router = Router();

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const pinHash = process.env.ADMIN_PIN_HASH;

  if (!username || !pinHash) {
    throw new Error('ADMIN_USERNAME and ADMIN_PIN_HASH must be configured');
  }

  return { username, pinHash };
}

function validateLoginInput(username, pin) {
  return (
    typeof username === 'string' &&
    username.trim().length > 0 &&
    username.trim().length <= 80 &&
    typeof pin === 'string' &&
    /^\d{4,12}$/.test(pin)
  );
}

router.post('/login', loginLimiter, async (req, res) => {

  const { username, pin } = req.body ?? {};

  if (!validateLoginInput(username, pin)) {
    return res.status(400).json({ error: 'Invalid login request.' });
  }

  try {
    const admin = getAdminCredentials();
    const isUsernameValid = username.trim() === admin.username;
    const isPinValid = await bcrypt.compare(pin, admin.pinHash);

    if (!isUsernameValid || !isPinValid) {
      return res.status(401).json({ error: 'Invalid username or PIN.' });
    }

    const token = createSessionToken(admin.username);

    res.setHeader('Set-Cookie', createSessionCookie(token));
    return res.json({ authenticated: true });
  } catch (err) {
    console.error('POST /api/auth/login error:', err.message);
    return res.status(500).json({ error: 'Authentication is not configured.' });
  }
});

router.get('/session', (req, res) => {
  const token = getCookie(req, SESSION_COOKIE_NAME);
  const session = verifySessionToken(token);

  if (!session) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({ authenticated: true, expiresAt: session.expiresAt });
});

router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', createClearSessionCookie());
  return res.status(204).send();
});

export function requireAuth(req, res, next) {
  const token = getCookie(req, SESSION_COOKIE_NAME);
  const session = verifySessionToken(token);

  if (!session) {
    res.setHeader('Set-Cookie', createClearSessionCookie());
    return res.status(401).json({ error: 'Authentication required.' });
  }

  req.auth = session;
  return next();
}

export default router;
