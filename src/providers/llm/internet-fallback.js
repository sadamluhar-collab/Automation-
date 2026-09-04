import {internetFetch} from '../internet-fallback.js';

export async function llmInternetFallback(input){
  const prompt=String(input?.prompt||input?.input||input?.text||'').trim();
  if(!prompt) throw Object.assign(new Error('LLM fallback input missing'),{code:'VALIDATION'});
  const search=await import('../internet-fallback.js').then(m=>m.internetResearch(prompt));
  const pages=[];
  for(const item of search.results.slice(0,5)){
    try{pages.push(await internetFetch(item.url,{maxBytes:120000}));}catch{}
  }
  return {provider:'internet',fallback:true,input:prompt,results:search.results,pages};
}
