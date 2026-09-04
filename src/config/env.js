import {envKeyPool} from '../providers/key-pool.js';

const required = ['SUPABASE_URL'];
const PROVIDERS = {
  tavily: ['TAVILY_API_KEY', 2],
  openai: ['OPENAI_API_KEY', 7],
  openrouter: ['OPENROUTER_API_KEY', 7],
  elevenlabs: ['ELEVENLABS_API_KEY', 7],
  sarvam: ['SARVAM_API_KEY', 7],
  luma: ['LUMA_API_KEY', 7],
  runwayml: ['RUNWAYML_API_KEY', 7],
  fal: ['FAL_API_KEY', 7],
  huggingface: ['HF_TOKEN', 7]
};

export function env() {
  const e = process.env;
  for (const k of required) if (!e[k]) throw new Error(`Missing environment variable: ${k}`);
  const providerKeys = {};
  for (const [name, [base, max]] of Object.entries(PROVIDERS)) {
    providerKeys[name] = envKeyPool(e, base, max);
  }
  return {
    ...e,
    PORT: Number(e.PORT || 10000),
    APP_BASE_URL: e.APP_BASE_URL || `http://localhost:${e.PORT || 10000}`,
    PROVIDER_KEYS: providerKeys
  };
}
