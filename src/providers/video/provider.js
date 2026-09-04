import {createKeyPool} from '../key-pool.js';

export function videoProvider({url, apiKey, apiKeys}) {
  const pool = createKeyPool(apiKeys || apiKey);
  return {
    async generate(input) {
      if (!url || !pool.size) throw Object.assign(new Error('Video provider credentials missing'), {code: 'CONFIGURATION'});
      return pool.run(async key => {
        const r = await fetch(url, {method: 'POST', headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey || ''}, body: JSON.stringify(input)});
        if (!r.ok) throw Object.assign(new Error(`Video provider HTTP ${r.status}`), {status: r.status, code: r.status === 429 ? 'RATE_LIMIT' : 'PROVIDER'});
        return r.json();
      });
    }
  };
}
