import {rebuild} from './dependency-rebuild.js';export function regenerate(step,state){return rebuild(step,{...state,[step]:{...state[step],status:'queued',progress:0}})}
