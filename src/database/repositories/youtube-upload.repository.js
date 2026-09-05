import {query} from '../supabase.js';

export const youtubeUploads={
  getByRun:async(runId)=>{const rows=await query('youtube_uploads',{params:`?pipeline_run_id=eq.${encodeURIComponent(runId)}&select=*&limit=1`});return rows?.[0]||null},
  create:async(data)=>{const rows=await query('youtube_uploads',{method:'POST',params:'?select=*',headers:{Prefer:'return=representation'},body:data});return rows?.[0]||null},
  update:async(id,patch)=>{const rows=await query('youtube_uploads',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}&select=*`,headers:{Prefer:'return=representation'},body:{...patch,updated_at:new Date().toISOString()}});return rows?.[0]||null}
};
