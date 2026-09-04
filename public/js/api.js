import {authHeaders,refreshSession} from './auth.js?v=20260904-authfix';

export async function api(path,init={}){
  const makeRequest=()=>{
    const headers={...authHeaders(),...(init.headers||{})};
    if(init.body&&!headers['content-type'])headers['content-type']='application/json';
    return fetch(path,{...init,headers});
  };

  let r=await makeRequest();
  if(r.status===401&&path!=='/health'&&!path.startsWith('/api/realtime-config')){
    try{
      const refreshed=await refreshSession();
      if(refreshed)r=await makeRequest();
    }catch{}
  }

  const data=await r.json().catch(()=>({success:false,error:{message:`HTTP ${r.status}`}}));
  if(!r.ok){const error=new Error(data?.error?.message||`HTTP ${r.status}`);error.status=r.status;error.data=data;throw error}
  return data;
}
