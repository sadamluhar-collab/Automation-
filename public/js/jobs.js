import {api} from './api.js';
import {getAccessToken} from './auth.js';

const STATUSES=['queued','retrying','running','completed','failed','cancelled'];
let jobs=[];let projects=[];let selected=null;let status='';let project='';
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const label=v=>String(v||'').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const time=v=>v?new Date(v).toLocaleString():'—';
const pct=v=>Math.max(0,Math.min(100,Number(v)||0));

function detail(){
 if(!selected)return '<div class="jobs-empty">Select a job to inspect its state, worker, checkpoint, input/output and controls.</div>';
 const canRetry=selected.status==='failed';const canCancel=['queued','retrying','running'].includes(selected.status);
 return `<div class="job-detail-head"><div><div class="label">Job</div><h2>${esc(label(selected.job_type))}</h2><p class="muted">${esc(selected.id)}</p></div><span class="job-status" data-status="${esc(selected.status)}">${esc(selected.status)}</span></div>
 <div class="job-progress-large"><i style="width:${pct(selected.progress_percent)}%"></i></div>
 <div class="stat-grid"><div class="stat"><strong>${pct(selected.progress_percent)}%</strong><span>Progress</span></div><div class="stat"><strong>${esc(label(selected.current_step||'—'))}</strong><span>Current step</span></div><div class="stat"><strong>${esc(selected.retry_count)}/${esc(selected.max_retries)}</strong><span>Retries</span></div><div class="stat"><strong>${esc(selected.priority)}</strong><span>Priority</span></div></div>
 <div class="job-actions">${canRetry?'<button id="job-retry" class="button" type="button">Retry job</button>':''}${canCancel?'<button id="job-cancel" class="button secondary" type="button">Cancel job</button>':''}</div>
 <div class="job-info-grid"><div><span>Worker</span><b>${esc(selected.worker_id||'Unassigned')}</b></div><div><span>Provider</span><b>${esc(selected.provider||'—')}</b></div><div><span>Model</span><b>${esc(selected.model||'—')}</b></div><div><span>Created</span><b>${esc(time(selected.created_at))}</b></div><div><span>Started</span><b>${esc(time(selected.started_at))}</b></div><div><span>Completed</span><b>${esc(time(selected.completed_at))}</b></div><div><span>Next attempt</span><b>${esc(time(selected.next_attempt_at))}</b></div><div><span>Lease until</span><b>${esc(time(selected.lease_until))}</b></div></div>
 ${selected.error_message?`<div class="job-error"><b>${esc(selected.error_code||'ERROR')}</b><div>${esc(selected.error_message)}</div></div>`:''}
 <details open><summary>Input</summary><pre>${esc(JSON.stringify(selected.input||{},null,2))}</pre></details><details><summary>Checkpoint</summary><pre>${esc(JSON.stringify(selected.checkpoint||{},null,2))}</pre></details><details><summary>Output</summary><pre>${esc(JSON.stringify(selected.output||{},null,2))}</pre></details>`;
}
function jobCards(){return jobs.map(j=>`<button class="job-card ${selected?.id===j.id?'active':''}" data-job="${esc(j.id)}"><div class="job-head"><div><strong>${esc(label(j.job_type))}</strong><div class="job-id">${esc(j.id)}</div></div><span class="job-status" data-status="${esc(j.status)}">${esc(j.status)}</span></div><div class="job-meta">${esc(label(j.current_step||'Not started'))} · priority ${esc(j.priority)} · retry ${esc(j.retry_count)}/${esc(j.max_retries)}</div><div class="job-progress"><i style="width:${pct(j.progress_percent)}%"></i></div><div class="job-meta">${pct(j.progress_percent)}% · ${esc(time(j.created_at))}</div></button>`).join('')||'<div class="jobs-empty">No jobs found. Start an automation from Projects to create a real queued job.</div>'}
function render(){
 const root=document.querySelector('#content');if(!root)return;
 if(!getAccessToken()){root.innerHTML='<div class="card"><h2>Jobs</h2><div class="jobs-empty">Sign in to view your jobs. Jobs are tenant-scoped.</div></div>';return}
 const counts=Object.fromEntries(STATUSES.map(s=>[s,jobs.filter(j=>j.status===s).length]));
 const options=projects.map(p=>`<option value="${esc(p.id)}" ${project===p.id?'selected':''}>${esc(p.name)}</option>`).join('');
 root.innerHTML=`<div class="jobs-shell"><div class="jobs-toolbar"><div><h2>Jobs</h2><p class="muted">Durable execution queue backed by <b>automation_jobs</b>. Workers claim queued jobs and report progress.</p></div><div class="jobs-filters"><select id="jobs-project"><option value="">All projects</option>${options}</select><select id="jobs-status"><option value="">All statuses</option>${STATUSES.map(s=>`<option value="${s}" ${status===s?'selected':''}>${label(s)}</option>`).join('')}</select><button id="jobs-refresh" class="button secondary" type="button">Refresh</button></div></div>
 <div class="stat-grid"><div class="stat"><strong id="jobs-total">${jobs.length}</strong><span>Total</span></div><div class="stat"><strong id="jobs-queued">${counts.queued||0}</strong><span>Queued</span></div><div class="stat"><strong id="jobs-running">${counts.running||0}</strong><span>Running</span></div><div class="stat"><strong id="jobs-failed">${counts.failed||0}</strong><span>Failed</span></div></div>
 <div class="jobs-layout"><div class="card"><div class="section-head"><div><h3>Queue</h3><p class="muted">Newest jobs first.</p></div></div><div class="job-list" id="jobs-list">${jobCards()}</div></div><div class="card" id="job-detail">${detail()}</div></div></div>`;
 bind();
}
function patchList(){
 const total=document.querySelector('#jobs-total');const queued=document.querySelector('#jobs-queued');const running=document.querySelector('#jobs-running');const failed=document.querySelector('#jobs-failed');
 const counts=Object.fromEntries(STATUSES.map(s=>[s,jobs.filter(j=>j.status===s).length]));
 if(total)total.textContent=jobs.length;if(queued)queued.textContent=counts.queued||0;if(running)running.textContent=counts.running||0;if(failed)failed.textContent=counts.failed||0;
 const list=document.querySelector('#jobs-list');if(list){const active=document.activeElement?.id;list.innerHTML=jobCards();bindJobButtons();if(active)document.getElementById(active)?.focus()}
}
function bindJobButtons(){document.querySelectorAll('[data-job]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.job)))}
function bind(){
 document.querySelector('#jobs-project')?.addEventListener('change',e=>{project=e.target.value;selected=null;load(true)});
 document.querySelector('#jobs-status')?.addEventListener('change',e=>{status=e.target.value;selected=null;load(true)});
 document.querySelector('#jobs-refresh')?.addEventListener('click',()=>load(false));
 bindJobButtons();
 document.querySelector('#job-retry')?.addEventListener('click',()=>action('retry'));
 document.querySelector('#job-cancel')?.addEventListener('click',()=>action('cancel'));
}
async function load(forceRender=false){
 if(!getAccessToken()){render();return}
 try{
  const qs=new URLSearchParams();if(status)qs.set('status',status);if(project)qs.set('project_id',project);
  const [jr,pr]=await Promise.all([api(`/api/jobs?${qs}`,{cache:'no-store'}),api('/api/projects',{cache:'no-store'})]);
  jobs=Array.isArray(jr?.data)?jr.data:[];projects=Array.isArray(pr?.data)?pr.data:[];
  if(forceRender||!document.querySelector('.jobs-shell')){if(!selected&&jobs[0])selected=jobs[0];render();if(selected)await refreshSelectedDetail();return}
  patchList();
  if(selected&&jobs.some(j=>j.id===selected.id))await refreshSelectedDetail();
  else if(jobs[0])await select(jobs[0].id);
  else{selected=null;const box=document.querySelector('#job-detail');if(box)box.innerHTML=detail()}
 }catch(error){const root=document.querySelector('#content');if(root)root.innerHTML=`<div class="card"><h2>Jobs</h2><div class="jobs-empty jobs-error">Jobs module failed to load: ${esc(error.message)}</div></div>`}
}
async function refreshSelectedDetail(){if(!selected)return;try{const r=await api(`/api/jobs/${encodeURIComponent(selected.id)}`,{cache:'no-store'});selected=r?.data||selected;const box=document.querySelector('#job-detail');if(box)box.innerHTML=detail();bind();}catch(error){const box=document.querySelector('#job-detail');if(box)box.innerHTML=`<div class="jobs-empty jobs-error">Unable to load job: ${esc(error.message)}</div>`}}
async function select(id){selected=jobs.find(j=>j.id===id)||selected;const list=document.querySelector('#jobs-list');if(list){document.querySelectorAll('[data-job]').forEach(b=>b.classList.toggle('active',b.dataset.job===id))}await refreshSelectedDetail()}
async function action(name){
 try{const r=await api(`/api/jobs/${encodeURIComponent(selected.id)}`,{method:'POST',body:JSON.stringify({action:name})});selected=r?.data||selected;await load(false)}catch(error){const box=document.querySelector('#job-detail');if(box)box.insertAdjacentHTML('afterbegin',`<div class="job-error">${esc(error.message)}</div>`)}
}
export function activate(){window.removeEventListener('automation:automation_jobs',onRealtime);window.addEventListener('automation:automation_jobs',onRealtime);render();load(false)}
const onRealtime=()=>load(false);
