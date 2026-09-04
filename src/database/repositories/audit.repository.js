import {query} from '../supabase.js';
export const audit={write:(x)=>query('audit_logs',{method:'POST',body:x})};
