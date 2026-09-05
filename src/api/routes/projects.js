import {projects} from '../../database/repositories/project.repository.js';
import {projectStrategy} from '../../database/repositories/project-strategy.repository.js';
import {startDirectShort,getDirectRun} from '../../pipeline/direct-run.service.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function list(req,res){
  try{send(res,200,{success:true,data:await projects.list(req.user.id)})}
  catch(error){console.error('projects.list failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Database request failed'}})}
}

export async function create(req,res){
  try{
    const name=String(req.body?.name||'').trim();
    const channelId=String(req.body?.channel_id||'').trim();
    const mode=String(req.body?.mode||'manual').trim();
    if(!name)return send(res,400,{success:false,error:{code:'VALIDATION',message:'Project name is required'}});
    if(!channelId)return send(res,400,{success:false,error:{code:'VALIDATION',message:'YouTube channel is required'}});
    if(!['manual','auto'].includes(mode))return send(res,400,{success:false,error:{code:'VALIDATION',message:'Invalid project mode'}});
    const data=await projects.create({userId:req.user.id,channelId,name,mode,config:req.body?.config||{}});
    send(res,201,{success:true,data});
  }catch(error){
    const status=error.message.includes('not found')||error.message.includes('Workspace')?404:500;
    console.error('projects.create failed',error);
    send(res,status,{success:false,error:{code:status===404?'NOT_FOUND':'DATABASE',message:status===404?error.message:'Project could not be created'}});
  }
}

export async function update(req,res){
  try{
    const id=String(req.params.id||'').trim();
    const mode=req.body?.mode;
    const status=req.body?.status;
    if(mode!==undefined&&!['manual','auto'].includes(mode))return send(res,400,{success:false,error:{code:'VALIDATION',message:'Invalid project mode'}});
    const data=await projects.update({userId:req.user.id,id,name:req.body?.name,mode,status,config:req.body?.config});
    send(res,200,{success:true,data});
  }catch(error){
    const status=error.message.includes('not found')||error.message.includes('Workspace')?404:400;
    console.error('projects.update failed',error);
    send(res,status,{success:false,error:{code:status===404?'NOT_FOUND':'VALIDATION',message:error.message}});
  }
}

export async function remove(req,res){
  try{
    const id=String(req.params.id||'').trim();
    const data=await projects.remove({userId:req.user.id,id});
    send(res,200,{success:true,data});
  }catch(error){
    const status=error.message==='Project not found'?404:error.message==='Project has active jobs'?409:400;
    console.error('projects.remove failed',error);
    send(res,status,{success:false,error:{code:status===404?'ACTIVE_JOBS':status===409?'ACTIVE_JOBS':'DELETE_FAILED',message:error.message}});
  }
}

export async function run(req,res){
  try{
    const result=await startDirectShort({userId:req.user.id,projectId:req.params.id,prompt:req.body?.prompt,idempotencyKey:req.body?.idempotency_key,source:'project-run'});
    return send(res,202,{success:true,status:'queued',data:{job_id:result.job.id,pipeline_run_id:result.pipeline_run_id,project_id:result.project_id,reused:result.reused}});
  }catch(error){
    console.error('projects.run failed',{code:error.code||'RUN_FAILED',message:error.message});
    return send(res,error.status||500,{success:false,error:{code:error.code||'RUN_FAILED',message:error.status?error.message:'Project run could not be started'}});
  }
}

export async function runStatus(req,res){
  try{
    const run=await getDirectRun({userId:req.user.id,runId:req.params.runId});
    return send(res,200,{success:true,data:{id:run.id,project_id:run.project_id,status:run.status,current_step:run.current_step,progress:run.progress,steps:run.steps,created_at:run.created_at,updated_at:run.updated_at,completed_at:run.completed_at}});
  }catch(error){return send(res,error.status||500,{success:false,error:{code:error.code||'RUN_STATUS_FAILED',message:error.status?error.message:'Run status unavailable'}})}
}

export async function get(req,res){
  try{
    const data=await projects.get(req.params.id,req.user.id);
    if(!data)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Project not found'}});
    send(res,200,{success:true,data});
  }catch(error){console.error('projects.get failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Database request failed'}})}
}
