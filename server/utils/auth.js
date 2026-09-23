import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { isProduction } from '../config/env.js';
import db from '../db/database.js';

export const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'financial_tracker_session';

const CLOCK_SKEW_MS = 60 * 1000;
const SESSION_VERSION = 1;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/;

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('AUTH_SESSION_SECRET must be set to at least 32 bytes');
  }
  return secret;
}

export function getConfiguredUsername() {
  return process.env.ADMIN_USERNAME?.trim() || '';
}

function getCookieOptions(includeMaxAge = true) {
  const options = [
    'HttpOnly',
    'Path=/',
    `SameSite=${isProduction ? 'None' : 'Lax'}`,
    'Priority=High',
  ];

  if (includeMaxAge) {
    options.push(`Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`);
  }
  if (isProduction) {
    options.push('Secure');
  }

  return options;
}

function sign(value) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function credentialVersionFor(passwordHash) {
  return sign(`credential:${passwordHash || ''}`);
}

async function findAccountByUsername(username) {
  const result = await db.execute({
    sql: 'SELECT id, username, password_hash, active_session_id FROM accounts WHERE username = ? COLLATE NOCASE',
    args: [username],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    username: String(row.username),
    password_hash: String(row.password_hash),
    active_session_id: row.active_session_id == null ? null : String(row.active_session_id),
  };
}

async function findAccountBySessionId(sessionId) {
  if (!sessionId) return null;
  const result = await db.execute({
    sql: 'SELECT id, username, active_session_id FROM accounts WHERE active_session_id = ?',
    args: [sessionId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    username: String(row.username),
    active_session_id: String(row.active_session_id),
  };
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;

  return timingSafeEqual(aBuffer, bBuffer);
}

export function assertAuthConfiguration() {
  const username = getConfiguredUsername();
  const pinHash = process.env.ADMIN_PIN_HASH || '';
  const pinHashMatch = pinHash.match(BCRYPT_HASH_PATTERN);
  const pinCost = pinHashMatch ? Number(pinHashMatch[1]) : 0;

  if (!username || username.length > 80 || username !== process.env.ADMIN_USERNAME) {
    throw new Error('ADMIN_USERNAME must be 1 to 80 characters without surrounding whitespace');
  }
  if (!pinHashMatch || pinCost < 10 || pinCost > 15) {
    throw new Error('ADMIN_PIN_HASH must be a bcrypt hash with cost 10 to 15');
  }

  const secret = getSessionSecret();
  if (/^(change|replace|example|secret|password)/i.test(secret)) {
    throw new Error('AUTH_SESSION_SECRET must not use a placeholder value');
  }
}

export async function createSessionToken(username) {
  const account = await findAccountByUsername(username);
  if (!account) {
    throw new Error('Cannot create a session for an unknown account');
  }

  const sessionId = randomUUID();
  await db.execute({
    sql: 'UPDATE accounts SET active_session_id = ? WHERE id = ?',
    args: [sessionId, account.id],
  });

  const issuedAt = Date.now();
  const payload = {
    version: SESSION_VERSION,
    username: account.username,
    userId: account.id,
    credentialVersion: credentialVersionFor(account.password_hash),
    sessionId,
    issuedAt,
    expiresAt: issuedAt + SESSION_DURATION_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function createSessionCookie(token) {
  return `${SESSION_COOKIE_NAME}=${token}; ${getCookieOptions().join('; ')}`;
}

export function createClearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; ${getCookieOptions(false).join('; ')}; Max-Age=0`;
}

export function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header || header.length > 8192) return null;

  const prefix = `${name}=`;
  const match = header
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix));

  if (!match) return null;

  try {
    const value = decodeURIComponent(match.slice(prefix.length));
    return value.length <= 4096 ? value : null;
  } catch {
    return null;
  }
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const now = Date.now();

    const account = typeof payload?.username === 'string'
      ? await findAccountByUsername(payload.username)
      : null;

    if (
      payload?.version !== SESSION_VERSION ||
      !account ||
      payload.userId !== account.id ||
      payload.credentialVersion !== credentialVersionFor(account.password_hash) ||
      typeof payload.sessionId !== 'string' ||
      payload.sessionId !== account.active_session_id ||
      !Number.isFinite(payload.issuedAt) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.issuedAt > now + CLOCK_SKEW_MS ||
      payload.expiresAt <= now ||
      payload.expiresAt - payload.issuedAt !== SESSION_DURATION_MS
    ) {
      return null;
    }

    return {
      ...payload,
      username: account.username,
      userId: account.id,
    };
  } catch {
    return null;
  }
}

export async function revokeSessionToken(token) {
  const session = await verifySessionToken(token);
  if (!session) return false;
  await db.execute({
    sql: 'UPDATE accounts SET active_session_id = ? WHERE id = ? AND active_session_id = ?',
    args: [randomUUID(), session.userId, session.sessionId],
  });
  return true;
}

export function createReceiptToken(receiptId, sessionId) {
  if (!receiptId || !sessionId) return '';
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `${receiptId}:${sessionId}:${expiresAt}`;
  const signature = createHmac('sha256', getSessionSecret()).update(`receipt:${payload}`).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

export async function verifyReceiptToken(receiptId, token) {
  if (!token || typeof token !== 'string' || !receiptId) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return false;

  let rawPayload;
  try {
    rawPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const expectedSignature = createHmac('sha256', getSessionSecret()).update(`receipt:${rawPayload}`).digest('base64url');
  if (!safeEqual(signature, expectedSignature)) return false;

  const [tokenReceiptId, tokenSessionId, tokenExpiresAtStr] = rawPayload.split(':');
  const tokenExpiresAt = Number(tokenExpiresAtStr);

  if (
    Number(tokenReceiptId) !== Number(receiptId) ||
    !Number.isFinite(tokenExpiresAt) ||
    tokenExpiresAt <= Date.now()
  ) {
    return false;
  }

  const owner = await findAccountBySessionId(tokenSessionId);
  if (!owner) return false;

  const receipt = await db.execute({
    sql: 'SELECT user_id FROM receipts WHERE id = ?',
    args: [Number(receiptId)],
  });
  const receiptOwner = receipt.rows[0]?.user_id;
  if (receiptOwner != null && Number(receiptOwner) !== owner.id) return false;

  return true;
}

export async function authenticateReceiptToken(receiptId, token) {
  if (!await verifyReceiptToken(receiptId, token)) return null;
  const parts = String(token).split('.');
  let rawPayload = '';
  try {
    rawPayload = Buffer.from(parts[0], 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const sessionId = rawPayload.split(':')[1];
  const owner = await findAccountBySessionId(sessionId);
  if (!owner) return null;
  return { username: owner.username, userId: owner.id, sessionId: owner.active_session_id };
}

