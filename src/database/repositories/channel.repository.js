import {query} from '../supabase.js';

const userRow=async userId=>query('users',{params:`?id=eq.${encodeURIComponent(userId)}&select=id,tenant_id`}).then(x=>x[0]||null);
const ensureMemory=async channelId=>{
  const rows=await query('channel_memory',{params:`?channel_id=eq.${encodeURIComponent(channelId)}&select=id,version,data`});
  if(rows[0])return rows[0];
  const created=await query('channel_memory',{method:'POST',params:'?select=*',headers:{Prefer:'return=representation'},body:{channel_id:channelId,data:{status:'pending',source:'youtube_channel_connect',analysis_status:'pending'},version:1}});
  return created?.[0]||null;
};

export const channels={
  list:async user=>{
    const u=await userRow(user);if(!u)return [];
    return query('channels',{params:`?user_id=eq.${encodeURIComponent(user)}&tenant_id=eq.${encodeURIComponent(u.tenant_id)}&select=*&order=created_at.asc`});
  },
  get:(id)=>query('channels',{params:`?id=eq.${encodeURIComponent(id)}&select=*`}).then(x=>x[0]||null),
  user:userRow,
  ensureUser:async(id,email='')=>{
    const existing=await userRow(id);if(existing)return existing;
    const tenant=await query('tenants',{method:'POST',params:'?select=*',headers:{Prefer:'return=representation'},body:{name:email?`${email} Workspace`:'YouTube Workspace'}});
    const tenantRow=tenant?.[0];if(!tenantRow?.id)throw new Error('Unable to create workspace');
    try{
      const created=await query('users',{method:'POST',params:'?select=id,tenant_id',headers:{Prefer:'return=representation'},body:{id,tenant_id:tenantRow.id,role:'owner'}});
      if(created?.[0])return created[0];
    }catch{}
    const raced=await userRow(id);if(raced)return raced;
    throw new Error('Unable to create workspace user');
  },
  upsert:async({userId,email,channel,credential})=>{
    if(!channel?.youtube_channel_id)throw new Error('YouTube channel id is required');
    const user=await channels.ensureUser(userId,email);
    const existing=await query('channels',{params:`?youtube_channel_id=eq.${encodeURIComponent(channel.youtube_channel_id)}&select=*`}).then(x=>x[0]||null);
    if(existing&&existing.user_id!==userId)throw Object.assign(new Error('YouTube channel is already connected to another workspace'),{code:'DUPLICATE_CHANNEL',status:409});
    const row={tenant_id:user.tenant_id,user_id:userId,youtube_channel_id:channel.youtube_channel_id,youtube_handle:channel.youtube_handle||null,name:channel.name||null,description:channel.description||null,profile_image:channel.profile_image||null,banner:channel.banner||null,subscribers:Number(channel.subscribers||0),total_views:Number(channel.total_views||0),video_count:Number(channel.video_count||0),country:channel.country||null,status:existing?.status||'pending',last_error:null,updated_at:new Date().toISOString()};
    const saved=await query('channels',{method:existing?'PATCH':'POST',params:existing?`?id=eq.${encodeURIComponent(existing.id)}&user_id=eq.${encodeURIComponent(userId)}&select=*`:'?select=*',headers:{Prefer:'return=representation'},body:row});
    const savedChannel=saved?.[0];if(!savedChannel?.id)throw new Error('YouTube channel could not be saved');
    await query('channel_credentials',{method:'POST',params:'?on_conflict=channel_id&select=id',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{channel_id:savedChannel.id,...credential,updated_at:new Date().toISOString()}});
    await ensureMemory(savedChannel.id);
    return savedChannel;
  }
};
