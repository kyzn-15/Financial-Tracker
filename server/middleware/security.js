import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { isProduction } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function parseOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('CLIENT_ORIGIN must contain valid HTTP(S) origins');
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('CLIENT_ORIGIN entries must be origins without paths or credentials');
  }

  if (isProduction && url.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('Production CLIENT_ORIGIN entries must use HTTPS');
  }

  return url.origin;
}

function loadAllowedOrigins() {
  const configured = process.env.CLIENT_ORIGIN
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (isProduction && (!configured || configured.length === 0)) {
    throw new Error('CLIENT_ORIGIN must be configured in production');
  }

  return new Set((configured?.length ? configured : DEFAULT_DEVELOPMENT_ORIGINS).map(parseOrigin));
}

const allowedOrigins = loadAllowedOrigins();

function rejectCorsOrigin(origin, callback) {
  const error = new Error('Origin is not allowed');
  error.statusCode = 403;
  error.expose = true;
  callback(error);
}

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return rejectCorsOrigin(origin, callback);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  exposedHeaders: ['Content-Disposition', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
  maxAge: 600,
  optionsSuccessStatus: 204,
};

function originFromHeader(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function requireTrustedOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const requestOrigin = originFromHeader(req.get('Origin')) || originFromHeader(req.get('Referer'));
  if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }

  return next();
}

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      imgSrc: ["'none'"],
      fontSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: isProduction
    ? {
        maxAge: 31_536_000,
        includeSubDomains: true,
      }
    : false,
  referrerPolicy: { policy: 'no-referrer' },
});

export function setApiResponseHeaders(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
  );
  res.setHeader('X-Robots-Tag', 'noindex, noarchive, nosnippet');
  next();
}

function jsonRateLimitHandler(_req, res, _next, options) {
  res.status(options.statusCode).json(options.message);
}

const rateLimitDefaults = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
};

export const apiLimiter = rateLimit({
  ...rateLimitDefaults,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: { error: 'Too many API requests. Try again later.' },
});

export const loginLimiter = rateLimit({
  ...rateLimitDefaults,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Try again later.' },
});

export const receiptUploadLimiter = rateLimit({
  ...rateLimitDefaults,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many receipt uploads. Try again later.' },
});

export const exportLimiter = rateLimit({
  ...rateLimitDefaults,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many export requests. Try again later.' },
});

export const backupImportLimiter = rateLimit({
  ...rateLimitDefaults,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: 'Too many database import attempts. Try again later.' },
});

export function configureTrustProxy(app) {
  const value = process.env.TRUST_PROXY?.trim();
  if (!value) return;

  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
    throw new Error('TRUST_PROXY must be an integer from 1 to 10');
  }

  app.set('trust proxy', hops);
}
