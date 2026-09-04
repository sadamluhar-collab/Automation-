import {audit} from '../database/repositories/audit.repository.js';export const auditEvent=(x)=>audit.write({...x,created_at:new Date().toISOString()});
