import {api} from './api.js';

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const arr=v=>Array.isArray(v)?v:[];

function ensureStyles(){
  if(document.querySelector('#project-strategy-styles'))return;
  const style=document.createElement('style');
  style.id='project-strategy-styles';
  style.textContent='.strategy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}.strategy-summary,.strategy-topic{border:1px solid var(--border,#263242);border-radius:12px;padding:16px;background:rgba(255,255,255,.015)}.strategy-summary h4,.strategy-topics h4{margin:0 0 12px}.strategy-summary p{line-height:1.55}.strategy-list{margin:8px 0 16px;padding-left:20px}.strategy-list li{margin:6px 0}.strategy-topics{margin-top:16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.strategy-topics h4{grid-column:1/-1}.strategy-topic p{margin:8px 0;line-height:1.45}@media(max-width:800px){.strategy-grid,.strategy-topics{grid-template-columns:1fr}}';
  document.head.appendChild(style);
}

export function strategyPanel(project){ensureStyles();return `<div class="card panel strategy-panel" id="project-strategy"><div class="section-head"><div><div class="label">CHANNEL INTELLIGENCE</div><h3>Channel analysis & content planning</h3><p class="muted">Analyze the connected YouTube channel, its description and recent videos, then generate a data-backed Shorts content plan.</p></div><span class="badge" id="strategy-status">Not analyzed</span></div><div class="project-actions"><button class="button" id="analyze-channel">Analyze channel & plan content</button><span id="strategy-message" class="muted"></span></div><div id="strategy-result"></div></div>`;}

function listBlock(title,items){const values=arr(items).filter(Boolean).map(x=>`<li>${esc(x)}</li>`).join('');return values?`<div><strong>${esc(title)}</strong><ul class="strategy-list">${values}</ul></div>`:'';}

function renderStrategy(strategy){
  const analysis=strategy?.channel_analysis||{};const plan=strategy?.content_plan||{};const topics=arr(plan.topics);
  const topicsHtml=topics.map((t,i)=>`<div class="strategy-topic"><div class="section-head"><strong>${i+1}. ${esc(t.title||'Untitled')}</strong><span class="badge">${esc(t.priority||'medium')}</span></div><p><strong>Hook:</strong> ${esc(t.hook||'—')}</p><p><strong>Angle:</strong> ${esc(t.angle||'—')}</p><p><strong>Why:</strong> ${esc(t.why||'—')}</p><p class="muted">Estimated: ${Number(t.estimated_duration_seconds||0)} sec</p><button class="button secondary" data-use-topic="${esc(t.title||'')}">Use this topic</button></div>`).join('');
  return `<div class="strategy-grid"><div class="strategy-summary"><h4>Channel understanding</h4><p><strong>Niche:</strong> ${esc(analysis.niche||'—')}</p><p><strong>Audience:</strong> ${esc(analysis.audience||'—')}</p><p><strong>Description:</strong> ${esc(analysis.description_summary||'—')}</p><p><strong>Recommended format:</strong> ${esc(analysis.recommended_format||'—')}</p>${listBlock('Content pillars',analysis.content_pillars)}${listBlock('Winning patterns',analysis.winning_patterns)}${listBlock('Avoid patterns',analysis.avoid_patterns)}</div><div class="strategy-summary"><h4>Content strategy</h4><p>${esc(plan.strategy_summary||'—')}</p><p><strong>Cadence:</strong> ${esc(plan.cadence||'—')}</p><p><strong>Next best topic:</strong> ${esc(plan.next_best_topic||'—')}</p></div></div>${topicsHtml?`<div class="strategy-topics"><h4>Recommended Shorts</h4>${topicsHtml}</div>`:''}<div class="notice">Source videos analyzed: ${Number(strategy?.source_video_count||strategy?.source?.videos?.length||0)} · Provider: ${esc(strategy?.provider||'—')} · Model: ${esc(strategy?.model||'—')}</div>`;
}

export async function loadStrategy(projectId){const result=await api(`/api/projects/${encodeURIComponent(projectId)}/strategy`,{cache:'no-store'});const strategy=result?.data;const status=document.querySelector('#strategy-status');const resultBox=document.querySelector('#strategy-result');if(strategy&&resultBox){resultBox.innerHTML=renderStrategy(strategy);if(status)status.textContent='Analyzed';bindTopicButtons();}return strategy;}

function bindTopicButtons(){document.querySelectorAll('[data-use-topic]').forEach(button=>button.addEventListener('click',()=>{const input=document.querySelector('#cfg-topic');if(input){input.value=button.dataset.useTopic;input.dispatchEvent(new Event('input',{bubbles:true}));input.scrollIntoView({behavior:'smooth',block:'center'});}}));}

export function bindStrategy(project){
  ensureStyles();
  const button=document.querySelector('#analyze-channel');if(!button)return;
  button.addEventListener('click',async()=>{
    const message=document.querySelector('#strategy-message');const status=document.querySelector('#strategy-status');button.disabled=true;
    if(message)message.textContent='Reading channel + recent videos and generating strategy…';if(status)status.textContent='Analyzing…';
    try{
      const result=await api(`/api/projects/${encodeURIComponent(project.id)}/strategy/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({config:{topic:document.querySelector('#cfg-topic')?.value.trim()||'',language:document.querySelector('#cfg-language')?.value||'English',content_type:document.querySelector('#cfg-content_type')?.value||'YouTube Short',tone:document.querySelector('#cfg-tone')?.value||'Informative',audience:document.querySelector('#cfg-audience')?.value.trim()||'General',research_depth:document.querySelector('#cfg-research')?.value||'standard'}})});
      if(!result?.data?.strategy)throw new Error('Strategy was not generated');
      if(message)message.textContent=`Analysis saved. ${Number(result.data.source?.videos?.length||0)} recent videos were analyzed.`;if(status)status.textContent='Analyzed';
      const box=document.querySelector('#strategy-result');if(box)box.innerHTML=renderStrategy(result.data.strategy);bindTopicButtons();
    }catch(error){if(status)status.textContent='Failed';if(message)message.textContent=`Analysis failed: ${error.message}`;}finally{button.disabled=false;}
  });
  loadStrategy(project.id).catch(()=>{});
}
