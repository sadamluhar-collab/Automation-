import {get} from './provider-registry.js';

const RETRYABLE_CODES = new Set(['CONFIGURATION', 'RATE_LIMIT', 'PROVIDER', 'UPSTREAM', 'TIMEOUT']);
const RETRYABLE_STATUS = new Set([401, 403, 408, 409, 425, 429, 500, 502, 503, 504]);

function canFailover(error) {
  if (!error) return true;
  if (error.retryable === true) return true;
  if (RETRYABLE_CODES.has(error.code)) return true;
  return RETRYABLE_STATUS.has(error.status || error.statusCode);
}

export async function route(type, preferred, fallback, ...args) {
  const candidates = [
    ...(Array.isArray(preferred) ? preferred : [preferred]),
    ...(Array.isArray(fallback) ? fallback : [fallback])
  ].filter(Boolean);

  const unique = [...new Set(candidates)];
  let lastError;

  for (const name of unique) {
    const p = get(type, name);
    if (!p) continue;
    try {
      return await p(...args);
    } catch (error) {
      lastError = error;
      if (!canFailover(error)) throw error;
    }
  }

  if (lastError) throw lastError;
  throw new Error(`No configured provider for ${type}`);
}
