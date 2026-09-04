import {query} from '../database/supabase.js';export const proposeMemoryUpdate=(channel,data)=>query('channel_memory_versions',{method:'POST',body:{channel_id:channel,data,status:'proposed'}});
