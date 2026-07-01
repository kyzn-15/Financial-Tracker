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

const router = Router();

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const attemptsByIp = new Map();

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const attempt = attemptsByIp.get(ip);

  if (!attempt || attempt.resetAt <= now) {
    attemptsByIp.set(ip, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }

  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const attempt = attemptsByIp.get(ip);

  if (!attempt || attempt.resetAt <= now) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }

  attempt.count += 1;
}

function clearFailedAttempts(ip) {
  attemptsByIp.delete(ip);
}

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

router.post('/login', async (req, res) => {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }

  const { username, pin } = req.body ?? {};

  if (!validateLoginInput(username, pin)) {
    recordFailedAttempt(ip);
    return res.status(400).json({ error: 'Invalid login request.' });
  }

  try {
    const admin = getAdminCredentials();
    const isUsernameValid = username.trim() === admin.username;
    const isPinValid = await bcrypt.compare(pin, admin.pinHash);

    if (!isUsernameValid || !isPinValid) {
      recordFailedAttempt(ip);
      return res.status(401).json({ error: 'Invalid username or PIN.' });
    }

    clearFailedAttempts(ip);
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
