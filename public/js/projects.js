import {api} from './api.js';export const loadProjects=(channel)=>api(`/api/projects/${channel}`);
