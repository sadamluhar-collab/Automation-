import {env} from '../config/env.js';
import {decrypt} from '../security/encryption.js';
import {query} from '../database/supabase.js';
import {youtubeRequest} from '../providers/youtube/youtube.api.js';
import {createKeyPool} from '../providers/key-pool.js';
import {projectStrategy} from '../database/repositories/project-strategy.repository.js';

const LLM_ORDER=['openai','gemini','deepseek','groq','zai','aihubmix','openrouter'];
const MODEL_DEFAULTS={openai:'gpt-4o-mini',gemini:'gemini-2.5-flash',deepseek:'deepseek-chat',groq:'llama-3.3-70b-versatile',zai:'glm-4.5-flash',aihubmix:'gpt-4o-mini',openrouter:'openai/gpt-4o-mini'};
const COMPAT={
  openai:{url:'https://api.openai.com/v1/chat/completions'},
  deepseek:{url:'https://api.deepseek.com/chat/completions'},
  groq:{url:'https://api.groq.com/openai/v1/chat/completions'},
  zai:{url:'https://api.z.ai/api/paas/v4/chat/completions'},
  aihubmix:{url:'https://aihubmix.com/v1/chat/completions'},
  openrouter:{url:'https://openrouter.ai/api/v1/chat/completions'}
};

const text=v=>String(v||'').replace(/\s+/g,' ').trim();
const isoDurationSeconds=value=>{const m=String(value||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):0};
const extractLLMText=data=>text(data?.choices?.[0]?.message?.content||data?.output_text||data?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join(' ')||'');

async function channelCredentials(channelId,userId){
  const users=await query('users',{params:`?id=eq.${encodeURIComponent(userId)}&select=id,tenant_id`});
  const user=users?.[0];
  if(!user)throw new Error('Workspace user not found');
  const channels=await query('channels',{params:`?id=eq.${encodeURIComponent(channelId)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&user_id=eq.${encodeURIComponent(userId)}&select=id,youtube_channel_id,name,description,subscribers,total_views,video_count,country`});
  const channel=channels?.[0];
  if(!channel)throw new Error('Channel not found in your workspace');
  const credentials=await query('channel_credentials',{params:`?channel_id=eq.${encodeURIComponent(channelId)}&select=access_token,refresh_token,expires_at`});
  const credential=credentials?.[0];
  if(!credential?.access_token&&!credential?.refresh_token)throw new Error('YouTube authorization is missing for this channel');
  return {user,channel,credential};
}

async function freshToken(channelId,credential){
  const expired=credential.expires_at&&new Date(credential.expires_at).getTime()<=Date.now()+60000;
  if(!expired&&credential.access_token)return credential.access_token;
  if(!credential.refresh_token)throw Object.assign(new Error('YouTube access token expired; reconnect the channel'),{code:'AUTH'});
  const e=env();
  if(!e.YOUTUBE_CLIENT_ID||!e.YOUTUBE_CLIENT_SECRET)throw Object.assign(new Error('YouTube OAuth configuration is incomplete'),{code:'CONFIGURATION'});
  const body=new URLSearchParams({client_id:e.YOUTUBE_CLIENT_ID,client_secret:e.YOUTUBE_CLIENT_SECRET,refresh_token:decrypt(credential.refresh_token),grant_type:'refresh_token'});
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.access_token)throw Object.assign(new Error('YouTube token refresh failed'),{code:response.status===401?'AUTH':'UPSTREAM',status:response.status,details:data});
  const expiresAt=new Date(Date.now()+Number(data.expires_in||3600)*1000).toISOString();
  await query('channel_credentials',{method:'PATCH',params:`?channel_id=eq.${encodeURIComponent(channelId)}`,body:{access_token:credential.access_token===data.access_token?credential.access_token:credential.access_token,expires_at:expiresAt,updated_at:new Date().toISOString()}}).catch(()=>{});
  return data.access_token;
}

