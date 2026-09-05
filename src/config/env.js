import {envKeyPool} from '../providers/key-pool.js';

const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ENCRYPTION_KEY','WORKER_SECRET','APP_BASE_URL','YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','YOUTUBE_REDIRECT_URI'];
const PROVIDERS={tavily:['TAVILY_API_KEY',7],openai:['OPENAI_API_KEY',7],gemini:['GEMINI_API_KEY',7],deepseek:['DEEPSEEK_API_KEY',7],groq:['GROQ_API_KEY',7],zai:['ZAI_API_KEY',7],aihubmix:['AIHUBMIX_API_KEY',7],openrouter:['OPENROUTER_API_KEY',7],elevenlabs:['ELEVENLABS_API_KEY',7],sarvam:['SARVAM_API_KEY',7],luma:['LUMA_API_KEY',7],runwayml:['RUNWAYML_API_KEY',7],fal:['FAL_API_KEY',7],huggingface:['HF_TOKEN',7]};

export function env(){
  const e=process.env;
  for(const k of required)if(!e[k])throw Object.assign(new Error(`Missing environment variable: ${k}`),{code:'CONFIGURATION'});
  const appBase=e.APP_BASE_URL.replace(/\/$/,'');
  const redirect=new URL(e.YOUTUBE_REDIRECT_URI);
  const expected=new URL(`${appBase}/api/youtube/callback`);
  if(redirect.origin!==expected.origin||redirect.pathname!==expected.pathname)throw Object.assign(new Error('YOUTUBE_REDIRECT_URI must match APP_BASE_URL/api/youtube/callback'),{code:'CONFIGURATION'});
  const providerKeys={};for(const[name,[base,max]]of Object.entries(PROVIDERS))providerKeys[name]=envKeyPool(e,base,max);
  return {...e,PORT:Number(e.PORT||10000),APP_BASE_URL:appBase,PROVIDER_KEYS:providerKeys};
}
