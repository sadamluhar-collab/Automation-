import {query} from '../database/supabase.js';export const cleanup=()=>query('rpc/cleanup_expired_artifacts',{method:'POST',body:{}});
