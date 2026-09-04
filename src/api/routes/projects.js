import {projects} from '../../database/repositories/project.repository.js';

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
    const data=await projects.create({userId:req.user.id,channelId,name,mode});
    send(res,201,{success:true,data});
  }catch(error){
    const status=error.message.includes('not found')||error.message.includes('Workspace')?404:500;
    console.error('projects.create failed',error);
    send(res,status,{success:false,error:{code:status===404?'NOT_FOUND':'DATABASE',message:status===404?error.message:'Project could not be created'}});
  }
}

export async function get(req,res){
  try{
    const data=await projects.get(req.params.id,req.user.id);
    if(!data)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Project not found'}});
    send(res,200,{success:true,data});
  }catch(error){console.error('projects.get failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Database request failed'}})}
}
