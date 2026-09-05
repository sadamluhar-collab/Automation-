import {upsertContentHistory} from '../../content/content-history.service.js';
import {logger} from '../../utils/logger.js';
export async function run(ctx){
  if(!ctx.providers?.youtube)throw Object.assign(new Error('YouTube provider not configured'),{code:'CONFIGURATION'});
  const plan=ctx.state?.['content-plan']?.result||{};const assembly=ctx.state?.assembly?.result||{};
  const result=await ctx.providers.youtube.upload({...ctx.input,pipeline_run_id:ctx.job.input?.pipeline_run_id||ctx.input?.pipeline_run_id,channel_id:ctx.job.channel_id,user_id:ctx.job.user_id,project_id:ctx.job.project_id,artifact:assembly,title:plan.title,description:plan.description,keywords:plan.keywords,hashtags:plan.hashtags,publish_at:ctx.input?.publish_at||null});
  if(result?.id){try{await upsertContentHistory(ctx.job.channel_id,[{id:result.id,title:plan.title,description:plan.description,topic:plan.topic,recipe_concept:plan.recipe_concept,keywords:plan.keywords,published_at:new Date().toISOString(),duration_seconds:60}])}catch(error){logger.error('content history persistence failed',{job_id:ctx.job.id,error:error.message})}}
  return {youtube_video_id:result?.id||null,upload_status:result?.already_exists?'already_exists':'completed',video:result};
}
