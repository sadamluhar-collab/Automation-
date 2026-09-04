import {auditEvent} from '../security/audit.js';export const auditCommand=(x)=>auditEvent({event_type:'command',...x});
