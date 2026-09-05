import {query} from '../database/supabase.js';
export async function enqueue(job){
 const body={...job,status:'queued'};
 if(body.idempotency_key){const existing=await query('automation_jobs',{params:`?idempotency_key=eq.${encodeURIComponent(body.idempotency_key)}&select=*`});if(existing?.[0])return existing[0]}
 try{const rows=await query('automation_jobs',{method:'POST',params:'?select=*',body,headers:{Prefer:'return=representation'}});return rows?.[0]||null}catch(error){if(error.status===409&&body.idempotency_key){const existing=await query('automation_jobs',{params:`?idempotency_key=eq.${encodeURIComponent(body.idempotency_key)}&select=*`});if(existing?.[0])return existing[0]}throw error}
}
export async function getJob(id){const rows=await query('automation_jobs',{params:`?id=eq.${encodeURIComponent(id)}&select=*`});return rows[0]||null}
export async function updateJob(id,patch){return query('automation_jobs',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}`,body:{...patch,updated_at:new Date().toISOString()}})}
export async function renewJobLease(id,workerId,seconds=120){const rows=await query('automation_jobs',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}&worker_id=eq.${encodeURIComponent(workerId)}&status=eq.running&select=id,lease_until`,headers:{Prefer:'return=representation'},body:{lease_until:new Date(Date.now()+seconds*1000).toISOString()}});return rows?.[0]||null}
