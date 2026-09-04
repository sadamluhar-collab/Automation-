import {env} from '../../config/env.js';
import {internetResearch} from '../../providers/internet-fallback.js';
import {researchProvider} from '../../providers/research/provider.js';

function researchQuery(input){
  return String(input?.query||input?.topic||input?.prompt||input?.subject||input?.config?.topic||'').trim();
}

function tavilyInput(input,q){
  const depth=String(input?.research_depth||input?.config?.research_depth||'standard').toLowerCase();
  return {
    query:q,
    search_depth:depth==='advanced'?'advanced':'basic',
    max_results:8,
    include_answer:true,
    include_raw_content:false
  };
}

export async function run(ctx){
  const input=ctx.input||{};
  const q=researchQuery(input);
  if(!q) throw Object.assign(new Error('Research query missing'),{code:'VALIDATION'});

  try{
    if(ctx.providers?.research) return await ctx.providers.research.research(tavilyInput(input,q));

    const e=env();
    const keys=e.PROVIDER_KEYS?.tavily||[];
    if(keys.length){
      const provider=researchProvider({url:'https://api.tavily.com/search',apiKeys:keys});
      return await provider.research(tavilyInput(input,q));
    }
  }catch(error){
    try{return await internetResearch(q)}catch(fallbackError){
      fallbackError.cause=error;
      throw fallbackError;
    }
  }

  return internetResearch(q);
}
