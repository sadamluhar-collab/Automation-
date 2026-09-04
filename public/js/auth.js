const SESSION_KEY='automation.auth.session';

async function supabaseConfig(){
  const r=await fetch('/api/realtime-config',{cache:'no-store'});
  if(!r.ok)throw new Error('Authentication configuration unavailable');
  const x=await r.json();
  if(!x?.url||!x?.anon_key)throw new Error('Supabase authentication configuration missing');
  return {url:x.url,key:x.anon_key};
}

export function getSession(){
  try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}
}

export function getAccessToken(){return getSession()?.access_token||null}

export function clearSession(){localStorage.removeItem(SESSION_KEY)}

async function request(path,body){
  const {url,key}=await supabaseConfig();
  const r=await fetch(`${url}/auth/v1/${path}`,{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.msg||data?.error_description||data?.message||data?.error||'Authentication failed');
  return data;
}

export async function signIn(email,password){
  const session=await request('token?grant_type=password',{email,password});
  localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  return session;
}

export async function signUp(email,password){
  const result=await request('signup',{email,password});
  if(result?.access_token)localStorage.setItem(SESSION_KEY,JSON.stringify(result));
  return result;
}

export function authHeaders(){
  const token=getAccessToken();
  return token?{Authorization:`Bearer ${token}`}:{};
}
