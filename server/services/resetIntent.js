import { randomBytes, timingSafeEqual } from 'crypto';

const RESET_DELAY_MS = 10_000;
const RESET_INTENT_TTL_MS = 2 * 60 * 1000;

// ponytail: process-local is fail-closed; use shared storage before running multiple API instances.
let pendingResetIntent = null;

function tokensMatch(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createResetIntent(sessionId, now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  pendingResetIntent = {
    token,
    sessionId,
    notBefore: now + RESET_DELAY_MS,
    expiresAt: now + RESET_INTENT_TTL_MS,
  };
  return { token, waitSeconds: RESET_DELAY_MS / 1000, expiresAt: pendingResetIntent.expiresAt };
}

export function consumeResetIntent(sessionId, token, now = Date.now()) {
  if (!pendingResetIntent || now > pendingResetIntent.expiresAt) {
    pendingResetIntent = null;
    return 'invalid';
  }
  if (pendingResetIntent.sessionId !== sessionId || !tokensMatch(pendingResetIntent.token, token)) {
    return 'invalid';
  }
  if (now < pendingResetIntent.notBefore) return 'too_early';

  pendingResetIntent = null;
  return 'ready';
}
