import {query} from '../database/supabase.js';export const analytics=(channel)=>query('analytics',{params:`?channel_id=eq.${encodeURIComponent(channel)}&order=observed_at.desc`});
