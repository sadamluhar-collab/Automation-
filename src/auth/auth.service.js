import {env} from '../config/env.js';
export async function verifyAccessToken(token){if(!token)throw new Error('Missing access token');const e=env();const r=await fetch(`${e.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:e.SUPABASE_ANON_KEY||e.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Invalid access token');return r.json();}
