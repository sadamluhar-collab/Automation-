import {api} from './api.js';
import {getAccessToken} from './auth.js';

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const steps=[
  ['research','Research','Find facts, sources and context.'],
  ['content-plan','Content Plan','Turn research into a structured plan.'],
  ['script','Script','Generate the narration and script.'],
  ['scenes','Scenes','Break the script into visual scenes.'],
  ['references','References','Collect visual/source references.'],
  ['clips','Clips','Prepare source clips and media.'],
  ['audio','Audio','Generate or prepare narration audio.'],
  ['music','Music','Select or generate background music.'],
  ['assembly','Assembly','Combine scenes, clips and audio.'],
  ['thumbnail','Thumbnail','Prepare the video thumbnail.'],
  ['qc','Quality Check','Validate media, timing and output.'],
  ['upload','Upload','Publish the approved video to YouTube.'],
  ['analytics','Analytics','Track the published result.']
];
const configDefaults={topic:'',language:'English',content_type:'YouTube video',duration_minutes:5,tone:'Informative',audience:'General',research_depth:'standard',publish:'manual',schedule:'',pipeline_enabled:true};
let projectRows=[];
let projectChannels=[];
let selected=null;

async function loadProjects(){
  if(!getAccessToken())return;
  try{
    const [projects,channels]=await Promise.all([
      api('/api/projects',{cache:'no-store'}),
      api('/api/channels',{cache:'no-store'})
    ]);
    projectRows=Array.isArray(projects?.data)?projects.data:[];
    projectChannels=Array.isArray(channels?.data)?channels.data:[];
    if(selected)selected=projectRows.find(p=>p.id===selected.id)||null;
    renderProjects();
  }catch(error){
    const content=document.querySelector('#content');
    if(content)content.innerHTML=`<div class="card"><h2>Projects</h2><div class="empty">Unable to load projects: ${esc(error.message)}</div></div>`;
  }
}

