export class AppError extends Error { constructor(code,message,status=400,details={}) { super(message); this.code=code; this.status=status; this.details=details; } }
export const errorBody=(e,requestId)=>({success:false,error:{code:e.code||'INTERNAL_ERROR',message:e.message||'Internal error',request_id:requestId,retryable:Boolean(e.retryable)}});
