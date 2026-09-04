import {api} from './api.js';
import {subscribeTables} from './realtime.js';
import {getSession,getAccessToken,signIn,signUp,clearSession} from './auth.js';

const health=document.querySelector('#health');
const realtime=document.querySelector('#realtime');
const internetStatusEl=document.querySelector('#internet-status');
const content=document.querySelector('#content');
const title=document.querySelector('#page-title');

const tableModules={channels:['channels'],projects:['projects','project_versions'],pipeline:['pipeline_runs','pipeline_steps','scenes','scene_versions'],jobs:['automation_jobs','job_items'],recovery:['faults','recovery_attempts'],commands:['commands'],schedules:['schedules'],analytics:['analytics'],artifacts:['artifacts'],memory:['channel_memory','channel_memory_versions']};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let currentSection='overview';
let channelRows=[];

function renderAuthBox(){
  const session=getSession();
  if(session?.access_token)return `<div class="card panel"><div class="item"><span>Authenticated</span><span class="badge">${escapeHtml(session.user?.email||'Signed in')}</span></div><div class="item"><button id="youtube-connect-btn" class="button" type="button">Connect YouTube</button><button id="signout-btn" class="button secondary" type="button">Sign out</button></div><div id="youtube-message" class="muted"></div></div>`;
  return `<div class="card panel"><h3>Sign in to load your channels</h3><p class="muted">Channels are tenant-scoped and require a Supabase access token.</p><form id="auth-form" class="auth-form"><input id="auth-email" type="email" autocomplete="email" placeholder="Email" required><input id="auth-password" type="password" autocomplete="current-password" placeholder="Password" minlength="6" required><div class="item"><button class="button" type="submit">Sign in</button><button class="button secondary" type="button" id="signup-btn">Create account</button></div><div id="auth-message" class="muted"></div></form></div>`;
}

function renderChannels(){
  if(!getAccessToken()){
    content.innerHTML=`<div class="card"><h2>Channels</h2><p class="muted">YouTube channels connected to your automation workspace.</p></div>${renderAuthBox()}`;
    bindAuth();
    return;
  }
  const cards=channelRows.map(c=>`<div class="card channel-card"><div class="label">YouTube Channel</div><h2>${escapeHtml(c.name||c.youtube_handle||'Unnamed channel')}</h2><p class="muted">${escapeHtml(c.youtube_handle||c.youtube_channel_id||'')}</p><div class="list"><div class="item"><span>Subscribers</span><span class="badge">${Number(c.subscribers||0).toLocaleString()}</span></div><div class="item"><span>Videos</span><span class="badge">${Number(c.video_count||0).toLocaleString()}</span></div><div class="item"><span>Country</span><span class="badge">${escapeHtml(c.country||'—')}</span></div></div></div>`).join('');
  content.innerHTML=`<div class="card"><div class="item"><div><h2>Channels</h2><p class="muted">Live channels from your workspace. Realtime changes update this list without a full database reload.</p></div><span class="badge">${channelRows.length} channel${channelRows.length===1?'':'s'}</span></div></div>${cards||'<div class="card"><div class="empty">No YouTube channels connected yet. Click Connect YouTube below to add a real channel.</div></div>'}${renderAuthBox()}`;
  bindAuth();
}

async function loadChannels(){
  if(currentSection!=='channels'||!getAccessToken())return;
  try{
    const result=await api('/api/channels',{cache:'no-store'});
    channelRows=Array.isArray(result?.data)?result.data:[];
    renderChannels();
  }catch(error){
    if(error.status===401){clearSession();channelRows=[];renderChannels();return;}
    content.innerHTML=`<div class="card"><h2>Channels</h2><div class="empty">Unable to load channels: ${escapeHtml(error.message)}</div></div>${renderAuthBox()}`;
    bindAuth();
  }
}

function bindAuth(){
  document.querySelector('#signout-btn')?.addEventListener('click',()=>{clearSession();channelRows=[];window.location.reload()});
  document.querySelector('#youtube-connect-btn')?.addEventListener('click',()=>{
    const message=document.querySelector('#youtube-message');
    if(message)message.textContent='Opening Google YouTube authorization…';
    window.location.assign('/api/youtube/connect');
  });
  const params=new URLSearchParams(window.location.search);
  const youtubeResult=params.get('youtube');
  if(youtubeResult==='connected'){
    const message=document.querySelector('#youtube-message');
    if(message)message.textContent='YouTube channel connected successfully.';
    history.replaceState(null,document.title,window.location.pathname);
  }else if(youtubeResult==='error'){
    const message=document.querySelector('#youtube-message');
    if(message)message.textContent=`YouTube connection failed: ${params.get('message')||'Unknown error'}`;
    history.replaceState(null,document.title,window.location.pathname);
  }
  const form=document.querySelector('#auth-form');
  if(!form)return;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const message=document.querySelector('#auth-message');
    message.textContent='Signing in…';
    try{await signIn(document.querySelector('#auth-email').value.trim(),document.querySelector('#auth-password').value);window.location.reload()}catch(error){message.textContent=error.message}
  });
  document.querySelector('#signup-btn')?.addEventListener('click',async()=>{
    const message=document.querySelector('#auth-message');
    message.textContent='Creating account…';
    try{const result=await signUp(document.querySelector('#auth-email').value.trim(),document.querySelector('#auth-password').value);if(result?.access_token)window.location.reload();else message.textContent='Account created. Confirm your email, then sign in.'}catch(error){message.textContent=error.message}
  });
}