function renderProjects(){
  const content=document.querySelector('#content');
  if(!content||!getAccessToken())return;
  const channelMap=new Map(projectChannels.map(c=>[c.id,c]));
  const cards=projectRows.map(p=>{
    const c=channelMap.get(p.channel_id);
    return `<div class="card project-card"><div class="section-head"><div><div class="label">PROJECT</div><h2>${esc(p.name)}</h2><p class="muted">${esc(c?.youtube_handle||c?.name||'Channel unavailable')}</p></div><span class="badge">${esc(p.status)}</span></div><div class="stat-grid"><div class="stat"><strong>${esc(p.mode)}</strong><span>Automation mode</span></div><div class="stat"><strong>v${Number(p.version||1)}</strong><span>Configuration version</span></div><div class="stat"><strong>${p.config?.pipeline_enabled===false?'Off':'On'}</strong><span>Pipeline</span></div><div class="stat"><strong>${p.updated_at?esc(new Date(p.updated_at).toLocaleDateString()):'—'}</strong><span>Last update</span></div></div><div class="project-actions"><button class="button" data-open="${esc(p.id)}">Open project</button><button class="button" data-run="${esc(p.id)}" ${p.status==='running'?'disabled':''}>${p.status==='running'?'Running…':'Start automation'}</button></div></div>`;
  }).join('');
  const options=projectChannels.map(c=>`<option value="${esc(c.id)}">${esc(c.name||c.youtube_handle||c.youtube_channel_id)}</option>`).join('');
  const projectList=cards?`<div class="project-grid panel">${cards}</div>`:'<div class="card panel"><div class="empty">No projects yet. Create your first project above.</div></div>';
  content.innerHTML=`<div class="card"><div class="section-head"><div><div class="label">PROJECT WORKSPACE</div><h2>Projects</h2><p class="muted">Each project is a complete automation workspace: channel, content rules, pipeline, publishing and versioned configuration.</p></div><span class="badge">${projectRows.length} project${projectRows.length===1?'':'s'}</span></div><div class="notice">Flow: YouTube channel → project configuration → Research → Script → Scenes → Media → Assembly → QC → Upload → Analytics.</div></div><div class="card panel"><div class="section-head"><div><h3>Create project</h3><p class="muted">Create a project for a connected channel, then open it to configure the complete automation workflow.</p></div></div>${projectChannels.length?`<form id="project-form" class="form-grid"><div class="field"><label>Project name</label><input id="project-name" maxlength="200" placeholder="e.g. Daily AI News" required></div><div class="field"><label>YouTube channel</label><select id="project-channel" required>${options}</select></div><div class="field"><label>Automation mode</label><select id="project-mode"><option value="manual">Manual — start when I choose</option><option value="auto">Auto — run from automation rules</option></select></div><div class="field"><label>First topic (optional)</label><input id="project-topic" maxlength="500" placeholder="What should this project create?"></div><div class="field full"><div class="project-actions"><button class="button" type="submit">Create project</button><span id="project-message" class="muted"></span></div></div></form>`:'<div class="empty">Connect a YouTube channel first to create a project.</div>'}</div>${projectList}${selected?renderEditor(selected):''}`;
  document.querySelector('#project-form')?.addEventListener('submit',createProject);
  document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>{
    selected=projectRows.find(p=>p.id===button.dataset.open)||null;
    renderProjects();
    document.querySelector('#project-editor')?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  document.querySelectorAll('[data-run]').forEach(button=>button.addEventListener('click',()=>runProject(button.dataset.run)));
  bindEditor();
}

function renderEditor(project){
  const channel=projectChannels.find(x=>x.id===project.channel_id);
  const cfg={...configDefaults,...(project.config||{})};
  const workflow=steps.map(([id,name,desc],index)=>`<div class="step"><strong>${index+1}. ${esc(name)}</strong><span>${esc(desc)}</span></div>`).join('');
  return `<div class="card panel" id="project-editor"><div class="section-head"><div><div class="label">PROJECT EDITOR</div><h2>${esc(project.name)}</h2><p class="muted">${esc(channel?.name||channel?.youtube_handle||'Channel')} · Version ${Number(project.version||1)}</p></div><span class="badge">${esc(project.status)}</span></div><div class="stat-grid"><div class="stat"><strong>${esc(project.mode)}</strong><span>How runs start</span></div><div class="stat"><strong>${esc(cfg.content_type)}</strong><span>Output type</span></div><div class="stat"><strong>${esc(cfg.language)}</strong><span>Language</span></div><div class="stat"><strong>${Number(cfg.duration_minutes||5)} min</strong><span>Target duration</span></div></div><div class="card panel"><h3>1. Content settings</h3><div class="form-grid"><div class="field"><label>Topic / niche</label><input id="cfg-topic" value="${esc(cfg.topic)}" placeholder="Topic, niche or content brief"></div><div class="field"><label>Language</label><select id="cfg-language">${['English','Hindi','Hinglish','Gujarati','Other'].map(x=>`<option ${cfg.language===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Content type</label><select id="cfg-content_type">${['YouTube video','YouTube Short','News update','Explainer','Listicle'].map(x=>`<option ${cfg.content_type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Target duration (minutes)</label><input id="cfg-duration" type="number" min="1" max="180" value="${Number(cfg.duration_minutes||5)}"></div><div class="field"><label>Tone</label><select id="cfg-tone">${['Informative','News','Storytelling','Educational','Entertaining'].map(x=>`<option ${cfg.tone===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Audience</label><input id="cfg-audience" value="${esc(cfg.audience)}" placeholder="Who is this for?"></div><div class="field"><label>Research depth</label><select id="cfg-research"><option value="light" ${cfg.research_depth==='light'?'selected':''}>Light</option><option value="standard" ${cfg.research_depth==='standard'?'selected':''}>Standard</option><option value="deep" ${cfg.research_depth==='deep'?'selected':''}>Deep</option></select></div><div class="field"><label>Publishing</label><select id="cfg-publish"><option value="manual" ${cfg.publish==='manual'?'selected':''}>Manual approval</option><option value="auto" ${cfg.publish==='auto'?'selected':''}>Automatic after QC</option></select></div><div class="field full"><label>Schedule rule</label><input id="cfg-schedule" value="${esc(cfg.schedule)}" placeholder="Optional schedule expression"><span class="muted">Saved with the project configuration. Actual scheduler execution remains in the Schedules module.</span></div></div></div><div class="card panel"><div class="section-head"><div><h3>2. Automation pipeline</h3><p class="muted">The project run starts at Research and follows the dependency-aware pipeline.</p></div><span class="badge">${steps.length} stages</span></div><div class="workflow">${workflow}</div></div><div class="card panel"><h3>3. Run controls</h3><div class="notice">Start Automation creates a durable Postgres queue job. Workers can claim, checkpoint and recover that job. Project configuration is stored separately as versions.</div><div class="project-actions"><button class="button" id="save-project">Save configuration</button><button class="button" id="run-editor" ${project.status==='running'?'disabled':''}>${project.status==='running'?'Automation running…':'Start automation now'}</button><button class="button secondary" id="close-editor">Close editor</button><span id="editor-message" class="muted"></span></div></div></div>`;
}

function configFromEditor(){
  return {
    topic:document.querySelector('#cfg-topic')?.value.trim()||'',
    language:document.querySelector('#cfg-language')?.value||'English',
    content_type:document.querySelector('#cfg-content_type')?.value||'YouTube video',
    duration_minutes:Math.min(180,Math.max(1,Number(document.querySelector('#cfg-duration')?.value||5))),
    tone:document.querySelector('#cfg-tone')?.value||'Informative',
    audience:document.querySelector('#cfg-audience')?.value.trim()||'General',
    research_depth:document.querySelector('#cfg-research')?.value||'standard',
    publish:document.querySelector('#cfg-publish')?.value||'manual',
    schedule:document.querySelector('#cfg-schedule')?.value.trim()||'',
    pipeline_enabled:true
  };
}

function bindEditor(){
  if(!selected)return;
  document.querySelector('#close-editor')?.addEventListener('click',()=>{selected=null;renderProjects()});
  document.querySelector('#save-project')?.addEventListener('click',saveProject);
  document.querySelector('#run-editor')?.addEventListener('click',()=>runProject(selected.id));
}

async function createProject(event){
  event.preventDefault();
  const message=document.querySelector('#project-message');
  if(message)message.textContent='Creating…';
  try{
    const result=await api('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:document.querySelector('#project-name').value.trim(),channel_id:document.querySelector('#project-channel').value,mode:document.querySelector('#project-mode').value,config:{topic:document.querySelector('#project-topic').value.trim()}})});
    if(!result?.data)throw new Error('Project was not created');
    projectRows=[result.data,...projectRows];
    selected=result.data;
    renderProjects();
    document.querySelector('#project-editor')?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){
    if(message)message.textContent=error.message;
  }
}

async function saveProject(){
  if(!selected)return;
  const message=document.querySelector('#editor-message');
  if(message)message.textContent='Saving configuration…';
  try{
    const result=await api(`/api/projects/${encodeURIComponent(selected.id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:selected.name,mode:selected.mode,status:selected.status,config:configFromEditor()})});
    if(!result?.data)throw new Error('Configuration was not saved');
    selected=result.data;
    projectRows=projectRows.map(p=>p.id===selected.id?selected:p);
    renderProjects();
    const next=document.querySelector('#editor-message');
    if(next)next.textContent='Configuration saved.';
  }catch(error){
    if(message)message.textContent=`Save failed: ${error.message}`;
  }
}

async function runProject(id){
  const project=projectRows.find(x=>x.id===id);
  if(!project||project.status==='running')return;
  const message=document.querySelector('#editor-message')||document.querySelector('#project-message');
  if(message)message.textContent='Starting durable pipeline job…';
  try{
    const result=await api(`/api/projects/${encodeURIComponent(id)}/run`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    if(!result?.data?.job)throw new Error('Pipeline job was not created');
    const next={...project,status:'running'};
    projectRows=projectRows.map(x=>x.id===id?next:x);
    selected=selected?.id===id?next:selected;
    renderProjects();
    const nextMessage=document.querySelector('#editor-message');
    if(nextMessage)nextMessage.textContent=`Started. Job ${result.data.job.id||'created'} is queued at Research.`;
  }catch(error){
    if(message)message.textContent=`Start failed: ${error.message}`;
  }
}

function activate(){
  if(document.querySelector('#page-title'))document.querySelector('#page-title').textContent='Projects';
  if(!getAccessToken()){
    document.querySelector('#content').innerHTML='<div class="card"><h2>Projects</h2><div class="empty">Sign in to manage projects.</div></div>';
    return;
  }
  document.querySelector('#content').innerHTML='<div class="card"><div class="empty">Loading project workspace…</div></div>';
  loadProjects();
}

window.addEventListener('automation:projects',()=>{if(document.querySelector('#page-title')?.textContent==='Projects')loadProjects()});
export {activate,loadProjects};
