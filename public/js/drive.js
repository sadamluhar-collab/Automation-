import {api} from './api.js?v=20260905-drive';
import {getAccessToken} from './auth.js?v=20260904-authfix';

const escapeHtml=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

function renderDriveCard(){
  const content=document.querySelector('#content');
  if(!content||document.querySelector('#drive-connect-card'))return;
  const card=document.createElement('div');
  card.id='drive-connect-card';
  card.className='card panel';
  card.innerHTML=`<div class="item"><div><h2>Google Drive</h2><p id="drive-status-text" class="muted">Checking Drive connection…</p></div><button id="drive-connect-btn" class="button" type="button">Connect Google Drive</button></div><div id="drive-message" class="muted"></div>`;
  content.appendChild(card);
  const button=card.querySelector('#drive-connect-btn');
  const statusText=card.querySelector('#drive-status-text');
  const message=card.querySelector('#drive-message');
  if(!getAccessToken()){
    statusText.textContent='Sign in to connect your Google Drive storage.';
    button.textContent='Sign in required';
    button.disabled=true;
    return;
  }
  api('/api/drive/status',{cache:'no-store'}).then(result=>{
    const connection=result?.data?.connection;
    if(result?.data?.connected){
      statusText.textContent=`Connected${connection?.email?` · ${escapeHtml(connection.email)}`:''}`;
      button.textContent='Google Drive Connected';
      button.disabled=true;
    }else{
      statusText.textContent='Not connected. Authorize Google Drive once to enable persistent storage.';
    }
  }).catch(error=>{
    statusText.textContent=error.status===401?'Sign in to connect your Google Drive storage.':'Unable to check Drive connection.';
    if(error.status===401){button.textContent='Sign in required';button.disabled=true;}
  });
  button.addEventListener('click',async()=>{
    button.disabled=true;
    message.textContent='Preparing Google Drive authorization…';
    try{
      const result=await api('/api/drive/connect',{cache:'no-store'});
      if(!result?.authorization_url)throw new Error('Google Drive authorization URL was not returned');
      window.location.assign(result.authorization_url);
    }catch(error){
      button.disabled=false;
      if(error.status===401){message.textContent='Session expired. Sign in again, then connect Google Drive.';return;}
      message.textContent=`Drive connection failed: ${error.message}`;
    }
  });
}

function handleCallback(){
  const params=new URLSearchParams(window.location.search);
  const result=params.get('drive');
  if(result!=='connected'&&result!=='error')return;
  setTimeout(()=>{
    const card=document.querySelector('#drive-connect-card');
    const message=card?.querySelector('#drive-message');
    if(message)message.textContent=result==='connected'?'Google Drive connected successfully.':'Google Drive connection failed. Check the authorization settings and try again.';
    if(result==='connected'&&card){const button=card.querySelector('#drive-connect-btn');if(button){button.textContent='Google Drive Connected';button.disabled=true}const text=card.querySelector('#drive-status-text');if(text)text.textContent='Connected';}
    history.replaceState(null,document.title,window.location.pathname);
  },100);
}

const observe=()=>{
  const content=document.querySelector('#content');
  if(!content)return;
  const add=()=>{
    const title=document.querySelector('#page-title')?.textContent?.trim().toLowerCase();
    if(title==='overview')renderDriveCard();
  };
  add();
  new MutationObserver(add).observe(content,{childList:true,subtree:true});
};

handleCallback();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
