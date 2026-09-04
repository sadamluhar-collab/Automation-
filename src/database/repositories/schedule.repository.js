import {query} from '../supabase.js';
import {projects} from './project.repository.js';

const userRow=async userId=>query('users',{params:`?id=eq.${encodeURIComponent(userId)}&select=id,tenant_id`}).then(x=>x[0]||null);
const clean=row=>row?{...row}:null;

async function ownsChannel(channelId,userId,tenantId){
  const rows=await query('channels',{params:`?id=eq.${encodeURIComponent(channelId)}&user_id=eq.${encodeURIComponent(userId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&select=id`});
  return Boolean(rows[0]);
}

async function ownsProject(projectId,userId){return projectId?Boolean(await projects.get(projectId,userId)):true}

export const schedules={
  list:async userId=>{
    const user=await userRow(userId);if(!user)return [];
    return query('schedules',{params:`?user_id=eq.${encodeURIComponent(userId)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=*&order=next_run_at.asc.nullslast,created_at.desc&limit=100`});
  },
  get:async(id,userId)=>{
    const user=await userRow(userId);if(!user)return null;
    const rows=await query('schedules',{params:`?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=*`});
    return clean(rows[0]);
  },
  create:async({userId,name,channelId,projectId,publishAt,timezone='UTC',scheduleType='once',cronExpression,payload={},enabled=true})=>{
    const user=await userRow(userId);if(!user)throw new Error('Workspace user not found');
    if(!channelId||!(await ownsChannel(channelId,userId,user.tenant_id)))throw new Error('Channel not found in your workspace');
    if(projectId&&!(await ownsProject(projectId,userId)))throw new Error('Project not found');
    if(!publishAt)throw new Error('Start date/time is required');
    if(!['once','cron'].includes(scheduleType))throw new Error('Invalid schedule type');
    if(scheduleType==='cron'&&!cronExpression)throw new Error('Cron expression is required');
    const created=await query('schedules',{method:'POST',params:'?select=*',headers:{Prefer:'return=representation'},body:{tenant_id:user.tenant_id,user_id:userId,name:String(name||'Scheduled automation').trim(),channel_id:channelId,project_id:projectId||null,publish_at:publishAt,timezone,schedule_type:scheduleType,cron_expression:cronExpression||null,payload:payload||{},enabled:Boolean(enabled),status:enabled?'active':'paused',next_run_at:publishAt,updated_at:new Date().toISOString()}});
    return clean(created?.[0]);
  },
  update:async({id,userId,...patch})=>{
    const existing=await schedules.get(id,userId);if(!existing)throw new Error('Schedule not found');
    const user=await userRow(userId);
    const next={name:String(patch.name??existing.name).trim(),publish_at:patch.publishAt??existing.publish_at,timezone:patch.timezone??existing.timezone,enabled:patch.enabled??existing.enabled,status:patch.enabled===undefined?existing.status:(patch.enabled?'active':'paused'),schedule_type:patch.scheduleType??existing.schedule_type,cron_expression:patch.cronExpression??existing.cron_expression,payload:patch.payload??existing.payload,project_id:patch.projectId??existing.project_id,channel_id:patch.channelId??existing.channel_id,updated_at:new Date().toISOString()};
    if(!next.name)throw new Error('Schedule name is required');
    if(!['once','cron'].includes(next.schedule_type))throw new Error('Invalid schedule type');
    if(next.schedule_type==='cron'&&!next.cron_expression)throw new Error('Cron expression is required');
    if(!(await ownsChannel(next.channel_id,userId,user.tenant_id)))throw new Error('Channel not found in your workspace');
    if(next.project_id&&!(await ownsProject(next.project_id,userId)))throw new Error('Project not found');
    if(patch.publishAt||patch.scheduleType||patch.cronExpression)next.next_run_at=patch.publishAt||existing.next_run_at;
    const rows=await query('schedules',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=*`,headers:{Prefer:'return=representation'},body:next});
    return clean(rows?.[0]||null);
  },
  remove:async(id,userId)=>{
    const user=await userRow(userId);if(!user)return false;
    const rows=await query('schedules',{method:'DELETE',params:`?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&tenant_id=eq.${encodeURIComponent(user.tenant_id)}&select=id`,headers:{Prefer:'return=representation'}});return Boolean(rows?.length);
  }
};
