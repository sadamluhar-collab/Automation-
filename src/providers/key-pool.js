const RETRYABLE_STATUS = new Set([401, 403, 408, 409, 425, 429, 500, 502, 503, 504]);

function normalizeKeys(apiKeys) {
  if (typeof apiKeys === 'string') return apiKeys ? [apiKeys] : [];
  return Array.isArray(apiKeys) ? apiKeys.filter(Boolean) : [];
}

export function createKeyPool(apiKeys, {cooldownMs = 30000} = {}) {
  const keys = normalizeKeys(apiKeys);
  const blockedUntil = new Map();
  let cursor = 0;

  function nextKey() {
    if (!keys.length) return null;
    const now = Date.now();
    for (let i = 0; i < keys.length; i += 1) {
      const index = (cursor + i) % keys.length;
      const key = keys[index];
      if ((blockedUntil.get(key) || 0) <= now) {
        cursor = (index + 1) % keys.length;
        return key;
      }
    }
    const key = keys[cursor % keys.length];
    cursor = (cursor + 1) % keys.length;
    return key;
  }

  function penalize(key, status) {
    if (key && RETRYABLE_STATUS.has(status)) blockedUntil.set(key, Date.now() + cooldownMs);
  }

  async function run(request) {
    if (!keys.length) throw Object.assign(new Error('Provider credentials missing'), {code: 'CONFIGURATION'});
    let lastError;
    const attempted = new Set();
    for (let i = 0; i < keys.length; i += 1) {
      const key = nextKey();
      if (!key || attempted.has(key)) continue;
      attempted.add(key);
      try {
        const response = await request(key);
        if (response?.ok === false) {
          penalize(key, response.status);
          lastError = Object.assign(new Error(`Provider HTTP ${response.status}`), {status: response.status});
          if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
          continue;
        }
        return response;
      } catch (error) {
        const status = error?.status || error?.statusCode;
        penalize(key, status);
        lastError = error;
        if (!RETRYABLE_STATUS.has(status)) throw error;
      }
    }
    throw lastError || new Error('No provider API key available');
  }

  return {size: keys.length, nextKey, penalize, run};
}

export function envKeyPool(env, baseName, max = 7) {
  const keys = [];
  for (let i = 1; i <= max; i += 1) {
    const name = i === 1 ? baseName : `${baseName}_${i}`;
    if (env[name]) keys.push(env[name]);
  }
  return keys;
}
