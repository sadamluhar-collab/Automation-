import {projects} from '../../database/repositories/project.repository.js';
import {projectStrategy} from '../../database/repositories/project-strategy.repository.js';
import {pipeline} from '../../database/repositories/pipeline.repository.js';
import {enqueue} from '../../queue/queue.service.js';

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
    send(res,status,{success:false,error:{code:status===404?'NOT_FOUND':status===409?'ACTIVE_JOBS':'DELETE_FAILED',message:error.message}});
  }
}

export async function run(req,res){
  try{
    const id=String(req.params.id||'').trim();
    const project=await projects.get(id,req.user.id);
    if(!project)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Project not found'}});
    const strategy=await projectStrategy.get({userId:req.user.id,projectId:project.id});
    const pipelineRun=await pipeline.createRun({userId:req.user.id,projectId:project.id,state:{}});
    try{
      const job=await enqueue({user_id:req.user.id,channel_id:project.channel_id,project_id:project.id,job_type:'pipeline',current_step:'research',input:{project_id:project.id,pipeline_run_id:pipelineRun.id,config:project.config||{},strategy:strategy||null},priority:4,max_retries:3});
      await projects.update({userId:req.user.id,id,status:'running',config:project.config});
      send(res,202,{success:true,data:{project_id:project.id,pipeline_run_id:pipelineRun.id,job}});
    }catch(error){
      await pipeline.updateRun(pipelineRun.id,{status:'failed',current_step:'research',state:{error:error.message}}).catch(()=>{});
      throw error;
    }
  }catch(error){
    console.error('projects.run failed',error);
    send(res,500,{success:false,error:{code:'RUN_FAILED',message:'Project run could not be started'}});
  }
}

export async function get(req,res){
  try{
    const data=await projects.get(req.params.id,req.user.id);
    if(!data)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Project not found'}});
    send(res,200,{success:true,data});
  }catch(error){console.error('projects.get failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Database request failed'}})}
}
