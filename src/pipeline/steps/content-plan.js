import {createHash} from 'node:crypto';
import {query} from '../../database/supabase.js';
import {listContentHistory,saveGeneration,updateGeneration} from '../../content/content-history.service.js';
import {findSimilar,contentFingerprint} from '../../content/content-uniqueness.js';

const clean=v=>String(v||'').trim();
const parse=result=>{const raw=result?.choices?.[0]?.message?.content??result?.candidates?.[0]?.content?.parts?.[0]?.text??result; if(typeof raw!=='string')return result;const s=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();try{return JSON.parse(s)}catch{return result}};
async function channelContext(ctx){
 const channelId=ctx.job?.channel_id||ctx.input?.channel_id;if(!channelId)return null;
 const rows=await query('channels',{params:`?id=eq.${encodeURIComponent(channelId)}&select=id,name,description,youtube_channel_id`});
 const channel=rows?.[0]||null;const history=await listContentHistory(channelId).catch(()=>[]);
 let memory=[];if(!history.length){const m=await query('channel_memory',{params:`?channel_id=eq.${encodeURIComponent(channelId)}&select=data&limit=1`}).catch(()=>[]);memory=m?.[0]?.data||{}}
 return {channel,history,memory};
}
export async function run(ctx){
 if(!ctx.providers?.llm)throw Object.assign(new Error('LLM provider not configured'),{code:'CONFIGURATION'});
 const {channel,history,memory}=await channelContext(ctx);if(!channel)throw Object.assign(new Error('YouTube channel is required for content generation'),{code:'CHANNEL_REQUIRED'});
 const base={channel,channel_analysis:memory.analysis||memory.summary||memory,existing_shorts:history.filter(x=>x.content_type==='short').slice(0,500).map(x=>({title:x.title,description:x.description,topic:x.topic,recipe_concept:x.recipe_concept,keywords:x.keywords,published_at:x.published_at})),request:ctx.input?.prompt||ctx.input?.topic||'Create a unique 60-second YouTube Short'};
 const max=Number(ctx.input?.max_generation_attempts||ctx.input?.config?.max_generation_attempts||6);let candidate=null;
 const idempotencyKey=ctx.job?.id?`short:${ctx.job.id}`:`short:${createHash('sha256').update(JSON.stringify(base)).digest('hex')}`;
 for(let attempt=1;attempt<=max;attempt++){
  const prompt={task:'unique-short-content-plan',requirements:{duration_seconds:60,avoid_existing_titles:true,avoid_existing_topics:true,avoid_semantically_similar_recipes:true,do_not_reuse_recipe_with_renamed_ingredients:true,return_json:true},context:base,previous_rejection:candidate?.rejection_reason||null};
  const result=parse(await ctx.providers.llm.generate(prompt));
  candidate={topic:clean(result?.topic||result?.concept||result?.title),recipe_concept:clean(result?.recipe_concept||result?.recipe||result?.concept),title:clean(result?.title),description:clean(result?.description),hashtags:Array.isArray(result?.hashtags)?result.hashtags.slice(0,30):[],keywords:Array.isArray(result?.keywords)?result.keywords.slice(0,50):[]};
  const similar=findSimilar(candidate,history,.72);
  if(!candidate.topic||!candidate.title){candidate.rejection_reason='LLM returned incomplete content plan';continue}
  if(!similar){
   const generation=await saveGeneration({channel_id:channel.id,project_id:ctx.job?.project_id||ctx.input?.project_id||null,job_id:ctx.job?.id||null,idempotency_key:idempotencyKey,attempt,status:'accepted',topic:candidate.topic,recipe_concept:candidate.recipe_concept,title:candidate.title,description:candidate.description,hashtags:candidate.hashtags,keywords:candidate.keywords,content_fingerprint:contentFingerprint(candidate),payload:candidate});
   return {...candidate,generation_id:generation?.id||null,unique:true,attempt};
  }
  candidate.rejection_reason=`Similar existing content: ${similar.title||similar.topic||'existing Short'} (${similar.similarity.toFixed(2)})`;
  await saveGeneration({channel_id:channel.id,project_id:ctx.job?.project_id||null,job_id:ctx.job?.id||null,idempotency_key:`${idempotencyKey}:attempt:${attempt}`,attempt,status:'rejected',topic:candidate.topic,recipe_concept:candidate.recipe_concept,title:candidate.title,description:candidate.description,hashtags:candidate.hashtags,keywords:candidate.keywords,content_fingerprint:contentFingerprint(candidate),payload:candidate,rejection_reason:candidate.rejection_reason}).catch(()=>{});
 }
 throw Object.assign(new Error(`Could not generate a sufficiently unique Short after ${max} attempts`),{code:'CONTENT_NOT_UNIQUE'});
}
