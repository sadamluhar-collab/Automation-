import {api} from './api.js';
import {getAccessToken} from './auth.js';

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
let projectRows=[];
let projectChannels=[];
let bound=false;

async function loadProjects(){
  if(!getAccessToken())return;
  try{
    const [projects,channels]=await Promise.all([
      api('/api/projects',{cache:'no-store'}),
      api('/api/channels',{cache:'no-store'})
    ]);
    projectRows=Array.isArray(projects?.data)?projects.data:[];
    projectChannels=Array.isArray(channels?.data)?channels.data:[];
    renderProjects();
  }catch(error){
    document.querySelector('#content').innerHTML=`<div class="card"><h2>Projects</h2><div class="empty">Unable to load projects: ${esc(error.message)}</div></div>`;
  }
}

function renderProjects(){
  const content=document.querySelector('#content');
  if(!content||!getAccessToken())return;
  const channelMap=new Map(projectChannels.map(c=>[c.id,c]));
  const cards=projectRows.map(p=>{const c=channelMap.get(p.channel_id);return `<div class="card"><div class="item"><div><div class="label">Project</div><h2>${esc(p.name)}</h2></div><span class="badge">${esc(p.status)}</span></div><div class="list"><div class="item"><span>Channel</span><span class="badge">${esc(c?.youtube_handle||c?.name||p.channel_id)}</span></div><div class="item"><span>Mode</span><span class="badge">${esc(p.mode)}</span></div><div class="item"><span>Updated</span><span class="badge">${p.updated_at?esc(new Date(p.updated_at).toLocaleString()):'—'}</span></div></div></div>`}).join('');
  const options=projectChannels.map(c=>`<option value="${esc(c.id)}">${esc(c.name||c.youtube_handle||c.youtube_channel_id)}</option>`).join('');
  content.innerHTML=`<div class="card"><div class="item"><div><h2>Projects</h2><p class="muted">Create and manage automation projects for your connected YouTube channels.</p></div><span class="badge">${projectRows.length} project${projectRows.length===1?'':'s'}</span></div></div><div class="card panel"><h3>Create project</h3>${projectChannels.length?`<form id="project-form" class="auth-form"><input id="project-name" type="text" maxlength="200" placeholder="Project name" required><select id="project-channel" required>${options}</select><select id="project-mode"><option value="manual">Manual</option><option value="auto">Auto</option></select><div class="item"><button class="button" type="submit">Create Project</button></div><div id="project-message" class="muted"></div></form>`:'<div class="empty">Connect a YouTube channel first to create a project.</div>'}</div>${cards||'<div class="card"><div class="empty">No projects yet. Create your first project above.</div></div>'}`;
  document.querySelector('#project-form')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const message=document.querySelector('#project-message');
    message.textContent='Creating project…';
    try{
      const result=await api('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:document.querySelector('#project-name').value.trim(),channel_id:document.querySelector('#project-channel').value,mode:document.querySelector('#project-mode').value})});
      if(!result?.data)throw new Error('Project was not created');
      projectRows=[result.data,...projectRows];
      renderProjects();
    }catch(error){message.textContent=error.message}
  });
}

function activate(){
  if(document.querySelector('#page-title'))document.querySelector('#page-title').textContent='Projects';
  if(!getAccessToken()){
    document.querySelector('#content').innerHTML='<div class="card"><h2>Projects</h2><div class="empty">Sign in to manage projects.</div></div>';
    return;
  }
  document.querySelector('#content').innerHTML='<div class="card"><div class="empty">Loading projects…</div></div>';
  loadProjects();
}

document.querySelectorAll('#nav button[data-section="projects"]').forEach(button=>button.addEventListener('click',()=>{setTimeout(activate,0)}));
if(!bound){bound=true;window.addEventListener('automation:projects',activate)}
