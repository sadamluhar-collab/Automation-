import {query} from '../supabase.js';
export const projects={list:(channel)=>query('projects',{params:`?channel_id=eq.${encodeURIComponent(channel)}&select=*`}),get:(id)=>query('projects',{params:`?id=eq.${encodeURIComponent(id)}&select=*`}).then(x=>x[0]||null)};
