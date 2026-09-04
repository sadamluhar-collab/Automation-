import {query} from '../database/supabase.js';export const reconcile=()=>query('rpc/reconcile_system',{method:'POST',body:{}});
