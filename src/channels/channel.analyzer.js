import {youtubeRequest} from '../providers/youtube/youtube.api.js';
import {loadYouTubeCredential} from '../auth/youtube-credential.service.js';

const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const durationSeconds=value=>{const m=String(value||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):0};
const stopWords=new Set(['the','and','for','with','from','this','that','your','you','are','how','what','why','when','a','an','to','of','in','on','is','it','my','me','we','our','at','by']);

export async function collectChannelSource(channelId,userId){
  const {channel,accessToken}=await loadYouTubeCredential(channelId,userId);
  const details=await youtubeRequest(accessToken,`channels?part=snippet,contentDetails,statistics,brandingSettings&id=${encodeURIComponent(channel.youtube_channel_id)}`);
  const item=details?.items?.[0];if(!item?.id)throw Object.assign(new Error('YouTube channel could not be verified'),{code:'NO_CHANNEL',status:404});
  const uploads=item.contentDetails?.relatedPlaylists?.uploads;
  let videos=[];
  if(uploads){
    const page=await youtubeRequest(accessToken,`playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=50`);
    const ids=(page?.items||[]).map(v=>v?.contentDetails?.videoId).filter(Boolean);
    if(ids.length){
      const stats=await youtubeRequest(accessToken,`videos?part=snippet,contentDetails,statistics&id=${ids.join(',')}`);
      videos=(stats?.items||[]).map(v=>({id:v.id,title:clean(v.snippet?.title),description:clean(v.snippet?.description).slice(0,1000),published_at:v.snippet?.publishedAt||null,duration_seconds:durationSeconds(v.contentDetails?.duration),views:Number(v.statistics?.viewCount||0),likes:Number(v.statistics?.likeCount||0),comments:Number(v.statistics?.commentCount||0),tags:Array.isArray(v.snippet?.tags)?v.snippet.tags.slice(0,20):[]}));
    }
  }
  const words=new Map();for(const video of videos){for(const part of video.title.toLowerCase().split(/[^a-z0-9]+/)){if(part.length>=4&&!stopWords.has(part))words.set(part,(words.get(part)||0)+1)}}
  const keywordPatterns=[...words.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([word,count])=>({word,count}));
  const avg=n=>videos.length?Math.round(videos.reduce((s,v)=>s+v[n],0)/videos.length):0;
  const source={channel:{id:item.id,title:item.snippet?.title||channel.name||'',description:item.snippet?.description||channel.description||'',handle:item.snippet?.customUrl||channel.youtube_handle||null,subscribers:Number(item.statistics?.subscriberCount||channel.subscribers||0),total_views:Number(item.statistics?.viewCount||channel.total_views||0),video_count:Number(item.statistics?.videoCount||channel.video_count||0),country:item.snippet?.country||channel.country||null,banner:item.brandingSettings?.image?.bannerExternalUrl||channel.banner||null},videos,summary:{sample_size:videos.length,avg_views:avg('views'),avg_likes:avg('likes'),avg_comments:avg('comments'),top_title_keywords:keywordPatterns}};
  return source;
}

export function buildChannelMemory(source){
  const videos=source.videos||[];const s=source.summary||{};
  const topTitles=[...videos].sort((a,b)=>b.views-a.views).slice(0,10).map(v=>({video_id:v.id,title:v.title,views:v.views,likes:v.likes,comments:v.comments,published_at:v.published_at,duration_seconds:v.duration_seconds}));
  return {status:'analyzed',analysis_status:'complete',source:'youtube_data_api',analyzed_at:new Date().toISOString(),channel:source.channel,sample:{video_count:videos.length,avg_views:s.avg_views||0,avg_likes:s.avg_likes||0,avg_comments:s.avg_comments||0},top_title_keywords:s.top_title_keywords||[],top_videos:topTitles,content_rules:{avoid_repeating_titles:true,avoid_repeating_topics:true,prefer_recent_patterns:true}};
}
