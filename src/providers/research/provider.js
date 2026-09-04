import {createKeyPool} from '../key-pool.js';

export function researchProvider({url, apiKey, apiKeys}) {
  const pool = createKeyPool(apiKeys || apiKey);
  return {
    async research(input) {
      if (!url || !pool.size) throw Object.assign(new Error('Research provider credentials missing'), {code: 'CONFIGURATION'});
      return pool.run(async key => {
        const r = await fetch(url, {method: 'POST', headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'}, body: JSON.stringify(input)});
        if (!r.ok) throw Object.assign(new Error(`Research provider HTTP ${r.status}`), {status: r.status, code: r.status === 429 ? 'RATE_LIMIT' : 'PROVIDER'});
        return r.json();
      });
    }
  };
}
