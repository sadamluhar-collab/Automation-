import {driveAuthorizationUrl,exchangeDriveCode,createDriveState,verifyDriveState} from '../../auth/drive.oauth.js';
import {query} from '../../database/supabase.js';
import {encrypt} from '../../security/encryption.js';
import {env} from '../../config/env.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};
const redirect=(res,url)=>{res.statusCode=302;res.setHeader('location',url);res.setHeader('cache-control','no-store');res.end()};
const appUrl=()=>env().APP_BASE_URL.replace(/\/$/,'');

export function connect(req,res){
  try{send(res,200,{success:true,authorization_url:driveAuthorizationUrl(createDriveState(req.user.id))})}
  catch(e){send(res,e.status||500,{success:false,error:{code:e.code||'DRIVE_OAUTH_CONFIG',message:e.message||'Google Drive OAuth configuration failed'}})}
}

export async function status(req,res){
  try{
    const rows=await query('drive_connections',{params:`?user_id=eq.${encodeURIComponent(req.user.id)}&select=id,tenant_id,email,scope,drive_root_folder_id,status,updated_at,created_at&limit=1`});
    const row=rows?.[0];
    send(res,200,{success:true,data:{connected:Boolean(row),connection:row||null}});
  }catch(e){send(res,e.status||500,{success:false,error:{code:e.code||'DRIVE_STATUS',message:e.message||'Could not read Drive connection'}})}
}

export async function callback(req,res){
  let state;
  try{
    if(req.query.error)throw Object.assign(new Error(req.query.error_description||`Google Drive OAuth denied: ${req.query.error}`),{code:'OAUTH_DENIED'});
    if(!req.query.code)throw Object.assign(new Error('Missing Google Drive OAuth code'),{code:'DRIVE_OAUTH_EXCHANGE',status:400});
    state=verifyDriveState(req.query.state);
    const token=await exchangeDriveCode(req.query.code);
    // public.users has no email column; email is optional in drive_connections.
    const users=await query('users',{params:`?id=eq.${encodeURIComponent(state.sub)}&select=id,tenant_id&limit=1`});
    const user=users?.[0];if(!user)throw Object.assign(new Error('Workspace user not found'),{code:'AUTH',status:401});
    const body={user_id:user.id,tenant_id:user.tenant_id,access_token:encrypt(token.access_token),refresh_token:token.refresh_token?encrypt(token.refresh_token):null,expires_at:new Date(Date.now()+Number(token.expires_in||3600)*1000).toISOString(),scope:token.scope||'https://www.googleapis.com/auth/drive.file',token_type:token.token_type||'Bearer',status:'active',updated_at:new Date().toISOString()};
    const existing=await query('drive_connections',{params:`?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`});
    if(existing?.[0]?.id)await query('drive_connections',{method:'PATCH',params:`?id=eq.${encodeURIComponent(existing[0].id)}&select=id`,headers:{Prefer:'return=representation'},body});
    else await query('drive_connections',{method:'POST',params:'?select=id',headers:{Prefer:'return=representation'},body});
    redirect(res,`${appUrl()}/?drive=connected`);
  }catch(e){console.error('Drive OAuth callback failed',{code:e.code||'DRIVE_CONNECT',message:e.message});redirect(res,`${appUrl()}/?drive=error&code=${encodeURIComponent(e.code||'DRIVE_CONNECT')}`)}
}
