// exchangeRate.js — In-memory cached MYR↔IDR exchange rate service

// Cache structure: { myrToIdr, idrToMyr, fetchedAt }
let cache = null;

// TTL in milliseconds (default 15 minutes)
const CACHE_TTL_MS =
  (parseInt(process.env.EXCHANGE_RATE_CACHE_MINUTES, 10) || 15) * 60 * 1000;
const EXCHANGE_RATE_API_URL = process.env.EXCHANGE_RATE_API_URL?.trim();

if (!EXCHANGE_RATE_API_URL) {
  throw new Error('EXCHANGE_RATE_API_URL must be configured');
}

/**
 * Check if the cache is still valid (not expired).
 */
function isCacheValid() {
  if (!cache || !cache.fetchedAt) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

export const FALLBACK_MYR_TO_IDR = 4500;

/**
 * Fetch the latest MYR→IDR exchange rate.
 * Returns { myrToIdr, idrToMyr, usingFallback }.
 */
export async function getExchangeRate() {
  // Return cached rate if still valid
  if (isCacheValid()) {
    return {
      myrToIdr: cache.myrToIdr,
      idrToMyr: cache.idrToMyr,
      usingFallback: false,
    };
  }

  try {
    const res = await fetch(EXCHANGE_RATE_API_URL);

    if (!res.ok) {
      console.error(`Exchange rate API returned status ${res.status}`);
      return getFallbackRate();
    }

    const data = await res.json();
    const myrToIdr = data.rates?.IDR;

    if (!myrToIdr) {
      console.warn('Exchange rate API response missing IDR rate. Using fallback.');
      return getFallbackRate();
    }

    // Update cache
    cache = {
      myrToIdr,
      idrToMyr: 1 / myrToIdr,
      fetchedAt: Date.now(),
    };

    console.log(`💱 Exchange rate updated: 1 MYR = ${myrToIdr} IDR`);
    return {
      myrToIdr: cache.myrToIdr,
      idrToMyr: cache.idrToMyr,
      usingFallback: false,
    };
  } catch (err) {
    console.warn('Failed to fetch exchange rate:', err.message, '- Using fallback.');
    return getFallbackRate();
  }
}

/**
 * Returns a hardcoded fallback rate of 1 MYR = 4500 IDR
 */
function getFallbackRate() {
  return {
    myrToIdr: FALLBACK_MYR_TO_IDR,
    idrToMyr: 1 / FALLBACK_MYR_TO_IDR,
    usingFallback: true,
  };
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
      message: 'Using fallback rate (API unavailable)',
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
