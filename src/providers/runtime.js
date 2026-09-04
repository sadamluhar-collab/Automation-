import {env} from '../config/env.js';
import {createKeyPool} from './key-pool.js';
import {researchProvider} from './research/provider.js';
import {createVideoProvider} from './video/runtime.js';

const ALIASES = {
  tavily:'tavily',openai:'openai',gpt:'openai',gemini:'gemini',google:'gemini',deepseek:'deepseek',groq:'groq',zai:'zai','z.ai':'zai',aihubmix:'aihubmix','ai hub mix':'aihubmix',openrouter:'openrouter',elevenlabs:'elevenlabs',sarvam:'sarvam',luma:'luma',runway:'runwayml',runwayml:'runwayml',fal:'fal',hf:'huggingface',huggingface:'huggingface'
};

export const FALLBACK_CHAINS={
  research:['tavily'],
  llm:['openai','gemini','deepseek','groq','zai','aihubmix','openrouter'],
  audio:['elevenlabs','sarvam'],
  image:['fal','huggingface'],
  video:['luma','runwayml','fal','huggingface']
};

const LLM_MODELS={openai:'gpt-4o-mini',gemini:'gemini-2.5-flash',deepseek:'deepseek-chat',groq:'llama-3.3-70b-versatile',zai:'glm-4.5-flash',aihubmix:'gpt-4o-mini',openrouter:'openai/gpt-4o-mini'};
const LLM_URLS={openai:'https://api.openai.com/v1/chat/completions',deepseek:'https://api.deepseek.com/chat/completions',groq:'https://api.groq.com/openai/v1/chat/completions',zai:'https://api.z.ai/api/paas/v4/chat/completions',aihubmix:'https://aihubmix.com/v1/chat/completions',openrouter:'https://openrouter.ai/api/v1/chat/completions'};
const RETRYABLE=new Set([401,403,408,409,425,429,500,502,503,504]);

export function providerName(config){
  if(!config||typeof config!=='object')return null;
  return String(config.provider||config.name||config.type||'').toLowerCase();
}
export function normalizeProviderName(name){return ALIASES[String(name||'').toLowerCase()]||null;}

export function withRuntimeProviderKeys(providers={}){
  const e=env();const result={};
  for(const [slot,config] of Object.entries(providers||{})){
    if(!config||typeof config!=='object'){result[slot]=config;continue}
    const key=normalizeProviderName(providerName(config));
    result[slot]=key?{...config,provider:key,apiKeys:e.PROVIDER_KEYS[key]}:{...config};
  }
  return result;
}

export function providerKeyStatus(){const e=env();return Object.fromEntries(Object.entries(e.PROVIDER_KEYS).map(([name,keys])=>[name,keys.length]));}
export function providerFallbackChain(type,preferred=null){const configured=preferred?[preferred]:[];return [...new Set([...configured,...(FALLBACK_CHAINS[type]||[])].map(normalizeProviderName).filter(Boolean))];}

function retryable(error){return Boolean(error?.retryable)||error?.code==='CONFIGURATION'||error?.code==='RATE_LIMIT'||error?.code==='PROVIDER'||error?.code==='UPSTREAM'||error?.code==='TIMEOUT'||RETRYABLE.has(error?.status||error?.statusCode);}

async function callGemini(key,model,input){
  const prompt=typeof input==='string'?input:JSON.stringify(input);
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:'You are a production content-generation step in a YouTube automation pipeline. Use only supplied input and pipeline state. Return structured JSON when requested.'}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(`Gemini HTTP ${r.status}`),{status:r.status,code:r.status===429?'RATE_LIMIT':'PROVIDER'});
  return data;
}

async function callCompat(name,key,model,input){
  const r=await fetch(LLM_URLS[name],{method:'POST',headers:{Authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:'You are a production content-generation step in a YouTube automation pipeline. Use only supplied input and pipeline state. Return structured JSON when requested.'},{role:'user',content:typeof input==='string'?input:JSON.stringify(input)}],temperature:0.2})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(`${name} HTTP ${r.status}`),{status:r.status,code:r.status===429?'RATE_LIMIT':'PROVIDER'});
  return data;
}

function makeLLMProvider(){
  return {async generate(input){
    const e=env();let lastError;
    for(const name of FALLBACK_CHAINS.llm){
      const keys=e.PROVIDER_KEYS?.[name]||[];if(!keys.length)continue;
      const pool=createKeyPool(keys);const model=process.env[`${name.toUpperCase()}_MODEL`]||LLM_MODELS[name];
      try{return await pool.run(key=>name==='gemini'?callGemini(key,model,input):callCompat(name,key,model,input));}
      catch(error){lastError=error;if(!retryable(error))throw error;}
    }
    throw lastError||Object.assign(new Error('No configured LLM provider'),{code:'CONFIGURATION'});
  }};
}

function makeResearchProvider(){
  const e=env();const keys=e.PROVIDER_KEYS?.tavily||[];
  return keys.length?researchProvider({url:'https://api.tavily.com/search',apiKeys:keys}):null;
}

export function createRuntimeProviders(overrides={}){
  const runtime={...overrides};
  if(!runtime.llm)runtime.llm=makeLLMProvider();
  if(!runtime.research){const research=makeResearchProvider();if(research)runtime.research=research;}
  if(!runtime.video)runtime.video=createVideoProvider();
  return runtime;
}
