import {youtubeRequest} from '../providers/youtube/youtube.api.js';
import {loadYouTubeCredential} from '../auth/youtube-credential.service.js';
import {analyzeChannel} from './channel.analyzer.js';

const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const durationSeconds=value=>{const m=String(value||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):0};

export async function collectChannelSource(channelId,userId){
  const {channel,accessToken}=await loadYouTubeCredential(channelId,userId);
  const details=await youtubeRequest(accessToken,`channels?part=snippet,contentDetails,statistics,brandingSettings&id=${encodeURIComponent(channel.youtube_channel_id)}`);
  const item=details?.items?.[0];
  if(!item?.id)throw Object.assign(new Error('YouTube channel could not be verified'),{code:'NO_CHANNEL',status:404});
  const playlistId=item.contentDetails?.relatedPlaylists?.uploads;
  let videos=[];
  if(playlistId){
    const page=await youtubeRequest(accessToken,`playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=50`);
    const ids=(page?.items||[]).map(v=>v?.contentDetails?.videoId).filter(Boolean);
    if(ids.length){
      const data=await youtubeRequest(accessToken,`videos?part=snippet,contentDetails,statistics&id=${ids.join(',')}`);
      videos=(data?.items||[]).map(v=>({id:v.id,title:clean(v.snippet?.title),description:clean(v.snippet?.description).slice(0,2000),published_at:v.snippet?.publishedAt||null,duration_seconds:durationSeconds(v.contentDetails?.duration),views:Number(v.statistics?.viewCount||0),likes:Number(v.statistics?.likeCount||0),comments:Number(v.statistics?.commentCount||0),tags:Array.isArray(v.snippet?.tags)?v.snippet.tags.slice(0,30):[]}));
    }
  }
  const channelData={id:item.id,title:clean(item.snippet?.title||channel.name),description:clean(item.snippet?.description||channel.description),handle:item.snippet?.customUrl||channel.youtube_handle||null,subscribers:Number(item.statistics?.subscriberCount||channel.subscribers||0),total_views:Number(item.statistics?.viewCount||channel.total_views||0),video_count:Number(item.statistics?.videoCount||channel.video_count||0),country:item.snippet?.country||channel.country||null,banner:item.brandingSettings?.image?.bannerExternalUrl||channel.banner||null};
  const analysis=analyzeChannel(channelData,videos);
  return {channel:channelData,videos,analysis,summary:{sample_size:videos.length,avg_views:analysis.average_views,avg_likes:analysis.average_likes,avg_comments:analysis.average_comments}};
}
