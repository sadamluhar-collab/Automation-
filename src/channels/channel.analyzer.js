export function analyzeChannel(channel,videos=[]){
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const stop=new Set(['the','and','for','with','from','this','that','your','you','are','how','what','why','when','where','a','an','to','of','in','on','is','it','my','me','we','our','at','by','as','or']);
  const titles=[...new Set(videos.map(v=>clean(v?.title)).filter(Boolean))];
  const words=new Map();
  for(const title of titles)for(const word of title.toLowerCase().split(/[^a-z0-9]+/))if(word.length>=4&&!stop.has(word))words.set(word,(words.get(word)||0)+1);
  const avg=n=>videos.length?Math.round(videos.reduce((s,v)=>s+Number(v?.[n]||0),0)/videos.length):0;
  const top=[...videos].sort((a,b)=>Number(b?.views||0)-Number(a?.views||0)).slice(0,10);
  return {channel_id:channel?.id||channel?.youtube_channel_id||null,channel_name:clean(channel?.title||channel?.name),sample_size:videos.length,average_views:avg('views'),average_likes:avg('likes'),average_comments:avg('comments'),title_keywords:[...words.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([word,count])=>({word,count})),top_videos:top.map(v=>({id:v.id,title:clean(v.title),views:Number(v.views||0),likes:Number(v.likes||0),comments:Number(v.comments||0),published_at:v.published_at||null,duration_seconds:Number(v.duration_seconds||0)})),topics:titles.slice(0,20),content_rules:{avoid_repeating_titles:true,avoid_repeating_topics:true,use_real_channel_data:true}};
}
