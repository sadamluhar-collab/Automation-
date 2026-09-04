import {query} from '../supabase.js';

const userRow=async userId=>query('users',{params:`?id=eq.${encodeURIComponent(userId)}&select=id,tenant_id`}).then(x=>x[0]||null);

export const projectStrategy={
  get:async({userId,projectId})=>{
    const user=await userRow(userId);
    if(!user)return null;
    const rows=await query('project_strategy',{params:`?project_id=eq.${encodeURIComponent(projectId)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=*`});
    return rows[0]||null;
  },
  save:async({userId,projectId,channelId,sourceVideoCount,sourceSnapshot,channelAnalysis,contentPlan,provider,model})=>{
    const user=await userRow(userId);
    if(!user)throw new Error('Workspace user not found');
    const rows=await query('project_strategy',{method:'POST',params:'?on_conflict=project_id&select=*',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{tenant_id:user.tenant_id,project_id:projectId,channel_id:channelId,source_video_count:Number(sourceVideoCount||0),source_snapshot:sourceSnapshot||{},channel_analysis:channelAnalysis||{},content_plan:contentPlan||{},provider:provider||null,model:model||null,analyzed_at:new Date().toISOString(),updated_at:new Date().toISOString()}});
    return rows?.[0]||null;
  }
};
