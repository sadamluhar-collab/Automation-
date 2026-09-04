import {query} from '../database/supabase.js';export async function tick(){return query('rpc/reconcile_schedules',{method:'POST',body:{}})}
