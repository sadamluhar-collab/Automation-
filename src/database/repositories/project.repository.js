import {query} from '../supabase.js';

const userRow=async userId=>query('users',{params:`?id=eq.${encodeURIComponent(userId)}&select=id,tenant_id`}).then(x=>x[0]||null);

export const projects={
  list:async userId=>{
    const user=await userRow(userId);
    if(!user)return [];
    return query('projects',{params:`?tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=*&order=created_at.desc`});
  },
  get:async(id,userId)=>{
    const user=await userRow(userId);
    if(!user)return null;
    const rows=await query('projects',{params:`?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=*`});
    return rows[0]||null;
  },
  create:async({userId,channelId,name,mode='manual'})=>{
    const user=await userRow(userId);
    if(!user)throw new Error('Workspace user not found');
    const channels=await query('channels',{params:`?id=eq.${encodeURIComponent(channelId)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&user_id=eq.${encodeURIComponent(userId)}&select=id`});
    if(!channels[0])throw new Error('Channel not found in your workspace');
    const created=await query('projects',{method:'POST',params:'?select=*',headers:{Prefer:'return=representation'},body:{tenant_id:user.tenant_id,channel_id:channelId,name,mode,status:'draft'}});
    const project=created?.[0];
    if(!project?.id)throw new Error('Project could not be created');
    await query('project_versions',{method:'POST',params:'?select=id',headers:{Prefer:'return=representation'},body:{project_id:project.id,version:1,data:{name,mode,status:'draft'}}});
    return project;
  }
};
