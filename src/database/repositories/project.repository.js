import {query} from '../supabase.js';

const userRow=async userId=>query('users',{params:`?id=eq.${encodeURIComponent(userId)}&select=id,tenant_id`}).then(x=>x[0]||null);

const defaults={topic:'',language:'English',content_type:'YouTube video',duration_minutes:5,tone:'Informative',audience:'General',research_depth:'standard',publish:'manual',schedule:'',pipeline_enabled:true};

const latestVersion=async projectId=>{
  const rows=await query('project_versions',{params:`?project_id=eq.${encodeURIComponent(projectId)}&select=version,data,created_at&order=version.desc&limit=1`});
  return rows[0]||null;
};

const withConfig=async project=>{
  if(!project)return null;
  const version=await latestVersion(project.id);
  return {...project,config:{...defaults,...(version?.data||{}).config},version:version?.version||1,version_created_at:version?.created_at||null};
};

export const projects={
  list:async userId=>{
    const user=await userRow(userId);
    if(!user)return [];
    const rows=await query('projects',{params:`?tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=*&order=created_at.desc`});
    return Promise.all(rows.map(withConfig));
  },
  get:async(id,userId)=>{
    const user=await userRow(userId);
    if(!user)return null;
    const rows=await query('projects',{params:`?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=*`});
    return withConfig(rows[0]||null);
  },
  create:async({userId,channelId,name,mode='manual',config={}})=>{
    const user=await userRow(userId);
    if(!user)throw new Error('Workspace user not found');
    const channels=await query('channels',{params:`?id=eq.${encodeURIComponent(channelId)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&user_id=eq.${encodeURIComponent(userId)}&select=id`});
    if(!channels[0])throw new Error('Channel not found in your workspace');
    const created=await query('projects',{method:'POST',params:'?select=*',headers:{Prefer:'return=representation'},body:{tenant_id:user.tenant_id,channel_id:channelId,name,mode,status:'draft'}});
    const project=created?.[0];
    if(!project?.id)throw new Error('Project could not be created');
    await query('project_versions',{method:'POST',params:'?select=id',headers:{Prefer:'return=representation'},body:{project_id:project.id,version:1,data:{name,mode,status:'draft',config:{...defaults,...config}}}});
    return withConfig(project);
  },
  update:async({userId,id,name,mode,status,config})=>{
    const user=await userRow(userId);
    if(!user)throw new Error('Workspace user not found');
    const existing=await projects.get(id,userId);
    if(!existing)throw new Error('Project not found');
    const nextName=String(name??existing.name).trim();
    const nextMode=mode??existing.mode;
    const nextStatus=status??existing.status;
    if(!nextName)throw new Error('Project name is required');
    if(!['manual','auto'].includes(nextMode))throw new Error('Invalid project mode');
    if(!['draft','ready','running','paused','completed','failed'].includes(nextStatus))throw new Error('Invalid project status');
    const updated=await query('projects',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=*`,headers:{Prefer:'return=representation'},body:{name:nextName,mode:nextMode,status:nextStatus,updated_at:new Date().toISOString()}});
    const version=(existing.version||1)+1;
    await query('project_versions',{method:'POST',params:'?select=id',headers:{Prefer:'return=representation'},body:{project_id:id,version,data:{name:nextName,mode:nextMode,status:nextStatus,config:{...defaults,...(config||existing.config||{})}}}});
    return withConfig(updated?.[0]||null);
  }
};
