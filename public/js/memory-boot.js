let activate=null;
let dispose=null;
let active=false;

async function openMemory(){
  if(active)return;
  if(!activate){
    const module=await import('./memory.js?v=20260904-4');
    if(typeof module.activate!=='function')throw new Error('Memory module is unavailable');
    activate=module.activate;
    dispose=typeof module.dispose==='function'?module.dispose:null;
  }
  active=true;
  await activate();
}

function closeMemory(){
  if(!active)return;
  active=false;
  if(dispose)dispose();
}

document.querySelector('#nav button[data-section="memory"]')?.addEventListener('click',()=>openMemory().catch(error=>{
  active=false;
  const content=document.querySelector('#content');
  if(content)content.innerHTML=`<div class="card"><h2>Memory</h2><div class="empty error">Memory module failed to load: ${String(error.message||error)}</div></div>`;
  console.error('Memory module failed',error);
}));

document.querySelectorAll('#nav button[data-section]:not([data-section="memory"])').forEach(button=>button.addEventListener('click',closeMemory));

window.addEventListener('automation:section-change',event=>{
  if(event.detail?.section!=='memory')closeMemory();
});
