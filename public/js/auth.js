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

export async function restoreOAuthSession(){
  const hash=window.location.hash.replace(/^#/,'');
  if(!hash)return null;
  const params=new URLSearchParams(hash);
  const access_token=params.get('access_token');
  if(!access_token)return null;
  const refresh_token=params.get('refresh_token');
  const expires_in=Number(params.get('expires_in')||3600);
  const token_type=params.get('token_type')||'bearer';
  const {url,key}=await supabaseConfig();
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${access_token}`}});
  if(!r.ok)throw new Error('Google authentication session could not be verified');
  const user=await r.json();
  const session={access_token,refresh_token,expires_in,token_type,user};
  localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  history.replaceState(null,document.title,window.location.pathname+window.location.search);
  return session;
}

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

export async function signInWithGoogle(){
  const {url}=await supabaseConfig();
  const redirectTo=`${window.location.origin}${window.location.pathname}`;
  const target=`${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  window.location.assign(target);
}

export async function signUp(email,password){
  const result=await request('signup',{email,password});
  if(result?.access_token)localStorage.setItem(SESSION_KEY,JSON.stringify(result));
  return result;
}

export function authHeaders(){
  const token=getAccessToken();
  return token?{Authorization:`Bearer ${token}`} : {};
}
