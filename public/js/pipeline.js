import {api} from './api.js';
import {getAccessToken} from './auth.js';

const STAGES=[
  ['research','Research'],['content-plan','Content Plan'],['script','Script'],['scenes','Scenes'],['references','References'],['clips','Clips'],['audio','Audio'],['music','Music'],['assembly','Assembly'],['thumbnail','Thumbnail'],['qc','Quality Check'],['upload','Upload'],['analytics','Analytics']
];
const STATUS_ORDER=['queued','running','completed','failed','paused','cancelled'];
let runs=[];
let projects=[];
let selectedId=null;
let selected=null;
let projectFilter='';
let statusFilter='';
let timer=null;
let styleLoaded=false;

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>Math.max(0,Math.min(100,Number(v)||0));
const label=v=>String(v||'').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const time=v=>v?new Date(v).toLocaleString(): '—';

function loadStyle(){
  if(styleLoaded)return;
  styleLoaded=true;
  const link=document.createElement('link');link.rel='stylesheet';link.href='/css/pipeline.css?v=20260904-1';document.head.appendChild(link);
}

function projectName(id){return projects.find(p=>p.id===id)?.name||'Project';}
function sortedSteps(rows=[]){
  const map=new Map(rows.map(x=>[x.step,x]));
  return STAGES.map(([key,name])=>({...map.get(key),step:key,name,status:map.get(key)?.status||'queued',progress:pct(map.get(key)?.progress),error:map.get(key)?.error||null}));
}

function render(){
  const root=document.querySelector('#content');
  if(!root)return;
  loadStyle();
  if(!getAccessToken()){
    root.innerHTML='<div class="card"><h2>Pipeline</h2><div class="pipeline-empty">Sign in to load your pipeline runs. Pipeline data is tenant-scoped.</div></div>';
    return;
  }
  const total=runs.length;
  const running=runs.filter(x=>x.status==='running').length;
  const completed=runs.filter(x=>x.status==='completed').length;
  const failed=runs.filter(x=>x.status==='failed').length;
  const projectOptions=projects.map(p=>`<option value="${esc(p.id)}" ${p.id===projectFilter?'selected':''}>${esc(p.name)}</option>`).join('');
  const statusOptions=STATUS_ORDER.map(s=>`<option value="${s}" ${s===statusFilter?'selected':''}>${label(s)}</option>`).join('');
  const runCards=runs.map(run=>{
    const active=run.id===selectedId?' active':'';
    return `<button class="pipeline-run${active}" data-run-id="${esc(run.id)}"><div class="pipeline-run-head"><div><h3>${esc(projectName(run.project_id))}</h3><div class="meta">${esc(run.id)} · ${time(run.created_at)}</div></div><span class="pipeline-status">${esc(run.status)}</span></div><div class="pipeline-progress"><i style="width:${pct(run.progress)}%"></i></div><div class="meta">${esc(label(run.current_step||'Not started'))} · ${pct(run.progress)}%</div></button>`;
  }).join('');
  root.innerHTML=`<div class="pipeline-shell">
    <div class="pipeline-toolbar">
      <div><h2>Pipeline</h2><p class="pipeline-live">Durable pipeline execution view for <b>pipeline_runs</b>, <b>pipeline_steps</b>, <b>scenes</b> and <b>scene_versions</b>.</p></div>
      <div class="pipeline-filters"><select id="pipeline-project"><option value="">All projects</option>${projectOptions}</select><select id="pipeline-status"><option value="">All statuses</option>${statusOptions}</select><button id="pipeline-refresh" class="button secondary" type="button">Refresh</button></div>
    </div>
    <div class="stat-grid"><div class="stat"><strong>${total}</strong><span>Total runs</span></div><div class="stat"><strong>${running}</strong><span>Running</span></div><div class="stat"><strong>${completed}</strong><span>Completed</span></div><div class="stat"><strong>${failed}</strong><span>Failed</span></div></div>
    <div class="pipeline-layout"><div class="card"><div class="section-head"><div><h3>Runs</h3><p class="muted">Newest first. Select a run to inspect every stage.</p></div></div><div class="pipeline-runs">${runCards||'<div class="pipeline-empty">No pipeline runs yet. Start an automation from a project and its run will appear here.</div>'}</div></div><div id="pipeline-detail" class="card pipeline-detail">${renderDetail()}</div></div>
  </div>`;
  bind();
}

