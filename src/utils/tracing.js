export function traceContext(req){return {request_id:req.requestId,job_id:req.headers['x-job-id']||null,worker_id:req.headers['x-worker-id']||null};}
