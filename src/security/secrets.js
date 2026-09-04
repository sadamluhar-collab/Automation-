export const redact=(obj)=>JSON.parse(JSON.stringify(obj,(k,v)=>/token|secret|key|password/i.test(k)?'[REDACTED]':v));
