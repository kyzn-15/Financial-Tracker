import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { isProduction } from '../config/env.js';
import db from '../db/database.js';

export const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'financial_tracker_session';

const CLOCK_SKEW_MS = 60 * 1000;
const SESSION_VERSION = 1;
const ACTIVE_SESSION_KEY = 'active_session_id';
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

function getCredentialVersion() {
  return sign(`credential:${process.env.ADMIN_PIN_HASH || ''}`);
}

async function getActiveSessionId() {
  const result = await db.execute({
    sql: 'SELECT value FROM app_metadata WHERE key = ?',
    args: [ACTIVE_SESSION_KEY],
  });
  return typeof result.rows[0]?.value === 'string' ? result.rows[0].value : null;
}

async function rotateActiveSessionId() {
  const sessionId = randomUUID();
  await db.execute({
    sql: `INSERT INTO app_metadata (key, value, updated_at)
          VALUES (?, ?, datetime('now','+8 hours'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [ACTIVE_SESSION_KEY, sessionId],
  });
  return sessionId;
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
  const issuedAt = Date.now();
  const payload = {
    version: SESSION_VERSION,
    username,
    credentialVersion: getCredentialVersion(),
    sessionId: await rotateActiveSessionId(),
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

    if (
      payload?.version !== SESSION_VERSION ||
      payload.username !== getConfiguredUsername() ||
      payload.credentialVersion !== getCredentialVersion() ||
      typeof payload.sessionId !== 'string' ||
      payload.sessionId !== await getActiveSessionId() ||
      !Number.isFinite(payload.issuedAt) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.issuedAt > now + CLOCK_SKEW_MS ||
      payload.expiresAt <= now ||
      payload.expiresAt - payload.issuedAt !== SESSION_DURATION_MS
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function revokeSessionToken(token) {
  if (!await verifySessionToken(token)) return false;
  await rotateActiveSessionId();
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

  const activeSessionId = await getActiveSessionId();
  if (!activeSessionId || tokenSessionId !== activeSessionId) {
    return false;
  }

  return true;
}

