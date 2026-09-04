import {updateJob} from '../queue/queue.service.js';export const checkpoint=(jobId,data)=>updateJob(jobId,{checkpoint:data,updated_at:new Date().toISOString()});
