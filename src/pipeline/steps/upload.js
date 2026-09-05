import {upsertContentHistory} from '../../content/content-history.service.js';
export async function run(ctx){
 if(!ctx.providers?.youtube)throw Object.assign(new Error('YouTube provider not configured'),{code:'CONFIGURATION'});
 const plan=ctx.state?.['content-plan']?.result||{};const assembly=ctx.state?.assembly?.result||{};
 const result=await ctx.providers.youtube.upload({...ctx.input,channel_id:ctx.job.channel_id,user_id:ctx.job.user_id,artifact:assembly,title:plan.title,description:plan.description,keywords:plan.keywords,hashtags:plan.hashtags,publish_at:ctx.input?.publish_at||null});
 if(result?.id)await upsertContentHistory(ctx.job.channel_id,[{id:result.id,title:plan.title,description:plan.description,topic:plan.topic,recipe_concept:plan.recipe_concept,keywords:plan.keywords,published_at:new Date().toISOString(),duration_seconds:60}]).catch(()=>{});
 return {youtube_video_id:result?.id||null,video:result};
}
