import {query} from '../database/supabase.js';
export async function enqueue(job){const rows=await query('automation_jobs',{method:'POST',params:'?select=*',body:{...job,status:'queued'},headers:{Prefer:'return=representation'}});return rows[0]}
export async function getJob(id){const rows=await query('automation_jobs',{params:`?id=eq.${encodeURIComponent(id)}&select=*`});return rows[0]||null}
export async function updateJob(id,patch){return query('automation_jobs',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}`,body:patch})}
