import {api} from './api.js';export const execute=(command,job_id)=>api('/api/commands',{method:'POST',body:JSON.stringify({command,job_id})});
