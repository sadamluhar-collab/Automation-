import {query} from '../supabase.js';
export const channels={list:(user)=>query('channels',{params:`?user_id=eq.${encodeURIComponent(user)}&select=*`}),get:(id)=>query('channels',{params:`?id=eq.${encodeURIComponent(id)}&select=*`}).then(x=>x[0]||null)};
