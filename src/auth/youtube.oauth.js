import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {env} from '../config/env.js';

const scope='https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
const b64=value=>Buffer.from(value).toString('base64url');
const unb64=value=>Buffer.from(value,'base64url').toString('utf8');
const sign=value=>createHmac('sha256',env().WORKER_SECRET).update(value).digest('base64url');

export function createState(userId){
  if(!userId)throw new Error('Missing authenticated user');
  const payload=b64(JSON.stringify({sub:userId,nonce:randomBytes(18).toString('base64url'),exp:Date.now()+10*60*1000}));
  return `${payload}.${sign(payload)}`;
}

export function verifyState(state){
  if(!state||typeof state!=='string')throw new Error('Invalid OAuth state');
  const parts=state.split('.');
  if(parts.length!==2)throw new Error('Invalid OAuth state');
  const [payload,signature]=parts;
  const expected=sign(payload);
  const a=Buffer.from(signature);const b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error('Invalid OAuth state');
  let data;
  try{data=JSON.parse(unb64(payload))}catch{throw new Error('Invalid OAuth state payload')}
  if(!data?.sub||!data?.nonce||!Number.isFinite(data.exp)||data.exp<Date.now())throw new Error('Expired OAuth state');
  return data;
}

export function authorizationUrl(state){
  const e=env();
  if(!e.YOUTUBE_CLIENT_ID||!e.YOUTUBE_CLIENT_SECRET||!e.YOUTUBE_REDIRECT_URI)throw new Error('YouTube OAuth configuration is incomplete');
  const q=new URLSearchParams({client_id:e.YOUTUBE_CLIENT_ID,redirect_uri:e.YOUTUBE_REDIRECT_URI,response_type:'code',scope,access_type:'offline',prompt:'consent',include_granted_scopes:'true',state});
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeCode(code){
  const e=env();
  if(!code)throw new Error('Missing YouTube OAuth code');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:e.YOUTUBE_CLIENT_ID,client_secret:e.YOUTUBE_CLIENT_SECRET,redirect_uri:e.YOUTUBE_REDIRECT_URI,grant_type:'authorization_code'})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(data?.error_description||'YouTube OAuth exchange failed'),{code:data?.error||'OAUTH_EXCHANGE',details:data});
  if(!data.access_token)throw new Error('YouTube OAuth did not return an access token');
  return data;
}

export async function refreshAccessToken(refreshToken){
  const e=env();
  if(!refreshToken)throw new Error('Missing YouTube refresh token');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:e.YOUTUBE_CLIENT_ID,client_secret:e.YOUTUBE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:'refresh_token'})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.access_token)throw Object.assign(new Error(data?.error_description||'YouTube token refresh failed'),{code:data?.error||'TOKEN_REFRESH',details:data});
  return data;
}
