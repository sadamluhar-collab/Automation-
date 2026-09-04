import {route} from '../provider-router.js';export const fallback=(primary,secondary)=>(input)=>route('video',primary,secondary,input);