async function collectVideos(token,channel){
  const details=await youtubeRequest(token,`channels?part=snippet,contentDetails,statistics&id=${encodeURIComponent(channel.youtube_channel_id)}`);
  const item=details?.items?.[0];
  const uploads=item?.contentDetails?.relatedPlaylists?.uploads;
  if(!uploads)return [];
  const page=await youtubeRequest(token,`playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=50`);
  const ids=(page?.items||[]).map(x=>x?.contentDetails?.videoId).filter(Boolean);
  if(!ids.length)return [];
  const videos=await youtubeRequest(token,`videos?part=snippet,contentDetails,statistics&id=${ids.join(',')}`);
  return (videos?.items||[]).map(v=>({
    id:v.id,title:text(v.snippet?.title),description:text(v.snippet?.description).slice(0,1000),published_at:v.snippet?.publishedAt||null,
    duration_seconds:isoDurationSeconds(v.contentDetails?.duration),views:Number(v.statistics?.viewCount||0),likes:Number(v.statistics?.likeCount||0),comments:Number(v.statistics?.commentCount||0),tags:(v.snippet?.tags||[]).slice(0,20)
  }));
}

async function callCompat(name,key,model,prompt){
  const config=COMPAT[name];
  const response=await fetch(config.url,{method:'POST',headers:{Authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:'You are the strategy engine for a YouTube automation platform. Return valid JSON only. Do not invent channel facts; use only the supplied source data.'},{role:'user',content:prompt}],temperature:0.2,response_format:{type:'json_object'}})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(`LLM provider HTTP ${response.status}`),{status:response.status,code:response.status===429?'RATE_LIMIT':'PROVIDER',details:data});
  return data;
}

async function callGemini(key,model,prompt){
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:'You are the strategy engine for a YouTube automation platform. Return valid JSON only. Do not invent channel facts; use only supplied source data.'}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(`Gemini HTTP ${response.status}`),{status:response.status,code:response.status===429?'RATE_LIMIT':'PROVIDER',details:data});
  return data;
}

async function generateStrategy(source,config){
  const prompt=JSON.stringify({task:'Analyze this YouTube channel and create a Shorts content strategy for the project.',requirements:{content_type:config.content_type||'YouTube Short',language:config.language||'English',tone:config.tone||'Informative',audience:config.audience||'General',research_depth:config.research_depth||'standard',topic:config.topic||''},source},null,2);
  let lastError;
  for(const name of LLM_ORDER){
    const keys=env().PROVIDER_KEYS?.[name]||[];
    if(!keys.length)continue;
    const pool=createKeyPool(keys);
    const model=process.env[`${name.toUpperCase()}_MODEL`]||MODEL_DEFAULTS[name];
    try{
      const data=await pool.run(key=>name==='gemini'?callGemini(key,model,prompt):callCompat(name,key,model,prompt));
      const raw=extractLLMText(data);
      if(!raw)throw Object.assign(new Error(`${name} returned an empty strategy`),{code:'PROVIDER'});
      const parsed=JSON.parse(raw.replace(/^```json\s*/i,'').replace(/\s*```$/,''));
      return {data:parsed,provider:name,model};
    }catch(error){lastError=error}
  }
  throw lastError||Object.assign(new Error('No configured LLM provider'),{code:'CONFIGURATION'});
}

export async function analyzeProjectChannel({userId,project,config}){
  const {channel,credential}=await channelCredentials(project.channel_id,userId);
  const token=await freshToken(channel.id,credential);
  const videos=await collectVideos(token,channel);
  const source={channel:{id:channel.youtube_channel_id,name:channel.name,description:channel.description,subscribers:Number(channel.subscribers||0),total_views:Number(channel.total_views||0),video_count:Number(channel.video_count||0),country:channel.country},videos};
  const result=await generateStrategy(source,config||{});
  const saved=await projectStrategy.save({userId,projectId:project.id,channelId:channel.id,sourceVideoCount:videos.length,sourceSnapshot:source,channelAnalysis:result.data.channel_analysis||result.data.analysis||{},contentPlan:result.data.content_plan||result.data.plan||{},provider:result.provider,model:result.model});
  return {strategy:saved,source,result:result.data,provider:result.provider,model:result.model};
}

export async function getProjectStrategy({userId,projectId}){return projectStrategy.get({userId,projectId})}
