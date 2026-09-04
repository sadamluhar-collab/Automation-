import {query} from '../database/supabase.js';export const recoverWorkers=()=>query('rpc/recover_stale_workers',{method:'POST',body:{}});