function renderDetail(){
  if(!selected)return '<div class="pipeline-empty">Select a pipeline run to open its execution timeline.</div>';
  const steps=sortedSteps(selected.steps);
  const scenes=selected.scenes||[];
  return `<div class="pipeline-detail-head"><div><div class="label">Pipeline Run</div><h2>${esc(projectName(selected.project_id))}</h2><p class="muted">${esc(selected.id)} · created ${esc(time(selected.created_at))}</p></div><span class="pipeline-status">${esc(selected.status)}</span></div>
    <div class="pipeline-progress-large"><i style="width:${pct(selected.progress)}%"></i></div>
    <div class="stat-grid"><div class="stat"><strong>${pct(selected.progress)}%</strong><span>Progress</span></div><div class="stat"><strong>${esc(label(selected.current_step||'—'))}</strong><span>Current stage</span></div><div class="stat"><strong>${steps.filter(s=>s.status==='completed').length}/${steps.length}</strong><span>Stages complete</span></div><div class="stat"><strong>${scenes.length}</strong><span>Scenes</span></div></div>
    <div class="panel"><div class="section-head"><div><h3>Execution timeline</h3><p class="muted">Dependencies are enforced by the pipeline engine.</p></div></div><div class="pipeline-stage-grid">${steps.map(s=>`<button class="pipeline-stage" data-step="${esc(s.step)}" data-status="${esc(s.status)}"><strong>${esc(s.name)}</strong><span>${esc(s.status)} · ${pct(s.progress)}%</span></button>`).join('')}</div><div id="pipeline-inspect" class="pipeline-inspect"></div></div>
    <div class="panel"><div class="section-head"><div><h3>Scenes</h3><p class="muted">Latest scene version is shown when available.</p></div></div><div class="pipeline-scenes">${scenes.length?scenes.map(scene=>`<div class="pipeline-scene"><div class="scene-head"><strong>Scene ${esc(scene.scene_number)}</strong><span class="badge">${esc(scene.status)}</span></div><div class="muted">Version ${esc(scene.latest_version?.version||'—')}</div>${scene.latest_version?.data?`<div class="pipeline-code">${esc(JSON.stringify(scene.latest_version.data,null,2))}</div>`:''}</div>`).join(''):'<div class="pipeline-empty">No scenes recorded for this project yet.</div>'}</div></div>`;
}

function bind(){
  document.querySelector('#pipeline-project')?.addEventListener('change',e=>{projectFilter=e.target.value;selectedId=null;selected=null;load()});
  document.querySelector('#pipeline-status')?.addEventListener('change',e=>{statusFilter=e.target.value;selectedId=null;selected=null;load()});
  document.querySelector('#pipeline-refresh')?.addEventListener('click',()=>load());
  document.querySelectorAll('[data-run-id]').forEach(button=>button.addEventListener('click',()=>selectRun(button.dataset.runId)));
  document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>inspect(button.dataset.step)));
}

async function loadProjects(){
  const result=await api('/api/projects',{cache:'no-store'});
  projects=Array.isArray(result?.data)?result.data:[];
}

async function loadRuns(){
  const qs=new URLSearchParams();
  if(projectFilter)qs.set('project_id',projectFilter);
  if(statusFilter)qs.set('status',statusFilter);
  const result=await api(`/api/pipeline/runs${qs.toString()?`?${qs}`:''}`,{cache:'no-store'});
  runs=Array.isArray(result?.data)?result.data:[];
  if(selectedId&&!runs.some(x=>x.id===selectedId))selectedId=null;
}

async function selectRun(id){
  selectedId=id;
  render();
  const detail=document.querySelector('#pipeline-detail');
  if(detail)detail.innerHTML='<div class="pipeline-empty">Loading pipeline run…</div>';
  try{
    const result=await api(`/api/pipeline/runs/${encodeURIComponent(id)}`,{cache:'no-store'});
    selected=result?.data||null;
    render();
  }catch(error){
    selected=null;
    const target=document.querySelector('#pipeline-detail');
    if(target)target.innerHTML=`<div class="pipeline-empty pipeline-error">Unable to load pipeline run: ${esc(error.message)}</div>`;
  }
}

async function inspect(step){
  const target=document.querySelector('#pipeline-inspect');
  if(!target)return;
  target.innerHTML='<div class="notice">Loading stage dependencies…</div>';
  try{
    const result=await api(`/api/pipeline/${encodeURIComponent(step)}`,{cache:'no-store'});
    const data=result?.data||result;
    target.innerHTML=`<div class="notice"><strong>${esc(label(step))}</strong><div class="pipeline-code">Dependencies: ${esc((data.dependencies||[]).join(', ')||'None')}\nDownstream: ${esc((data.downstream||[]).join(', ')||'None')}</div></div>`;
  }catch(error){target.innerHTML=`<div class="notice pipeline-error">Stage inspection failed: ${esc(error.message)}</div>`}
}

async function load(){
  if(!getAccessToken()){render();return;}
  try{
    await Promise.all([loadProjects(),loadRuns()]);
    if(selectedId)await selectRun(selectedId);else if(runs[0]){selectedId=runs[0].id;await selectRun(selectedId)}else{selected=null;render()}
  }catch(error){
    const root=document.querySelector('#content');
    if(root)root.innerHTML=`<div class="card"><h2>Pipeline</h2><div class="pipeline-empty pipeline-error">Pipeline module failed to load: ${esc(error.message)}</div></div>`;
  }
}

export function activate(){
  loadStyle();
  clearInterval(timer);
  window.removeEventListener('automation:pipeline_runs',onRealtime);
  window.removeEventListener('automation:pipeline_steps',onRealtime);
  window.removeEventListener('automation:scenes',onRealtime);
  window.removeEventListener('automation:scene_versions',onRealtime);
  window.addEventListener('automation:pipeline_runs',onRealtime);
  window.addEventListener('automation:pipeline_steps',onRealtime);
  window.addEventListener('automation:scenes',onRealtime);
  window.addEventListener('automation:scene_versions',onRealtime);
  timer=setInterval(()=>{if(document.querySelector('#pipeline-refresh'))load()},10000);
  render();
  load();
}

function onRealtime(){load()}
