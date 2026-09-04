import {api} from './api.js';

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

function attachDeleteControls(){
  document.querySelectorAll('.project-card').forEach(card=>{
    if(card.querySelector('[data-delete-project]'))return;
    const open=card.querySelector('[data-open]');
    const actions=card.querySelector('.project-actions');
    if(!open||!actions)return;
    const button=document.createElement('button');
    button.className='button secondary';
    button.type='button';
    button.dataset.deleteProject=open.dataset.open;
    button.textContent='Delete project';
    actions.appendChild(button);
  });
}

async function deleteProject(button){
  const id=button.dataset.deleteProject;
  const card=button.closest('.project-card');
  const name=card?.querySelector('h2')?.textContent?.trim()||'this project';
  const typed=window.prompt(`Delete project "${name}"? This removes its project data and generated pipeline records. Type the project name to confirm.`,'');
  if(typed!==name)return;
  button.disabled=true;
  button.textContent='Deleting…';
  try{
    const result=await api(`/api/projects/${encodeURIComponent(id)}`,{method:'DELETE'});
    if(!result?.success)throw new Error(result?.error?.message||'Project could not be deleted');
    card?.remove();
    window.dispatchEvent(new Event('automation:projects'));
  }catch(error){
    button.disabled=false;
    button.textContent='Delete project';
    window.alert(`Delete failed: ${esc(error.message)}`);
  }
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-delete-project]');
  if(button)deleteProject(button);
});

const observer=new MutationObserver(attachDeleteControls);
observer.observe(document.body,{childList:true,subtree:true});
attachDeleteControls();
