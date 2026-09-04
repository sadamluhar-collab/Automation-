import {api} from './api.js';export const loadDashboard=()=>Promise.all([api('/health'),api('/api/workers')]);
