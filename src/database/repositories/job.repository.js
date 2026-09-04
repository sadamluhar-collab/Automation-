import {query} from '../supabase.js';

const owned=async(id,userId)=>{
  const rows=await query('automation_jobs',{params:`?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*`});
  return rows[0]||null;
};

export const jobs={
  create:(x)=>query('automation_jobs',{method:'POST',params:'?select=*',body:x,headers:{Prefer:'return=representation'}}),
  get:(id,userId)=>owned(id,userId),
  list:async(userId,{status,projectId,limit=100}={})=>{
    const filters=[`user_id=eq.${encodeURIComponent(userId)}`];
    if(status)filters.push(`status=eq.${encodeURIComponent(status)}`);
    if(projectId)filters.push(`project_id=eq.${encodeURIComponent(projectId)}`);
    return query('automation_jobs',{params:`?${filters.join('&')}&select=*&order=created_at.desc&limit=${Math.min(Number(limit)||100,200)}`});
  },
  update:async(id,userId,x)=>{
    if(!(await owned(id,userId)))return null;
    return query('automation_jobs',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,body:x,headers:{Prefer:'return=representation'}});
  },
  claim:()=>query('automation_jobs',{params:'?status=eq.queued&order=priority.asc,created_at.asc&limit=1'}).then(x=>x[0]||null)
};
