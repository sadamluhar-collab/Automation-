import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {env,driveConfig} from '../config/env.js';

const scope='https://www.googleapis.com/auth/drive.file';
const b64=value=>Buffer.from(value).toString('base64url');
const unb64=value=>Buffer.from(value,'base64url').toString('utf8');
const sign=value=>createHmac('sha256',driveConfig().WORKER_SECRET).update(value).digest('base64url');

export function createDriveState(userId){
  if(!userId)throw new Error('Missing authenticated user');
  const payload=b64(JSON.stringify({sub:userId,nonce:randomBytes(18).toString('base64url'),exp:Date.now()+10*60*1000}));
  return `${payload}.${sign(payload)}`;
}
export function verifyDriveState(state){
  if(!state||typeof state!=='string')throw Object.assign(new Error('Invalid Drive OAuth state'),{code:'DRIVE_OAUTH_STATE',status:400});
  const [payload,signature]=state.split('.');
  if(!payload||!signature)throw Object.assign(new Error('Invalid Drive OAuth state'),{code:'DRIVE_OAUTH_STATE',status:400});
  const expected=sign(payload);const a=Buffer.from(signature),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw Object.assign(new Error('Invalid Drive OAuth state'),{code:'DRIVE_OAUTH_STATE',status:400});
  let data;try{data=JSON.parse(unb64(payload))}catch{throw Object.assign(new Error('Invalid Drive OAuth state payload'),{code:'DRIVE_OAUTH_STATE',status:400})}
  if(!data?.sub||!data?.nonce||!Number.isFinite(data.exp)||data.exp<Date.now())throw Object.assign(new Error('Expired Drive OAuth state'),{code:'DRIVE_OAUTH_STATE',status:400});
  return data;
}
export function driveAuthorizationUrl(state){
  const e=driveConfig();
  const q=new URLSearchParams({client_id:e.DRIVE_CLIENT_ID,redirect_uri:e.DRIVE_REDIRECT_URI,response_type:'code',scope,access_type:'offline',prompt:'consent'});
  q.set('state',state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}
export async function exchangeDriveCode(code){
  const e=driveConfig();if(!code)throw Object.assign(new Error('Missing Google Drive OAuth code'),{code:'DRIVE_OAUTH_EXCHANGE',status:400});
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:e.DRIVE_CLIENT_ID,client_secret:e.DRIVE_CLIENT_SECRET,redirect_uri:e.DRIVE_REDIRECT_URI,grant_type:'authorization_code'})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(data?.error_description||'Google Drive OAuth exchange failed'),{code:data?.error||'DRIVE_OAUTH_EXCHANGE',status:r.status});
  if(!data.access_token)throw Object.assign(new Error('Google Drive OAuth did not return an access token'),{code:'DRIVE_OAUTH_EXCHANGE',status:502});
  return data;
}
export async function refreshDriveAccessToken(refreshToken){
  const e=driveConfig();
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:e.DRIVE_CLIENT_ID,client_secret:e.DRIVE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:'refresh_token'})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.access_token)throw Object.assign(new Error(data?.error_description||'Google Drive token refresh failed'),{code:data?.error||'DRIVE_TOKEN_REFRESH',status:r.status});
  return data;
}
