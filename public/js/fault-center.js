import {api} from './api.js';export const loadFaults=(channel_id)=>api(`/api/faults?channel_id=${encodeURIComponent(channel_id)}`);
