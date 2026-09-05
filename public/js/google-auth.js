const SESSION_KEY='automation.auth.session';
const GOOGLE_CLIENT_ID='819928266856-7hmgvb5rbq2crvpp8t5sq1hmmqvktr2s.apps.googleusercontent.com';
const config=async()=>{const r=await fetch('/api/realtime-config',{cache:'no-store'});if(!r.ok)throw new Error('Authentication configuration unavailable');const x=await r.json();if(!x?.url)throw new Error('Supabase URL unavailable');return x};
const getSession=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
const randomNonce=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const sha256=async value=>{const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')};
const loadGoogle=()=>new Promise((resolve,reject)=>{if(window.google?.accounts?.id)return resolve();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.onload=()=>resolve();s.onerror=()=>reject(new Error('Google Identity Services failed to load'));document.head.appendChild(s)});
async function restore(){const hash=window.location.hash.replace(/^#/,'');if(!hash)return;const p=new URLSearchParams(hash),token=p.get('access_token');if(!token)return;const x=await config();const r=await fetch(`${x.url}/auth/v1/user`,{headers:{apikey:x.anon_key,Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Google session verification failed');const user=await r.json();localStorage.setItem(SESSION_KEY,JSON.stringify({access_token:token,refresh_token:p.get('refresh_token'),expires_in:Number(p.get('expires_in')||3600),token_type:p.get('token_type')||'bearer',user}));history.replaceState(null,document.title,window.location.pathname+window.location.search);window.location.reload()}
async function googleLogin(){
  const x=await config();
  await loadGoogle();
  const nonce=randomNonce();
  const hashedNonce=await sha256(nonce);
  await new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(fn,value)=>{if(settled)return;settled=true;fn(value)};
    window.google.accounts.id.initialize({
      client_id:GOOGLE_CLIENT_ID,
      nonce:hashedNonce,
      auto_select:false,
      cancel_on_tap_outside:true,
      callback:async response=>{
        try{
          if(!response?.credential)throw new Error('Google did not return an ID token');
          const r=await fetch(`${x.url}/auth/v1/token?grant_type=id_token`,{method:'POST',headers:{'Content-Type':'application/json',apikey:x.anon_key},body:JSON.stringify({provider:'google',id_token:response.credential,nonce})});
          const data=await r.json().catch(()=>({}));
          if(!r.ok||!data?.access_token)throw new Error(data?.msg||data?.message||data?.error_description||'Google Supabase sign-in failed');
          const user=data.user||{};
          localStorage.setItem(SESSION_KEY,JSON.stringify({access_token:data.access_token,refresh_token:data.refresh_token,expires_in:Number(data.expires_in||3600),token_type:data.token_type||'bearer',user}));
          finish(resolve);
          window.location.reload();
        }catch(e){finish(reject,e)}
      }
    });
    window.google.accounts.id.prompt(notification=>{
      if(notification.isNotDisplayed()||notification.isSkippedMoment()){
        const holder=document.createElement('div');
        holder.style.position='fixed';holder.style.inset='0';holder.style.zIndex='2147483647';holder.style.display='flex';holder.style.alignItems='center';holder.style.justifyContent='center';holder.style.background='rgba(0,0,0,.35)';
        const inner=document.createElement('div');inner.style.background='#fff';inner.style.padding='24px';inner.style.borderRadius='12px';inner.style.boxShadow='0 8px 40px rgba(0,0,0,.35)';
        const button=document.createElement('div');button.id='google-id-signin';inner.appendChild(button);holder.appendChild(inner);document.body.appendChild(holder);
        window.google.accounts.id.renderButton(button,{theme:'outline',size:'large',text:'signin_with',shape:'rectangular'});
        const observer=new MutationObserver(()=>{if(!document.body.contains(holder)){observer.disconnect();finish(reject,new Error('Google sign-in was cancelled'))}});observer.observe(document.body,{childList:true,subtree:true});
      }
    });
  });
}
(async()=>{try{await restore()}catch(e){console.error(e)}if(getSession()?.access_token)return;const row=document.querySelector('.status-row');if(!row)return;const b=document.createElement('button');b.className='status';b.type='button';b.textContent='GOOGLE LOGIN';b.title='Sign in with Google';b.addEventListener('click',()=>googleLogin().catch(e=>alert(e.message)));row.prepend(b)})();
