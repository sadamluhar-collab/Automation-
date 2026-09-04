import {broadcast} from './broadcast.js';export const emit=(event,payload)=>broadcast('automation',event,payload);
