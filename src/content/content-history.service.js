import {query} from '../database/supabase.js';
import {normalizeHistoryItem} from './content-uniqueness.js';

export async function listContentHistory(channelId){
  return query('content_history',{params:`?channel_id=eq.${encodeURIComponent(channelId)}&select=*&order=published_at.desc.nullslast,created_at.desc&limit=1000`});
}
export async function upsertContentHistory(channelId,items=[]){
  const rows=items.map(normalizeHistoryItem).filter(x=>x.youtube_video_id).map(x=>({channel_id:channelId,...x,metadata:{source:'youtube_data_api'}}));
  if(!rows.length)return [];
  const saved=await query('content_history',{method:'POST',params:'?on_conflict=channel_id,youtube_video_id&select=*',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:rows});
  return saved||[];
}
export async function saveGeneration(data){
  const rows=await query('short_generations',{method:'POST',params:'?on_conflict=idempotency_key&select=*',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:data});
  return rows?.[0]||null;
}
export async function updateGeneration(id,patch){
  const rows=await query('short_generations',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}&select=*`,headers:{Prefer:'return=representation'},body:{...patch,updated_at:new Date().toISOString()}});return rows?.[0]||null;
}
