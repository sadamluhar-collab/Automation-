import {enqueue,getJob,updateJob} from '../../queue/queue.service.js';
import {jobs} from '../../database/repositories/job.repository.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};
const allowedTransition=(status,next)=>({queued:['cancelled'],retrying:['cancelled'],failed:['queued'],cancelled:[],completed:[],running:['cancelled']}[status]||[]).includes(next);

export async function list(req,res){
  try{const data=await jobs.list(req.user.id,{status:req.query?.status,projectId:req.query?.project_id,limit:req.query?.limit});send(res,200,{success:true,data})}
  catch(error){console.error('jobs.list failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Jobs could not be loaded'}})}
}

export async function create(req,res){
  try{
    const body=req.body||{};
    const job=await enqueue({user_id:req.user.id,channel_id:body.channel_id,project_id:body.project_id,job_type:body.job_type||'pipeline',current_step:body.current_step||'research',input:body.input||{},priority:body.priority??4,max_retries:body.max_retries??3});
    send(res,201,{success:true,data:job});
  }catch(error){console.error('jobs.create failed',error);send(res,400,{success:false,error:{code:error.code||'INVALID_JOB',message:error.message||'Job could not be created'}})}
}

export async function get(req,res){
  try{const job=await jobs.get(req.params.id,req.user.id);if(!job)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Job not found'}});send(res,200,{success:true,data:job})}
  catch(error){console.error('jobs.get failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Job could not be loaded'}})}
}

export async function action(req,res){
  try{
    const id=req.params.id;
    const job=await jobs.get(id,req.user.id);
    if(!job)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Job not found'}});
    const actionName=req.body?.action;
    let next;
    if(actionName==='cancel')next='cancelled';
    else if(actionName==='retry')next='queued';
    else return send(res,400,{success:false,error:{code:'INVALID_ACTION',message:'Action must be retry or cancel'}});
    if(!allowedTransition(job.status,next))return send(res,409,{success:false,error:{code:'INVALID_TRANSITION',message:`Cannot ${actionName} job while status is ${job.status}`}});
    const patch={status:next,error_code:null,error_message:null,worker_id:next==='queued'?null:job.worker_id,lease_until:null};
    if(next==='queued')Object.assign(patch,{next_attempt_at:new Date().toISOString(),started_at:null,completed_at:null});
    const result=await jobs.update(id,req.user.id,patch);
    send(res,200,{success:true,data:{...job,...(Array.isArray(result)&&result[0]?result[0]:patch)}});
  }catch(error){console.error('jobs.action failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Job action failed'}})}
}
