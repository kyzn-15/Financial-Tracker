import { randomBytes, timingSafeEqual } from 'crypto';

const RESET_DELAY_MS = 10_000;
const RESET_INTENT_TTL_MS = 2 * 60 * 1000;

// ponytail: process-local is fail-closed; use shared storage before running multiple API instances.
const pendingIntents = {
  reset: null,
  delete: null,
};

function tokensMatch(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createIntent(kind, sessionId, now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  const intent = {
    token,
    sessionId,
    notBefore: now + RESET_DELAY_MS,
    expiresAt: now + RESET_INTENT_TTL_MS,
  };
  pendingIntents[kind] = intent;
  return { token, waitSeconds: RESET_DELAY_MS / 1000, expiresAt: intent.expiresAt };
}

function consumeIntent(kind, sessionId, token, now = Date.now()) {
  const pending = pendingIntents[kind];
  if (!pending || now > pending.expiresAt) {
    pendingIntents[kind] = null;
    return 'invalid';
  }
  if (pending.sessionId !== sessionId || !tokensMatch(pending.token, token)) {
    return 'invalid';
  }
  if (now < pending.notBefore) return 'too_early';

  pendingIntents[kind] = null;
  return 'ready';
}

export function createResetIntent(sessionId, now) {
  return createIntent('reset', sessionId, now);
}

export function consumeResetIntent(sessionId, token, now) {
  return consumeIntent('reset', sessionId, token, now);
}

export function createDeleteIntent(sessionId, now) {
  return createIntent('delete', sessionId, now);
}

export function consumeDeleteIntent(sessionId, token, now) {
  return consumeIntent('delete', sessionId, token, now);
}
