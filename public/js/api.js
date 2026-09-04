import {authHeaders} from './auth.js';

export async function api(path,init={}){
  const headers={...authHeaders(),...(init.headers||{})};
  if(init.body&&!headers['content-type'])headers['content-type']='application/json';
  const r=await fetch(path,{...init,headers});
  const data=await r.json().catch(()=>({success:false,error:{message:`HTTP ${r.status}`}}));
  if(!r.ok){const error=new Error(data?.error?.message||`HTTP ${r.status}`);error.status=r.status;error.data=data;throw error}
  return data;
}
