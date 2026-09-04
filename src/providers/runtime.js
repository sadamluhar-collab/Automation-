import {env} from '../config/env.js';

const ALIASES = {
  tavily: 'tavily',
  openai: 'openai',
  openrouter: 'openrouter',
  elevenlabs: 'elevenlabs',
  sarvam: 'sarvam',
  luma: 'luma',
  runway: 'runwayml',
  runwayml: 'runwayml',
  fal: 'fal',
  hf: 'huggingface',
  huggingface: 'huggingface'
};

function providerName(config) {
  if (!config || typeof config !== 'object') return null;
  return String(config.provider || config.name || config.type || '').toLowerCase();
}

export function withRuntimeProviderKeys(providers = {}) {
  const e = env();
  const result = {};
  for (const [slot, config] of Object.entries(providers || {})) {
    if (!config || typeof config !== 'object') {
      result[slot] = config;
      continue;
    }
    const key = ALIASES[providerName(config)];
    result[slot] = key ? {...config, apiKeys: e.PROVIDER_KEYS[key]} : {...config};
  }
  return result;
}

export function providerKeyStatus() {
  const e = env();
  return Object.fromEntries(Object.entries(e.PROVIDER_KEYS).map(([name, keys]) => [name, keys.length]));
}
