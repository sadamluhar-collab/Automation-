import {api} from './api.js';export const loadJob=(id)=>api(`/api/jobs/${id}`);
