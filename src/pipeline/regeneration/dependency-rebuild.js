import {downstream} from '../pipeline.dependencies.js';export function rebuild(step,state){for(const s of downstream(step))if(state[s])state[s]={...state[s],status:'stale',progress:0};return state}
