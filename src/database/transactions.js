import { query } from './supabase.js';
export async function rpc(name,args){ return query(`rpc/${name}`,{method:'POST',body:args}); }