const render=section=>{
  title.textContent=section[0].toUpperCase()+section.slice(1);
  if(section==='overview'){
    currentSection=section;
    content.innerHTML=`<div class="grid"><div class="card"><div class="label">API</div><div class="metric" id="api-metric">Checking</div><div class="muted">Backend availability</div></div><div class="card"><div class="label">Internet</div><div class="metric" id="internet-metric">Checking</div><div class="muted" id="internet-detail">Live outbound internet connectivity</div></div><div class="card"><div class="label">Realtime</div><div class="metric" id="rt-metric">Connecting</div><div class="muted">Supabase synchronization</div></div><div class="card"><div class="label">Architecture</div><div class="metric">Ready</div><div class="muted">API · Queue · Workers · Recovery</div></div></div><div class="card panel"><h2>System</h2><div class="list"><div class="item"><span>Durable queue</span><span class="badge">Postgres</span></div><div class="item"><span>Workers</span><span class="badge">Disposable + heartbeat</span></div><div class="item"><span>Recovery</span><span class="badge">Automatic repair</span></div><div class="item"><span>Data sync</span><span class="badge">Realtime events</span></div><div class="item"><span>Internet</span><span class="badge">Live outbound probe + fallback research</span></div></div></div>`;
    return;
  }
  currentSection=section;
  if(section==='channels'){renderChannels();loadChannels();return;}
  const tables=tableModules[section]||[];
  content.innerHTML=`<div class="card"><h2>${escapeHtml(section)}</h2><p class="muted">Live module is connected to the ${tables.join(', ')} data stream.</p><div class="empty">Waiting for authenticated module data. Realtime changes will appear here without a full database reload.</div></div>`;
};

render('overview');

document.querySelectorAll('#nav button').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('#nav button').forEach(x=>x.classList.remove('active'));
  button.classList.add('active');
  render(button.dataset.section);
}));

const checkApi=async()=>{
  let lastError;
  for(let attempt=0;attempt<4;attempt++){
    try{const x=await api('/health',{cache:'no-store'});if(x?.success){health.textContent='API HEALTHY';const metric=document.querySelector('#api-metric');if(metric)metric.textContent='Healthy';return}lastError=new Error(x?.error?.message||'Health check failed')}catch(error){lastError=error}
    await new Promise(resolve=>setTimeout(resolve,Math.min(1500*(attempt+1),4500)));
  }
  health.textContent='API UNAVAILABLE';const metric=document.querySelector('#api-metric');if(metric)metric.textContent='Unavailable';console.error('API health check failed',lastError);
};

const checkInternet=async()=>{try{const x=await api(`/api/internet-status?t=${Date.now()}`,{cache:'no-store'});if(x?.success&&x.status==='live'){internetStatusEl.textContent=`INTERNET LIVE ${x.latency_ms}ms`;const metric=document.querySelector('#internet-metric');if(metric)metric.textContent='LIVE';const detail=document.querySelector('#internet-detail');if(detail)detail.textContent=`Outbound internet · ${x.latency_ms}ms · ${new Date(x.checked_at).toLocaleTimeString()}`;return}throw new Error(x?.error||'Internet probe failed')}catch(error){internetStatusEl.textContent='INTERNET OFFLINE';const metric=document.querySelector('#internet-metric');if(metric)metric.textContent='OFFLINE';const detail=document.querySelector('#internet-detail');if(detail)detail.textContent='No live outbound internet connection from API';console.error('Internet connectivity check failed',error)}};

checkApi();checkInternet();setInterval(checkInternet,10000);

subscribeTables({tables:[...new Set(Object.values(tableModules).flat())],onStatus:status=>{realtime.textContent=`REALTIME ${status.toUpperCase()}`;const metric=document.querySelector('#rt-metric');if(metric)metric.textContent=status==='connected'?'Connected':'Connecting'},onChange:change=>{window.dispatchEvent(new CustomEvent(`automation:${change.table}`,{detail:change}));if(change.table==='channels'){if(change.event==='DELETE')channelRows=channelRows.filter(x=>x.id!==change.oldRecord?.id);else if(change.record){const i=channelRows.findIndex(x=>x.id===change.record.id);if(i<0)channelRows=[...channelRows,change.record];else channelRows=channelRows.map((x,n)=>n===i?change.record:x)}if(currentSection==='channels')renderChannels()}}}).catch(err=>{realtime.textContent='REALTIME UNAVAILABLE';console.error(err)});

export {tableModules};
