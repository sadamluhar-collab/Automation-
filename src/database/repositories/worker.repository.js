import {query} from '../supabase.js';
export const workers={register:(x)=>query('workers',{method:'POST',params:'?select=*',body:x,headers:{Prefer:'return=representation'}}).then(x=>x[0]),heartbeat:(id,x)=>query('workers',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}`,body:{...x,last_heartbeat:new Date().toISOString()}})};
