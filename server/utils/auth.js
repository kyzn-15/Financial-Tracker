import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'financial_tracker_session';

const COOKIE_OPTIONS = [
  'HttpOnly',
  'Path=/',
  'SameSite=Strict',
  `Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`,
];

if (process.env.NODE_ENV === 'production') {
  COOKIE_OPTIONS.push('Secure');
}

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SESSION_SECRET must be set to at least 32 characters');
  }
  return secret;
}

function sign(value) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export function createSessionToken(username) {
  const payload = {
    username,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function createSessionCookie(token) {
  return `${SESSION_COOKIE_NAME}=${token}; ${COOKIE_OPTIONS.join('; ')}`;
}

export function createClearSessionCookie() {
  const options = COOKIE_OPTIONS.filter((option) => !option.startsWith('Max-Age='));
  return `${SESSION_COOKIE_NAME}=; ${options.join('; ')}; Max-Age=0`;
}

export function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;

  const cookies = header.split(';').map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    if (!payload?.username || !payload?.expiresAt || payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
