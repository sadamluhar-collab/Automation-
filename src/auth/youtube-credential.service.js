import {query} from '../database/supabase.js';
import {refreshAccessToken} from './youtube.oauth.js';
import {encrypt,decrypt} from '../security/encryption.js';
const userRow=async userId=>query('users',{params:`?id=eq.${encodeURIComponent(userId)}&select=id,tenant_id`}).then(x=>x[0]||null);
export async function loadYouTubeCredential(channelId,userId){
 const user=await userRow(userId);if(!user)throw Object.assign(new Error('Workspace user not found'),{code:'AUTH',status:401});
 const rows=await query('channels',{params:`?id=eq.${encodeURIComponent(channelId)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&user_id=eq.${encodeURIComponent(userId)}&select=id,youtube_channel_id,name`});
 const channel=rows?.[0];if(!channel)throw Object.assign(new Error('Channel not found in your workspace'),{code:'NOT_FOUND',status:404});
 const credentials=await query('channel_credentials',{params:`?channel_id=eq.${encodeURIComponent(channelId)}&select=*`});
 const credential=credentials?.[0];if(!credential)throw Object.assign(new Error('YouTube authorization is missing for this channel'),{code:'YOUTUBE_AUTH',status:401});
 const expired=credential.expires_at&&new Date(credential.expires_at).getTime()<=Date.now()+60000;
 if(!expired&&credential.access_token)return {channel,accessToken:decrypt(credential.access_token),credential};
 if(!credential.refresh_token)throw Object.assign(new Error('YouTube access token expired; reconnect the channel'),{code:'YOUTUBE_REAUTH_REQUIRED',status:401});
 try{
  const fresh=await refreshAccessToken(decrypt(credential.refresh_token));
  const next={access_token:encrypt(fresh.access_token),refresh_token:fresh.refresh_token?encrypt(fresh.refresh_token):credential.refresh_token,expires_at:new Date(Date.now()+Number(fresh.expires_in||3600)*1000).toISOString(),scope:fresh.scope||credential.scope,token_type:fresh.token_type||credential.token_type||'Bearer',revoked_at:null,updated_at:new Date().toISOString()};
  await query('channel_credentials',{method:'PATCH',params:`?channel_id=eq.${encodeURIComponent(channelId)}`,headers:{Prefer:'return=representation'},body:next});
  return {channel,accessToken:fresh.access_token,credential:{...credential,...next}};
 }catch(error){
  await query('channel_credentials',{method:'PATCH',params:`?channel_id=eq.${encodeURIComponent(channelId)}&select=id`,headers:{Prefer:'return=representation'},body:{revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}}).catch(()=>{});
  await query('channels',{method:'PATCH',params:`?id=eq.${encodeURIComponent(channelId)}&user_id=eq.${encodeURIComponent(userId)}&select=id`,headers:{Prefer:'return=representation'},body:{status:'reauthorization_required',last_error:error.message||'YouTube authorization failed',updated_at:new Date().toISOString()}}).catch(()=>{});
  throw Object.assign(new Error('YouTube authorization expired or was revoked; reconnect the channel'),{code:'YOUTUBE_REAUTH_REQUIRED',status:401});
 }
}
