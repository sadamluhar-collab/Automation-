import {query} from '../supabase.js';
export const faults={create:(x)=>query('faults',{method:'POST',body:x}),list:(channel)=>query('faults',{params:`?channel_id=eq.${encodeURIComponent(channel)}&order=created_at.desc`})};
