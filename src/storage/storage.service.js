import {env} from '../config/env.js';
import {readFile} from 'node:fs/promises';
export async function uploadFile(bucket,path,filePath,contentType='application/octet-stream'){
  const bytes=await readFile(filePath);return uploadBytes(bucket,path,bytes,contentType);
}
export async function uploadBytes(bucket,path,bytes,contentType='application/octet-stream'){
  const e=env(),key=e.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw Object.assign(new Error('Storage service key missing'),{code:'CONFIGURATION'});
  const r=await fetch(`${e.SUPABASE_URL.replace(/\/$/,'')}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':contentType,'x-upsert':'true'},body:bytes});
  if(!r.ok)throw Object.assign(new Error(`Storage upload ${r.status}`),{status:r.status,code:'STORAGE_UPLOAD'});
  return {bucket,path,size:bytes.length};
}
export async function downloadBytes(bucket,path){
  const e=env(),key=e.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw Object.assign(new Error('Storage service key missing'),{code:'CONFIGURATION'});
  const r=await fetch(`${e.SUPABASE_URL.replace(/\/$/,'')}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`,{headers:{Authorization:`Bearer ${key}`,apikey:key}});
  if(!r.ok)throw Object.assign(new Error(`Storage download ${r.status}`),{status:r.status,code:'STORAGE_DOWNLOAD'});
  return Buffer.from(await r.arrayBuffer());
}
