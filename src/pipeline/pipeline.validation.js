import {PIPELINE_STEPS} from '../config/constants.js';export function validateStep(step){if(!PIPELINE_STEPS.includes(step))throw new Error(`Unknown pipeline step: ${step}`);return true}
