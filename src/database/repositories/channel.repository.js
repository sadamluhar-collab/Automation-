import {query} from '../supabase.js';

export const channels={
  list:(user)=>query('channels',{params:`?user_id=eq.${encodeURIComponent(user)}&select=*&order=created_at.asc`}),
  get:(id)=>query('channels',{params:`?id=eq.${encodeURIComponent(id)}&select=*`}).then(x=>x[0]||null),
  user:(id)=>query('users',{params:`?id=eq.${encodeURIComponent(id)}&select=id,tenant_id`}).then(x=>x[0]||null),
  ensureUser:async(id,email='')=>{
    const existing=await channels.user(id);
    if(existing)return existing;
    const tenant=await query('tenants',{method:'POST',params:'?select=*',headers:{Prefer:'return=representation'},body:{name:email?`${email} Workspace`:'YouTube Workspace'}});
    const tenantRow=tenant?.[0];
    if(!tenantRow?.id)throw new Error('Unable to create workspace');
    const created=await query('users',{method:'POST',params:'?select=id,tenant_id',headers:{Prefer:'return=representation'},body:{id,tenant_id:tenantRow.id,role:'owner'}});
    if(created?.[0])return created[0];
    const raced=await channels.user(id);
    if(raced)return raced;
    throw new Error('Unable to create workspace user');
  },
  upsert:async({userId,email,channel,credential})=>{
    const user=await channels.ensureUser(userId,email);
    const row={tenant_id:user.tenant_id,user_id:userId,youtube_channel_id:channel.youtube_channel_id,youtube_handle:channel.youtube_handle||null,name:channel.name||null,description:channel.description||null,profile_image:channel.profile_image||null,banner:channel.banner||null,subscribers:Number(channel.subscribers||0),total_views:Number(channel.total_views||0),video_count:Number(channel.video_count||0),country:channel.country||null,updated_at:new Date().toISOString()};
    const saved=await query('channels',{method:'POST',params:'?on_conflict=youtube_channel_id&select=*',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:row});
    const savedChannel=saved?.[0];
    if(!savedChannel?.id)throw new Error('YouTube channel could not be saved');
    await query('channel_credentials',{method:'POST',params:'?on_conflict=channel_id&select=id',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{channel_id:savedChannel.id,...credential,updated_at:new Date().toISOString()}});
    return savedChannel;
  }
};
