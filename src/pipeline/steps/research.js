import {internetResearch} from '../../providers/internet-fallback.js';

export async function run(ctx){
  const input=ctx.input||{};
  try{
    if(ctx.providers?.research) return await ctx.providers.research.research(input);
  }catch(error){
    const q=input.query||input.topic||input.prompt||input.subject;
    if(q) return internetResearch(q);
    throw error;
  }
  const q=input.query||input.topic||input.prompt||input.subject;
  if(q) return internetResearch(q);
  throw Object.assign(new Error('Research provider unavailable and no research query supplied'),{code:'CONFIGURATION'});
}
