import {envKeyPool} from '../providers/key-pool.js';

const PROVIDERS={tavily:['TAVILY_API_KEY',7],openai:['OPENAI_API_KEY',7],gemini:['GEMINI_API_KEY',7],deepseek:['DEEPSEEK_API_KEY',7],groq:['GROQ_API_KEY',7],zai:['ZAI_API_KEY',7],aihubmix:['AIHUBMIX_API_KEY',7],openrouter:['OPENROUTER_API_KEY',7],elevenlabs:['ELEVENLABS_API_KEY',7],sarvam:['SARVAM_API_KEY',7],luma:['LUMA_API_KEY',7],runwayml:['RUNWAYML_API_KEY',7],fal:['FAL_API_KEY',7],huggingface:['HF_TOKEN',7]};

export function env(){
  const e=process.env;
  if(!e.SUPABASE_URL)throw Object.assign(new Error('Missing environment variable: SUPABASE_URL'),{code:'CONFIGURATION'});
  const providerKeys={};for(const[name,[base,max]]of Object.entries(PROVIDERS))providerKeys[name]=envKeyPool(e,base,max);
  return {...e,PORT:Number(e.PORT||10000),APP_BASE_URL:(e.APP_BASE_URL||`https://${e.RENDER_EXTERNAL_HOSTNAME||'localhost:10000'}`).replace(/\/$/,''),PROVIDER_KEYS:providerKeys};
}

export function youtubeConfig(){
  const e=env();
  for(const k of ['YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','YOUTUBE_REDIRECT_URI','WORKER_SECRET'])if(!e[k])throw Object.assign(new Error(`Missing environment variable: ${k}`),{code:'YOUTUBE_OAUTH_CONFIG'});
  const redirect=new URL(e.YOUTUBE_REDIRECT_URI),expected=new URL(`${e.APP_BASE_URL}/api/youtube/callback`);
  if(redirect.origin!==expected.origin||redirect.pathname!==expected.pathname)throw Object.assign(new Error('YOUTUBE_REDIRECT_URI must match APP_BASE_URL/api/youtube/callback'),{code:'YOUTUBE_OAUTH_CONFIG'});
  return e;
}

export function driveConfig(){
  const e=env();
  for(const k of ['WORKER_SECRET','DRIVE_CLIENT_ID','DRIVE_CLIENT_SECRET'])if(!e[k])throw Object.assign(new Error(`Missing environment variable: ${k}`),{code:'DRIVE_OAUTH_CONFIG'});
  const redirect=e.DRIVE_REDIRECT_URI||`${e.APP_BASE_URL}/api/drive/callback`;
  const expected=new URL(`${e.APP_BASE_URL}/api/drive/callback`);
  const actual=new URL(redirect);
  if(actual.origin!==expected.origin||actual.pathname!==expected.pathname)throw Object.assign(new Error('DRIVE_REDIRECT_URI must match APP_BASE_URL/api/drive/callback'),{code:'DRIVE_OAUTH_CONFIG'});
  return {...e,DRIVE_REDIRECT_URI:redirect};
}
