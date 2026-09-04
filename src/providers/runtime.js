import {env} from '../config/env.js';

const ALIASES = {
  tavily: 'tavily',
  openai: 'openai',
  gpt: 'openai',
  gemini: 'gemini',
  google: 'gemini',
  deepseek: 'deepseek',
  groq: 'groq',
  zai: 'zai',
  'z.ai': 'zai',
  aihubmix: 'aihubmix',
  'ai hub mix': 'aihubmix',
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

// Capability-oriented provider order. The first available provider is active;
// the rest are standby and are used only when the active provider fails.
export const FALLBACK_CHAINS = {
  research: ['tavily'],
  llm: ['openai', 'gemini', 'deepseek', 'groq', 'zai', 'aihubmix', 'openrouter'],
  audio: ['elevenlabs', 'sarvam'],
  image: ['fal', 'huggingface'],
  video: ['luma', 'runwayml', 'fal', 'huggingface']
};

function providerName(config) {
  if (!config || typeof config !== 'object') return null;
  return String(config.provider || config.name || config.type || '').toLowerCase();
}

export function normalizeProviderName(name) {
  return ALIASES[String(name || '').toLowerCase()] || null;
}

export function withRuntimeProviderKeys(providers = {}) {
  const e = env();
  const result = {};
  for (const [slot, config] of Object.entries(providers || {})) {
    if (!config || typeof config !== 'object') {
      result[slot] = config;
      continue;
    }
    const key = normalizeProviderName(providerName(config));
    result[slot] = key ? {...config, provider: key, apiKeys: e.PROVIDER_KEYS[key]} : {...config};
  }
  return result;
}

export function providerKeyStatus() {
  const e = env();
  return Object.fromEntries(Object.entries(e.PROVIDER_KEYS).map(([name, keys]) => [name, keys.length]));
}

export function providerFallbackChain(type, preferred = null) {
  const configured = preferred ? [preferred] : [];
  const chain = FALLBACK_CHAINS[type] || [];
  return [...new Set([...configured, ...chain].map(normalizeProviderName).filter(Boolean))];
}
