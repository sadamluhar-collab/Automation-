import {query} from '../database/supabase.js';

const ownsChannel=async(channelId,userId)=>{
  const rows=await query('channels',{params:`?id=eq.${encodeURIComponent(channelId)}&user_id=eq.${encodeURIComponent(userId)}&select=id`});
  return Boolean(rows[0]);
};

export const analyticsRepository={
  channels:async(userId)=>query('channels',{params:`?user_id=eq.${encodeURIComponent(userId)}&select=id,name,youtube_handle,subscribers,total_views,video_count,country&order=name.asc`}),
  list:async({userId,channelId,projectId,from,to,limit=500}={})=>{
    if(channelId && !(await ownsChannel(channelId,userId)))return null;
    const channels=channelId?[channelId]:(await analyticsRepository.channels(userId)).map(x=>x.id);
    if(!channels.length)return [];
    const filters=[channels.length===1?`channel_id=eq.${encodeURIComponent(channels[0])}`:`channel_id=in.(${channels.map(encodeURIComponent).join(',')})`];
    if(projectId)filters.push(`project_id=eq.${encodeURIComponent(projectId)}`);
    if(from)filters.push(`observed_at=gte.${encodeURIComponent(from)}`);
    if(to)filters.push(`observed_at=lte.${encodeURIComponent(to)}`);
    return query('analytics',{params:`?${filters.join('&')}&select=*&order=observed_at.desc&limit=${Math.min(Math.max(Number(limit)||500,1),1000)}`});
  },
  summary:async({userId,channelId,projectId,from,to}={})=>{
    const rows=await analyticsRepository.list({userId,channelId,projectId,from,to,limit:1000});
    if(rows===null)return null;
    const totals=rows.reduce((a,r)=>({views:a.views+Number(r.views||0),likes:a.likes+Number(r.likes||0),comments:a.comments+Number(r.comments||0),watch_time_seconds:a.watch_time_seconds+Number(r.watch_time_seconds||0)}),{views:0,likes:0,comments:0,watch_time_seconds:0});
    const videos=new Map();
    for(const r of rows){const key=r.youtube_video_id||r.id;const old=videos.get(key)||{youtube_video_id:r.youtube_video_id||null,views:0,likes:0,comments:0,watch_time_seconds:0,observed_at:r.observed_at};videos.set(key,{...old,views:old.views+Number(r.views||0),likes:old.likes+Number(r.likes||0),comments:old.comments+Number(r.comments||0),watch_time_seconds:old.watch_time_seconds+Number(r.watch_time_seconds||0),observed_at:r.observed_at>old.observed_at?r.observed_at:old.observed_at});}
    const daily=new Map();
    for(const r of rows){const day=String(r.observed_at||'').slice(0,10);if(!day)continue;const old=daily.get(day)||{date:day,views:0,likes:0,comments:0,watch_time_seconds:0};daily.set(day,{date:day,views:old.views+Number(r.views||0),likes:old.likes+Number(r.likes||0),comments:old.comments+Number(r.comments||0),watch_time_seconds:old.watch_time_seconds+Number(r.watch_time_seconds||0)});}
    return {...totals,video_count:videos.size,rows_count:rows.length,daily:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),videos:[...videos.values()].sort((a,b)=>b.views-a.views).slice(0,50)};
  }
};
