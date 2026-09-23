import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../db/database.js';
import {
  authenticateReceiptToken,
  createClearSessionCookie,
  createSessionCookie,
  createSessionToken,
  getCookie,
  revokeSessionToken,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from '../utils/auth.js';
import { deleteAccount, getAccountById, registerAccount } from '../services/accounts.js';
import { loginLimiter } from '../middleware/security.js';

const router = Router();
const DUMMY_PIN_HASH = '$2b$10$Lv/mX1AfEEf4o4p.qXJAoewB5ll6TINgaMucGrefMhu/FKtoNBjRK';

function validateLoginInput(username, pin) {
  return (
    typeof username === 'string' &&
    username.trim().length > 0 &&
    username.trim().length <= 80 &&
    typeof pin === 'string' &&
    /^\d{4,12}$/.test(pin)
  );
}

async function findAccountForLogin(username) {
  const result = await db.execute({
    sql: 'SELECT id, username, password_hash FROM accounts WHERE username = ? COLLATE NOCASE',
    args: [username.trim()],
  });
  return result.rows[0] || null;
}

async function pinMatches(pin, passwordHash) {
  try {
    return await bcrypt.compare(pin, passwordHash);
  } catch {
    return false;
  }
}

router.post('/register', loginLimiter, async (req, res) => {
  const { username, pin } = req.body ?? {};
  if (!validateLoginInput(username, pin)) {
    return res.status(400).json({ error: 'Username must be 1 to 80 characters and PIN must be 4 to 12 digits.' });
  }

  try {
    const account = await registerAccount(username, pin);
    const token = await createSessionToken(account.username);
    res.setHeader('Set-Cookie', createSessionCookie(token));
    return res.status(201).json({ authenticated: true });
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 409) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('POST /api/auth/register error:', err.message);
    return res.status(500).json({ error: 'Could not create the account.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, pin } = req.body ?? {};

  if (!validateLoginInput(username, pin)) {
    return res.status(400).json({ error: 'Invalid login request.' });
  }

  try {
    const account = await findAccountForLogin(username);
    const passwordHash = account ? String(account.password_hash) : DUMMY_PIN_HASH;
    const isPinValid = await pinMatches(pin, passwordHash);

    if (!account || !isPinValid) {
      return res.status(401).json({ error: 'Invalid username or PIN.' });
    }

    const token = await createSessionToken(String(account.username));
    res.setHeader('Set-Cookie', createSessionCookie(token));
    return res.json({ authenticated: true });
  } catch (err) {
    console.error('POST /api/auth/login error:', err.message);
    return res.status(500).json({ error: 'Authentication is not configured.' });
  }
});

router.get('/session', async (req, res) => {
  try {
    const token = getCookie(req, SESSION_COOKIE_NAME);
    const session = await verifySessionToken(token);

    if (!session) {
      return res.status(401).json({ authenticated: false });
    }

    return res.json({ authenticated: true, expiresAt: session.expiresAt });
  } catch (err) {
    console.error('GET /api/auth/session error:', err.message);
    return res.status(500).json({ error: 'Could not verify the session.' });
  }
});

router.delete('/account', async (req, res) => {
  try {
    const session = await verifySessionToken(getCookie(req, SESSION_COOKIE_NAME));
    if (!session) {
      res.setHeader('Set-Cookie', createClearSessionCookie());
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const body = req.body ?? {};
    const requestedName = typeof body.username === 'string' ? body.username.trim() : null;
    const requestedId = body.userId == null || body.userId === '' ? null : Number(body.userId);
    const targetsSomeoneElse = (
      (requestedName && requestedName.localeCompare(session.username, undefined, { sensitivity: 'accent' }) !== 0)
      || (requestedId != null && requestedId !== session.userId)
    );
    if (targetsSomeoneElse) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    if (typeof body.pin !== 'string' || !/^\d{4,12}$/.test(body.pin)) {
      return res.status(400).json({ error: 'Current PIN is required.' });
    }

    const account = await getAccountById(session.userId);
    if (!account || !await pinMatches(body.pin, account.password_hash)) {
      return res.status(401).json({ error: 'Current PIN is incorrect.' });
    }

    await deleteAccount(account.id);
    res.setHeader('Set-Cookie', createClearSessionCookie());
    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/auth/account error:', err.message);
    return res.status(500).json({ error: 'Could not delete the account.' });
  }
});

router.post('/logout', async (req, res) => {
  res.setHeader('Set-Cookie', createClearSessionCookie());
  try {
    await revokeSessionToken(getCookie(req, SESSION_COOKIE_NAME));
    return res.status(204).send();
  } catch (err) {
    console.error('POST /api/auth/logout error:', err.message);
    return res.status(500).json({ error: 'Could not invalidate the session.' });
  }
});

export async function requireAuth(req, res, next) {
  try {
    const token = getCookie(req, SESSION_COOKIE_NAME);
    const session = await verifySessionToken(token);

    if (!session) {
      // Allow receipt image GET requests if authenticated via a valid session-bound receipt token
      if (req.method === 'GET' && req.path.endsWith('/image') && req.query?.token) {
        const match = req.path.match(/^\/(\d+)\/image$/);
        if (match) {
          const owner = await authenticateReceiptToken(Number(match[1]), req.query.token);
          if (owner) {
            req.auth = owner;
            return next();
          }
        }
      }

      res.setHeader('Set-Cookie', createClearSessionCookie());
      return res.status(401).json({ error: 'Authentication required.' });
    }

    req.auth = session;
    return next();
  } catch (err) {
    return next(err);
  }
}

export default router;
