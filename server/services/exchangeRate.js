// exchangeRate.js — Cached MYR↔IDR rate with last successful API rate as backup
import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';

// Cache structure: { myrToIdr, idrToMyr, fetchedAt }
let cache = null;

const CACHE_TTL_MS =
  (parseInt(process.env.EXCHANGE_RATE_CACHE_MINUTES, 10) || 15) * 60 * 1000;
const EXCHANGE_RATE_API_URL = process.env.EXCHANGE_RATE_API_URL?.trim();

if (!EXCHANGE_RATE_API_URL) {
  throw new Error('EXCHANGE_RATE_API_URL must be configured');
}

export const LAST_EXCHANGE_RATE_KEY = 'last_exchange_rate_myr_idr';
export const LAST_EXCHANGE_RATE_FETCHED_AT_KEY = 'last_exchange_rate_fetched_at';

/** Used only when the API is unavailable and no rate has ever been saved. */
export const FALLBACK_MYR_TO_IDR = 4500;

function isCacheValid() {
  if (!cache || !cache.fetchedAt) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

function parseMyrToIdr(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function ratePayload(myrToIdr, usingFallback) {
  return {
    myrToIdr,
    idrToMyr: 1 / myrToIdr,
    usingFallback,
  };
}

async function saveLastFetchedRate(myrToIdr, fetchedAtIso) {
  const updatedAt = nowUTC8();
  await db.batch([
    {
      sql: `INSERT INTO app_metadata (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [LAST_EXCHANGE_RATE_KEY, String(myrToIdr), updatedAt],
    },
    {
      sql: `INSERT INTO app_metadata (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [LAST_EXCHANGE_RATE_FETCHED_AT_KEY, fetchedAtIso, updatedAt],
    },
  ], 'write');
}

async function loadLastFetchedRate() {
  const result = await db.execute({
    sql: 'SELECT key, value FROM app_metadata WHERE key IN (?, ?)',
    args: [LAST_EXCHANGE_RATE_KEY, LAST_EXCHANGE_RATE_FETCHED_AT_KEY],
  });
  const values = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  const myrToIdr = parseMyrToIdr(values[LAST_EXCHANGE_RATE_KEY]);
  if (myrToIdr == null) return null;
  return {
    myrToIdr,
    fetchedAt: typeof values[LAST_EXCHANGE_RATE_FETCHED_AT_KEY] === 'string'
      ? values[LAST_EXCHANGE_RATE_FETCHED_AT_KEY]
      : null,
  };
}

async function getFallbackRate() {
  const saved = await loadLastFetchedRate();
  if (saved) {
    console.warn(`Using last saved exchange rate: 1 MYR = ${saved.myrToIdr} IDR`);
    return {
      ...ratePayload(saved.myrToIdr, true),
      usingSavedRate: true,
      savedFetchedAt: saved.fetchedAt,
    };
  }

  console.warn(`No saved exchange rate found. Using bootstrap rate: 1 MYR = ${FALLBACK_MYR_TO_IDR} IDR`);
  return {
    ...ratePayload(FALLBACK_MYR_TO_IDR, true),
    usingSavedRate: false,
  };
}

/**
 * Fetch the latest MYR→IDR exchange rate.
 * Returns { myrToIdr, idrToMyr, usingFallback }.
 */
export async function getExchangeRate() {
  if (isCacheValid()) {
    return ratePayload(cache.myrToIdr, false);
  }

  try {
    const res = await fetch(EXCHANGE_RATE_API_URL);

    if (!res.ok) {
      console.error(`Exchange rate API returned status ${res.status}`);
      return getFallbackRate();
    }

    const data = await res.json();
    const myrToIdr = parseMyrToIdr(data.rates?.IDR);

    if (myrToIdr == null) {
      console.warn('Exchange rate API response missing a valid IDR rate. Using last saved rate.');
      return getFallbackRate();
    }

    const fetchedAt = Date.now();
    cache = {
      myrToIdr,
      idrToMyr: 1 / myrToIdr,
      fetchedAt,
    };

    try {
      await saveLastFetchedRate(myrToIdr, new Date(fetchedAt).toISOString());
    } catch (err) {
      console.error('Failed to persist last exchange rate:', err.message);
    }

    console.log(`💱 Exchange rate updated: 1 MYR = ${myrToIdr} IDR`);
    return ratePayload(cache.myrToIdr, false);
  } catch (err) {
    console.warn('Failed to fetch exchange rate:', err.message, '- Using last saved rate.');
    return getFallbackRate();
  }
}

/**
 * Fetch (or read cache for) the current rate with metadata for the API endpoint.
 */
export async function getExchangeRateInfo() {
  const rate = await getExchangeRate();
  const info = {
    myrToIdr: rate.myrToIdr,
    idrToMyr: rate.idrToMyr,
    usingFallback: rate.usingFallback,
  };

  if (rate.usingFallback) {
    return {
      ...info,
      cached: false,
      fetchedAt: rate.savedFetchedAt || undefined,
      message: rate.usingSavedRate
        ? 'Using last saved rate (API unavailable)'
        : 'Using bootstrap rate (API unavailable and no saved rate yet)',
    };
  }

  return {
    ...info,
    cached: true,
    fetchedAt: new Date(cache.fetchedAt).toISOString(),
    expiresAt: new Date(cache.fetchedAt + CACHE_TTL_MS).toISOString(),
    isValid: isCacheValid(),
  };
}

export function clearExchangeRateCache() {
  cache = null;
}
