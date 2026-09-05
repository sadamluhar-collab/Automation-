import { env } from '../config/env.js';
let client;
export function db(){
  if(client)return client;
  const e=env();
  if(!e.SUPABASE_SERVICE_ROLE_KEY)throw Object.assign(new Error('Missing SUPABASE_SERVICE_ROLE_KEY for server-side database access'),{code:'CONFIGURATION'});
  client={base:`${e.SUPABASE_URL.replace(/\/$/,'')}/rest/v1`,key:e.SUPABASE_SERVICE_ROLE_KEY};
  return client;
}
export async function query(table,{method='GET',params='',body,headers={}}={}){
  const d=db();
  const r=await fetch(`${d.base}/${table}${params}`,{method,headers:{apikey:d.key,Authorization:`Bearer ${d.key}`,Accept:'application/json','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok){
    const message=typeof data==='string'?data:data?.message||data?.error?.message||JSON.stringify(data);
    throw Object.assign(new Error(`Supabase ${r.status}: ${message}`),{status:r.status,code:r.status===401?'DATABASE_AUTH':'DATABASE'});
  }
  return data;
}
