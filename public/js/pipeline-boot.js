let activate=null;

async function openPipeline(){
  if(!activate){
    const module=await import('./pipeline.js?v=20260904-1');
    if(typeof module.activate!=='function')throw new Error('Pipeline module is unavailable');
    activate=module.activate;
  }
  activate();
}

document.querySelector('#nav button[data-section="pipeline"]')?.addEventListener('click',()=>openPipeline().catch(error=>{
  const content=document.querySelector('#content');
  if(content)content.innerHTML=`<div class="card"><h2>Pipeline</h2><div class="empty error">Pipeline module failed to load: ${String(error.message||error)}</div></div>`;
  console.error('Pipeline module failed',error);
}));
