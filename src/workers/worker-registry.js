import {query} from '../database/supabase.js';

export async function registerWorker(id) {
  const now = new Date().toISOString();
  const existing = await query('workers', {params: `?id=eq.${encodeURIComponent(id)}&select=id&limit=1`}).catch(() => []);
  if (existing?.[0]) {
    await query('workers', {method:'PATCH', params:`?id=eq.${encodeURIComponent(id)}&select=id`, body:{status:'idle',last_heartbeat:now,current_job_id:null,updated_at:now}});
  } else {
    await query('workers', {method:'POST', params:'?select=id', headers:{Prefer:'return=representation'}, body:{id,status:'idle',last_heartbeat:now,current_job_id:null,updated_at:now}});
  }
  return id;
}

export async function heartbeat(id, currentJobId = null) {
  await query('workers', {
    method:'PATCH',
    params:`?id=eq.${encodeURIComponent(id)}&select=id`,
    body:{status:currentJobId?'busy':'idle',last_heartbeat:new Date().toISOString(),current_job_id:currentJobId,updated_at:new Date().toISOString()}
  });
}
