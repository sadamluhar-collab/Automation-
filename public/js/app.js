import {api} from './api.js';
import {subscribeTables} from './realtime.js';

const health=document.querySelector('#health');
const realtime=document.querySelector('#realtime');
const content=document.querySelector('#content');
const title=document.querySelector('#page-title');

const tableModules={channels:['channels'],projects:['projects','project_versions'],pipeline:['pipeline_runs','pipeline_steps','scenes','scene_versions'],jobs:['automation_jobs','job_items'],recovery:['faults','recovery_attempts'],commands:['commands'],schedules:['schedules'],analytics:['analytics'],artifacts:['artifacts'],memory:['channel_memory','channel_memory_versions']};

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const render=section=>{
  title.textContent=section[0].toUpperCase()+section.slice(1);
  if(section==='overview'){
    content.innerHTML=`<div class="grid"><div class="card"><div class="label">API</div><div class="metric" id="api-metric">Checking</div><div class="muted">Backend availability</div></div><div class="card"><div class="label">Realtime</div><div class="metric" id="rt-metric">Connecting</div><div class="muted">Supabase synchronization</div></div><div class="card"><div class="label">Architecture</div><div class="metric">Ready</div><div class="muted">API · Queue · Workers · Recovery</div></div></div><div class="card panel"><h2>System</h2><div class="list"><div class="item"><span>Durable queue</span><span class="badge">Postgres</span></div><div class="item"><span>Workers</span><span class="badge">Disposable + heartbeat</span></div><div class="item"><span>Recovery</span><span class="badge">Automatic repair</span></div><div class="item"><span>Data sync</span><span class="badge">Realtime events</span></div></div></div>`;
    return;
  }
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
    try{
      const x=await api('/health',{cache:'no-store'});
      if(x?.success){
        health.textContent='API HEALTHY';
        const metric=document.querySelector('#api-metric');if(metric)metric.textContent='Healthy';
        return;
      }
      lastError=new Error(x?.error?.message||'Health check failed');
    }catch(error){lastError=error}
    await new Promise(resolve=>setTimeout(resolve,Math.min(1500*(attempt+1),4500)));
  }
  health.textContent='API UNAVAILABLE';
  const metric=document.querySelector('#api-metric');if(metric)metric.textContent='Unavailable';
  console.error('API health check failed',lastError);
};

checkApi();

subscribeTables({tables:[...new Set(Object.values(tableModules).flat())],onStatus:status=>{
  realtime.textContent=`REALTIME ${status.toUpperCase()}`;
  const metric=document.querySelector('#rt-metric');if(metric)metric.textContent=status==='connected'?'Connected':'Connecting';
},onChange:change=>window.dispatchEvent(new CustomEvent(`automation:${change.table}`,{detail:change}))}).catch(err=>{realtime.textContent='REALTIME UNAVAILABLE';console.error(err)});

export {tableModules};
