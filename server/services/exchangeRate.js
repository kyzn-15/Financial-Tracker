// exchangeRate.js — In-memory cached MYR↔IDR exchange rate service

// Cache structure: { myrToIdr, idrToMyr, fetchedAt }
let cache = null;

// TTL in milliseconds (default 15 minutes)
const CACHE_TTL_MS =
  (parseInt(process.env.EXCHANGE_RATE_CACHE_MINUTES, 10) || 15) * 60 * 1000;

/**
 * Check if the cache is still valid (not expired).
 */
function isCacheValid() {
  if (!cache || !cache.fetchedAt) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

/**
 * Fetch the latest MYR→IDR exchange rate.
 * Returns { myrToIdr, idrToMyr } or null on failure.
 */
export async function getExchangeRate() {
  // Return cached rate if still valid
  if (isCacheValid()) {
    return { myrToIdr: cache.myrToIdr, idrToMyr: cache.idrToMyr };
  }

  try {
    const res = await fetch(
      'https://open.er-api.com/v6/latest/MYR'
    );

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
    return { myrToIdr: cache.myrToIdr, idrToMyr: cache.idrToMyr };
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
    myrToIdr: 4500,
    idrToMyr: 1 / 4500
  };
}

/**
 * Return the current cache state (for the /api/exchange-rate endpoint).
 */
export function getCachedRate() {
  if (!cache) {
    const fallback = getFallbackRate();
    return { 
      cached: false, 
      myrToIdr: fallback.myrToIdr,
      idrToMyr: fallback.idrToMyr,
      message: 'Using fallback rate (no cache available)' 
    };
  }

  return {
    cached: true,
    myrToIdr: cache.myrToIdr,
    idrToMyr: cache.idrToMyr,
    fetchedAt: new Date(cache.fetchedAt).toISOString(),
    expiresAt: new Date(cache.fetchedAt + CACHE_TTL_MS).toISOString(),
    isValid: isCacheValid(),
  };
}
