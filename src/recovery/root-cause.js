export const rootCause=(fault)=>fault?.details?.root_cause||fault?.error_message||'Root cause unavailable';
