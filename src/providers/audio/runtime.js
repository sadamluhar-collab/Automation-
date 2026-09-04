import {env} from '../../config/env.js';
import {createKeyPool} from '../key-pool.js';

const RETRYABLE = new Set([401,403,408,425,429,500,502,503,504]);

function textFrom(input = {}) {
  if (typeof input === 'string') return input;
  return input.text || input.script || input.content || input.narration || input.voice_text || input.previous_result?.text || input.previous_result?.script || '';
}

function languageFrom(input = {}) {
  return input.language_code || input.language || input.locale || 'hi-IN';
}

function retryable(error) {
  return Boolean(error?.retryable) || error?.code === 'RATE_LIMIT' || error?.code === 'PROVIDER' || RETRYABLE.has(error?.status);
}

async function sarvam(key, input) {
  const text = textFrom(input);
  if (!text) throw Object.assign(new Error('Audio text missing'), {code:'CONFIGURATION'});
  const r = await fetch('https://api.sarvam.ai/text-to-speech', {
    method:'POST',
    headers:{'api-subscription-key':key,'content-type':'application/json'},
    body:JSON.stringify({text, language_code:languageFrom(input), model:input.model || 'bulbul:v3', speaker:input.speaker || 'shubh', output_audio_codec:input.output_audio_codec || 'wav'})
  });
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw Object.assign(new Error(`Sarvam HTTP ${r.status}`), {status:r.status, code:r.status===429?'RATE_LIMIT':'PROVIDER'});
  return data;
}

async function elevenlabs(key, input) {
  const text = textFrom(input);
  const voice = input.voice_id || process.env.ELEVENLABS_VOICE_ID;
  if (!text || !voice) throw Object.assign(new Error('ElevenLabs text or voice missing'), {code:'CONFIGURATION'});
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`, {
    method:'POST',
    headers:{'xi-api-key':key,'content-type':'application/json','accept':'audio/mpeg'},
    body:JSON.stringify({text, model_id:input.model_id || 'eleven_multilingual_v2'})
  });
  if (!r.ok) throw Object.assign(new Error(`ElevenLabs HTTP ${r.status}`), {status:r.status, code:r.status===429?'RATE_LIMIT':'PROVIDER'});
  return {mime_type:'audio/mpeg', audio_base64:Buffer.from(await r.arrayBuffer()).toString('base64')};
}

export function createAudioRuntimeProvider() {
  const e = env();
  const providers = [
    ['elevenlabs', e.PROVIDER_KEYS?.elevenlabs || [], elevenlabs],
    ['sarvam', e.PROVIDER_KEYS?.sarvam || [], sarvam]
  ].filter(([,keys]) => keys.length);
  return {
    async generate(input={}) {
      let lastError;
      for (const [, keys, call] of providers) {
        try { return await createKeyPool(keys).run(key => call(key,input)); }
        catch (error) { lastError = error; if (!retryable(error)) throw error; }
      }
      throw lastError || Object.assign(new Error('No configured audio provider'), {code:'CONFIGURATION'});
    },
    async music() {
      throw Object.assign(new Error('Music generation provider is not configured'), {code:'CONFIGURATION'});
    }
  };
}
