import {query} from '../database/supabase.js';
export async function enqueue(job){
 const body={...job,status:'queued'};
 if(body.idempotency_key){const existing=await query('automation_jobs',{params:`?idempotency_key=eq.${encodeURIComponent(body.idempotency_key)}&select=*`});if(existing?.[0])return existing[0]}
 const rows=await query('automation_jobs',{method:'POST',params:'?select=*',body,headers:{Prefer:'return=representation'}});return rows?.[0]||null;
}
export async function getJob(id){const rows=await query('automation_jobs',{params:`?id=eq.${encodeURIComponent(id)}&select=*`});return rows[0]||null}
export async function updateJob(id,patch){return query('automation_jobs',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}`,body:{...patch,updated_at:new Date().toISOString()}})}
