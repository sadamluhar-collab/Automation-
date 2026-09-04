import {enqueue,getJob} from '../../queue/queue.service.js';export const jobController={create:enqueue,get:getJob};
