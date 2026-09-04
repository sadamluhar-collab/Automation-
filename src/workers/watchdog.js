import {query} from '../database/supabase.js';export async function watchdog(){return query('rpc/watchdog_workers',{method:'POST',body:{}})}
