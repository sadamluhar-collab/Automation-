import {commandCenter} from '../../commands/command-center.js';
import {startDirectShort} from '../../pipeline/direct-run.service.js';
import {auditCommand} from '../../commands/command-audit.js';
import {jobs} from '../../database/repositories/job.repository.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function execute(req,res){try{const command=req.body?.command,jobId=req.body?.job_id,before=await jobs.get(jobId,req.user.id);if(!before)return send(res,404,{success:false,error:{code:'JOB_NOT_FOUND',message:'Job not found',request_id:req.requestId}});const data=await commandCenter.execute(command,jobId,req.user.id);await auditCommand({user_id:req.user.id,job_id:jobId,command,new_state:{status:data.status},old_state:{status:before.status},request_id:req.requestId,metadata:{source:'command-center'}});return send(res,200,{success:true,data})}catch(e){console.error('command.execute failed',{code:e.code||'COMMAND_FAILED',message:e.message});return send(res,e.status||400,{success:false,error:{code:e.code||'COMMAND_FAILED',message:e.message,request_id:req.requestId}})}}

export async function runShort(req,res){try{const result=await startDirectShort({userId:req.user.id,projectId:req.body?.project_id,prompt:req.body?.prompt,idempotencyKey:req.body?.idempotency_key,source:'command-api'});return send(res,202,{success:true,status:'queued',data:{job_id:result.job.id,pipeline_run_id:result.pipeline_run_id,project_id:result.project_id,reused:result.reused}})}catch(e){console.error('command.runShort failed',{code:e.code||'COMMAND_FAILED',message:e.message});return send(res,e.status||500,{success:false,error:{code:e.code||'COMMAND_FAILED',message:e.status?e.message:'Short command could not be started',request_id:req.requestId}})}}
