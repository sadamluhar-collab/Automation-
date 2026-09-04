import {query} from '../supabase.js';
export const artifacts={create:(x)=>query('artifacts',{method:'POST',params:'?select=*',body:x,headers:{Prefer:'return=representation'}}).then(x=>x[0]),list:(project)=>query('artifacts',{params:`?project_id=eq.${encodeURIComponent(project)}&order=created_at.desc`})};
