import {dependencies} from '../pipeline/pipeline.dependencies.js';export const graph=(steps)=>Object.fromEntries(steps.map(s=>[s,dependencies(s)]));
